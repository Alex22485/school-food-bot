const { Markup } = require("telegraf");
const { prepare } = require("../database/db");
const logger = require("../utils/logger");
const escapeHtml = require("escape-html");

// Показать главную админ-панель
async function showAdminPanel(ctx) {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("👥 Управление пользователями", "admin_users")],
    [Markup.button.callback("🍳 Управление кухней", "admin_kitchen")],
    [Markup.button.callback("🏙️ Управление городами", "admin_cities")],
    [Markup.button.callback("🏫 Управление школами", "admin_schools")],
    [Markup.button.callback("📊 Статистика", "admin_stats")],
  ]);

  await ctx.reply("👑 **Панель администратора**\n\nВыберите раздел:", {
    parse_mode: "Markdown",
    ...keyboard,
  });
}

// === УПРАВЛЕНИЕ КУХНЕЙ ===

// Показать список сотрудников кухни
async function showKitchenStaff(ctx) {
  try {
    const staff = prepare(`
      SELECT u.id, u.telegram_id, u.is_active, 
             c.name as city_name, s.name as school_name,
             u.created_at
      FROM users u
      LEFT JOIN cities c ON u.city_id = c.id
      LEFT JOIN schools s ON u.school_id = s.id
      WHERE u.role = 'kitchen'
      ORDER BY u.created_at DESC
    `).all();

    let text = "🍳 **Сотрудники кухни**\n\n";

    if (staff.length === 0) {
      text += "Пока нет зарегистрированных сотрудников кухни.";
    } else {
      staff.forEach((person, index) => {
        text += `${index + 1}. **ID:** ${person.id}\n`;
        text += `   📱 Telegram: ${person.telegram_id}\n`;
        text += `   🏙️ Город: ${person.city_name || "Не указан"}\n`;
        text += `   🏫 Школа: ${person.school_name || "Не указана"}\n`;
        text += `   ✅ Статус: ${person.is_active ? "Активен" : "Заблокирован"}\n`;
        text += `   📅 Зарегистрирован: ${new Date(person.created_at).toLocaleDateString("ru-RU")}\n\n`;
      });
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("➕ Добавить кухню", "admin_add_kitchen")],
      [Markup.button.callback("🔁 Заменить кухню", "admin_replace_kitchen")],
      [Markup.button.callback("❌ Удалить кухню", "admin_remove_kitchen")],
      [Markup.button.callback("🔙 Назад", "admin_back")],
    ]);

    await ctx.reply(text, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    logger.error("Error in showKitchenStaff:", error);
    ctx.reply("❌ Ошибка при загрузке списка кухни");
  }
}

// Начать процесс добавления сотрудника кухни
async function startAddKitchen(ctx) {
  try {
    const schools = prepare(`
      SELECT s.id, s.name, c.name as city_name 
      FROM schools s
      JOIN cities c ON s.city_id = c.id
      ORDER BY c.name, s.name
    `).all();

    if (schools.length === 0) {
      return ctx.reply("❌ Сначала добавьте школы!");
    }

    // Проверяем, какие школы уже имеют кухню
    const schoolsWithKitchen = prepare(`
      SELECT school_id FROM users WHERE role = 'kitchen'
    `).all();

    const kitchenSchoolIds = schoolsWithKitchen.map((k) => k.school_id);

    // Фильтруем школы без кухни
    const availableSchools = schools.filter(
      (s) => !kitchenSchoolIds.includes(s.id),
    );

    if (availableSchools.length === 0) {
      return ctx.reply("❌ Во всех школах уже есть сотрудники кухни!");
    }

    ctx.session = ctx.session || {};
    ctx.session.adminAction = "add_kitchen";

    const buttons = availableSchools.map((school) =>
      Markup.button.callback(
        `${school.city_name} - ${school.name}`,
        `admin_select_school_${school.id}`,
      ),
    );

    const keyboard = [];
    for (let i = 0; i < buttons.length; i += 1) {
      keyboard.push([buttons[i]]);
    }
    keyboard.push([Markup.button.callback("🔙 Отмена", "admin_kitchen")]);

    await ctx.reply(
      "🍳 **Добавление сотрудника кухни**\n\n" +
        "Выберите школу, для которой нужно добавить кухню:\n\n" +
        "_Будут показаны только школы, в которых еще нет кухни._",
      Markup.inlineKeyboard(keyboard),
    );
  } catch (error) {
    logger.error("Error in startAddKitchen:", error);
    ctx.reply("❌ Ошибка");
  }
}

