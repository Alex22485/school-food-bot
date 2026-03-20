// const { Telegraf, session, Markup } = require("telegraf");
// const rateLimit = require("telegraf-ratelimit");
// const config = require("../config");
// const logger = require("../utils/logger");
// const { sanitizeInput, requestLogger } = require("../middlewares/security");
// const errorHandler = require("../middlewares/errorHandler");
// const authMiddleware = require("../middlewares/auth");
// const {
//   allowAdmin,
//   allowTeacher,
//   allowKitchen,
//   allowUser,
// } = require("../middlewares/roleCheck");
// const { auditMiddleware } = require("../middlewares/audit");
// const {
//   startHandler,
//   handleRoleSelection,
//   startRegistration,
// } = require("../handlers/start");
// const registrationHandler = require("../handlers/registration");
// const adminHandler = require("../handlers/admin");
// const kitchenHandler = require("../handlers/kitchen");
// const menuHandler = require("../handlers/menu");
// const orderHandler = require("../handlers/order");

// // Создаем экземпляр бота
// const bot = new Telegraf(config.bot.token);

// // Функция для получения названия роли
// function getRoleName(role) {
//   const roles = {
//     user: "👤 Пользователь",
//     admin: "🔑 Администратор",
//     class_teacher: "🍎 Классный руководитель",
//     kitchen: "🍳 Кухня",
//     parent: "👪 Родитель/Ученик",
//   };
//   return roles[role] || role;
// }

// // Глобальный middleware для всех callback запросов
// bot.use(async (ctx, next) => {
//   if (ctx.callbackQuery) {
//     try {
//       // Пытаемся ответить на callback как можно быстрее
//       await ctx.answerCbQuery().catch(() => {});
//     } catch (e) {
//       // Игнорируем ошибки, если уже ответили
//     }
//   }
//   return next();
// });

// // Настройка middleware (порядок важен!)
// bot.use(session()); // Сессии для временных данных
// bot.use(requestLogger); // Логирование запросов
// bot.use(sanitizeInput); // Защита от XSS
// bot.use(
//   rateLimit({
//     window: config.security.rateLimit.window,
//     limit: config.security.rateLimit.limit,
//     onLimitExceeded: (ctx) => {
//       logger.warn("Rate limit exceeded", {
//         userId: ctx.from?.id,
//         username: ctx.from?.username,
//       });
//       ctx.reply("⏳ Слишком много запросов. Пожалуйста, подождите.");
//     },
//   }),
// );
// bot.use(authMiddleware); // Аутентификация

// // Подключаем обработчик команды /start
// bot.start(auditMiddleware("start"), startHandler);

// // Обработчик нажатий на кнопки выбора роли
// bot.action(/^role_.+/, async (ctx) => {
//   console.log("✅ Нажата кнопка роли:", ctx.callbackQuery.data);
//   await handleRoleSelection(ctx);
// });

// // Обработчики для выбора класса
// bot.action(/^classGrade_\d+$/, async (ctx) => {
//   console.log("🔢 Выбрана цифра класса:", ctx.callbackQuery.data);
//   await registrationHandler.handleRegistrationAction(ctx);
// });

// bot.action(/^classLetter_[АБВГДЕ]?$/, async (ctx) => {
//   console.log("🔤 Выбрана буква класса:", ctx.callbackQuery.data);
//   await registrationHandler.handleRegistrationAction(ctx);
// });

// // Обработчики для регистрации (город, школа)
// bot.action(/^register_.+/, async (ctx) => {
//   await registrationHandler.handleRegistrationAction(ctx);
// });

// // === КОМАНДЫ ДЛЯ КУХНИ ===

// // Команда /kitchen
// bot.command(
//   "kitchen",
//   allowKitchen,
//   auditMiddleware("kitchen_panel"),
//   async (ctx) => {
//     if (!ctx.state.user) {
//       return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//     }
//     await kitchenHandler.showKitchenMenu(ctx);
//   },
// );

// // Обработчики кнопок кухни
// bot.action("kitchen_back", allowKitchen, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await kitchenHandler.showKitchenMenu(ctx);
// });

// bot.action("kitchen_create_menu", allowKitchen, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await kitchenHandler.startCreateMenu(ctx);
// });

// bot.action("kitchen_my_menus", allowKitchen, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await kitchenHandler.showMyMenus(ctx);
// });

