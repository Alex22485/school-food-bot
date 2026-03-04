// const { Markup } = require("telegraf");
// const { prepare } = require("../database/db");
// const logger = require("../utils/logger");
// const config = require("../config");

// // Константы для безопасности
// const ROLE_SELECTION_TTL = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
// const VALID_ROLES = ["parent", "class_teacher", "kitchen"];

// // Обработчик команды /start
// async function startHandler(ctx) {
//   try {
//     // Проверяем, есть ли уже пользователь в контексте (аутентифицирован)
//     if (ctx.state.user) {
//       // Пользователь уже зарегистрирован - показываем меню согласно роли
//       await showRoleBasedMenu(ctx, ctx.state.user);
//     } else {
//       // Новый пользователь - показываем выбор роли
//       await showRoleSelection(ctx);
//     }
//   } catch (error) {
//     logger.error("Error in startHandler:", {
//       error: error.message,
//       telegramId: ctx.from?.id,
//     });
//     await ctx.reply("❌ Произошла ошибка. Пожалуйста, попробуйте позже.");
//   }
// }

// // Показать меню в зависимости от роли
// async function showRoleBasedMenu(ctx, user) {
//   const username = ctx.from.first_name || "Пользователь";

//   let menuText = `👋 С возвращением, ${escapeHtml(username)}!\n\n`;

//   // Базовая информация
//   menuText += `Ваша роль: ${getRoleDisplay(user.role)}\n`;

//   // Добавляем информацию о статусе
//   if (!user.is_active) {
//     menuText +=
//       "\n⚠️ **ВНИМАНИЕ**: Ваш аккаунт заблокирован. Обратитесь к администратору.\n";
//     await ctx.reply(menuText);
//     return;
//   }

//   // Проверяем заполненность профиля
//   const isProfileComplete = checkProfileCompleteness(user);

//   if (!isProfileComplete) {
//     menuText += "\n📝 Пожалуйста, заполните профиль:\n";
//     menuText += "Используйте /profile для заполнения данных.\n\n";
//   }

//   // Меню в зависимости от роли
//   let keyboard = [];

//   switch (user.role) {
//     case "admin":
//       menuText += "\n🔑 **Панель администратора**\n\n";
//       menuText += "Выберите действие:";
//       keyboard = [
//         [Markup.button.callback("👥 Управление пользователями", "admin_users")],
//         [Markup.button.callback("🏫 Управление школами", "admin_schools")],
//         [Markup.button.callback("📅 Управление меню", "admin_menus")],
//         [Markup.button.callback("📊 Статистика", "admin_stats")],
//         [Markup.button.callback("📋 Логи аудита", "admin_audit")],
//       ];
//       break;

//     case "class_teacher":
//       menuText += "\n🍎 **Панель классного руководителя**\n\n";
//       menuText += "Выберите действие:";
//       keyboard = [
//         [Markup.button.callback("📋 Заказы класса", "teacher_orders")],
//         [Markup.button.callback("💰 Отметить оплату", "teacher_payments")],
//         [Markup.button.callback("📊 Статистика класса", "teacher_stats")],
//       ];
//       break;

//     case "kitchen":
//       menuText += "\n🍳 **Панель кухни**\n\n";
//       menuText += "Выберите действие:";
//       keyboard = [
//         [Markup.button.callback("📊 Заказы на сегодня", "kitchen_today")],
//         [Markup.button.callback("✅ Подтвердить заказы", "kitchen_confirm")],
//         [Markup.button.callback("📋 Отчет по заказам", "kitchen_report")],
//       ];
//       break;

//     case "parent":
//       menuText += "\n👪 **Панель родителя**\n\n";
//       menuText += "Выберите действие:";
//       keyboard = [
//         [Markup.button.callback("🍽️ Меню на сегодня", "parent_menu")],
//         [Markup.button.callback("📝 Сделать заказ", "parent_order")],
//         [Markup.button.callback("📋 История заказов", "parent_history")],
//       ];
//       break;

