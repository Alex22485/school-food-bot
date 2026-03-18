const { Markup } = require("telegraf");
const { prepare } = require("../database/db");
const logger = require("../utils/logger");

// Показать меню для ученика/родителя
async function showUserMenu(ctx) {
  if (!ctx.state.user) {
    await ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
    return;
  }

  const user = ctx.state.user;

  // Проверяем, есть ли у пользователя город и школа
  if (!user.city_id || !user.school_id) {
    await ctx.reply(
      "❌ Ошибка: не указаны город и школа. Сначала заполните профиль.",
    );
    return;
  }

  try {
    // Получаем доступные меню для школы пользователя
    const menus = prepare(`
      SELECT id, date, items, created_at
      FROM menus
      WHERE school_id = ?
      ORDER BY date DESC
      LIMIT 10
    `).all(user.school_id);

    if (menus.length === 0) {
      await ctx.reply("📭 На сегодня меню еще нет. Попробуйте позже.");
      return;
    }

    let text = "🍽️ **Доступные меню**\n\n";

    // Создаем кнопки для каждого меню
    const buttons = [];
    menus.forEach((menu) => {
      const dateStr = menu.date.split("-").reverse().join(".");
      const items = JSON.parse(menu.items);
      buttons.push([
        Markup.button.callback(
          `${dateStr} (${items.length} блюд)`,
          `user_view_menu_${menu.id}`,
        ),
      ]);
    });

    buttons.push([Markup.button.callback("🔙 Назад", "user_menu_back")]);

    const keyboard = Markup.inlineKeyboard(buttons);

    await ctx.reply(text, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    logger.error("Error in showUserMenu:", error);
    await ctx.reply("❌ Ошибка при загрузке меню");
  }
}

// Показать конкретное меню для ученика/родителя
async function showUserMenuDetails(ctx, menuId) {
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
    text += `🏫 **Школа:** ${menu.school_name}\n\n`;
    text += `**Блюда:**\n`;

    items.forEach((item, index) => {
      text += `${index + 1}. **${item.name}** — ${item.price}₽\n`;
    });

    // Добавляем кнопку заказа, если это родитель/ученик
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback("📝 Заказать", `order_from_menu_${menu.id}`),
        Markup.button.callback("🔙 Назад", "user_menu"),
      ],
    ]);

    await ctx.reply(text, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    logger.error("Error in showUserMenuDetails:", error);
    await ctx.reply("❌ Ошибка при загрузке меню");
  }
}

// Показать главное меню для ученика/родителя
async function showUserMainMenu(ctx) {
  if (!ctx.state.user) {
    await ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
    return;
  }

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("🍽️ Посмотреть меню", "user_menu")],
    [Markup.button.callback("📝 Мои заказы", "user_orders")],
    [Markup.button.callback("👤 Профиль", "user_profile")],
  ]);

  await ctx.reply("👤 **Главное меню**\n\nВыберите действие:", {
    parse_mode: "Markdown",
    ...keyboard,
  });
}

module.exports = {
  showUserMenu,
  showUserMenuDetails,
  showUserMainMenu,
};
