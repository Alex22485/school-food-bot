const bot = require('./src/bot');
const logger = require('./src/utils/logger');
const { closeDB } = require('./src/database/db');

console.log('��� Запуск бота...');

// Функция запуска бота
async function startBot() {
    try {
        // Запускаем бота
        await bot.launch();
        logger.info('Bot started successfully');
        console.log('✅ Бот успешно запущен! Нажмите Ctrl+C для остановки.');
    } catch (error) {
        logger.error('Failed to start bot:', error);
        console.error('❌ Ошибка запуска бота:', error.message);
        process.exit(1);
    }
}

// Обработка сигналов завершения
process.once('SIGINT', () => {
    console.log('\n��� Получен сигнал остановки...');
    logger.info('Received SIGINT signal');
    
    // Останавливаем бота
    bot.stop('SIGINT');
    
    // Закрываем соединение с БД
    closeDB();
    
    logger.info('Bot stopped gracefully');
    console.log('✅ Бот остановлен');
    process.exit(0);
});

process.once('SIGTERM', () => {
    console.log('\n��� Получен сигнал завершения...');
    logger.info('Received SIGTERM signal');
    
    // Останавливаем бота
    bot.stop('SIGTERM');
    
    // Закрываем соединение с БД
    closeDB();
    
    logger.info('Bot stopped gracefully');
    console.log('✅ Бот остановлен');
    process.exit(0);
});

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    console.error('❌ Необработанная ошибка:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled Rejection:', error);
    console.error('❌ Необработанный промис:', error.message);
    process.exit(1);
});

// Запускаем бота
startBot();