// Обработка выбора школы для добавления кухни
async function handleAddKitchenSchool(ctx, schoolId) {
  try {
    const school = prepare(`
      SELECT s.name, c.name as city_name 
      FROM schools s
      JOIN cities c ON s.city_id = c.id
      WHERE s.id = ?
    `).get(schoolId);

    ctx.session = ctx.session || {};
    ctx.session.adminAction = "add_kitchen_telegram";
    ctx.session.adminSchoolId = schoolId;
    ctx.session.adminSchoolName = `${school.city_name} - ${school.name}`;

    await ctx.reply(
      `🏫 **Школа:** ${ctx.session.adminSchoolName}\n\n` +
        "📱 **Введите Telegram ID сотрудника кухни**\n\n" +
        "Как узнать ID:\n" +
        "1. Попросите сотрудника написать @userinfobot\n" +
        "2. Он пришлет свой ID (число)\n" +
        "3. Отправьте это число сюда",
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Отмена", "admin_kitchen")],
      ]),
    );
  } catch (error) {
    logger.error("Error in handleAddKitchenSchool:", error);
    ctx.reply("❌ Ошибка");
  }
}

// Обработка ввода Telegram ID для нового сотрудника кухни
async function handleAddKitchenTelegram(ctx, telegramId) {
  try {
    const schoolId = ctx.session.adminSchoolId;
    const schoolName = ctx.session.adminSchoolName;

    // Проверяем, не занята ли уже школа
    const existing = prepare(`
      SELECT id FROM users 
      WHERE role = 'kitchen' AND school_id = ?
    `).get(schoolId);

    if (existing) {
      return ctx.reply("❌ Для этой школы уже есть сотрудник кухни!");
    }

    // Проверяем, не зарегистрирован ли уже этот пользователь
    const userExists = prepare(
      `SELECT id FROM users WHERE telegram_id = ?`,
    ).get(telegramId);

    let result;

    if (userExists) {
      // Если пользователь уже есть, обновляем его роль
      result = prepare(`
        UPDATE users 
        SET role = 'kitchen', city_id = (SELECT city_id FROM schools WHERE id = ?), 
            school_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE telegram_id = ?
      `).run(schoolId, schoolId, telegramId);

      logger.info("Existing user updated to kitchen", { telegramId, schoolId });
    } else {
      // Создаем нового пользователя
      const cityId = prepare(`SELECT city_id FROM schools WHERE id = ?`).get(
        schoolId,
      ).city_id;

      result = prepare(`
        INSERT INTO users (telegram_id, role, city_id, school_id, is_active, created_at, updated_at)
        VALUES (?, 'kitchen', ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(telegramId, cityId, schoolId);

      logger.info("New kitchen user created", { telegramId, schoolId });
    }

    await ctx.reply(
      `✅ **Сотрудник кухни успешно добавлен!**\n\n` +
        `🏫 Школа: ${schoolName}\n` +
        `📱 Telegram ID: ${telegramId}\n\n` +
        `Теперь этот пользователь может войти в бот и будет иметь права кухни.`,
    );

    // Очищаем сессию
    ctx.session.adminAction = null;
    ctx.session.adminSchoolId = null;
    ctx.session.adminSchoolName = null;

    // Показываем обновленный список
    await showKitchenStaff(ctx);
  } catch (error) {
    logger.error("Error in handleAddKitchenTelegram:", error);
    ctx.reply("❌ Ошибка при добавлении сотрудника кухни");
  }
}

// Начать процесс замены сотрудника кухни
async function startReplaceKitchen(ctx) {
  try {
    const staff = prepare(`
      SELECT u.id, u.telegram_id, s.name as school_name, c.name as city_name
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.id
      LEFT JOIN cities c ON u.city_id = c.id
      WHERE u.role = 'kitchen'
    `).all();

    if (staff.length === 0) {
      return ctx.reply("❌ Нет сотрудников кухни для замены");
    }

    ctx.session = ctx.session || {};
    ctx.session.adminAction = "replace_kitchen_select";

    const buttons = staff.map((person) =>
      Markup.button.callback(
        `${person.city_name || "?"} - ${person.school_name || "?"} (ID: ${person.telegram_id})`,
        `admin_replace_select_${person.id}`,
      ),
    );

    const keyboard = [];
    buttons.forEach((button) => keyboard.push([button]));
    keyboard.push([Markup.button.callback("🔙 Отмена", "admin_kitchen")]);

    await ctx.reply(
      "🔄 **Замена сотрудника кухни**\n\n" + "Выберите, кого нужно заменить:",
      Markup.inlineKeyboard(keyboard),
    );
  } catch (error) {
    logger.error("Error in startReplaceKitchen:", error);
    ctx.reply("❌ Ошибка");
  }
}

// Обработка выбора сотрудника для замены
async function handleReplaceKitchen(ctx, userId) {
  ctx.session = ctx.session || {};
  ctx.session.adminAction = "replace_kitchen_new";
  ctx.session.adminOldUserId = userId;

  await ctx.reply(
    "🔄 **Введите Telegram ID нового сотрудника**\n\n" +
      "Новый сотрудник получит все права кухни для этой школы.",
    Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Отмена", "admin_kitchen")],
    ]),
  );
}

// Обработка ввода нового Telegram ID для замены
async function handleReplaceKitchenNew(ctx, newTelegramId) {
  try {
    const oldUserId = ctx.session.adminOldUserId;

    // Получаем данные старого сотрудника
    const oldUser = prepare(`
      SELECT school_id, city_id FROM users WHERE id = ?
    `).get(oldUserId);

    if (!oldUser) {
      return ctx.reply("❌ Старый сотрудник не найден");
    }

    // Проверяем, не занят ли уже новый пользователь
    const existingNew = prepare(
      `SELECT id FROM users WHERE telegram_id = ?`,
    ).get(newTelegramId);

    if (existingNew) {
      // Если новый пользователь уже есть, обновляем его роль
      prepare(`
        UPDATE users 
        SET role = 'kitchen', school_id = ?, city_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE telegram_id = ?
      `).run(oldUser.school_id, oldUser.city_id, newTelegramId);
    } else {
      // Создаем нового пользователя
      prepare(`
        INSERT INTO users (telegram_id, role, city_id, school_id, is_active, created_at, updated_at)
        VALUES (?, 'kitchen', ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(newTelegramId, oldUser.city_id, oldUser.school_id);
    }

    // Удаляем или деактивируем старого сотрудника
    prepare(
      `UPDATE users SET role = 'user', school_id = NULL WHERE id = ?`,
    ).run(oldUserId);

    logger.info("Kitchen staff replaced", { oldUserId, newTelegramId });

    await ctx.reply(
      `✅ **Сотрудник кухни успешно заменен!**\n\n` +
        `Новый сотрудник с ID ${newTelegramId} теперь имеет права кухни.`,
    );

    ctx.session.adminAction = null;
    ctx.session.adminOldUserId = null;

    await showKitchenStaff(ctx);
  } catch (error) {
    logger.error("Error in handleReplaceKitchenNew:", error);
    ctx.reply("❌ Ошибка при замене сотрудника");
  }
}

// Начать процесс удаления сотрудника кухни
async function startRemoveKitchen(ctx) {
  try {
    const staff = prepare(`
      SELECT u.id, u.telegram_id, s.name as school_name, c.name as city_name
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.id
      LEFT JOIN cities c ON u.city_id = c.id
      WHERE u.role = 'kitchen'
    `).all();

    if (staff.length === 0) {
      return ctx.reply("❌ Нет сотрудников кухни для удаления");
    }

    const buttons = staff.map((person) =>
      Markup.button.callback(
        `${person.city_name || "?"} - ${person.school_name || "?"} (ID: ${person.telegram_id})`,
        `admin_remove_select_${person.id}`,
      ),
    );

    const keyboard = [];
    buttons.forEach((button) => keyboard.push([button]));
    keyboard.push([Markup.button.callback("🔙 Отмена", "admin_kitchen")]);

    await ctx.reply(
      "❌ **Удаление сотрудника кухни**\n\n" + "Выберите, кого нужно удалить:",
      Markup.inlineKeyboard(keyboard),
    );
  } catch (error) {
    logger.error("Error in startRemoveKitchen:", error);
    ctx.reply("❌ Ошибка");
  }
}

// Обработка удаления сотрудника
async function handleRemoveKitchen(ctx, userId) {
  try {
    const user = prepare(`
      SELECT telegram_id, school_id FROM users WHERE id = ?
    `).get(userId);

    if (!user) {
      return ctx.reply("❌ Пользователь не найден");
    }

    // Вместо полного удаления деактивируем и меняем роль
    prepare(`
      UPDATE users 
      SET role = 'user', school_id = NULL, is_active = 0 
      WHERE id = ?
    `).run(userId);

    logger.info("Kitchen staff removed", {
      userId,
      telegramId: user.telegram_id,
    });

    await ctx.reply(
      `✅ **Сотрудник кухни удален**\n\n` +
        `Пользователь с ID ${user.telegram_id} больше не имеет прав кухни.`,
    );

    await showKitchenStaff(ctx);
  } catch (error) {
    logger.error("Error in handleRemoveKitchen:", error);
    ctx.reply("❌ Ошибка при удалении");
  }
}

// === УПРАВЛЕНИЕ ГОРОДАМИ ===

async function showCities(ctx) {
  try {
    const cities = prepare("SELECT id, name FROM cities ORDER BY name").all();

    let text = "🏙️ **Список городов**\n\n";

    if (cities.length === 0) {
      text += "Городов пока нет.";
    } else {
      cities.forEach((city, index) => {
        text += `${index + 1}. ${city.name} (ID: ${city.id})\n`;
      });
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("➕ Добавить город", "admin_add_city")],
      [Markup.button.callback("🔙 Назад", "admin_back")],
    ]);

    await ctx.reply(text, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    logger.error("Error in showCities:", error);
    ctx.reply("❌ Ошибка при загрузке городов");
  }
}

async function startAddCity(ctx) {
  ctx.session = ctx.session || {};
  ctx.session.adminAction = "add_city";

  await ctx.reply("🏙️ **Добавление города**\n\n" + "Введите название города:", {
    parse_mode: "Markdown",
  });
}

async function handleAddCity(ctx, cityName) {
  try {
    const insert = prepare(
      "INSERT INTO cities (name, created_by) VALUES (?, ?)",
    );
    const result = insert.run(cityName, ctx.state.user.id);

    logger.info("City added", { cityId: result.lastInsertRowid, cityName });

    await ctx.reply(`✅ Город **${cityName}** успешно добавлен!`, {
      parse_mode: "Markdown",
    });

    await showCities(ctx);
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      ctx.reply(`❌ Город **${cityName}** уже существует!`, {
        parse_mode: "Markdown",
      });
    } else {
      logger.error("Error in handleAddCity:", error);
      ctx.reply("❌ Ошибка при добавлении города");
    }
  }
}

