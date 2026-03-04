// const { Telegraf, session } = require("telegraf");
// const rateLimit = require("telegraf-ratelimit");
// const config = require("../config");
// const logger = require("../utils/logger");
// const { sanitizeInput, requestLogger } = require("../middlewares/security");
// const errorHandler = require("../middlewares/errorHandler");
// const escapeHtml = require("escape-html");

// class Bot {
//   constructor() {
//     this.bot = new Telegraf(config.bot.token);
//     this.setupMiddleware();
//     this.setupCommands();
//     this.setupErrorHandling();
//   }

//   setupMiddleware() {
//     // Сессии для временного хранения данных
//     this.bot.use(session());

//     // Логирование запросов
//     this.bot.use(requestLogger);

//     // Санитизация ввода
//     this.bot.use(sanitizeInput);

//     // Rate limiting для защиты от спама
//     this.bot.use(
//       rateLimit({
//         window: config.security.rateLimit.window,
//         limit: config.security.rateLimit.limit,
//         onLimitExceeded: (ctx) => {
//           logger.warn("Rate limit exceeded", {
//             userId: ctx.from?.id,
//             username: ctx.from?.username,
//           });
//           ctx.reply("Слишком много запросов. Пожалуйста, подождите.");
//         },
//       }),
//     );
//   }

//   setupCommands() {
//     // Базовая команда /start
//     this.bot.start((ctx) => {
//       const username = ctx.from.first_name || "Пользователь";
//       logger.info("User started bot", {
//         userId: ctx.from.id,
//         username: ctx.from.username,
//       });

//       ctx.reply(
//         `👋 Привет, ${escapeHtml(username)}!\n\n` +
//           "Я бот школьной столовой. Я помогу вам:\n" +
//           "🍽️ Посмотреть меню на сегодня\n" +
//           "📝 Сделать заказ\n" +
//           "ℹ️ Узнать статус заказа\n\n" +
//           "Используйте /help для списка всех команд.",
//       );
//     });

//     // Команда /help
//     this.bot.help((ctx) => {
//       ctx.reply(
//         "📋 Доступные команды:\n\n" +
//           "/start - Начать работу с ботом\n" +
//           "/help - Показать это сообщение\n" +
//           "/menu - Посмотреть меню на сегодня\n" +
//           "/order - Сделать заказ\n" +
//           "/status - Проверить статус заказа\n" +
//           "/profile - Ваш профиль",
//       );
//     });

//     // Временная команда /menu (заглушка)
//     this.bot.command("menu", (ctx) => {
//       ctx.reply(
//         "🍽️ Меню на сегодня:\n\n" +
//           "1. Борщ - 50₽\n" +
//           "2. Макароны с котлетой - 80₽\n" +
//           "3. Компот - 20₽\n\n" +
//           "Для заказа используйте /order",
//       );
//     });

//     // Временная команда /profile (заглушка)
//     this.bot.command("profile", (ctx) => {
//       ctx.reply(
//         `👤 Ваш профиль:\n` +
//           `ID: ${ctx.from.id}\n` +
//           `Имя: ${escapeHtml(ctx.from.first_name || "Не указано")}\n` +
//           `Username: @${ctx.from.username || "Не указан"}\n` +
//           `Статус: Пользователь`,
//       );
//     });

//     // Обработчик для неизвестных команд
//     this.bot.on("text", (ctx) => {
//       logger.debug("Unknown command", {
//         userId: ctx.from.id,
//         text: ctx.message.text,
//       });
//       ctx.reply(
//         "Извините, я не понимаю эту команду. Используйте /help для списка доступных команд.",
//       );
//     });
//   }

//   setupErrorHandling() {
//     this.bot.catch(errorHandler);
//   }

//   async launch() {
//     try {
//       await this.bot.launch();
//       logger.info("Bot started successfully", {
//         environment: config.bot.environment,
//       });
//       console.log("✅ Бот запущен! Нажмите Ctrl+C для остановки.");
//     } catch (error) {
//       logger.error("Failed to start bot:", error);
//       console.error("❌ Ошибка запуска бота:", error.message);
//       process.exit(1);
//     }
//   }

//   stop(signal) {
//     this.bot.stop(signal);
//     logger.info("Bot stopped", { signal });
//   }
// }

// module.exports = Bot;

const { Telegraf, session } = require("telegraf");
const rateLimit = require("telegraf-ratelimit");
const config = require("../config");
const logger = require("../utils/logger");
const { sanitizeInput, requestLogger } = require("../middlewares/security");
const errorHandler = require("../middlewares/errorHandler");
const escapeHtml = require("escape-html");

