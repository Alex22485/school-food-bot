const { Markup } = require("telegraf");
const { prepare } = require("../database/db");
const logger = require("../utils/logger");
const escapeHtml = require("escape-html");

// Валидация даты (формат ДД.ММ.ГГГГ)
function validateDate(dateStr) {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    return {
      valid: false,
      error: "❌ Неверный формат даты. Используйте ДД.ММ.ГГГГ",
    };
  }

  const [day, month, year] = dateStr.split(".").map(Number);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { valid: false, error: "❌ Некорректная дата" };
  }

  const selectedDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (selectedDate < tomorrow) {
    return {
      valid: false,
      error: "❌ Меню можно создавать только на завтра и более поздние дни",
    };
  }

  return {
    valid: true,
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    displayDate: dateStr,
  };
}

// Извлечение цены из строки
function extractPrice(text) {
  const priceMatch = text.match(/(\d+)/);
  if (!priceMatch) return null;

  const price = parseInt(priceMatch[1]);

  if (isNaN(price) || price <= 0) return null;
  if (price > 1000) return null;

  return price;
}

// Извлечение названия блюда (все, что до первого числа)
function extractName(text) {
  const match = text.match(/\d+/);
  if (!match) return text.trim();

  const numberIndex = text.indexOf(match[0]);
  let name = text.substring(0, numberIndex).trim();

  if (!name) {
    return null;
  }

  return name;
}

// Парсинг строки блюда
function parseMenuItem(line) {
  line = line.trim();
  if (!line) return null;

  let name = extractName(line);

  if (!name || name.length < 2) {
    return {
      valid: false,
      error: '❌ Не указано название блюда. Формат: "Название Цена"',
    };
  }

  const price = extractPrice(line);
  if (!price) {
    return {
      valid: false,
      error: '❌ Не указана цена. Формат: "Название Цена"',
    };
  }

  return {
    valid: true,
    item: {
      name: escapeHtml(name),
      price: price,
    },
  };
}

// Проверка, что все блюда имеют цену
function validateAllItemsHavePrice(items) {
  const itemsWithoutPrice = items.filter(
    (item) => !item.price || item.price <= 0,
  );
  return {
    valid: itemsWithoutPrice.length === 0,
    itemsWithoutPrice: itemsWithoutPrice,
  };
}

// Показать меню кухни
async function showKitchenMenu(ctx) {
  if (!ctx.state.user) {
    await ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
    return;
  }

  const user = ctx.state.user;

  if (!user.city_id || !user.school_id) {
    await ctx.reply(
      "❌ Ошибка: не указаны город и школа. Пройдите регистрацию заново.",
    );
    return;
  }

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("📅 Создать меню", "kitchen_create_menu")],
    [Markup.button.callback("📋 Мои меню", "kitchen_my_menus")],
    [Markup.button.callback("👤 Профиль", "user_profile")],
  ]);

  await ctx.reply(
    "🍳 **Панель кухни**\n\n" +
      `🏙️ Город: ${getCityName(user.city_id)}\n` +
      `🏫 Школа: ${getSchoolName(user.school_id)}\n\n` +
      "Выберите действие:",
    {
      parse_mode: "Markdown",
      ...keyboard,
    },
  );
}

// Начать создание меню
async function startCreateMenu(ctx) {
  if (!ctx.state.user) {
    await ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
    return;
  }

  ctx.session = ctx.session || {};
  ctx.session.menuCreation = {
    step: "date",
    items: [],
  };

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const exampleDate = tomorrow
    .toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, ".");

  await ctx.reply(
    "📅 **Создание меню**\n\n" +
      "⏰ **Важно:** Меню можно создавать только на завтра и более поздние дни!\n\n" +
      "Введите дату в формате **ДД.ММ.ГГГГ**\n" +
      `Например: ${exampleDate}`,
    { parse_mode: "Markdown" },
  );
}

// Обработка ввода даты
async function handleMenuDate(ctx, dateStr) {
  if (!ctx.state.user) {
    await ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
    return;
  }

  const validation = validateDate(dateStr);

  if (!validation.valid) {
    await ctx.reply(`${validation.error}\n\nПопробуйте еще раз:`);
    return;
  }

  ctx.session.menuCreation.date = validation.date;
  ctx.session.menuCreation.displayDate = validation.displayDate;
  ctx.session.menuCreation.step = "items";

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("✅ Завершить и сохранить", "kitchen_finish")],
    [Markup.button.callback("❌ Отменить", "kitchen_cancel")],
  ]);

  await ctx.reply(
    `✅ Дата установлена: **${validation.displayDate}**\n\n` +
      "📝 **Введите блюда**\n\n" +
      "Каждое блюдо с **новой строки** в формате:\n" +
      "`Название Цена`\n\n" +
      "**Примеры:**\n" +
      "Пицца 350\n" +
      "Кофе 50\n" +
      "Котлета 85\n" +
      "Чай 25\n" +
      "Комплексный обед 320\n\n" +
      "**Важно:** Название должно быть перед ценой!\n" +
      "✅ Правильно: Молоко 17\n" +
      "❌ Неправильно: 17 молоко\n\n" +
      "Цену можно указывать с валютой или без, бот поймет\n" +
      "⚠️ **У каждого блюда должна быть указана цена!**\n" +
      "👇 **После ввода всех блюд нажмите кнопку ниже** 👇",
    {
      parse_mode: "Markdown",
      ...keyboard,
    },
  );
}

