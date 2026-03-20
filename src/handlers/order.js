const { Markup } = require("telegraf");
const { prepare } = require("../database/db");
const logger = require("../utils/logger");
const escapeHtml = require("escape-html");

// Начать процесс заказа
async function startOrder(ctx) {
  console.log("📋 startOrder вызвана");
  console.log("user:", ctx.state.user?.id);

  if (!ctx.state.user) {
    await ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
    return;
  }

  const user = ctx.state.user;

  if (!user.city_id || !user.school_id) {
    await ctx.reply(
      "❌ Ошибка: не указаны город и школа. Сначала заполните профиль.",
    );
    return;
  }

  try {
    console.log("Загружаем меню для школы:", user.school_id);

    const menus = prepare(`
      SELECT id, date, items, created_at
      FROM menus
      WHERE school_id = ?
      ORDER BY date DESC
      LIMIT 10
    `).all(user.school_id);

    console.log(`Найдено меню: ${menus.length}`);

    if (menus.length === 0) {
      await ctx.reply("📭 На сегодня меню еще нет. Попробуйте позже.");
      return;
    }

    let text = "📝 **Выберите меню для заказа**\n\n";

    const buttons = [];
    menus.forEach((menu) => {
      const dateStr = menu.date.split("-").reverse().join(".");
      const items = JSON.parse(menu.items);
      buttons.push([
        Markup.button.callback(
          `${dateStr} (${items.length} блюд)`,
          `order_select_menu_${menu.id}`,
        ),
      ]);
    });

    buttons.push([Markup.button.callback("🔙 Назад", "user_menu")]);

    const keyboard = Markup.inlineKeyboard(buttons);

    await ctx.reply(text, {
      parse_mode: "Markdown",
      ...keyboard,
    });

    console.log("✅ startOrder завершена");
  } catch (error) {
    console.error("❌ Ошибка в startOrder:", error);
    logger.error("Error in startOrder:", error);
    await ctx.reply("❌ Ошибка при загрузке меню");
  }
}

// Начать заказ из конкретного меню
async function startOrderFromMenu(ctx, menuId) {
  console.log(`📋 startOrderFromMenu вызвана с menuId: ${menuId}`);
  console.log("user:", ctx.state.user?.id);

  if (!ctx.state.user) {
    await ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
    return;
  }

  try {
    console.log("Загружаем меню из БД...");

    const menu = prepare(`
      SELECT m.*, c.name as city_name, s.name as school_name
      FROM menus m
      JOIN cities c ON m.city_id = c.id
      JOIN schools s ON m.school_id = s.id
      WHERE m.id = ?
    `).get(menuId);

    if (!menu) {
      console.log("❌ Меню не найдено");
      await ctx.reply("❌ Меню не найдено");
      return;
    }

    console.log("Меню найдено, парсим items...");
    const items = JSON.parse(menu.items);
    const dateStr = menu.date.split("-").reverse().join(".");

    console.log(`Блюд в меню: ${items.length}`);

    // ИНИЦИАЛИЗИРУЕМ СЕССИЮ
    ctx.session = ctx.session || {};

    ctx.session.orderCreation = {
      menuId: menuId,
      date: dateStr,
      items: items.map((item) => ({
        ...item,
        selected: false,
      })),
      step: "select_items",
    };

    console.log("Сессия создана, показываем выбор блюд");
    await showOrderItemSelection(ctx);
  } catch (error) {
    console.error("❌ Ошибка в startOrderFromMenu:", error);
    logger.error("Error in startOrderFromMenu:", error);
    await ctx.reply("❌ Ошибка при загрузке меню");
  }
}

// Показать выбор блюд
async function showOrderItemSelection(ctx) {
  console.log("📋 showOrderItemSelection вызвана");

  // ПРОВЕРЯЕМ СЕССИЮ
  if (!ctx.session) {
    console.log("❌ ctx.session не определена");
    await ctx.reply("❌ Ошибка: сессия не найдена. Начните заказ заново.");
    return;
  }

  const order = ctx.session.orderCreation;
  if (!order) {
    console.log("❌ order не найден в сессии");
    await ctx.reply("❌ Ошибка: заказ не найден. Начните заказ заново.");
    return;
  }

  console.log(`order: date=${order.date}, items=${order.items.length}`);

  try {
    // Формируем сообщение
    let text = `📝 **Заказ на ${order.date}**\n\n`;
    text += `**Выберите блюда:**\n\n`;

    const buttons = [];
    let totalPrice = 0;

    order.items.forEach((item, index) => {
      const status = item.selected ? "✅" : "⬜";
      text += `${status} **${item.name}** — ${item.price}₽\n`;

      if (item.selected) {
        totalPrice += item.price;
      }
    });

    text += `\n💰 **Итого:** ${totalPrice}₽`;

    // Создаем кнопки для каждого блюда
    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      buttons.push([
        Markup.button.callback(
          item.selected
            ? `❌ Убрать: ${item.name}`
            : `✅ Добавить: ${item.name}`,
          `order_toggle_item_${i}`,
        ),
      ]);
    }

    buttons.push([
      Markup.button.callback("✅ Подтвердить заказ", "order_confirm"),
      Markup.button.callback("🔙 Назад к меню", "user_menu"),
    ]);

    console.log("Отправляем сообщение с кнопками");

    await ctx.reply(text, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });

    console.log("✅ showOrderItemSelection завершена");
  } catch (error) {
    console.error("❌ Ошибка в showOrderItemSelection:", error);
    logger.error("Error in showOrderItemSelection:", error);
    await ctx.reply("❌ Ошибка при отображении меню");
  }
}