//     default: // user
//       menuText += "\n👤 **Главное меню**\n\n";
//       menuText += "Выберите действие:";
//       keyboard = [
//         [Markup.button.callback("🍽️ Меню на сегодня", "user_menu")],
//         [Markup.button.callback("📝 Сделать заказ", "user_order")],
//         [Markup.button.callback("📋 Мои заказы", "user_orders")],
//         [Markup.button.callback("👤 Профиль", "user_profile")],
//       ];
//   }

//   // Добавляем общую кнопку помощи
//   keyboard.push([Markup.button.callback("❓ Помощь", "help")]);

//   await ctx.reply(menuText, {
//     parse_mode: "Markdown",
//     ...Markup.inlineKeyboard(keyboard),
//   });
// }

// // Показать выбор роли для нового пользователя
// async function showRoleSelection(ctx) {
//   const username = ctx.from.first_name || "Пользователь";

//   // Генерируем временную метку для защиты от старых кнопок
//   const timestamp = Date.now();

//   const welcomeText =
//     `👋 Привет, ${escapeHtml(username)}!\n\n` +
//     `Добро пожаловать в бот школьной столовой. Для начала работы выберите вашу роль:\n\n` +
//     `👪 **Родитель** - заказ питания для ребенка\n` +
//     `🍎 **Классный руководитель** - управление заказами класса\n` +
//     `🍳 **Кухня** - сотрудник столовой\n\n` +
//     `_Этот выбор действителен в течение 24 часов._`;

//   // Создаем клавиатуру с уникальными callback_data
//   const keyboard = Markup.inlineKeyboard([
//     [
//       Markup.button.callback("👪 Родитель", `role_parent_${timestamp}`),
//       Markup.button.callback(
//         "🍎 Классный руководитель",
//         `role_teacher_${timestamp}`,
//       ),
//     ],
//     [
//       Markup.button.callback("🍳 Кухня", `role_kitchen_${timestamp}`),
//       Markup.button.callback("❓ Помощь", `role_help_${timestamp}`),
//     ],
//   ]);

//   // Сохраняем timestamp в сессию для проверки
//   ctx.session = ctx.session || {};
//   ctx.session.roleSelectionTimestamp = timestamp;

//   await ctx.replyWithMarkdown(welcomeText, keyboard);
// }

// // Обработчик нажатий на инлайн-кнопки
// async function handleRoleSelection(ctx) {
//   try {
//     const callbackData = ctx.callbackQuery.data;

//     // Проверяем формат данных (должен быть role_*_timestamp)
//     const parts = callbackData.split("_");
//     if (parts.length < 3 || parts[0] !== "role") {
//       logger.warn("Invalid callback data format:", { callbackData });
//       return ctx.answerCbQuery("❌ Неверный формат данных");
//     }

//     const action = parts[1]; // parent, teacher, kitchen, help
//     const timestamp = parseInt(parts[2]);

//     // Проверяем TTL (время жизни)
//     const now = Date.now();
//     if (now - timestamp > ROLE_SELECTION_TTL) {
//       logger.warn("Expired role selection attempt", {
//         telegramId: ctx.from.id,
//         callbackData,
//         age: now - timestamp,
//       });
//       await ctx.answerCbQuery("⏰ Срок выбора истек. Нажмите /start заново.");

//       // Удаляем старые кнопки
//       await ctx.editMessageText(
//         "⏰ Время выбора истекло. Пожалуйста, нажмите /start для нового выбора.",
//         { parse_mode: "Markdown" },
//       );
//       return;
//     }

//     // Проверяем, что пользователь еще не зарегистрирован
//     if (ctx.state.user) {
//       await ctx.answerCbQuery("❌ Вы уже зарегистрированы");
//       return;
//     }

//     // Обрабатываем выбор роли
//     switch (action) {
//       case "help":
//         await handleHelp(ctx);
//         break;