// Обработка ввода блюда
async function handleMenuItem(ctx, line) {
  if (!ctx.state.user) {
    await ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
    return;
  }

  const menuCreation = ctx.session.menuCreation;
  if (!menuCreation || menuCreation.step !== "items") return;

  const lines = line.split("\n").filter((l) => l.trim() !== "");

  let addedCount = 0;
  let errors = [];

  for (const singleLine of lines) {
    const parsed = parseMenuItem(singleLine);

    if (!parsed.valid) {
      errors.push(`❌ "${singleLine}" — ${parsed.error}`);
      continue;
    }

    menuCreation.items.push(parsed.item);
    addedCount++;
  }

  let responseText = "";

  if (addedCount > 0) {
    responseText += `✅ **Добавлено блюд:** ${addedCount}\n`;
    responseText += `📋 **Всего в меню:** ${menuCreation.items.length}\n\n`;

    const lastItems = menuCreation.items.slice(-addedCount);
    responseText += `**Последние добавленные:**\n`;
    lastItems.forEach((item, idx) => {
      responseText += `${idx + 1}. **${item.name}** — ${item.price}₽\n`;
    });
  }

  if (errors.length > 0) {
    responseText += `\n${errors.join("\n")}`;
  }

  responseText += `\n\n👉 **Когда все блюда добавлены, нажмите кнопку «Завершить и сохранить» выше** 👈`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("✅ Завершить и сохранить", "kitchen_finish")],
    [Markup.button.callback("❌ Отменить", "kitchen_cancel")],
  ]);

  await ctx.reply(responseText, {
    parse_mode: "Markdown",
    ...keyboard,
  });
}

// Завершение создания меню
async function finishMenuCreation(ctx) {
  if (!ctx.state.user) {
    await ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
    return;
  }

  const menuCreation = ctx.session.menuCreation;
  const user = ctx.state.user;

  if (!menuCreation || menuCreation.items.length === 0) {
    await ctx.reply("❌ Не добавлено ни одного блюда. Создание отменено.");
    ctx.session.menuCreation = null;
    await showKitchenMenu(ctx);
    return;
  }

  const priceValidation = validateAllItemsHavePrice(menuCreation.items);
  if (!priceValidation.valid) {
    const itemsList = priceValidation.itemsWithoutPrice
      .map((item) => `• ${item.name}`)
      .join("\n");

    await ctx.reply(
      `❌ **Ошибка: не у всех блюд указана цена**\n\n` +
        `Следующие блюда без цены:\n${itemsList}\n\n` +
        `Пожалуйста, добавьте цену для этих блюд или удалите их.`,
      { parse_mode: "Markdown" },
    );
    return;
  }

  try {
    const existing = prepare(`
      SELECT id FROM menus 
      WHERE school_id = ? AND date = ?
    `).get(user.school_id, menuCreation.date);

    if (existing) {
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("✅ Да, заменить", "kitchen_replace_menu")],
        [Markup.button.callback("❌ Нет, отменить", "kitchen_cancel")],
      ]);

      ctx.session.menuCreation.pendingReplace = true;

      await ctx.reply(
        "⚠️ **Меню на эту дату уже существует**\n\n" +
          "Заменить существующее меню?",
        {
          parse_mode: "Markdown",
          ...keyboard,
        },
      );
      return;
    }

    await saveMenu(ctx, menuCreation, user);
  } catch (error) {
    logger.error("Error in finishMenuCreation:", error);
    await ctx.reply("❌ Ошибка при сохранении меню");
  }
}