// bot.action("kitchen_replace_menu", allowKitchen, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await kitchenHandler.replaceMenu(ctx);
// });

// bot.action("kitchen_cancel", allowKitchen, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   ctx.session.menuCreation = null;
//   await kitchenHandler.showKitchenMenu(ctx);
// });

// bot.action("kitchen_finish", allowKitchen, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await kitchenHandler.finishMenuCreation(ctx);
// });

// // Просмотр конкретного меню кухней
// bot.action(/^kitchen_view_menu_(\d+)$/, allowKitchen, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   const menuId = parseInt(ctx.match[1]);
//   await kitchenHandler.showMenuDetails(ctx, menuId);
// });

// // === КОМАНДЫ ДЛЯ УЧЕНИКОВ/РОДИТЕЛЕЙ ===

// // Команда /menu для просмотра меню
// bot.command("menu", allowUser, auditMiddleware("view_menu"), async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await menuHandler.showUserMenu(ctx);
// });

// // Команда /order для заказа
// bot.command("order", allowUser, auditMiddleware("make_order"), async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await orderHandler.startOrder(ctx);
// });

// // Обработчик для кнопки "Меню" в главном меню
// bot.action("parent_menu", allowUser, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await menuHandler.showUserMenu(ctx);
// });

// bot.action("user_menu", allowUser, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await menuHandler.showUserMenu(ctx);
// });

// // Обработчик для кнопки "Заказать" в главном меню
// bot.action("parent_order", allowUser, async (ctx) => {
//   console.log("📝 КНОПКА parent_order НАЖАТА");
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await orderHandler.startOrder(ctx);
// });

// bot.action("user_order", allowUser, async (ctx) => {
//   console.log("📝 КНОПКА user_order НАЖАТА");
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await orderHandler.startOrder(ctx);
// });

// // Обработчик для возврата в меню
// bot.action("user_menu_back", allowUser, async (ctx) => {
//   await menuHandler.showUserMenu(ctx);
// });

// // Просмотр конкретного меню пользователем
// bot.action(/^user_view_menu_(\d+)$/, allowUser, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   const menuId = parseInt(ctx.match[1]);
//   await menuHandler.showUserMenuDetails(ctx, menuId);
// });

// // Заказ из конкретного меню
// bot.action(/^order_from_menu_(\d+)$/, allowUser, async (ctx) => {
//   console.log("📝 ЗАКАЗ ИЗ МЕНЮ, ID:", ctx.match[1]);
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   const menuId = parseInt(ctx.match[1]);
//   await orderHandler.startOrderFromMenu(ctx, menuId);
// });

// // Обработчики для процесса заказа
// bot.action(/^order_select_menu_(\d+)$/, allowUser, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   const menuId = parseInt(ctx.match[1]);
//   await orderHandler.startOrderFromMenu(ctx, menuId);
// });

// bot.action(/^order_toggle_item_(\d+)$/, allowUser, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   const itemIndex = parseInt(ctx.match[1]);
//   await orderHandler.toggleOrderItem(ctx, itemIndex);
// });

// bot.action("order_confirm", allowUser, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await orderHandler.confirmOrder(ctx);
// });

// // === АДМИН-КОМАНДЫ ===

// // Команда /admin
// bot.command(
//   "admin",
//   allowAdmin,
//   auditMiddleware("admin_panel"),
//   async (ctx) => {
//     if (!ctx.state.user) {
//       return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//     }
//     await adminHandler.showAdminPanel(ctx);
//   },
// );

// // Главное меню админки
// bot.action("admin_back", allowAdmin, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await adminHandler.showAdminPanel(ctx);
// });

// // Управление кухней
// bot.action("admin_kitchen", allowAdmin, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await adminHandler.showKitchenStaff(ctx);
// });

// bot.action("admin_add_kitchen", allowAdmin, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await adminHandler.startAddKitchen(ctx);
// });

// bot.action("admin_replace_kitchen", allowAdmin, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await adminHandler.startReplaceKitchen(ctx);
// });

// bot.action("admin_remove_kitchen", allowAdmin, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await adminHandler.startRemoveKitchen(ctx);
// });

// // Обработка выбора школы для добавления кухни
// bot.action(/^admin_select_school_(\d+)$/, allowAdmin, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   const schoolId = parseInt(ctx.match[1]);
//   await adminHandler.handleAddKitchenSchool(ctx, schoolId);
// });