//       case "parent":
//       case "teacher":
//       case "kitchen":
//         await registerUserWithRole(ctx, action);
//         break;

//       default:
//         logger.warn("Unknown role action:", { action, callbackData });
//         await ctx.answerCbQuery("❌ Неизвестная роль");
//     }
//   } catch (error) {
//     logger.error("Error in handleRoleSelection:", {
//       error: error.message,
//       telegramId: ctx.from?.id,
//     });
//     await ctx.answerCbQuery("❌ Произошла ошибка");
//   }
// }

// // Регистрация пользователя с выбранной ролью
// async function registerUserWithRole(ctx, roleType) {
//   try {
//     const telegramId = ctx.from.id;
//     const username = ctx.from.username || null;
//     const firstName = ctx.from.first_name || null;
//     const lastName = ctx.from.last_name || null;

//     // Маппинг ролей
//     const roleMapping = {
//       parent: "parent",
//       teacher: "class_teacher",
//       kitchen: "kitchen",
//     };

//     const dbRole = roleMapping[roleType];

//     // Начинаем транзакцию
//     const insertUser = prepare(`
//             INSERT INTO users (
//                 telegram_id,
//                 role,
//                 is_active,
//                 created_at,
//                 updated_at
//             ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
//         `);

//     const result = insertUser.run(telegramId, dbRole, 1);

//     logger.info("New user registered with role selection", {
//       userId: result.lastInsertRowid,
//       telegramId,
//       role: dbRole,
//     });

//     // Записываем в аудит
//     const { logAudit } = require("../middlewares/audit");
//     logAudit({
//       userId: result.lastInsertRowid,
//       telegramId,
//       action: "register",
//       entityType: "user",
//       newData: { role: dbRole, source: "role_selection" },
//     });

//     // Получаем созданного пользователя
//     const newUser = prepare(`
//             SELECT id, telegram_id, role, is_active
//             FROM users
//             WHERE id = ?
//         `).get(result.lastInsertRowid);

//     // Обновляем состояние
//     ctx.state.user = newUser;

//     // Отвечаем на callback
//     await ctx.answerCbQuery("✅ Регистрация успешна!");

//     // Показываем приветствие с выбранной ролью
//     await showRoleBasedMenu(ctx, newUser);
//   } catch (error) {
//     logger.error("Error in registerUserWithRole:", {
//       error: error.message,
//       telegramId: ctx.from.id,
//       roleType,
//     });

//     if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
//       await ctx.answerCbQuery("❌ Вы уже зарегистрированы");
//     } else {
//       await ctx.answerCbQuery("❌ Ошибка регистрации");
//     }
//   }
// }

// // Обработчик помощи при выборе роли
// async function handleHelp(ctx) {
//   const helpText =
//     "❓ **Помощь по ролям**\n\n" +
//     "👪 **Родитель** - если вы хотите заказывать питание для ребенка\n" +
//     "   • Просмотр меню\n" +
//     "   • Заказ блюд\n" +
//     "   • История заказов\n\n" +
//     "🍎 **Классный руководитель** - для учителей\n" +
//     "   • Просмотр заказов класса\n" +
//     "   • Отметка об оплате\n" +
//     "   • Статистика\n\n" +
//     "🍳 **Кухня** - для сотрудников столовой\n" +
//     "   • Просмотр заказов на сегодня\n" +
//     "   • Подтверждение заказов\n" +
//     "   • Отчеты\n\n" +
//     "Если вы администратор, обратитесь к разработчику для настройки.";

//   await ctx.answerCbQuery();
//   await ctx.replyWithMarkdown(helpText);
// }

// // Вспомогательные функции
// function getRoleDisplay(role) {
//   const roles = {
//     admin: "🔑 Администратор",
//     class_teacher: "🍎 Классный руководитель",
//     kitchen: "🍳 Кухня",
//     parent: "👪 Родитель",
//     user: "👤 Пользователь",
//   };
//   return roles[role] || role;
// }