// Сохранение меню в БД
async function saveMenu(ctx, menuCreation, user) {
  try {
    const itemsJson = JSON.stringify(menuCreation.items);

    const insert = prepare(`
      INSERT INTO menus (city_id, school_id, date, items, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      user.city_id,
      user.school_id,
      menuCreation.date,
      itemsJson,
      user.id,
    );

    logger.info("Menu created", {
      menuId: result.lastInsertRowid,
      schoolId: user.school_id,
      date: menuCreation.date,
      itemsCount: menuCreation.items.length,
    });

    let menuText = `✅ **Меню на ${menuCreation.displayDate} успешно создано!**\n\n`;
    menuText += `🏙️ **Город:** ${getCityName(user.city_id)}\n`;
    menuText += `🏫 **Школа:** ${getSchoolName(user.school_id)}\n\n`;
    menuText += `**Блюда:**\n`;

    menuCreation.items.forEach((item, index) => {
      menuText += `${index + 1}. **${item.name}** — ${item.price}₽\n`;
    });

    await ctx.reply(menuText, { parse_mode: "Markdown" });

    ctx.session.menuCreation = null;
    await showKitchenMenu(ctx);
  } catch (error) {
    logger.error("Error in saveMenu:", error);
    await ctx.reply("❌ Ошибка при сохранении меню в базу данных");
  }
}

// Замена существующего меню
async function replaceMenu(ctx) {
  if (!ctx.state.user) {
    await ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
    return;
  }

  const menuCreation = ctx.session.menuCreation;
  const user = ctx.state.user;

  try {
    prepare(`
      DELETE FROM menus 
      WHERE school_id = ? AND date = ?
    `).run(user.school_id, menuCreation.date);

    await saveMenu(ctx, menuCreation, user);
  } catch (error) {
    logger.error("Error in replaceMenu:", error);
    await ctx.reply("❌ Ошибка при замене меню");
  }
}

// Показать список меню
async function showMyMenus(ctx) {
  if (!ctx.state.user) {
    await ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
    return;
  }

  const user = ctx.state.user;

  try {
    const menus = prepare(`
      SELECT id, date, items, created_at
      FROM menus
      WHERE school_id = ?
      ORDER BY date DESC
      LIMIT 10
    `).all(user.school_id);

    if (menus.length === 0) {
      await ctx.reply("📭 У вас пока нет созданных меню.");
      return;
    }

    let text = "📋 **Ваши меню**\n\n";

    // Создаем кнопки для каждого меню
    const buttons = [];
    menus.forEach((menu) => {
      const dateStr = menu.date.split("-").reverse().join(".");
      const items = JSON.parse(menu.items);
      buttons.push([
        Markup.button.callback(
          `${dateStr} (${items.length} блюд)`,
          `kitchen_view_menu_${menu.id}`,
        ),
      ]);
    });

    buttons.push([Markup.button.callback("🔙 Назад", "kitchen_back")]);

    const keyboard = Markup.inlineKeyboard(buttons);

    await ctx.reply(text, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    logger.error("Error in showMyMenus:", error);
    await ctx.reply("❌ Ошибка при загрузке меню");
  }
}

// Показать конкретное меню
async function showMenuDetails(ctx, menuId) {
  if (!ctx.state.user) {
    await ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
    return;
  }

  try {
    const menu = prepare(`
      SELECT m.*, c.name as city_name, s.name as school_name
      FROM menus m
      JOIN cities c ON m.city_id = c.id
      JOIN schools s ON m.school_id = s.id
      WHERE m.id = ?
    `).get(menuId);

    if (!menu) {
      await ctx.reply("❌ Меню не найдено");
      return;
    }

    const items = JSON.parse(menu.items);
    const dateStr = menu.date.split("-").reverse().join(".");

    let text = `📅 **Меню на ${dateStr}**\n\n`;
    text += `🏙️ **Город:** ${menu.city_name}\n`;
    text += `🏫 **Школа:** ${menu.school_name}\n\n`;
    text += `**Блюда:**\n`;

    items.forEach((item, index) => {
      text += `${index + 1}. **${item.name}** — ${item.price}₽\n`;
    });

    text += `\n📝 Создано: ${new Date(menu.created_at).toLocaleString("ru-RU")}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Назад к списку", "kitchen_my_menus")],
    ]);

    await ctx.reply(text, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    logger.error("Error in showMenuDetails:", error);
    await ctx.reply("❌ Ошибка при загрузке меню");
  }
}

// Вспомогательные функции
function getCityName(cityId) {
  try {
    const city = prepare("SELECT name FROM cities WHERE id = ?").get(cityId);
    return city ? city.name : "Неизвестный город";
  } catch {
    return "Неизвестный город";
  }
}

function getSchoolName(schoolId) {
  try {
    const school = prepare("SELECT name FROM schools WHERE id = ?").get(
      schoolId,
    );
    return school ? school.name : "Неизвестная школа";
  } catch {
    return "Неизвестная школа";
  }
}

module.exports = {
  showKitchenMenu,
  startCreateMenu,
  handleMenuDate,
  handleMenuItem,
  finishMenuCreation,
  replaceMenu,
  showMyMenus,
  showMenuDetails,
};
