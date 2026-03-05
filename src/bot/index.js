// const { Telegraf, session } = require("telegraf");
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
// const { startHandler, handleRoleSelection } = require("../handlers/start");
// const registrationHandler = require("../handlers/registration");

// // Создаем экземпляр бота
// const bot = new Telegraf(config.bot.token);

// // Функция для получения названия роли
// function getRoleName(role) {
//   const roles = {
//     user: "👤 Пользователь",
//     admin: "🔑 Администратор",
//     class_teacher: "🍎 Классный руководитель",
//     kitchen: "🍳 Кухня",
//     parent: "👪 Родитель",
//   };
//   return roles[role] || role;
// }

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
// bot.use(authMiddleware);

// // Подключаем обработчик команды /start
// bot.start(auditMiddleware("start"), startHandler);

// // Обработчик нажатий на кнопки выбора роли
// bot.action(/^role_.+/, async (ctx) => {
//   console.log("✅ Нажата кнопка роли:", ctx.callbackQuery.data);
//   await handleRoleSelection(ctx);
// });

// // Обработчики для регистрации (машина состояний)
// bot.action(/^register_.+/, async (ctx) => {
//   await registrationHandler.handleRegistrationAction(ctx);
// });

// bot.on("text", async (ctx) => {
//   // Проверяем, находится ли пользователь в процессе регистрации
//   if (ctx.session?.registration) {
//     await registrationHandler.handleRegistrationInput(ctx);
//   } else if (ctx.message.text.startsWith("/")) {
//     // Неизвестная команда
//     logger.debug("Unknown command", {
//       userId: ctx.state.user?.id,
//       text: ctx.message.text,
//     });
//     ctx.reply("❓ Неизвестная команда. Используйте /help");
//   }
// });

// // Временные обработчики для остальных кнопок
// bot.action("help", async (ctx) => {
//   await ctx.answerCbQuery();
//   await ctx.reply("🆘 Помощь пока в разработке");
// });

// bot.action(/^(parent|teacher|kitchen|user)_menu/, async (ctx) => {
//   await ctx.answerCbQuery("⏳ Меню в разработке");
// });

// bot.action(/^(parent|teacher|kitchen|user)_order/, async (ctx) => {
//   await ctx.answerCbQuery("⏳ Заказ в разработке");
// });

// bot.action(/^(parent|user)_profile/, async (ctx) => {
//   await ctx.answerCbQuery("⏳ Профиль в разработке");
// });

// bot.action(/^admin_.+/, async (ctx) => {
//   await ctx.answerCbQuery("⏳ Админ-панель в разработке");
// });

// // Команда /help
// bot.help(auditMiddleware("help"), (ctx) => {
//   const user = ctx.state.user;
//   if (!user) {
//     return ctx.reply("Используйте /start для начала работы");
//   }

//   let helpText = "📋 Доступные команды:\n\n";
//   helpText += "/start - Начать работу с ботом\n";
//   helpText += "/help - Показать это сообщение\n";
//   helpText += "/profile - Ваш профиль\n";

//   if (user.role === "user" || user.role === "parent" || user.role === "admin") {
//     helpText += "🍽️ /menu - Посмотреть меню на сегодня\n";
//     helpText += "📝 /order - Сделать заказ\n";
//   }

//   if (user.role === "class_teacher" || user.role === "admin") {
//     helpText += "\n👥 Команды классного руководителя:\n";
//     helpText += "📋 /class_orders - Заказы класса\n";
//     helpText += "💰 /mark_paid - Отметить оплату\n";
//   }

//   if (user.role === "kitchen" || user.role === "admin") {
//     helpText += "\n🍳 Команды кухни:\n";
//     helpText += "📊 /today_orders - Заказы на сегодня\n";
//     helpText += "✅ /confirm_order - Подтвердить заказ\n";
//   }

//   if (user.role === "admin") {
//     helpText += "\n⚙️ Команды администратора:\n";
//     helpText += "🏫 /add_school - Добавить школу\n";
//     helpText += "📅 /add_menu - Добавить меню\n";
//     helpText += "👥 /users - Управление пользователями\n";
//   }

//   ctx.reply(helpText);
// });

// // Команда /profile
// bot.command("profile", auditMiddleware("profile"), (ctx) => {
//   const user = ctx.state.user;
//   if (!user) {
//     return ctx.reply("Используйте /start для начала работы");
//   }