// // Обработка выбора сотрудника для замены
// bot.action(/^admin_replace_select_(\d+)$/, allowAdmin, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   const userId = parseInt(ctx.match[1]);
//   await adminHandler.handleReplaceKitchen(ctx, userId);
// });

// // Обработка выбора сотрудника для удаления
// bot.action(/^admin_remove_select_(\d+)$/, allowAdmin, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   const userId = parseInt(ctx.match[1]);
//   await adminHandler.handleRemoveKitchen(ctx, userId);
// });

// // Управление городами
// bot.action("admin_cities", allowAdmin, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await adminHandler.showCities(ctx);
// });

// bot.action("admin_add_city", allowAdmin, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await adminHandler.startAddCity(ctx);
// });

// // Управление школами
// bot.action("admin_schools", allowAdmin, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await adminHandler.showSchools(ctx);
// });

// bot.action("admin_add_school", allowAdmin, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await adminHandler.startAddSchool(ctx);
// });

// bot.action(/^admin_select_city_(\d+)$/, allowAdmin, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   const cityId = parseInt(ctx.match[1]);
//   ctx.session = ctx.session || {};
//   ctx.session.adminCityId = cityId;
//   await ctx.reply("🏫 **Добавление школы**\n\nВведите название школы:");
// });

// // Пользователи и статистика
// bot.action("admin_users", allowAdmin, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await adminHandler.showUsers(ctx);
// });

// bot.action("admin_stats", allowAdmin, async (ctx) => {
//   if (!ctx.state.user) {
//     return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
//   }
//   await adminHandler.showStats(ctx);
// });

// // === ОБРАБОТЧИК ТЕКСТОВЫХ СООБЩЕНИЙ ===
// bot.use(async (ctx, next) => {
//   // Пропускаем callback запросы (они обрабатываются отдельно)
//   if (ctx.callbackQuery) {
//     return next();
//   }

//   // Пропускаем команды
//   if (ctx.message?.text?.startsWith("/")) {
//     return next();
//   }

//   console.log("\n📝 ТЕКСТОВОЕ СООБЩЕНИЕ");
//   console.log("ctx.state.user:", ctx.state.user);
//   console.log("Текст:", ctx.message?.text);

//   // Проверяем создание меню (кухня)
//   if (ctx.session?.menuCreation) {
//     const text = ctx.message.text.trim();
//     if (text === "/done") {
//       await kitchenHandler.finishMenuCreation(ctx);
//       return;
//     }
//     if (ctx.session.menuCreation.step === "date") {
//       await kitchenHandler.handleMenuDate(ctx, text);
//       return;
//     }
//     if (ctx.session.menuCreation.step === "items") {
//       await kitchenHandler.handleMenuItem(ctx, text);
//       return;
//     }
//   }

//   // Проверяем создание заказа
//   if (ctx.session?.orderCreation) {
//     const text = ctx.message.text.trim();
//     await orderHandler.handleOrderInput(ctx, text);
//     return;
//   }

//   // Проверяем админские действия
//   if (ctx.session?.adminAction) {
//     const text = ctx.message.text.trim();
//     switch (ctx.session.adminAction) {
//       case "add_city":
//         await adminHandler.handleAddCity(ctx, text);
//         ctx.session.adminAction = null;
//         return;
//       case "add_school":
//         if (ctx.session.adminCityId) {
//           await adminHandler.handleAddSchool(
//             ctx,
//             ctx.session.adminCityId,
//             text,
//           );
//           ctx.session.adminAction = null;
//           ctx.session.adminCityId = null;
//         }
//         return;
//       case "add_kitchen_telegram":
//         if (!/^\d+$/.test(text)) {
//           await ctx.reply(
//             "❌ Telegram ID должен быть числом! Попробуйте еще раз.",
//           );
//           return;
//         }
//         await adminHandler.handleAddKitchenTelegram(ctx, text);
//         return;
//       case "replace_kitchen_new":
//         if (!/^\d+$/.test(text)) {
//           await ctx.reply(
//             "❌ Telegram ID должен быть числом! Попробуйте еще раз.",
//           );
//           return;
//         }
//         await adminHandler.handleReplaceKitchenNew(ctx, text);
//         return;
//     }
//   }