// === УПРАВЛЕНИЕ ШКОЛАМИ ===

async function showSchools(ctx) {
  try {
    const schools = prepare(`
      SELECT s.id, s.name, c.name as city_name 
      FROM schools s
      JOIN cities c ON s.city_id = c.id
      ORDER BY c.name, s.name
    `).all();

    let text = "🏫 **Список школ**\n\n";

    if (schools.length === 0) {
      text += "Школ пока нет.";
    } else {
      schools.forEach((school, index) => {
        text += `${index + 1}. ${school.name} (${school.city_name})\n`;
      });
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("➕ Добавить школу", "admin_add_school")],
      [Markup.button.callback("🔙 Назад", "admin_back")],
    ]);

    await ctx.reply(text, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    logger.error("Error in showSchools:", error);
    ctx.reply("❌ Ошибка при загрузке школ");
  }
}

async function startAddSchool(ctx) {
  try {
    const cities = prepare("SELECT id, name FROM cities ORDER BY name").all();

    if (cities.length === 0) {
      return ctx.reply("❌ Сначала добавьте город!");
    }

    ctx.session = ctx.session || {};
    ctx.session.adminAction = "add_school";

    const buttons = cities.map((city) =>
      Markup.button.callback(city.name, `admin_select_city_${city.id}`),
    );

    const keyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      keyboard.push(buttons.slice(i, i + 2));
    }
    keyboard.push([Markup.button.callback("🔙 Отмена", "admin_back")]);

    await ctx.reply(
      "🏫 **Добавление школы**\n\n" + "Выберите город:",
      Markup.inlineKeyboard(keyboard),
    );
  } catch (error) {
    logger.error("Error in startAddSchool:", error);
    ctx.reply("❌ Ошибка");
  }
}

