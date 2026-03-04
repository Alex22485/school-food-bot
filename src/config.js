require('dotenv').config();
const path = require('path');

module.exports = {
    bot: {
        token: process.env.BOT_TOKEN,
        environment: process.env.NODE_ENV || 'development'
    },
    database: {
        path: path.resolve(process.env.DB_PATH || './database.sqlite'),
        backupPath: path.resolve(process.env.DB_BACKUP_PATH || './backups')
    },
    security: {
        rateLimit: {
            window: parseInt(process.env.RATE_LIMIT_WINDOW) || 1000,
            limit: parseInt(process.env.RATE_LIMIT_LIMIT) || 1
        },
        adminIds: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [],
        appSecret: process.env.APP_SECRET
    }
};