// Переключение выбора блюда
async function toggleOrderItem(ctx, itemIndex) {
  console.log(`📋 toggleOrderItem вызвана с itemIndex: ${itemIndex}`);

  // ПРОВЕРЯЕМ СЕССИЮ
  if (!ctx.session) {
    console.log("❌ ctx.session не определена");
    await ctx.reply("❌ Ошибка: сессия не найдена. Начните заказ заново.");
    return;
  }

  const order = ctx.session.orderCreation;
  if (!order) {
    console.log("❌ order не найден в сессии");
    await ctx.reply("❌ Ошибка: заказ не найден. Начните заказ заново.");
    return;
  }

  // Проверяем, что itemIndex корректен
  if (itemIndex < 0 || itemIndex >= order.items.length) {
    console.log(`❌ Неверный индекс: ${itemIndex}`);
    await ctx.reply("❌ Ошибка: неверный индекс блюда.");
    return;
  }

  console.log(
    `Текущее состояние item[${itemIndex}]: selected=${order.items[itemIndex]?.selected}`,
  );

  // Меняем состояние
  order.items[itemIndex].selected = !order.items[itemIndex].selected;

  console.log(`Новое состояние: selected=${order.items[itemIndex].selected}`);

  // Показываем обновленный список
  await showOrderItemSelection(ctx);
}

// Подтверждение заказа
async function confirmOrder(ctx) {
  console.log("📋 confirmOrder вызвана");

  // ПРОВЕРЯЕМ СЕССИЮ
  if (!ctx.session) {
    console.log("❌ ctx.session не определена");
    await ctx.reply("❌ Ошибка: сессия не найдена. Начните заказ заново.");
    return;
  }

  const order = ctx.session.orderCreation;
  const user = ctx.state.user;

  if (!order) {
    console.log("❌ order не найден в сессии");
    await ctx.reply("❌ Ошибка: заказ не найден. Начните заказ заново.");
    return;
  }

  const selectedItems = order.items.filter((i) => i.selected);
  if (selectedItems.length === 0) {
    await ctx.reply("❌ Вы не выбрали ни одного блюда!");
    return;
  }

  const totalPrice = selectedItems.reduce((sum, i) => sum + i.price, 0);

  try {
    const dateParts = order.date.split(".");
    const dbDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

    const insert = prepare(`
      INSERT INTO orders (user_id, menu_id, order_date, items, total_price, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `);

    const result = insert.run(
      user.id,
      order.menuId,
      dbDate,
      JSON.stringify(selectedItems),
      totalPrice,
    );

    logger.info("Order created", {
      orderId: result.lastInsertRowid,
      userId: user.id,
      itemsCount: selectedItems.length,
      totalPrice,
    });

    let text = `✅ **Заказ успешно оформлен!**\n\n`;
    text += `📅 **Дата:** ${order.date}\n`;
    text += `📋 **Блюда:**\n`;

    selectedItems.forEach((item, index) => {
      text += `${index + 1}. **${item.name}** — ${item.price}₽\n`;
    });

    text += `\n💰 **Итого:** ${totalPrice}₽`;
    text += `\n\nСтатус: ✅ Активен`;

    ctx.session.orderCreation = null;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🍽️ В меню", "user_menu")],
    ]);

    await ctx.reply(text, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    console.error("❌ Ошибка в confirmOrder:", error);
    logger.error("Error in confirmOrder:", error);
    await ctx.reply("❌ Ошибка при оформлении заказа");
  }
}

// Обработка ввода текста (заглушка)
async function handleOrderInput(ctx, text) {
  console.log(`📋 handleOrderInput вызвана с текстом: ${text}`);

  if (!ctx.session) {
    console.log("❌ ctx.session не определена");
    await ctx.reply("❌ Ошибка: сессия не найдена. Начните заказ заново.");
    return;
  }

  const order = ctx.session.orderCreation;
  if (!order) return;

  await ctx.reply("Используйте кнопки для выбора блюд.");
}

module.exports = {
  startOrder,
  startOrderFromMenu,
  handleOrderInput,
  toggleOrderItem,
  confirmOrder,
  showOrderItemSelection,
};
