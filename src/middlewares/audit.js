const { prepare, isConnected, connectDB } = require('../database/db');
const logger = require('../utils/logger');

// Проверяем и создаем таблицу для аудита, если её нет
function ensureAuditTable() {
    try {
        if (!isConnected()) {
            connectDB();
        }
        
        // Создаем таблицу для логов аудита
        prepare(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                telegram_id INTEGER,
                action TEXT NOT NULL,
                entity_type TEXT,
                entity_id INTEGER,
                old_data JSON,
                new_data JSON,
                ip TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `).run();
        
        // Создаем индекс для быстрого поиска
        prepare(`
            CREATE INDEX IF NOT EXISTS idx_audit_user 
            ON audit_logs(user_id, created_at)
        `).run();
        
        prepare(`
            CREATE INDEX IF NOT EXISTS idx_audit_action 
            ON audit_logs(action, created_at)
        `).run();
        
    } catch (error) {
        logger.error('Failed to create audit table:', error);
    }
}

// Функция для записи действия в аудит
function logAudit({
    userId,
    telegramId,
    action,
    entityType = null,
    entityId = null,
    oldData = null,
    newData = null,
    ctx = null
}) {
    try {
        if (!isConnected()) {
            connectDB();
        }
        
        // Получаем IP и User-Agent если есть контекст
        let ip = null;
        let userAgent = null;
        
        if (ctx) {
            // Telegram не передает IP и User-Agent напрямую,
            // но мы можем получить некоторую информацию
            ip = ctx.message?.from?.language_code || null;
            userAgent = 'Telegram Bot';
        }

        // Вставляем запись в аудит
        const insert = prepare(`
            INSERT INTO audit_logs (
                user_id, telegram_id, action, entity_type, 
                entity_id, old_data, new_data, ip, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insert.run(
            userId,
            telegramId,
            action,
            entityType,
            entityId,
            oldData ? JSON.stringify(oldData) : null,
            newData ? JSON.stringify(newData) : null,
            ip,
            userAgent
        );

        // Также логируем в файл
        logger.info('Audit log', {
            userId,
            telegramId,
            action,
            entityType,
            entityId
        });

    } catch (error) {
        logger.error('Failed to write audit log:', {
            error: error.message,
            userId,
            action
        });
    }
}

// Middleware для автоматического аудита команд
function auditMiddleware(action, entityType = null) {
    return async function(ctx, next) {
        const startTime = Date.now();
        
        try {
            // Запоминаем состояние до выполнения
            const beforeState = {
                user: ctx.state?.user ? { ...ctx.state.user } : null,
                message: ctx.message?.text
            };

            // Выполняем следующий middleware
            await next();

            // После выполнения записываем аудит
            if (ctx.state?.user) {
                const afterState = {
                    user: ctx.state.user,
                    response: ctx.message?.reply_to_message?.text
                };

                logAudit({
                    userId: ctx.state.user.id,
                    telegramId: ctx.state.user.telegram_id,
                    action: action,
                    entityType: entityType,
                    newData: {
                        command: ctx.message?.text,
                        response: ctx.message?.reply_to_message?.text,
                        executionTime: Date.now() - startTime
                    },
                    ctx
                });
            }
        } catch (error) {
            // Логируем ошибки
            if (ctx.state?.user) {
                logAudit({
                    userId: ctx.state.user.id,
                    telegramId: ctx.state.user.telegram_id,
                    action: 'error',
                    entityType: entityType || 'command',
                    newData: {
                        command: ctx.message?.text,
                        error: error.message,
                        executionTime: Date.now() - startTime
                    },
                    ctx
                });
            }
            throw error; // Пробрасываем ошибку дальше
        }
    };
}

// Инициализируем таблицу при загрузке модуля
ensureAuditTable();

module.exports = {
    logAudit,
    auditMiddleware
};