async function handleAddSchool(ctx, cityId, schoolName) {
  try {
    const insert = prepare(
      "INSERT INTO schools (name, city_id, created_by) VALUES (?, ?, ?)",
    );
    const result = insert.run(schoolName, cityId, ctx.state.user.id);

    logger.info("School added", {
      schoolId: result.lastInsertRowid,
      schoolName,
    });

    await ctx.reply(`✅ Школа **${schoolName}** успешно добавлена!`, {
      parse_mode: "Markdown",
    });

    await showSchools(ctx);
  } catch (error) {
    logger.error("Error in handleAddSchool:", error);
    ctx.reply("❌ Ошибка при добавлении школы");
  }
}

// === УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ===

async function showUsers(ctx) {
  try {
    const users = prepare(`
      SELECT id, telegram_id, role, city_id, school_id, class_name, child_name, is_active
      FROM users
      ORDER BY id DESC
      LIMIT 20
    `).all();

    let text = "👥 **Последние пользователи**\n\n";

    if (users.length === 0) {
      text += "Пользователей пока нет.";
    } else {
      users.forEach((user) => {
        text += `🆔 ${user.id} | 📱 ${user.telegram_id} | ${getRoleName(user.role)} | ${user.is_active ? "✅" : "❌"}\n`;
      });
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Назад", "admin_back")],
    ]);

    await ctx.reply(text, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    logger.error("Error in showUsers:", error);
    ctx.reply("❌ Ошибка при загрузке пользователей");
  }
}

