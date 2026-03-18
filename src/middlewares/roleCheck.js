const logger = require("../utils/logger");

// Фабрика функций для проверки ролей
function allowRoles(allowedRoles = []) {
  return async function roleMiddleware(ctx, next) {
    try {
      // Проверяем, есть ли пользователь в контексте
      if (!ctx.state?.user) {
        logger.warn("Role check failed: No user in context", {
          telegramId: ctx.from?.id,
        });

        await ctx.reply("⚠️ Необходимо авторизоваться. Используйте /start");
        return;
      }

      const userRole = ctx.state.user.role;

      // Проверяем, есть ли у пользователя разрешенная роль
      if (!allowedRoles.includes(userRole)) {
        logger.warn("Access denied: Insufficient permissions", {
          userId: ctx.state.user.id,
          userRole,
          requiredRoles: allowedRoles,
          command: ctx.message?.text,
        });

        await ctx.reply("⛔ У вас нет прав для выполнения этой команды.");
        return;
      }

      logger.debug("Role check passed", {
        userId: ctx.state.user.id,
        role: userRole,
        requiredRoles: allowedRoles,
      });

      ctx.state.allowedRoles = allowedRoles;

      return next();
    } catch (error) {
      logger.error("Role check error:", {
        error: error.message,
        userId: ctx.state?.user?.id,
        telegramId: ctx.from?.id,
      });

      await ctx.reply("❌ Ошибка проверки прав доступа.");
    }
  };
}

// Вспомогательные middleware для конкретных ролей
const allowAdmin = allowRoles(["admin"]);
const allowTeacher = allowRoles(["admin", "class_teacher"]);
const allowKitchen = allowRoles(["admin", "kitchen"]);
const allowUser = allowRoles([
  "user",
  "admin",
  "class_teacher",
  "kitchen",
  "parent",
]);
const allowParent = allowRoles(["admin", "parent"]);

module.exports = {
  allowRoles,
  allowAdmin,
  allowTeacher,
  allowKitchen,
  allowUser,
  allowParent,
};
