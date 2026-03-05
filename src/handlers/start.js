const { Markup } = require("telegraf");
const { prepare } = require("../database/db");
const logger = require("../utils/logger");
const registrationHandler = require("./registration");

const ROLE_SELECTION_TTL = 24 * 60 * 60 * 1000;

async function startHandler(ctx) {
  try {
    const telegramId = ctx.from.id;
    console.log("\n🔍 START HANDLER CALLED for user:", telegramId);

    // Прямой запрос к БД
    const existingUser = prepare(`
      SELECT * FROM users 
      WHERE telegram_id = ?
    `).get(telegramId);

    if (!existingUser) {
      console.log("📌 New user - showing role selection");
      await showRoleSelection(ctx);
    } else {
      console.log("📌 Existing user found:", {
        id: existingUser.id,
        role: existingUser.role,
        city_id: existingUser.city_id,
        school_id: existingUser.school_id,
        class_name: existingUser.class_name,
        child_name: existingUser.child_name,
      });

      ctx.state.user = existingUser;

      // Проверяем, заполнен ли профиль
      const isProfileComplete = checkProfileCompleteness(existingUser);
      console.log("📌 Profile complete:", isProfileComplete);

      if (!isProfileComplete) {
        console.log("📌 Profile incomplete - starting registration");
        await startRegistration(ctx, existingUser.role);
      } else {
        console.log("📌 Profile complete - showing menu");
        await showRoleBasedMenu(ctx, existingUser);
      }
    }
  } catch (error) {
    logger.error("Error in startHandler:", error);
    await ctx.reply("❌ Произошла ошибка. Пожалуйста, попробуйте позже.");
  }
}

// Запуск процесса регистрации
async function startRegistration(ctx, role) {
  ctx.session = ctx.session || {};
  ctx.session.registration = {
    role: role,
    step: "city",
    cityId: null,
    schoolId: null,
    classGrade: null,
    classLetter: null,
    className: null,
    childName: null,
  };

  await ctx.reply("📝 Давайте заполним ваш профиль!");
  await registrationHandler.askForNextStep(ctx);
}

// Обновленный текст с "Родитель/Ученик"
async function showRoleSelection(ctx) {
  const username = ctx.from.first_name || "Пользователь";
  const timestamp = Date.now();

  const welcomeText =
    `👋 Привет, ${escapeHtml(username)}!\n\n` +
    `Добро пожаловать в бот школьной столовой. Для начала работы выберите вашу роль:\n\n` +
    `👪 **Родитель/Ученик** - заказ питания\n` +
    `🍎 **Классный руководитель** - управление заказами класса\n` +
    `🍳 **Кухня** - сотрудник столовой\n\n` +
    `_Этот выбор действителен в течение 24 часов._`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback("👪 Родитель/Ученик", `role_parent_${timestamp}`),
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

// Упрощенная функция показа меню
async function showRoleBasedMenu(ctx, user, skipWelcome = false) {
  const username = ctx.from.first_name || "Пользователь";

  let menuText = "";

  if (!skipWelcome) {
    menuText += `👋 С возвращением, ${escapeHtml(username)}!\n\n`;
  }

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

  // Отправляем только кнопки с кратким заголовком
  await ctx.replyWithMarkdown(
    "**Выберите действие:**",
    Markup.inlineKeyboard(keyboard),
  );
}

// Проверка полноты профиля
function checkProfileCompleteness(user) {
  if (!user) return false;

  console.log("📌 Checking completeness for:", {
    role: user.role,
    city_id: user.city_id,
    school_id: user.school_id,
    class_name: user.class_name,
    child_name: user.child_name,
  });

  switch (user.role) {
    case "parent":
      const isComplete = !!(user.city_id && user.class_name && user.child_name);
      console.log("📌 Parent profile complete:", isComplete);
      return isComplete;

    case "class_teacher":
      return !!(user.city_id && user.class_name);

    case "kitchen":
      return !!user.city_id;

    default:
      return true;
  }
}

async function handleRoleSelection(ctx) {
  await ctx.answerCbQuery();

  try {
    const callbackData = ctx.callbackQuery.data;
    const parts = callbackData.split("_");

    if (parts.length < 3 || parts[0] !== "role") {
      return;
    }

    const action = parts[1];
    const timestamp = parseInt(parts[2]);

    if (Date.now() - timestamp > ROLE_SELECTION_TTL) {
      await ctx.editMessageText("⏰ Время выбора истекло. Нажмите /start");
      return;
    }

    const existing = prepare(`SELECT id FROM users WHERE telegram_id = ?`).get(
      ctx.from.id,
    );

    if (existing) {
      await ctx.editMessageText("❌ Вы уже зарегистрированы");
      return;
    }

    let role;
    if (action === "parent") role = "parent";
    else if (action === "teacher") role = "class_teacher";
    else if (action === "kitchen") role = "kitchen";
    else if (action === "help") {
      await showHelp(ctx);
      return;
    } else {
      return;
    }

    await ctx.editMessageText(
      `📝 **Начинаем регистрацию**\n\n` +
        `Вы выбрали роль: ${getRoleDisplay(role)}\n\n` +
        `Сейчас мы соберем необходимые данные. После заполнения профиля вы будете зарегистрированы.`,
    );

    await startRegistration(ctx, role);
  } catch (error) {
    logger.error("Error in handleRoleSelection:", error);
    await ctx.editMessageText(`❌ Ошибка регистрации: ${error.message}`);
  }
}

async function showHelp(ctx) {
  const helpText =
    "❓ **Помощь по ролям**\n\n" +
    "👪 **Родитель/Ученик** - заказ питания\n" +
    "🍎 **Классный руководитель** - для учителей\n" +
    "🍳 **Кухня** - для сотрудников столовой";

  await ctx.editMessageText(helpText, { parse_mode: "Markdown" });
}

// Обновлено отображение роли
function getRoleDisplay(role) {
  const roles = {
    admin: "🔑 Администратор",
    class_teacher: "🍎 Классный руководитель",
    kitchen: "🍳 Кухня",
    parent: "👪 Родитель/Ученик",
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
  showRoleBasedMenu,
  checkProfileCompleteness,
  startRegistration,
};