// === СТАТИСТИКА ===

async function showStats(ctx) {
  try {
    const totalUsers = prepare("SELECT COUNT(*) as count FROM users").get();
    const totalParents = prepare(
      "SELECT COUNT(*) as count FROM users WHERE role = 'parent'",
    ).get();
    const totalTeachers = prepare(
      "SELECT COUNT(*) as count FROM users WHERE role = 'class_teacher'",
    ).get();
    const totalKitchen = prepare(
      "SELECT COUNT(*) as count FROM users WHERE role = 'kitchen'",
    ).get();
    const totalCities = prepare("SELECT COUNT(*) as count FROM cities").get();
    const totalSchools = prepare("SELECT COUNT(*) as count FROM schools").get();

    const text =
      "📊 **Статистика**\n\n" +
      `👥 Всего пользователей: ${totalUsers.count}\n` +
      `👪 Родителей/Учеников: ${totalParents.count}\n` +
      `🍎 Учителей: ${totalTeachers.count}\n` +
      `🍳 Сотрудников кухни: ${totalKitchen.count}\n` +
      `🏙️ Городов: ${totalCities.count}\n` +
      `🏫 Школ: ${totalSchools.count}\n`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Назад", "admin_back")],
    ]);

    await ctx.reply(text, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    logger.error("Error in showStats:", error);
    ctx.reply("❌ Ошибка при загрузке статистики");
  }
}

// Вспомогательная функция
function getRoleName(role) {
  const roles = {
    parent: "👪 Родитель/Ученик",
    class_teacher: "🍎 Учитель",
    kitchen: "🍳 Кухня",
    admin: "👑 Админ",
    user: "👤 Пользователь",
  };
  return roles[role] || role;
}

module.exports = {
  showAdminPanel,
  showKitchenStaff,
  startAddKitchen,
  handleAddKitchenSchool,
  handleAddKitchenTelegram,
  startReplaceKitchen,
  handleReplaceKitchen,
  handleReplaceKitchenNew,
  startRemoveKitchen,
  handleRemoveKitchen,
  showCities,
  startAddCity,
  handleAddCity,
  showSchools,
  startAddSchool,
  handleAddSchool,
  showUsers,
  showStats,
};