//   // Проверяем, есть ли ожидающий ввод кода
//   if (ctx.session?.pendingRole) {
//     const code = ctx.message.text.trim();
//     if (
//       ctx.session.pendingRole === "kitchen" &&
//       code === config.security.kitchenSecret
//     ) {
//       ctx.session.pendingRole = null;
//       await ctx.reply("✅ Код принят! Начинаем регистрацию...");
//       await startRegistration(ctx, "kitchen");
//       return;
//     }
//     if (
//       ctx.session.pendingRole === "class_teacher" &&
//       code === config.security.teacherSecret
//     ) {
//       ctx.session.pendingRole = null;
//       await ctx.reply("✅ Код принят! Начинаем регистрацию...");
//       await startRegistration(ctx, "class_teacher");
//       return;
//     }
//     ctx.session.pendingRole = null;
//     await ctx.reply(
//       "❌ Неверный код! Нажмите /start и попробуйте снова.\n\nЕсли вы учитель или сотрудник кухни, обратитесь к администратору.",
//     );
//     return;
//   }

//   // Обычная обработка текста (регистрация)
//   if (ctx.session?.registration) {
//     await registrationHandler.handleRegistrationInput(ctx);
//     return;
//   }

//   return next();
// });

// // Временные обработчики для остальных кнопок
// bot.action("help", async (ctx) => {
//   await ctx.reply("🆘 Помощь пока в разработке");
// });

// bot.action(/^(parent|user)_profile/, async (ctx) => {
//   await ctx.answerCbQuery("⏳ Профиль в разработке");
// });

// // Команда /help
// bot.help(auditMiddleware("help"), (ctx) => {
//   const user = ctx.state.user;
//   if (!user) {
//     return ctx.reply("Используйте /start для начала работы");
//   }

//   let helpText = "📋 **Доступные команды**\n\n";
//   helpText += "/start - Начать работу\n";
//   helpText += "/help - Показать это сообщение\n";
//   helpText += "/profile - Ваш профиль\n";

//   if (user.role === "user" || user.role === "parent" || user.role === "admin") {
//     helpText += "🍽️ /menu - Посмотреть меню\n";
//     helpText += "📝 /order - Сделать заказ\n";
//   }

//   if (user.role === "class_teacher" || user.role === "admin") {
//     helpText += "\n👥 **Для учителя:**\n";
//     helpText += "📋 /class_orders - Заказы класса\n";
//     helpText += "💰 /mark_paid - Отметить оплату\n";
//   }

//   if (user.role === "kitchen" || user.role === "admin") {
//     helpText += "\n🍳 **Для кухни:**\n";
//     helpText += "📊 /today_orders - Заказы сегодня\n";
//     helpText += "✅ /confirm_order - Подтвердить заказ\n";
//     helpText += "📝 /kitchen - Панель управления кухней\n";
//   }

//   if (user.role === "admin") {
//     helpText += "\n👑 **Админ-команды:**\n";
//     helpText += "/admin - Панель управления\n";
//   }

//   ctx.reply(helpText, { parse_mode: "Markdown" });
// });

// // Команда /profile
// bot.command("profile", auditMiddleware("profile"), (ctx) => {
//   const user = ctx.state.user;
//   if (!user) {
//     return ctx.reply("Используйте /start для начала работы");
//   }

//   let profileText = "👤 **Ваш профиль**\n\n";
//   profileText += `🆔 ID: ${user.id}\n`;
//   profileText += `📱 Telegram ID: ${user.telegram_id}\n`;
//   profileText += `👤 Роль: ${getRoleName(user.role)}\n`;
//   profileText += `✅ Статус: ${user.is_active ? "Активен" : "Заблокирован"}\n`;

//   if (user.city_id) {
//     const cityName = getCityName(user.city_id);
//     profileText += `🏙️ **Город:** ${cityName}\n`;
//   }
//   if (user.school_id) {
//     const schoolName = getSchoolName(user.school_id);
//     profileText += `🏫 **Школа:** ${schoolName}\n`;
//   }
//   if (user.class_name) profileText += `📚 **Класс:** ${user.class_name}\n`;
//   if (user.child_name) profileText += `👤 **Ученик:** ${user.child_name}\n`;

//   profileText += `\n📅 **Зарегистрирован:** ${new Date(user.created_at).toLocaleDateString("ru-RU")}`;
//   ctx.reply(profileText, { parse_mode: "Markdown" });
// });