// Функция для настройки middleware
const setupMiddleware = (bot) => {
  // Сессии для временного хранения данных
  bot.use(session());

  // Логирование запросов
  bot.use(requestLogger);

  // Санитизация ввода
  bot.use(sanitizeInput);

  // Rate limiting для защиты от спама
  bot.use(
    rateLimit({
      window: config.security.rateLimit.window,
      limit: config.security.rateLimit.limit,
      onLimitExceeded: (ctx) => {
        logger.warn("Rate limit exceeded", {
          userId: ctx.from?.id,
          username: ctx.from?.username,
        });
        ctx.reply("Слишком много запросов. Пожалуйста, подождите.");
      },
    }),
  );
};

// Функция для настройки команд
const setupCommands = (bot) => {
  // Базовая команда /start
  bot.start((ctx) => {
    const username = ctx.from.first_name || "Пользователь";
    logger.info("User started bot", {
      userId: ctx.from.id,
      username: ctx.from.username,
    });

    ctx.reply(
      `👋 Привет, ${escapeHtml(username)}!\n\n` +
        "Я бот школьной столовой. Я помогу вам:\n" +
        "🍽️ Посмотреть меню на сегодня\n" +
        "📝 Сделать заказ\n" +
        "ℹ️ Узнать статус заказа\n\n" +
        "Используйте /help для списка всех команд.",
    );
  });

  // Команда /help
  bot.help((ctx) => {
    ctx.reply(
      "📋 Доступные команды:\n\n" +
        "/start - Начать работу с ботом\n" +
        "/help - Показать это сообщение\n" +
        "/menu - Посмотреть меню на сегодня\n" +
        "/order - Сделать заказ\n" +
        "/status - Проверить статус заказа\n" +
        "/profile - Ваш профиль",
    );
  });

  // Команда /menu
  bot.command("menu", (ctx) => {
    ctx.reply(
      "🍽️ Меню на сегодня:\n\n" +
        "1. Борщ - 50₽\n" +
        "2. Макароны с котлетой - 80₽\n" +
        "3. Компот - 20₽\n\n" +
        "Для заказа используйте /order",
    );
  });

  // Команда /profile
  bot.command("profile", (ctx) => {
    ctx.reply(
      `👤 Ваш профиль:\n` +
        `ID: ${ctx.from.id}\n` +
        `Имя: ${escapeHtml(ctx.from.first_name || "Не указано")}\n` +
        `Username: @${ctx.from.username || "Не указан"}\n` +
        `Статус: Пользователь`,
    );
  });

  // Заглушка для /order
  bot.command("order", (ctx) => {
    ctx.reply(
      "🛒 Функция заказа находится в разработке. Скоро она будет доступна!",
    );
  });

  // Заглушка для /status
  bot.command("status", (ctx) => {
    ctx.reply("📦 Функция проверки статуса заказа находится в разработке.");
  });

  // Обработчик для неизвестных команд
  bot.on("text", (ctx) => {
    logger.debug("Unknown command", {
      userId: ctx.from.id,
      text: ctx.message.text,
    });
    ctx.reply(
      "Извините, я не понимаю эту команду. Используйте /help для списка доступных команд.",
    );
  });
};

// Функция для настройки обработки ошибок
const setupErrorHandling = (bot) => {
  bot.catch(errorHandler);
};

// Функция создания бота (основная)
const createBot = () => {
  // Создаем экземпляр бота
  const bot = new Telegraf(config.bot.token);

  // Настраиваем все компоненты
  setupMiddleware(bot);
  setupCommands(bot);
  setupErrorHandling(bot);

  return bot;
};

// Функция запуска бота
const launchBot = async (bot) => {
  try {
    await bot.launch();
    logger.info("Bot started successfully", {
      environment: config.bot.environment,
    });
    console.log("✅ Бот запущен! Нажмите Ctrl+C для остановки.");
  } catch (error) {
    logger.error("Failed to start bot:", error);
    console.error("❌ Ошибка запуска бота:", error.message);
    process.exit(1);
  }
};

// Создаем и запускаем бота
const bot = createBot();
launchBot(bot);

// Обработка сигналов завершения
process.once("SIGINT", () => {
  bot.stop("SIGINT");
  logger.info("Bot stopped", { signal: "SIGINT" });
  process.exit(0);
});

process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
  logger.info("Bot stopped", { signal: "SIGTERM" });
  process.exit(0);
});

// Экспортируем бота для использования в других файлах
module.exports = bot;
