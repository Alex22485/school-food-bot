const logger = require("../utils/logger");

const errorHandler = async (err, ctx) => {
  logger.error("Bot error:", {
    error: err.message,
    stack: err.stack,
    userId: ctx.from?.id,
    chatId: ctx.chat?.id,
  });

  try {
    await ctx.reply(
      "Извините, произошла внутренняя ошибка. Наша команда уже уведомлена.",
    );
  } catch (replyError) {
    logger.error("Failed to send error message:", replyError);
  }
};

module.exports = errorHandler;