// // Вспомогательные функции для получения названий
// function getCityName(cityId) {
//   try {
//     const { prepare } = require("../database/db");
//     const city = prepare("SELECT name FROM cities WHERE id = ?").get(cityId);
//     return city ? city.name : "Неизвестный город";
//   } catch {
//     return "Неизвестный город";
//   }
// }

// function getSchoolName(schoolId) {
//   try {
//     const { prepare } = require("../database/db");
//     const school = prepare("SELECT name FROM schools WHERE id = ?").get(
//       schoolId,
//     );
//     return school ? school.name : "Неизвестная школа";
//   } catch {
//     return "Неизвестная школа";
//   }
// }

// // Обработка ошибок
// bot.catch(errorHandler);

// module.exports = bot;

// Функция для получения названия роли

const { Telegraf, session, Markup } = require("telegraf");
const { HttpsProxyAgent } = require("https-proxy-agent");
const rateLimit = require("telegraf-ratelimit");
const config = require("../config");
const logger = require("../utils/logger");
const { sanitizeInput, requestLogger } = require("../middlewares/security");
const errorHandler = require("../middlewares/errorHandler");
const authMiddleware = require("../middlewares/auth");
const {
  allowAdmin,
  allowTeacher,
  allowKitchen,
  allowUser,
} = require("../middlewares/roleCheck");
const { auditMiddleware } = require("../middlewares/audit");
const {
  startHandler,
  handleRoleSelection,
  startRegistration,
} = require("../handlers/start");
const registrationHandler = require("../handlers/registration");
const adminHandler = require("../handlers/admin");
const kitchenHandler = require("../handlers/kitchen");
const menuHandler = require("../handlers/menu");
const orderHandler = require("../handlers/order");

// Создаем прокси агент
const proxyAgent = new HttpsProxyAgent("http://127.0.0.1:10801");

// Создаем экземпляр бота с прокси
const bot = new Telegraf(config.bot.token, {
  telegram: { agent: proxyAgent },
});

function getRoleName(role) {
  const roles = {
    user: "👤 Пользователь",
    admin: "🔑 Администратор",
    class_teacher: "🍎 Классный руководитель",
    kitchen: "🍳 Кухня",
    parent: "👪 Родитель/Ученик",
  };
  return roles[role] || role;
}

// Глобальный middleware для всех callback запросов
bot.use(async (ctx, next) => {
  if (ctx.callbackQuery) {
    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch (e) {}
  }
  return next();
});

// Настройка middleware
bot.use(session());
bot.use(requestLogger);
bot.use(sanitizeInput);
bot.use(
  rateLimit({
    window: config.security.rateLimit.window,
    limit: config.security.rateLimit.limit,
    onLimitExceeded: (ctx) => {
      logger.warn("Rate limit exceeded", {
        userId: ctx.from?.id,
        username: ctx.from?.username,
      });
      ctx.reply("⏳ Слишком много запросов. Пожалуйста, подождите.");
    },
  }),
);
bot.use(authMiddleware);

// Подключаем обработчик команды /start
bot.start(auditMiddleware("start"), startHandler);

// Обработчик нажатий на кнопки выбора роли
bot.action(/^role_.+/, async (ctx) => {
  console.log("✅ Нажата кнопка роли:", ctx.callbackQuery.data);
  await handleRoleSelection(ctx);
});

// Обработчики для выбора класса
bot.action(/^classGrade_\d+$/, async (ctx) => {
  console.log("🔢 Выбрана цифра класса:", ctx.callbackQuery.data);
  await registrationHandler.handleRegistrationAction(ctx);
});

bot.action(/^classLetter_[АБВГДЕ]?$/, async (ctx) => {
  console.log("🔤 Выбрана буква класса:", ctx.callbackQuery.data);
  await registrationHandler.handleRegistrationAction(ctx);
});

// Обработчики для регистрации (город, школа)
bot.action(/^register_.+/, async (ctx) => {
  await registrationHandler.handleRegistrationAction(ctx);
});

// === КОМАНДЫ ДЛЯ КУХНИ ===

// Команда /kitchen
bot.command(
  "kitchen",
  allowKitchen,
  auditMiddleware("kitchen_panel"),
  async (ctx) => {
    if (!ctx.state.user) {
      return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
    }
    await kitchenHandler.showKitchenMenu(ctx);
  },
);

