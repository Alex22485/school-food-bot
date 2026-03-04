const dbManager = require('./src/database/db');
const logger = require('./src/utils/logger');

try {
    // Подключаемся к БД
    dbManager.connect();
    
    // Проверяем целостность
    dbManager.checkIntegrity();
    
    // Проверяем, что данные создались
    const db = dbManager.db;
    
    const cities = db.prepare('SELECT * FROM cities').all();
    console.log('Города:', cities);
    
    const schools = db.prepare('SELECT * FROM schools').all();
    console.log('Школы:', schools);
    
    console.log('✅ База данных успешно создана и настроена!');
    
    // Закрываем соединение
    dbManager.close();
} catch (error) {
    console.error('❌ Ошибка:', error.message);
    logger.error('Test failed:', error);
}