//   let profileText = "👤 Ваш профиль:\n\n";
//   profileText += `🆔 ID: ${user.id}\n`;
//   profileText += `📱 Telegram ID: ${user.telegram_id}\n`;
//   profileText += `👤 Роль: ${getRoleName(user.role)}\n`;
//   profileText += `✅ Статус: ${user.is_active ? "Активен" : "Заблокирован"}\n`;

//   if (user.city_id) profileText += `🏙️ Город: ${user.city_id}\n`;
//   if (user.school_id) profileText += `🏫 Школа: ${user.school_id}\n`;
//   if (user.class_name) profileText += `📚 Класс: ${user.class_name}\n`;
//   if (user.child_name) profileText += `👶 Ребенок: ${user.child_name}\n`;
//   if (user.shift) profileText += `⏰ Смена: ${user.shift}\n`;

//   profileText += `\n📅 Зарегистрирован: ${new Date(user.created_at).toLocaleDateString("ru-RU")}`;
//   ctx.reply(profileText);
// });

// // Команда /users (только для админов)
// bot.command("users", allowAdmin, auditMiddleware("view_users"), async (ctx) => {
//   const { prepare } = require("../database/db");
//   try {
//     const users = prepare(`
//       SELECT id, telegram_id, role, is_active, created_at
//       FROM users
//       ORDER BY created_at DESC
//       LIMIT 10
//     `).all();

//     let text = "👥 Последние пользователи:\n\n";
//     users.forEach((u) => {
//       text += `🆔 ${u.id} | 📱 ${u.telegram_id} | ${getRoleName(u.role)} | ${u.is_active ? "✅" : "❌"}\n`;
//     });
//     ctx.reply(text);
//   } catch (error) {
//     logger.error("Failed to fetch users:", error);
//     ctx.reply("❌ Ошибка получения списка пользователей");
//   }
// });

// // Команда /menu
// bot.command("menu", allowUser, auditMiddleware("view_menu"), (ctx) => {
//   ctx.reply(
//     "🍽️ Меню на сегодня:\n\n" +
//       "🍲 1. Борщ - 50₽\n" +
//       "🍝 2. Макароны с котлетой - 80₽\n" +
//       "🥤 3. Компот - 20₽\n\n" +
//       "📝 Для заказа используйте /order",
//   );
// });

// // Обработка ошибок
// bot.catch(errorHandler);

// module.exports = bot;

const { Telegraf, session } = require("telegraf");
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
const { startHandler, handleRoleSelection } = require("../handlers/start");
const registrationHandler = require("../handlers/registration");

// Создаем экземпляр бота
const bot = new Telegraf(config.bot.token);

// Функция для получения названия роли
function getRoleName(role) {
  const roles = {
    user: "👤 Пользователь",
    admin: "🔑 Администратор",
    class_teacher: "🍎 Классный руководитель",
    kitchen: "🍳 Кухня",
    parent: "👪 Родитель",
  };
  return roles[role] || role;
}

// Настройка middleware (порядок важен!)
bot.use(session()); // Сессии для временных данных
bot.use(requestLogger); // Логирование запросов
bot.use(sanitizeInput); // Защита от XSS
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

// НОВЫЕ обработчики для выбора класса
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

// Обработчик текстового ввода (только для имени ребенка)
bot.on("text", async (ctx) => {
  // Проверяем, находится ли пользователь в процессе регистрации
  if (ctx.session?.registration) {
    await registrationHandler.handleRegistrationInput(ctx);
  } else if (ctx.message.text.startsWith("/")) {
    // Неизвестная команда
    logger.debug("Unknown command", {
      userId: ctx.state.user?.id,
      text: ctx.message.text,
    });
    ctx.reply("❓ Неизвестная команда. Используйте /help");
  }
});

// Временные обработчики для остальных кнопок
bot.action("help", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("🆘 Помощь пока в разработке");
});

bot.action(/^(parent|teacher|kitchen|user)_menu/, async (ctx) => {
  await ctx.answerCbQuery("⏳ Меню в разработке");
});

bot.action(/^(parent|teacher|kitchen|user)_order/, async (ctx) => {
  await ctx.answerCbQuery("⏳ Заказ в разработке");
});