// Обработчики кнопок кухни
bot.action("kitchen_back", allowKitchen, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await kitchenHandler.showKitchenMenu(ctx);
});

bot.action("kitchen_create_menu", allowKitchen, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await kitchenHandler.startCreateMenu(ctx);
});

bot.action("kitchen_my_menus", allowKitchen, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await kitchenHandler.showMyMenus(ctx);
});

bot.action("kitchen_replace_menu", allowKitchen, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await kitchenHandler.replaceMenu(ctx);
});

bot.action("kitchen_cancel", allowKitchen, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  ctx.session.menuCreation = null;
  await kitchenHandler.showKitchenMenu(ctx);
});

bot.action("kitchen_finish", allowKitchen, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await kitchenHandler.finishMenuCreation(ctx);
});

// Просмотр конкретного меню кухней
bot.action(/^kitchen_view_menu_(\d+)$/, allowKitchen, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  const menuId = parseInt(ctx.match[1]);
  await kitchenHandler.showMenuDetails(ctx, menuId);
});

// === КОМАНДЫ ДЛЯ УЧЕНИКОВ/РОДИТЕЛЕЙ ===

// Команда /menu
bot.command("menu", allowUser, auditMiddleware("view_menu"), async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await menuHandler.showUserMenu(ctx);
});

// Команда /order
bot.command("order", allowUser, auditMiddleware("make_order"), async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await orderHandler.startOrder(ctx);
});

// Обработчики кнопок меню
bot.action("parent_menu", allowUser, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await menuHandler.showUserMenu(ctx);
});

bot.action("user_menu", allowUser, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await menuHandler.showUserMenu(ctx);
});

// Обработчики кнопок заказа
bot.action("parent_order", allowUser, async (ctx) => {
  console.log("📝 КНОПКА parent_order НАЖАТА");
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await orderHandler.startOrder(ctx);
});

bot.action("user_order", allowUser, async (ctx) => {
  console.log("📝 КНОПКА user_order НАЖАТА");
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await orderHandler.startOrder(ctx);
});

bot.action("user_menu_back", allowUser, async (ctx) => {
  await menuHandler.showUserMenu(ctx);
});

// Просмотр меню пользователем
bot.action(/^user_view_menu_(\d+)$/, allowUser, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  const menuId = parseInt(ctx.match[1]);
  await menuHandler.showUserMenuDetails(ctx, menuId);
});

// Заказ из меню
bot.action(/^order_from_menu_(\d+)$/, allowUser, async (ctx) => {
  console.log("📝 ЗАКАЗ ИЗ МЕНЮ, ID:", ctx.match[1]);
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  const menuId = parseInt(ctx.match[1]);
  await orderHandler.startOrderFromMenu(ctx, menuId);
});

bot.action(/^order_select_menu_(\d+)$/, allowUser, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  const menuId = parseInt(ctx.match[1]);
  await orderHandler.startOrderFromMenu(ctx, menuId);
});

bot.action(/^order_toggle_item_(\d+)$/, allowUser, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  const itemIndex = parseInt(ctx.match[1]);
  await orderHandler.toggleOrderItem(ctx, itemIndex);
});

bot.action("order_confirm", allowUser, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await orderHandler.confirmOrder(ctx);
});

// === АДМИН-КОМАНДЫ ===

// Команда /admin
bot.command(
  "admin",
  allowAdmin,
  auditMiddleware("admin_panel"),
  async (ctx) => {
    if (!ctx.state.user) {
      return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
    }
    await adminHandler.showAdminPanel(ctx);
  },
);

// Главное меню админки
bot.action("admin_back", allowAdmin, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await adminHandler.showAdminPanel(ctx);
});

// Управление кухней
bot.action("admin_kitchen", allowAdmin, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await adminHandler.showKitchenStaff(ctx);
});

bot.action("admin_add_kitchen", allowAdmin, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await adminHandler.startAddKitchen(ctx);
});

bot.action("admin_replace_kitchen", allowAdmin, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await adminHandler.startReplaceKitchen(ctx);
});

bot.action("admin_remove_kitchen", allowAdmin, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await adminHandler.startRemoveKitchen(ctx);
});

