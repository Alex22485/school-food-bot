// const { prepare } = require('../database/db');
// const logger = require('../utils/logger');

// // Middleware для аутентификации пользователя
// async function authMiddleware(ctx, next) {
//     try {
//         // Пропускаем, если пользователь уже аутентифицирован
//         if (ctx.state?.user) {
//             return next();
//         }

//         const telegramId = ctx.from?.id;

//         if (!telegramId) {
//             logger.warn('Auth failed: No telegram ID', { ctx: ctx.update?.update_id });
//             return next();
//         }

//         // Ищем пользователя в БД
//         const user = prepare(`
//             SELECT
//                 id,
//                 telegram_id,
//                 role,
//                 city_id,
//                 school_id,
//                 class_name,
//                 child_name,
//                 shift,
//                 is_active,
//                 created_at
//             FROM users
//             WHERE telegram_id = ?
//         `).get(telegramId);

//         // Если пользователь не найден - создаем нового
//         if (!user) {
//             logger.info('New user registered', {
//                 telegramId,
//                 username: ctx.from.username,
//                 firstName: ctx.from.first_name
//             });

//             // Создаем нового пользователя
//             const insert = prepare(`
//                 INSERT INTO users (
//                     telegram_id,
//                     role,
//                     is_active,
//                     class_name,
//                     child_name
//                 ) VALUES (?, ?, ?, ?, ?)
//             `);

//             const result = insert.run(
//                 telegramId,
//                 'user',  // роль по умолчанию
//                 1,       // активен
//                 null,    // class_name
//                 null     // child_name
//             );

//             // Получаем созданного пользователя
//             const newUser = prepare(`
//                 SELECT
//                     id,
//                     telegram_id,
//                     role,
//                     city_id,
//                     school_id,
//                     class_name,
//                     child_name,
//                     shift,
//                     is_active,
//                     created_at
//                 FROM users
//                 WHERE id = ?
//             `).get(result.lastInsertRowid);

//             ctx.state.user = newUser;

//             // Приветствуем нового пользователя
//             await ctx.reply(
//                 '��� Добро пожаловать! Вы зарегистрированы как обычный пользователь.\n' +
//                 'Для полноценной работы вам нужно указать:\n' +
//                 '• Город и школу\n' +
//                 '• Класс (если вы ученик)\n' +
//                 '• Имя ребенка (если вы родитель)\n\n' +
//                 'Используйте /profile для заполнения данных.'
//             );
//         } else {
//             // Проверяем, активен ли пользователь
//             if (!user.is_active) {
//                 logger.warn('Blocked user attempted access', {
//                     userId: user.id,
//                     telegramId
//                 });

//                 await ctx.reply('⛔ Ваш аккаунт заблокирован. Обратитесь к администратору.');
//                 return; // Прерываем выполнение
//             }

//             // Сохраняем пользователя в состояние
//             ctx.state.user = user;

//             logger.debug('User authenticated', {
//                 userId: user.id,
//                 role: user.role,
//                 telegramId
//             });
//         }

//         return next();
//     } catch (error) {
//         logger.error('Auth middleware error:', {
//             error: error.message,
//             stack: error.stack,
//             telegramId: ctx.from?.id
//         });

//         await ctx.reply('❌ Произошла ошибка аутентификации. Попробуйте позже.');
//         // Не пробрасываем ошибку дальше, чтобы не крашить бота
//     }
// }

// module.exports = authMiddleware;

const { prepare } = require("../database/db");
const logger = require("../utils/logger");

// Middleware для аутентификации пользователя
async function authMiddleware(ctx, next) {
  try {
    // Пропускаем, если пользователь уже аутентифицирован
    if (ctx.state?.user) {
      return next();
    }

    const telegramId = ctx.from?.id;

    if (!telegramId) {
      logger.warn("Auth failed: No telegram ID", {
        ctx: ctx.update?.update_id,
      });
      return next();
    }

    // Ищем пользователя в БД
    const user = prepare(`
            SELECT 
                id,
                telegram_id,
                role,
                city_id,
                school_id,
                class_name,
                child_name,
                shift,
                is_active,
                created_at
            FROM users 
            WHERE telegram_id = ?
        `).get(telegramId);

    // Если пользователь не найден - создаем нового, НО НЕ ОТПРАВЛЯЕМ ПРИВЕТСТВИЕ
    if (!user) {
      logger.info("New user registered", {
        telegramId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
      });

      // Создаем нового пользователя
      const insert = prepare(`
                INSERT INTO users (
                    telegram_id, 
                    role, 
                    is_active,
                    class_name,
                    child_name
                ) VALUES (?, ?, ?, ?, ?)
            `);

      const result = insert.run(
        telegramId,
        "user", // роль по умолчанию
        1, // активен
        null, // class_name
        null, // child_name
      );

      // Получаем созданного пользователя
      const newUser = prepare(`
                SELECT 
                    id,
                    telegram_id,
                    role,
                    city_id,
                    school_id,
                    class_name,
                    child_name,
                    shift,
                    is_active,
                    created_at
                FROM users 
                WHERE id = ?
            `).get(result.lastInsertRowid);

      ctx.state.user = newUser;

      // НЕ ОТПРАВЛЯЕМ ПРИВЕТСТВИЕ ЗДЕСЬ - оно будет в /start
      // Просто логируем создание пользователя
      logger.info("New user created, waiting for /start", {
        userId: newUser.id,
        telegramId,
      });
    } else {
      // Проверяем, активен ли пользователь
      if (!user.is_active) {
        logger.warn("Blocked user attempted access", {
          userId: user.id,
          telegramId,
        });

        await ctx.reply(
          "⛔ Ваш аккаунт заблокирован. Обратитесь к администратору.",
        );
        return; // Прерываем выполнение
      }

      // Сохраняем пользователя в состояние
      ctx.state.user = user;

      logger.debug("User authenticated", {
        userId: user.id,
        role: user.role,
        telegramId,
      });
    }

    return next();
  } catch (error) {
    logger.error("Auth middleware error:", {
      error: error.message,
      stack: error.stack,
      telegramId: ctx.from?.id,
    });

    // Не отправляем сообщение об ошибке, чтобы не дублировать
    // Просто пробрасываем дальше
    return next();
  }
}

module.exports = authMiddleware;
