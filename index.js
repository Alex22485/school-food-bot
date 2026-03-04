const logger = require("./src/utils/logger");

require("dotenv").config();
const bot = require("./src/bot");

console.log("Бот запущен...");

// Обработка сигналов завершения
process.once("SIGINT", () => {
  logger.info("Received SIGINT signal");
  bot.stop("SIGINT");
  process.exit(0);
});

process.once("SIGTERM", () => {
  logger.info("Received SIGTERM signal");
  bot.stop("SIGTERM");
  process.exit(0);
});

// Обработка необработанных ошибок
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  logger.error("Unhandled Rejection:", error);
  process.exit(1);
});

console.log("��� Запуск бота...");
console.log("⚠️  Не забудьте добавить BOT_TOKEN в файл .env!");