// function checkProfileCompleteness(user) {
//   // Для разных ролей разная обязательная информация
//   switch (user.role) {
//     case "parent":
//       return !!(
//         user.city_id &&
//         user.school_id &&
//         user.child_name &&
//         user.class_name
//       );
//     case "class_teacher":
//       return !!(user.city_id && user.school_id && user.class_name);
//     case "kitchen":
//       return !!(user.city_id && user.school_id);
//     default:
//       return true; // Для admin и user не проверяем
//   }
// }

// function escapeHtml(text) {
//   if (!text) return "";
//   return String(text)
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;")
//     .replace(/"/g, "&quot;")
//     .replace(/'/g, "&#039;");
// }

// module.exports = {
//   startHandler,
//   handleRoleSelection,
// };

const { Markup } = require("telegraf");
const { prepare } = require("../database/db");
const logger = require("../utils/logger");
const config = require("../config");

// Константы для безопасности
const ROLE_SELECTION_TTL = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах

// Обработчик команды /start
async function startHandler(ctx) {
  try {
    const telegramId = ctx.from.id;

    // Прямой запрос к БД - проверяем, есть ли пользователь
    const existingUser = prepare(`
      SELECT * FROM users 
      WHERE telegram_id = ? 
      AND telegram_id != 0
    `).get(telegramId);

    if (!existingUser) {
      // Это НОВЫЙ пользователь (нет в БД) - показываем выбор роли
      logger.info("New user detected, showing role selection", { telegramId });
      await showRoleSelection(ctx);
    } else {
      // Пользователь уже есть в БД
      ctx.state.user = existingUser; // Обновляем состояние

      // Проверяем, заполнен ли профиль
      const isProfileComplete = checkProfileCompleteness(existingUser);

      if (!isProfileComplete) {
        // Профиль не заполнен - показываем соответствующее сообщение
        await showIncompleteProfile(ctx, existingUser);
      } else {
        // Профиль заполнен - показываем меню
        await showRoleBasedMenu(ctx, existingUser);
      }
    }
  } catch (error) {
    logger.error("Error in startHandler:", {
      error: error.message,
      telegramId: ctx.from?.id,
    });
    await ctx.reply("❌ Произошла ошибка. Пожалуйста, попробуйте позже.");
  }
}

// Показать выбор роли для НОВОГО пользователя
async function showRoleSelection(ctx) {
  const username = ctx.from.first_name || "Пользователь";

  // Генерируем временную метку для защиты от старых кнопок
  const timestamp = Date.now();

  const welcomeText =
    `👋 Привет, ${escapeHtml(username)}!\n\n` +
    `Добро пожаловать в бот школьной столовой. Для начала работы выберите вашу роль:\n\n` +
    `👪 **Родитель** - заказ питания для ребенка\n` +
    `🍎 **Классный руководитель** - управление заказами класса\n` +
    `🍳 **Кухня** - сотрудник столовой\n\n` +
    `_Этот выбор действителен в течение 24 часов._`;

  // Создаем клавиатуру с уникальными callback_data
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

  // Сохраняем timestamp в сессию для проверки
  ctx.session = ctx.session || {};
  ctx.session.roleSelectionTimestamp = timestamp;

  await ctx.replyWithMarkdown(welcomeText, keyboard);
}

// Показать сообщение о незаполненном профиле
async function showIncompleteProfile(ctx, user) {
  const username = ctx.from.first_name || "Пользователь";

  let message = `👋 Привет, ${escapeHtml(username)}!\n\n`;
  message += `📝 **Ваш профиль не заполнен**\n\n`;
  message += `Для работы с ботом необходимо указать:\n`;

  if (user.role === "parent") {
    message += `• Город и школу\n`;
    message += `• Класс ребенка\n`;
    message += `• Имя ребенка\n`;
  } else if (user.role === "class_teacher") {
    message += `• Город и школу\n`;
    message += `• Ваш класс\n`;
  } else if (user.role === "kitchen") {
    message += `• Город и школу\n`;
  } else {
    message += `• Город и школу (если нужно)\n`;
  }

  message += `\nИспользуйте /profile для заполнения данных.`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("👤 Заполнить профиль", "edit_profile")],
    [Markup.button.callback("❓ Помощь", "help")],
  ]);

  await ctx.replyWithMarkdown(message, keyboard);
}

