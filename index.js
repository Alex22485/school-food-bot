const Bot = require('./src/bot');
const logger = require('./src/utils/logger');

// Обработка сигналов завершения
process.once('SIGINT', () => {
    logger.info('Received SIGINT signal');
    bot.stop('SIGINT');
    process.exit(0);
});

process.once('SIGTERM', () => {
    logger.info('Received SIGTERM signal');
    bot.stop('SIGTERM');
    process.exit(0);
});

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled Rejection:', error);
    process.exit(1);
});

// Запуск бота
const bot = new Bot();
bot.launch();

console.log('��� Запуск бота...');
console.log('⚠️  Не забудьте добавить BOT_TOKEN в файл .env!');