bot.action(/^(parent|user)_profile/, async (ctx) => {
  await ctx.answerCbQuery("⏳ Профиль в разработке");
});

bot.action(/^admin_.+/, async (ctx) => {
  await ctx.answerCbQuery("⏳ Админ-панель в разработке");
});

// Команда /help
bot.help(auditMiddleware("help"), (ctx) => {
  const user = ctx.state.user;
  if (!user) {
    return ctx.reply("Используйте /start для начала работы");
  }

  let helpText = "📋 Доступные команды:\n\n";
  helpText += "/start - Начать работу с ботом\n";
  helpText += "/help - Показать это сообщение\n";
  helpText += "/profile - Ваш профиль\n";

  if (user.role === "user" || user.role === "parent" || user.role === "admin") {
    helpText += "🍽️ /menu - Посмотреть меню на сегодня\n";
    helpText += "📝 /order - Сделать заказ\n";
  }

  if (user.role === "class_teacher" || user.role === "admin") {
    helpText += "\n👥 Команды классного руководителя:\n";
    helpText += "📋 /class_orders - Заказы класса\n";
    helpText += "💰 /mark_paid - Отметить оплату\n";
  }

  if (user.role === "kitchen" || user.role === "admin") {
    helpText += "\n🍳 Команды кухни:\n";
    helpText += "📊 /today_orders - Заказы на сегодня\n";
    helpText += "✅ /confirm_order - Подтвердить заказ\n";
  }

  if (user.role === "admin") {
    helpText += "\n⚙️ Команды администратора:\n";
    helpText += "🏫 /add_school - Добавить школу\n";
    helpText += "📅 /add_menu - Добавить меню\n";
    helpText += "👥 /users - Управление пользователями\n";
  }

  ctx.reply(helpText);
});

// Команда /profile
bot.command("profile", auditMiddleware("profile"), (ctx) => {
  const user = ctx.state.user;
  if (!user) {
    return ctx.reply("Используйте /start для начала работы");
  }

  let profileText = "👤 Ваш профиль:\n\n";
  profileText += `🆔 ID: ${user.id}\n`;
  profileText += `📱 Telegram ID: ${user.telegram_id}\n`;
  profileText += `👤 Роль: ${getRoleName(user.role)}\n`;
  profileText += `✅ Статус: ${user.is_active ? "Активен" : "Заблокирован"}\n`;

  if (user.city_id) {
    const cityName = getCityName(user.city_id);
    profileText += `🏙️ Город: ${cityName}\n`;
  }
  if (user.school_id) {
    const schoolName = getSchoolName(user.school_id);
    profileText += `🏫 Школа: ${schoolName}\n`;
  }
  if (user.class_name) profileText += `📚 Класс: ${user.class_name}\n`;
  if (user.child_name) profileText += `👶 Ребенок: ${user.child_name}\n`;
  if (user.shift) profileText += `⏰ Смена: ${user.shift}\n`;

  profileText += `\n📅 Зарегистрирован: ${new Date(user.created_at).toLocaleDateString("ru-RU")}`;
  ctx.reply(profileText);
});

// Вспомогательные функции для получения названий
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

// Команда /users (только для админов)
bot.command("users", allowAdmin, auditMiddleware("view_users"), async (ctx) => {
  const { prepare } = require("../database/db");
  try {
    const users = prepare(`
      SELECT id, telegram_id, role, is_active, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `).all();

    let text = "👥 Последние пользователи:\n\n";
    users.forEach((u) => {
      text += `🆔 ${u.id} | 📱 ${u.telegram_id} | ${getRoleName(u.role)} | ${u.is_active ? "✅" : "❌"}\n`;
    });
    ctx.reply(text);
  } catch (error) {
    logger.error("Failed to fetch users:", error);
    ctx.reply("❌ Ошибка получения списка пользователей");
  }
});

// Команда /menu
bot.command("menu", allowUser, auditMiddleware("view_menu"), (ctx) => {
  ctx.reply(
    "🍽️ Меню на сегодня:\n\n" +
      "🍲 1. Борщ - 50₽\n" +
      "🍝 2. Макароны с котлетой - 80₽\n" +
      "🥤 3. Компот - 20₽\n\n" +
      "📝 Для заказа используйте /order",
  );
});

// Обработка ошибок
bot.catch(errorHandler);

module.exports = bot;