// Показать меню в зависимости от роли
async function showRoleBasedMenu(ctx, user) {
  const username = ctx.from.first_name || "Пользователь";

  let menuText = `👋 С возвращением, ${escapeHtml(username)}!\n\n`;
  menuText += `Ваша роль: ${getRoleDisplay(user.role)}\n\n`;
  menuText += `**Главное меню**\n\n`;
  menuText += `Выберите действие:`;

  // Меню в зависимости от роли
  let keyboard = [];

  switch (user.role) {
    case "admin":
      keyboard = [
        [Markup.button.callback("👥 Управление пользователями", "admin_users")],
        [Markup.button.callback("🏫 Управление школами", "admin_schools")],
        [Markup.button.callback("📅 Управление меню", "admin_menus")],
        [Markup.button.callback("📊 Статистика", "admin_stats")],
        [Markup.button.callback("📋 Логи аудита", "admin_audit")],
      ];
      break;

    case "class_teacher":
      keyboard = [
        [Markup.button.callback("📋 Заказы класса", "teacher_orders")],
        [Markup.button.callback("💰 Отметить оплату", "teacher_payments")],
        [Markup.button.callback("📊 Статистика класса", "teacher_stats")],
      ];
      break;

    case "kitchen":
      keyboard = [
        [Markup.button.callback("📊 Заказы на сегодня", "kitchen_today")],
        [Markup.button.callback("✅ Подтвердить заказы", "kitchen_confirm")],
        [Markup.button.callback("📋 Отчет по заказам", "kitchen_report")],
      ];
      break;

    case "parent":
      keyboard = [
        [Markup.button.callback("🍽️ Меню на сегодня", "parent_menu")],
        [Markup.button.callback("📝 Сделать заказ", "parent_order")],
        [Markup.button.callback("📋 История заказов", "parent_history")],
        [Markup.button.callback("👤 Профиль", "parent_profile")],
      ];
      break;

    default: // user
      keyboard = [
        [Markup.button.callback("🍽️ Меню на сегодня", "user_menu")],
        [Markup.button.callback("📝 Сделать заказ", "user_order")],
        [Markup.button.callback("📋 Мои заказы", "user_orders")],
        [Markup.button.callback("👤 Профиль", "user_profile")],
      ];
  }

  // Добавляем общую кнопку помощи
  keyboard.push([Markup.button.callback("❓ Помощь", "help")]);

  await ctx.replyWithMarkdown(menuText, {
    ...Markup.inlineKeyboard(keyboard),
  });
}

// Обработчик нажатий на инлайн-кнопки
async function handleRoleSelection(ctx) {
  try {
    const callbackData = ctx.callbackQuery.data;

    // Проверяем формат данных (должен быть role_*_timestamp)
    const parts = callbackData.split("_");
    if (parts.length < 3 || parts[0] !== "role") {
      logger.warn("Invalid callback data format:", { callbackData });
      return ctx.answerCbQuery("❌ Неверный формат данных");
    }

    const action = parts[1]; // parent, teacher, kitchen, help
    const timestamp = parseInt(parts[2]);

    // Проверяем TTL (время жизни)
    const now = Date.now();
    if (now - timestamp > ROLE_SELECTION_TTL) {
      logger.warn("Expired role selection attempt", {
        telegramId: ctx.from.id,
        callbackData,
        age: now - timestamp,
      });
      await ctx.answerCbQuery("⏰ Срок выбора истек. Нажмите /start заново.");

      // Удаляем старые кнопки
      await ctx.editMessageText(
        "⏰ Время выбора истекло. Пожалуйста, нажмите /start для нового выбора.",
        { parse_mode: "Markdown" },
      );
      return;
    }

    // Проверяем, что пользователь еще не зарегистрирован (прямой запрос к БД)
    const existingUser = prepare(`
      SELECT * FROM users 
      WHERE telegram_id = ? 
      AND telegram_id != 0
    `).get(ctx.from.id);

    if (existingUser) {
      await ctx.answerCbQuery("❌ Вы уже зарегистрированы");
      return;
    }

    // Обрабатываем выбор роли
    switch (action) {
      case "help":
        await handleHelp(ctx);
        break;

      case "parent":
      case "teacher":
      case "kitchen":
        await registerUserWithRole(ctx, action);
        break;

      default:
        logger.warn("Unknown role action:", { action, callbackData });
        await ctx.answerCbQuery("❌ Неизвестная роль");
    }
  } catch (error) {
    logger.error("Error in handleRoleSelection:", {
      error: error.message,
      telegramId: ctx.from?.id,
    });
    await ctx.answerCbQuery("❌ Произошла ошибка");
  }
}

