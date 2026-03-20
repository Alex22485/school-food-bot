// const bot = require("./src/bot/index");
// const logger = require("./src/utils/logger");
// const { closeDB } = require("./src/database/db");

// console.log("🚀 Запуск бота...");

// // Флаг для отслеживания состояния бота
// let isBotRunning = false;

// // Функция запуска бота
// async function startBot() {
//   try {
//     // Запускаем бота
//     await bot.launch();
//     isBotRunning = true;
//     logger.info("Bot started successfully");
//     console.log("✅ Бот успешно запущен! Нажмите Ctrl+C для остановки.");
//   } catch (error) {
//     logger.error("Failed to start bot:", error);
//     console.error("❌ Ошибка запуска бота:", error.message);
//     process.exit(1);
//   }
// }

// // Функция остановки бота
// async function stopBot(signal) {
//   console.log(`\n🛑 Получен сигнал ${signal}...`);
//   logger.info(`Received ${signal} signal`);

//   if (isBotRunning) {
//     try {
//       // Останавливаем бота только если он запущен
//       await bot.stop(signal);
//       logger.info("Bot stopped gracefully");
//       console.log("✅ Бот остановлен");
//     } catch (error) {
//       logger.error("Error stopping bot:", error);
//       console.log("⚠️ Ошибка при остановке бота:", error.message);
//     }
//   } else {
//     console.log("⚠️ Бот не был запущен");
//   }

//   // Закрываем соединение с БД
//   try {
//     closeDB();
//     logger.info("Database connection closed");
//   } catch (error) {
//     logger.error("Error closing database:", error);
//   }

//   process.exit(0);
// }

// // Обработка сигналов завершения
// process.once("SIGINT", () => stopBot("SIGINT"));
// process.once("SIGTERM", () => stopBot("SIGTERM"));

// // Обработка необработанных ошибок
// process.on("uncaughtException", (error) => {
//   logger.error("Uncaught Exception:", error);
//   console.error("❌ Необработанная ошибка:", error.message);
//   console.error(error.stack);
//   stopBot("UNCAUGHT_EXCEPTION");
// });

// process.on("unhandledRejection", (error) => {
//   logger.error("Unhandled Rejection:", error);
//   console.error("❌ Необработанный промис:", error.message);
//   console.error(error.stack);
//   stopBot("UNHANDLED_REJECTION");
// });

// // Запускаем бота
// startBot();

// index.js (корневой файл)

const bot = require("./src/bot/index");
const logger = require("./src/utils/logger");
const { closeDB } = require("./src/database/db");

console.log("🚀 Запуск бота...");

let isBotRunning = false;

async function startBot() {
  try {
    await bot.launch();
    isBotRunning = true;
    logger.info("Bot started successfully");
    console.log("✅ Бот успешно запущен! Нажмите Ctrl+C для остановки.");
  } catch (error) {
    logger.error("Failed to start bot:", error);
    console.error("❌ Ошибка запуска бота:", error.message);
    process.exit(1);
  }
}

async function stopBot(signal) {
  console.log(`\n🛑 Получен сигнал ${signal}...`);
  logger.info(`Received ${signal} signal`);

  if (isBotRunning) {
    try {
      await bot.stop(signal);
      logger.info("Bot stopped gracefully");
      console.log("✅ Бот остановлен");
    } catch (error) {
      logger.error("Error stopping bot:", error);
    }
  }

  try {
    closeDB();
    logger.info("Database connection closed");
  } catch (error) {
    logger.error("Error closing database:", error);
  }

  process.exit(0);
}

process.once("SIGINT", () => stopBot("SIGINT"));
process.once("SIGTERM", () => stopBot("SIGTERM"));

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  console.error("❌ Необработанная ошибка:", error.message);
  stopBot("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (error) => {
  logger.error("Unhandled Rejection:", error);
  console.error("❌ Необработанный промис:", error.message);
  stopBot("UNHANDLED_REJECTION");
});

startBot();
