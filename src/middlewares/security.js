const escapeHtml = require("escape-html");
const logger = require("../utils/logger");

// Middleware для экранирования пользовательского ввода
const sanitizeInput = (ctx, next) => {
  if (ctx.message && ctx.message.text) {
    // Экранируем HTML-специальные символы
    ctx.message.text = escapeHtml(ctx.message.text);
  }
  return next();
};

// Middleware для логирования всех запросов
const requestLogger = (ctx, next) => {
  const start = Date.now();

  logger.info("Incoming request", {
    userId: ctx.from?.id,
    username: ctx.from?.username,
    command: ctx.message?.text,
    chatId: ctx.chat?.id,
  });

  return next()
    .then(() => {
      const ms = Date.now() - start;
      logger.debug("Response time", { ms });
    })
    .catch((err) => {
      logger.error("Request error", {
        error: err.message,
        stack: err.stack,
        userId: ctx.from?.id,
      });
      throw err;
    });
};

module.exports = {
  sanitizeInput,
  requestLogger,
};
