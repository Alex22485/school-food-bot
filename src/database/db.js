const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const config = require('../config');

// Переменные для хранения подключения
let db = null;
let isConnected = false;

// Подключение к БД с безопасными настройками
function connectDB() {
    try {
        if (isConnected) {
            return db;
        }

        // Убедимся, что папка для бэкапов существует
        const backupPath = config.database.backupPath;
        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath, { recursive: true });
        }

        // Подключаемся к БД
        db = new Database(config.database.path);

        // Включаем поддержку внешних ключей
        db.pragma('foreign_keys = ON');
        
        // Используем WAL режим для лучшей производительности и целостности
        db.pragma('journal_mode = WAL');
        
        // Устанавливаем таймаут на блокировки
        db.pragma('busy_timeout = 5000');
        
        // Включаем строгий режим типов данных
        db.pragma('strict = ON');

        isConnected = true;

        logger.info('Database connected successfully', { 
            path: config.database.path,
            journalMode: db.pragma('journal_mode', { simple: true })
        });

        // Запускаем миграции
        runMigrations();

        return db;
    } catch (error) {
        logger.error('Failed to connect to database:', error);
        throw error;
    }
}

// Создание бэкапа перед критическими операциями
function backupDB() {
    try {
        if (!isConnected) {
            connectDB();
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(config.database.backupPath, `backup-${timestamp}.sqlite`);
        
        // Создаем бэкап через механизм SQLite
        db.backup(backupFile);
        
        logger.info('Database backup created', { backupFile });
        return backupFile;
    } catch (error) {
        logger.error('Failed to create database backup:', error);
        throw error;
    }
}

// Миграции базы данных
function runMigrations() {
    try {
        if (!isConnected) {
            connectDB();
        }

        // Создаем таблицу для отслеживания миграций
        db.exec(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Проверяем, выполнялась ли миграция
        const migrationName = 'initial_schema_v1';
        const existing = db.prepare('SELECT id FROM migrations WHERE name = ?').get(migrationName);

        if (!existing) {
            logger.info('Running initial database migration...');
            
            // Начинаем транзакцию для атомарности
            const createTables = db.transaction(() => {
                // Таблица пользователей
                db.exec(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        telegram_id INTEGER UNIQUE NOT NULL,
                        role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin', 'class_teacher', 'kitchen')),
                        city_id INTEGER,
                        school_id INTEGER,
                        class_name TEXT,
                        child_name TEXT,
                        shift TEXT DEFAULT '1' CHECK(shift IN ('1', '2')),
                        is_active BOOLEAN DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL,
                        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL
                    )
                `);

                // Таблица городов
                db.exec(`
                    CREATE TABLE IF NOT EXISTS cities (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT UNIQUE NOT NULL,
                        created_by INTEGER NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
                    )
                `);

                // Таблица школ
                db.exec(`
                    CREATE TABLE IF NOT EXISTS schools (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        city_id INTEGER NOT NULL,
                        order_deadline_time TEXT DEFAULT '20:00',
                        created_by INTEGER NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE,
                        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
                        UNIQUE(name, city_id)
                    )
                `);

                // Таблица меню
                db.exec(`
                    CREATE TABLE IF NOT EXISTS menus (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        city_id INTEGER NOT NULL,
                        school_id INTEGER NOT NULL,
                        date DATE NOT NULL,
                        items JSON NOT NULL,
                        created_by INTEGER NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE,
                        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
                        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
                        UNIQUE(school_id, date)
                    )
                `);

                // Таблица заказов
                db.exec(`
                    CREATE TABLE IF NOT EXISTS orders (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        menu_id INTEGER NOT NULL,
                        order_date DATE NOT NULL,
                        items JSON NOT NULL,
                        total_price DECIMAL(10,2) NOT NULL,
                        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'confirmed', 'completed', 'cancelled')),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE RESTRICT,
                        UNIQUE(user_id, menu_id)
                    )
                `);

                // Таблица платежей
                db.exec(`
                    CREATE TABLE IF NOT EXISTS payments (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        order_id INTEGER NOT NULL UNIQUE,
                        class_teacher_id INTEGER NOT NULL,
                        is_paid BOOLEAN DEFAULT 0,
                        paid_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                        FOREIGN KEY (class_teacher_id) REFERENCES users(id) ON DELETE RESTRICT
                    )
                `);

                // Создаем индексы для оптимизации
                db.exec(`
                    CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
                    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
                    CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);
                    
                    CREATE INDEX IF NOT EXISTS idx_schools_city ON schools(city_id);
                    
                    CREATE INDEX IF NOT EXISTS idx_menus_date ON menus(date);
                    CREATE INDEX IF NOT EXISTS idx_menus_school_date ON menus(school_id, date);
                    
                    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
                    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
                    CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
                    
                    CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
                    CREATE INDEX IF NOT EXISTS idx_payments_paid ON payments(is_paid);
                `);

                // Записываем миграцию
                db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migrationName);
            });

            // Выполняем транзакцию
            createTables();

            // Заполняем начальными данными
            seedInitialData();

            logger.info('Database migration completed successfully');
        } else {
            logger.info('Database schema already up to date');
        }
    } catch (error) {
        logger.error('Migration failed:', error);
        throw error;
    }
}

// Начальные данные
function seedInitialData() {
    try {
        if (!isConnected) {
            connectDB();
        }

        // Проверяем, есть ли уже данные
        const cityCount = db.prepare('SELECT COUNT(*) as count FROM cities').get();
        
        if (cityCount.count === 0) {
            logger.info('Seeding initial data...');

            // Сначала создаем админа по умолчанию (системный пользователь)
            const insertUser = db.prepare(`
                INSERT INTO users (telegram_id, role, is_active) 
                VALUES (?, ?, ?)
            `);
            
            const systemUser = insertUser.run(0, 'admin', 1);
            const systemUserId = systemUser.lastInsertRowid;

            // Добавляем город
            const insertCity = db.prepare(`
                INSERT INTO cities (name, created_by) 
                VALUES (?, ?)
            `);
            
            const city = insertCity.run('Красноярск', systemUserId);
            const cityId = city.lastInsertRowid;

            // Добавляем школу
            const insertSchool = db.prepare(`
                INSERT INTO schools (name, city_id, order_deadline_time, created_by) 
                VALUES (?, ?, ?, ?)
            `);
            
            insertSchool.run('Школа №93', cityId, '20:00', systemUserId);

            logger.info('Initial data seeded successfully', { 
                cityId, 
                systemUserId 
            });
        }
    } catch (error) {
        logger.error('Failed to seed initial data:', error);
        throw error;
    }
}

// Функция для подготовки запросов
function prepare(sql) {
    if (!isConnected) {
        connectDB();
    }
    return db.prepare(sql);
}

// Функция для транзакций
function transaction(fn) {
    if (!isConnected) {
        connectDB();
    }
    return db.transaction(fn)();
}

// Закрытие соединения
function closeDB() {
    if (isConnected && db) {
        db.close();
        isConnected = false;
        logger.info('Database connection closed');
    }
}

// Проверка целостности данных
function checkIntegrity() {
    if (!isConnected) {
        connectDB();
    }
    const result = db.pragma('integrity_check');
    logger.info('Database integrity check', { result });
    return result;
}

// Экспортируем функции
module.exports = {
    connectDB,
    backupDB,
    prepare,
    transaction,
    closeDB,
    checkIntegrity,
    getDb: () => db,
    isConnected: () => isConnected
};
