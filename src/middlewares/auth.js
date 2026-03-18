const { prepare } = require("../database/db");
const logger = require("../utils/logger");

async function authMiddleware(ctx, next) {
  try {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      return next();
    }

    // ВСЕГДА ищем пользователя в БД, включая callback запросы!
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

    if (user) {
      // Пользователь найден - сохраняем в состояние
      ctx.state.user = user;
      logger.debug("User authenticated", {
        userId: user.id,
        role: user.role,
        telegramId,
      });
    } else {
      // Пользователь НЕ найден
      ctx.state.user = null;
      logger.info("User not found in DB", { telegramId });
    }

    return next();
  } catch (error) {
    logger.error("Auth middleware error:", {
      error: error.message,
      telegramId: ctx.from?.id,
    });
    return next();
  }
}

module.exports = authMiddleware;
