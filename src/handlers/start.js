//

const { Markup } = require("telegraf");
const { prepare } = require("../database/db");
const logger = require("../utils/logger");

const ROLE_SELECTION_TTL = 24 * 60 * 60 * 1000;

async function startHandler(ctx) {
  try {
    const telegramId = ctx.from.id;

    // Прямой запрос к БД
    const existingUser = prepare(`
      SELECT * FROM users 
      WHERE telegram_id = ?
    `).get(telegramId);

    if (!existingUser) {
      // Новый пользователь - показываем выбор роли
      await showRoleSelection(ctx);
    } else {
      // Существующий пользователь - показываем меню
      ctx.state.user = existingUser;
      await showRoleBasedMenu(ctx, existingUser);
    }
  } catch (error) {
    logger.error("Error in startHandler:", error);
    await ctx.reply("❌ Произошла ошибка. Пожалуйста, попробуйте позже.");
  }
}

async function showRoleSelection(ctx) {
  const username = ctx.from.first_name || "Пользователь";
  const timestamp = Date.now();

  const welcomeText =
    `👋 Привет, ${escapeHtml(username)}!\n\n` +
    `Добро пожаловать в бот школьной столовой. Для начала работы выберите вашу роль:\n\n` +
    `👪 **Родитель** - заказ питания для ребенка\n` +
    `🍎 **Классный руководитель** - управление заказами класса\n` +
    `🍳 **Кухня** - сотрудник столовой\n\n` +
    `_Этот выбор действителен в течение 24 часов._`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback("👪 Родитель", `role_parent_${timestamp}`),
      Markup.button.callback(
        "🍎 Классный руководитель",
        `role_teacher_${timestamp}`,
      ),
    ],
    [
      Markup.button.callback("🍳 Кухня", `role_kitchen_${timestamp}`),
      Markup.button.callback("❓ Помощь", `role_help_${timestamp}`),
    ],
  ]);

  await ctx.replyWithMarkdown(welcomeText, keyboard);
}

async function showRoleBasedMenu(ctx, user) {
  const username = ctx.from.first_name || "Пользователь";

  let menuText = `👋 С возвращением, ${escapeHtml(username)}!\n\n`;
  menuText += `Ваша роль: ${getRoleDisplay(user.role)}\n\n`;
  menuText += `**Главное меню**\n\nВыберите действие:`;

  let keyboard = [];

  switch (user.role) {
    case "admin":
      keyboard = [
        [Markup.button.callback("👥 Пользователи", "admin_users")],
        [Markup.button.callback("🏫 Школы", "admin_schools")],
        [Markup.button.callback("📅 Меню", "admin_menus")],
      ];
      break;
    case "class_teacher":
      keyboard = [
        [Markup.button.callback("📋 Заказы класса", "teacher_orders")],
        [Markup.button.callback("💰 Оплаты", "teacher_payments")],
      ];
      break;
    case "kitchen":
      keyboard = [
        [Markup.button.callback("📊 Заказы сегодня", "kitchen_today")],
        [Markup.button.callback("✅ Подтвердить", "kitchen_confirm")],
      ];
      break;
    case "parent":
      keyboard = [
        [Markup.button.callback("🍽️ Меню", "parent_menu")],
        [Markup.button.callback("📝 Заказать", "parent_order")],
        [Markup.button.callback("👤 Профиль", "parent_profile")],
      ];
      break;
    default:
      keyboard = [
        [Markup.button.callback("🍽️ Меню", "user_menu")],
        [Markup.button.callback("📝 Заказать", "user_order")],
        [Markup.button.callback("👤 Профиль", "user_profile")],
      ];
  }

  keyboard.push([Markup.button.callback("❓ Помощь", "help")]);
  await ctx.replyWithMarkdown(menuText, Markup.inlineKeyboard(keyboard));
}
// ! Старая функция
// async function handleRoleSelection(ctx) {
//   try {
//     const callbackData = ctx.callbackQuery.data;
//     const parts = callbackData.split("_");

//     if (parts.length < 3 || parts[0] !== "role") {
//       return;
//     }

//     const action = parts[1];
//     const timestamp = parseInt(parts[2]);

//     // Проверяем TTL
//     if (Date.now() - timestamp > ROLE_SELECTION_TTL) {
//       await ctx.editMessageText("⏰ Время выбора истекло. Нажмите /start");
//       return;
//     }

//     // Проверяем, не зарегистрирован ли уже
//     const existing = prepare(`SELECT id FROM users WHERE telegram_id = ?`).get(
//       ctx.from.id,
//     );
//     if (existing) {
//       await ctx.editMessageText("❌ Вы уже зарегистрированы");
//       return;
//     }