// Обработка выбора школы для добавления кухни
bot.action(/^admin_select_school_(\d+)$/, allowAdmin, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  const schoolId = parseInt(ctx.match[1]);
  await adminHandler.handleAddKitchenSchool(ctx, schoolId);
});

// Обработка выбора сотрудника для замены
bot.action(/^admin_replace_select_(\d+)$/, allowAdmin, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  const userId = parseInt(ctx.match[1]);
  await adminHandler.handleReplaceKitchen(ctx, userId);
});

// Обработка выбора сотрудника для удаления
bot.action(/^admin_remove_select_(\d+)$/, allowAdmin, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  const userId = parseInt(ctx.match[1]);
  await adminHandler.handleRemoveKitchen(ctx, userId);
});

// Управление городами
bot.action("admin_cities", allowAdmin, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await adminHandler.showCities(ctx);
});

bot.action("admin_add_city", allowAdmin, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await adminHandler.startAddCity(ctx);
});

// Управление школами
bot.action("admin_schools", allowAdmin, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await adminHandler.showSchools(ctx);
});

bot.action("admin_add_school", allowAdmin, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await adminHandler.startAddSchool(ctx);
});

bot.action(/^admin_select_city_(\d+)$/, allowAdmin, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  const cityId = parseInt(ctx.match[1]);
  ctx.session = ctx.session || {};
  ctx.session.adminCityId = cityId;
  await ctx.reply("🏫 **Добавление школы**\n\nВведите название школы:");
});

// Пользователи и статистика
bot.action("admin_users", allowAdmin, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await adminHandler.showUsers(ctx);
});

bot.action("admin_stats", allowAdmin, async (ctx) => {
  if (!ctx.state.user) {
    return ctx.reply("❗ Необходимо авторизоваться. Используйте /start");
  }
  await adminHandler.showStats(ctx);
});

// === ОБРАБОТЧИК ТЕКСТОВЫХ СООБЩЕНИЙ ===
bot.use(async (ctx, next) => {
  if (ctx.callbackQuery) return next();
  if (ctx.message?.text?.startsWith("/")) return next();

  console.log("\n📝 ТЕКСТОВОЕ СООБЩЕНИЕ");
  console.log("ctx.state.user:", ctx.state.user);
  console.log("Текст:", ctx.message?.text);

  if (ctx.session?.menuCreation) {
    const text = ctx.message.text.trim();
    if (text === "/done") {
      await kitchenHandler.finishMenuCreation(ctx);
      return;
    }
    if (ctx.session.menuCreation.step === "date") {
      await kitchenHandler.handleMenuDate(ctx, text);
      return;
    }
    if (ctx.session.menuCreation.step === "items") {
      await kitchenHandler.handleMenuItem(ctx, text);
      return;
    }
  }

  if (ctx.session?.orderCreation) {
    const text = ctx.message.text.trim();
    await orderHandler.handleOrderInput(ctx, text);
    return;
  }

  if (ctx.session?.adminAction) {
    const text = ctx.message.text.trim();
    switch (ctx.session.adminAction) {
      case "add_city":
        await adminHandler.handleAddCity(ctx, text);
        ctx.session.adminAction = null;
        return;
      case "add_school":
        if (ctx.session.adminCityId) {
          await adminHandler.handleAddSchool(
            ctx,
            ctx.session.adminCityId,
            text,
          );
          ctx.session.adminAction = null;
          ctx.session.adminCityId = null;
        }
        return;
      case "add_kitchen_telegram":
        if (!/^\d+$/.test(text)) {
          await ctx.reply(
            "❌ Telegram ID должен быть числом! Попробуйте еще раз.",
          );
          return;
        }
        await adminHandler.handleAddKitchenTelegram(ctx, text);
        return;
      case "replace_kitchen_new":
        if (!/^\d+$/.test(text)) {
          await ctx.reply(
            "❌ Telegram ID должен быть числом! Попробуйте еще раз.",
          );
          return;
        }
        await adminHandler.handleReplaceKitchenNew(ctx, text);
        return;
    }
  }

  if (ctx.session?.pendingRole) {
    const code = ctx.message.text.trim();
    if (
      ctx.session.pendingRole === "kitchen" &&
      code === config.security.kitchenSecret
    ) {
      ctx.session.pendingRole = null;
      await ctx.reply("✅ Код принят! Начинаем регистрацию...");
      await startRegistration(ctx, "kitchen");
      return;
    }
    if (
      ctx.session.pendingRole === "class_teacher" &&
      code === config.security.teacherSecret
    ) {
      ctx.session.pendingRole = null;
      await ctx.reply("✅ Код принят! Начинаем регистрацию...");
      await startRegistration(ctx, "class_teacher");
      return;
    }
    ctx.session.pendingRole = null;
    await ctx.reply(
      "❌ Неверный код! Нажмите /start и попробуйте снова.\n\nЕсли вы учитель или сотрудник кухни, обратитесь к администратору.",
    );
    return;
  }

  if (ctx.session?.registration) {
    await registrationHandler.handleRegistrationInput(ctx);
    return;
  }

  return next();
});

