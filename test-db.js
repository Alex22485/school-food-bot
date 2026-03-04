const { connectDB, checkIntegrity, closeDB, prepare, getDb } = require('./src/database/db');
const logger = require('./src/utils/logger');

try {
    // Подключаемся к БД
    connectDB();
    
    // Проверяем целостность
    checkIntegrity();
    
    // Проверяем, что данные создались
    const db = getDb();
    
    const cities = prepare('SELECT * FROM cities').all();
    console.log('Города:', cities);
    
    const schools = prepare('SELECT * FROM schools').all();
    console.log('Школы:', schools);
    
    const users = prepare('SELECT id, telegram_id, role FROM users').all();
    console.log('Пользователи:', users);
    
    console.log('✅ База данных успешно создана и настроена!');
    
    // Закрываем соединение
    closeDB();
} catch (error) {
    console.error('❌ Ошибка:', error.message);
    logger.error('Test failed:', error);
}