//     // Регистрируем
//     switch (action) {
//       case "parent":
//         await registerUser(ctx, "parent");
//         break;
//       case "teacher":
//         await registerUser(ctx, "class_teacher");
//         break;
//       case "kitchen":
//         await registerUser(ctx, "kitchen");
//         break;
//       case "help":
//         await showHelp(ctx);
//         break;
//     }
//   } catch (error) {
//     logger.error("Error in handleRoleSelection:", error);
//   }
// }

async function handleRoleSelection(ctx) {
  // СРАЗУ отвечаем Telegram, чтобы кнопка перестала крутиться
  await ctx.answerCbQuery();

  try {
    const callbackData = ctx.callbackQuery.data;
    console.log("📌 callbackData:", callbackData);

    const parts = callbackData.split("_");
    console.log("📌 parts:", parts);

    if (parts.length < 3 || parts[0] !== "role") {
      console.log("❌ Неверный формат");
      return;
    }

    const action = parts[1];
    const timestamp = parseInt(parts[2]);
    console.log("📌 action:", action);
    console.log("📌 timestamp:", timestamp);

    // Проверяем время жизни кнопки
    if (Date.now() - timestamp > ROLE_SELECTION_TTL) {
      console.log("❌ Кнопка просрочена");
      await ctx.editMessageText("⏰ Время выбора истекло. Нажмите /start");
      return;
    }

    // Проверяем, нет ли уже пользователя в БД
    console.log("📌 Проверяем существующего пользователя...");
    const existing = prepare(`SELECT id FROM users WHERE telegram_id = ?`).get(
      ctx.from.id,
    );
    console.log("📌 existing:", existing);

    if (existing) {
      console.log("❌ Пользователь уже существует");
      await ctx.editMessageText("❌ Вы уже зарегистрированы");
      return;
    }

    // Определяем роль
    let role;
    if (action === "parent") role = "user";
    else if (action === "teacher") role = "class_teacher";
    else if (action === "kitchen") role = "kitchen";
    else if (action === "help") {
      await showHelp(ctx);
      return;
    } else {
      console.log("❌ Неизвестный action:", action);
      return;
    }

    console.log("📌 role:", role);

    // СОЗДАЕМ пользователя в БД
    console.log("📌 Вставляем пользователя...");
    const insert = prepare(`
      INSERT INTO users (telegram_id, role, is_active, created_at, updated_at)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = insert.run(ctx.from.id, role);
    console.log("✅ result:", result);

    // Меняем текст сообщения
    await ctx.editMessageText(
      `✅ Регистрация успешна! Добро пожаловать, ${escapeHtml(ctx.from.first_name || "пользователь")}!`,
    );

    // Показываем меню новым сообщением
    const newUser = {
      id: result.lastInsertRowid,
      telegram_id: ctx.from.id,
      role: role,
      is_active: 1,
    };

    console.log("📌 newUser:", newUser);
    await showRoleBasedMenu(ctx, newUser);
  } catch (error) {
    console.log("❌❌❌ ОШИБКА:", error);
    console.log("❌❌❌ message:", error.message);
    console.log("❌❌❌ stack:", error.stack);

    logger.error("Error in handleRoleSelection:", error);
    await ctx.editMessageText(`❌ Ошибка регистрации: ${error.message}`);
  }
}

async function registerUser(ctx, role) {
  try {
    const insert = prepare(`
      INSERT INTO users (telegram_id, role, is_active, created_at, updated_at)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = insert.run(ctx.from.id, role);

    // Меняем сообщение
    await ctx.editMessageText(`✅ Регистрация успешна! Добро пожаловать!`);

    // Показываем меню
    const newUser = { id: result.lastInsertRowid, role };
    await showRoleBasedMenu(ctx, newUser);
  } catch (error) {
    logger.error("Registration error:", error);
    await ctx.editMessageText("❌ Ошибка регистрации");
  }
}

async function showHelp(ctx) {
  const helpText =
    "❓ **Помощь по ролям**\n\n" +
    "👪 **Родитель** - заказ питания для ребенка\n" +
    "🍎 **Классный руководитель** - для учителей\n" +
    "🍳 **Кухня** - для сотрудников столовой";

  await ctx.editMessageText(helpText, { parse_mode: "Markdown" });
}

function getRoleDisplay(role) {
  const roles = {
    admin: "🔑 Администратор",
    class_teacher: "🍎 Классный руководитель",
    kitchen: "🍳 Кухня",
    parent: "👪 Родитель",
    user: "👤 Пользователь",
  };
  return roles[role] || role;
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = {
  startHandler,
  handleRoleSelection,
};