// Временные обработчики
bot.action("help", async (ctx) => {
  await ctx.reply("🆘 Помощь пока в разработке");
});

bot.action(/^(parent|user)_profile/, async (ctx) => {
  await ctx.answerCbQuery("⏳ Профиль в разработке");
});

// Команда /help
bot.help(auditMiddleware("help"), (ctx) => {
  const user = ctx.state.user;
  if (!user) return ctx.reply("Используйте /start для начала работы");

  let helpText = "📋 **Доступные команды**\n\n";
  helpText += "/start - Начать работу\n";
  helpText += "/help - Показать это сообщение\n";
  helpText += "/profile - Ваш профиль\n";

  if (user.role === "user" || user.role === "parent" || user.role === "admin") {
    helpText += "🍽️ /menu - Посмотреть меню\n";
    helpText += "📝 /order - Сделать заказ\n";
  }

  if (user.role === "class_teacher" || user.role === "admin") {
    helpText += "\n👥 **Для учителя:**\n";
    helpText += "📋 /class_orders - Заказы класса\n";
    helpText += "💰 /mark_paid - Отметить оплату\n";
  }

  if (user.role === "kitchen" || user.role === "admin") {
    helpText += "\n🍳 **Для кухни:**\n";
    helpText += "📊 /today_orders - Заказы сегодня\n";
    helpText += "✅ /confirm_order - Подтвердить заказ\n";
    helpText += "📝 /kitchen - Панель управления кухней\n";
  }

  if (user.role === "admin") {
    helpText += "\n👑 **Админ-команды:**\n";
    helpText += "/admin - Панель управления\n";
  }

  ctx.reply(helpText, { parse_mode: "Markdown" });
});

// Команда /profile
bot.command("profile", auditMiddleware("profile"), (ctx) => {
  const user = ctx.state.user;
  if (!user) return ctx.reply("Используйте /start для начала работы");

  let profileText = "👤 **Ваш профиль**\n\n";
  profileText += `🆔 ID: ${user.id}\n`;
  profileText += `📱 Telegram ID: ${user.telegram_id}\n`;
  profileText += `👤 Роль: ${getRoleName(user.role)}\n`;
  profileText += `✅ Статус: ${user.is_active ? "Активен" : "Заблокирован"}\n`;

  if (user.city_id) {
    const cityName = getCityName(user.city_id);
    profileText += `🏙️ **Город:** ${cityName}\n`;
  }
  if (user.school_id) {
    const schoolName = getSchoolName(user.school_id);
    profileText += `🏫 **Школа:** ${schoolName}\n`;
  }
  if (user.class_name) profileText += `📚 **Класс:** ${user.class_name}\n`;
  if (user.child_name) profileText += `👤 **Ученик:** ${user.child_name}\n`;

  profileText += `\n📅 **Зарегистрирован:** ${new Date(user.created_at).toLocaleDateString("ru-RU")}`;
  ctx.reply(profileText, { parse_mode: "Markdown" });
});

// Вспомогательные функции
function getCityName(cityId) {
  try {
    const { prepare } = require("../database/db");
    const city = prepare("SELECT name FROM cities WHERE id = ?").get(cityId);
    return city ? city.name : "Неизвестный город";
  } catch {
    return "Неизвестный город";
  }
}

function getSchoolName(schoolId) {
  try {
    const { prepare } = require("../database/db");
    const school = prepare("SELECT name FROM schools WHERE id = ?").get(
      schoolId,
    );
    return school ? school.name : "Неизвестная школа";
  } catch {
    return "Неизвестная школа";
  }
}

// Обработка ошибок
bot.catch(errorHandler);

module.exports = bot;