// Регистрация пользователя с выбранной ролью
async function registerUserWithRole(ctx, roleType) {
  try {
    const telegramId = ctx.from.id;

    // Маппинг ролей
    const roleMapping = {
      parent: "parent",
      teacher: "class_teacher",
      kitchen: "kitchen",
    };

    const dbRole = roleMapping[roleType];

    // Начинаем транзакцию
    const insertUser = prepare(`
      INSERT INTO users (
        telegram_id, 
        role, 
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = insertUser.run(telegramId, dbRole, 1);

    logger.info("New user registered with role selection", {
      userId: result.lastInsertRowid,
      telegramId,
      role: dbRole,
    });

    // Записываем в аудит
    const { logAudit } = require("../middlewares/audit");
    logAudit({
      userId: result.lastInsertRowid,
      telegramId,
      action: "register",
      entityType: "user",
      newData: { role: dbRole, source: "role_selection" },
    });

    // Получаем созданного пользователя
    const newUser = prepare(`
      SELECT * FROM users 
      WHERE id = ?
    `).get(result.lastInsertRowid);

    // Отвечаем на callback
    await ctx.answerCbQuery("✅ Регистрация успешна!");

    // Показываем сообщение о необходимости заполнить профиль
    await showIncompleteProfile(ctx, newUser);
  } catch (error) {
    logger.error("Error in registerUserWithRole:", {
      error: error.message,
      telegramId: ctx.from.id,
      roleType,
    });

    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      await ctx.answerCbQuery("❌ Вы уже зарегистрированы");
    } else {
      await ctx.answerCbQuery("❌ Ошибка регистрации");
    }
  }
}

// Обработчик помощи при выборе роли
async function handleHelp(ctx) {
  const helpText =
    "❓ **Помощь по ролям**\n\n" +
    "👪 **Родитель** - если вы хотите заказывать питание для ребенка\n" +
    "   • Просмотр меню\n" +
    "   • Заказ блюд\n" +
    "   • История заказов\n\n" +
    "🍎 **Классный руководитель** - для учителей\n" +
    "   • Просмотр заказов класса\n" +
    "   • Отметка об оплате\n" +
    "   • Статистика\n\n" +
    "🍳 **Кухня** - для сотрудников столовой\n" +
    "   • Просмотр заказов на сегодня\n" +
    "   • Подтверждение заказов\n" +
    "   • Отчеты\n\n" +
    "Если вы администратор, обратитесь к разработчику для настройки.";

  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(helpText);
}

// Вспомогательные функции
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

function checkProfileCompleteness(user) {
  switch (user.role) {
    case "parent":
      return !!(
        user.city_id &&
        user.school_id &&
        user.child_name &&
        user.class_name
      );
    case "class_teacher":
      return !!(user.city_id && user.school_id && user.class_name);
    case "kitchen":
      return !!(user.city_id && user.school_id);
    default:
      return true;
  }
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
