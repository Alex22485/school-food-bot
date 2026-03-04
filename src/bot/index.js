// const { Telegraf, session } = require('telegraf');
// const rateLimit = require('telegraf-ratelimit');
// const config = require('../config');
// const logger = require('../utils/logger');
// const { sanitizeInput, requestLogger } = require('../middlewares/security');
// const errorHandler = require('../middlewares/errorHandler');
// const authMiddleware = require('../middlewares/auth');
// const { allowAdmin, allowTeacher, allowKitchen, allowUser } = require('../middlewares/roleCheck');
// const { auditMiddleware } = require('../middlewares/audit');

// // Создаем экземпляр бота
// const bot = new Telegraf(config.bot.token);

// // Настройка middleware (порядок важен!)
// bot.use(session());                    // Сессии для временных данных
// bot.use(requestLogger);                  // Логирование запросов
// bot.use(sanitizeInput);                  // Защита от XSS
// bot.use(rateLimit({                       // Защита от спама
//     window: config.security.rateLimit.window,
//     limit: config.security.rateLimit.limit,
//     onLimitExceeded: (ctx) => {
//         logger.warn('Rate limit exceeded', {
//             userId: ctx.from?.id,
//             username: ctx.from?.username
//         });
//         ctx.reply('⏳ Слишком много запросов. Пожалуйста, подождите.');
//     }
// }));
// bot.use(authMiddleware);                  // Аутентификация (должна быть после session)

// // Команды с проверкой ролей и аудитом

// // Публичные команды (доступны всем)
// bot.start(auditMiddleware('start'), (ctx) => {
//     const user = ctx.state.user;
//     const username = ctx.from.first_name || 'Пользователь';

//     let welcomeText = `��� Привет, ${escapeHtml(username)}!\n\n`;

//     if (user.role === 'admin') {
//         welcomeText += '��� Вы вошли как администратор\n';
//     } else if (user.role === 'class_teacher') {
//         welcomeText += '��� Вы вошли как классный руководитель\n';
//     } else if (user.role === 'kitchen') {
//         welcomeText += '��� Вы вошли как сотрудник кухни\n';
//     } else if (user.role === 'parent') {
//         welcomeText += '��� Вы вошли как родитель\n';
//     }

//     welcomeText +=
//         'Я бот школьной столовой. Я помогу вам:\n' +
//         '���️ Посмотреть меню на сегодня\n' +
//         '��� Сделать заказ\n' +
//         'ℹ️ Узнать статус заказа\n\n' +
//         'Используйте /help для списка всех команд.';

//     ctx.reply(welcomeText);
// });

// bot.help(auditMiddleware('help'), (ctx) => {
//     const user = ctx.state.user;
//     let helpText = '��� Доступные команды:\n\n';

//     // Базовые команды для всех
//     helpText += '/start - Начать работу с ботом\n';
//     helpText += '/help - Показать это сообщение\n';
//     helpText += '/profile - Ваш профиль\n';

//     // Команды для обычных пользователей
//     if (user.role === 'user' || user.role === 'parent' || user.role === 'admin') {
//         helpText += '���️ /menu - Посмотреть меню на сегодня\n';
//         helpText += '��� /order - Сделать заказ\n';
//         helpText += 'ℹ️ /status - Проверить статус заказа\n';
//     }

//     // Команды для классных руководителей и админов
//     if (user.role === 'class_teacher' || user.role === 'admin') {
//         helpText += '\n��� Команды классного руководителя:\n';
//         helpText += '��� /class_orders - Заказы класса\n';
//         helpText += '��� /mark_paid - Отметить оплату\n';
//     }

//     // Команды для кухни и админов
//     if (user.role === 'kitchen' || user.role === 'admin') {
//         helpText += '\n��� Команды кухни:\n';
//         helpText += '��� /today_orders - Заказы на сегодня\n';
//         helpText += '✅ /confirm_order - Подтвердить заказ\n';
//     }

//     // Команды только для админов
//     if (user.role === 'admin') {
//         helpText += '\n⚙️ Команды администратора:\n';
//         helpText += '��� /add_school - Добавить школу\n';
//         helpText += '��� /add_menu - Добавить меню\n';
//         helpText += '��� /users - Управление пользователями\n';
//         helpText += '��� /audit - Просмотр логов аудита\n';
//     }

//     ctx.reply(helpText);
// });

// // Команда профиля (доступна всем аутентифицированным)
// bot.command('profile', auditMiddleware('profile'), (ctx) => {
//     const user = ctx.state.user;

//     let profileText = '��� Ваш профиль:\n\n';
//     profileText += `��� ID: ${user.id}\n`;
//     profileText += `��� Telegram ID: ${user.telegram_id}\n`;
//     profileText += `��� Роль: ${getRoleName(user.role)}\n`;
//     profileText += `✅ Статус: ${user.is_active ? 'Активен' : 'Заблокирован'}\n`;

//     if (user.city_id) {
//         profileText += `���️ Город ID: ${user.city_id}\n`;
//     }
//     if (user.school_id) {
//         profileText += `��� Школа ID: ${user.school_id}\n`;
//     }
//     if (user.class_name) {
//         profileText += `��� Класс: ${user.class_name}\n`;
//     }
//     if (user.child_name) {
//         profileText += `��� Ребенок: ${user.child_name}\n`;
//     }
//     if (user.shift) {
//         profileText += `⏰ Смена: ${user.shift}\n`;
//     }

//     profileText += `\n��� Зарегистрирован: ${new Date(user.created_at).toLocaleDateString('ru-RU')}`;

//     ctx.reply(profileText);
// });

// // Пример команды только для админов
// bot.command('users', allowAdmin, auditMiddleware('view_users'), (ctx) => {
//     const { prepare } = require('../database/db');

//     try {
//         const users = prepare(`
//             SELECT id, telegram_id, role, is_active, created_at
//             FROM users
//             ORDER BY created_at DESC
//             LIMIT 10
//         `).all();

//         let text = '��� Последние пользователи:\n\n';
//         users.forEach(u => {
//             text += `��� ${u.id} | ��� ${u.telegram_id} | ��� ${getRoleName(u.role)} | ${u.is_active ? '✅' : '❌'}\n`;
//         });

//         ctx.reply(text);
//     } catch (error) {
//         logger.error('Failed to fetch users:', error);
//         ctx.reply('❌ Ошибка получения списка пользователей');
//     }
// });

// // Временная команда меню (заглушка)
// bot.command('menu', allowUser, auditMiddleware('view_menu'), (ctx) => {
//     ctx.reply(
//         '���️ Меню на сегодня:\n\n' +
//         '��� 1. Борщ - 50₽\n' +
//         '��� 2. Макароны с котлетой - 80₽\n' +
//         '��� 3. Компот - 20₽\n\n' +
//         '��� Для заказа используйте /order'
//     );
// });

// // Обработчик неизвестных команд
// bot.on('text', (ctx) => {
//     logger.debug('Unknown command', {
//         userId: ctx.state.user?.id,
//         text: ctx.message.text
//     });
//     ctx.reply('❓ Извините, я не понимаю эту команду. Используйте /help для списка доступных команд.');
// });

// // Обработка ошибок
// bot.catch(errorHandler);

// // Вспомогательная функция для получения названия роли
// function getRoleName(role) {
//     const roles = {
//         'user': '��� Пользователь',
//         'admin': '��� Администратор',
//         'class_teacher': '��� Классный руководитель',
//         'kitchen': '��� Кухня',
//         'parent': '��� Родитель'
//     };
//     return roles[role] || role;
// }

// // Функция для экранирования HTML
// function escapeHtml(text) {
//     if (!text) return '';
//     return String(text)
//         .replace(/&/g, '&amp;')
//         .replace(/</g, '&lt;')
//         .replace(/>/g, '&gt;')
//         .replace(/"/g, '&quot;')
//         .replace(/'/g, '&#039;');
// }

// module.exports = bot;

const { Telegraf, session } = require("telegraf");
const rateLimit = require("telegraf-ratelimit");
const config = require("../config");
const logger = require("../utils/logger");
const { sanitizeInput, requestLogger } = require("../middlewares/security");
const errorHandler = require("../middlewares/errorHandler");
const authMiddleware = require("../middlewares/auth");
const {
  allowAdmin,
  allowTeacher,
  allowKitchen,
  allowUser,
} = require("../middlewares/roleCheck");
const { auditMiddleware } = require("../middlewares/audit");

// Создаем экземпляр бота
const bot = new Telegraf(config.bot.token);

// Настройка middleware (порядок важен!)
bot.use(session()); // Сессии для временных данных
bot.use(requestLogger); // Логирование запросов
bot.use(sanitizeInput); // Защита от XSS
bot.use(
  rateLimit({
    // Защита от спама
    window: config.security.rateLimit.window,
    limit: config.security.rateLimit.limit,
    onLimitExceeded: (ctx) => {
      logger.warn("Rate limit exceeded", {
        userId: ctx.from?.id,
        username: ctx.from?.username,
      });
      ctx.reply("⏳ Слишком много запросов. Пожалуйста, подождите.");
    },
  }),
);
bot.use(authMiddleware); // Аутентификация (должна быть после session)

// Команды с проверкой ролей и аудитом

// Публичные команды (доступны всем)
bot.start(auditMiddleware("start"), (ctx) => {
  const user = ctx.state.user;
  const username = ctx.from.first_name || "Пользователь";

  let welcomeText = `👋 Привет, ${escapeHtml(username)}!\n\n`;

  if (user.role === "admin") {
    welcomeText += "🔑 Вы вошли как администратор\n";
  } else if (user.role === "class_teacher") {
    welcomeText += "🍎 Вы вошли как классный руководитель\n";
  } else if (user.role === "kitchen") {
    welcomeText += "🍳 Вы вошли как сотрудник кухни\n";
  } else if (user.role === "parent") {
    welcomeText += "👪 Вы вошли как родитель\n";
  }

  welcomeText +=
    "Я бот школьной столовой. Я помогу вам:\n" +
    "🍽️ Посмотреть меню на сегодня\n" +
    "📝 Сделать заказ\n" +
    "ℹ️ Узнать статус заказа\n\n" +
    "Используйте /help для списка всех команд.";

  ctx.reply(welcomeText);
});

bot.help(auditMiddleware("help"), (ctx) => {
  const user = ctx.state.user;
  let helpText = "📋 Доступные команды:\n\n";

  // Базовые команды для всех
  helpText += "/start - Начать работу с ботом\n";
  helpText += "/help - Показать это сообщение\n";
  helpText += "/profile - Ваш профиль\n";

  // Команды для обычных пользователей
  if (user.role === "user" || user.role === "parent" || user.role === "admin") {
    helpText += "🍽️ /menu - Посмотреть меню на сегодня\n";
    helpText += "📝 /order - Сделать заказ\n";
    helpText += "ℹ️ /status - Проверить статус заказа\n";
  }

  // Команды для классных руководителей и админов
  if (user.role === "class_teacher" || user.role === "admin") {
    helpText += "\n👥 Команды классного руководителя:\n";
    helpText += "📋 /class_orders - Заказы класса\n";
    helpText += "💰 /mark_paid - Отметить оплату\n";
  }

  // Команды для кухни и админов
  if (user.role === "kitchen" || user.role === "admin") {
    helpText += "\n🍳 Команды кухни:\n";
    helpText += "📊 /today_orders - Заказы на сегодня\n";
    helpText += "✅ /confirm_order - Подтвердить заказ\n";
  }

  // Команды только для админов
  if (user.role === "admin") {
    helpText += "\n⚙️ Команды администратора:\n";
    helpText += "🏫 /add_school - Добавить школу\n";
    helpText += "📅 /add_menu - Добавить меню\n";
    helpText += "👥 /users - Управление пользователями\n";
    helpText += "📋 /audit - Просмотр логов аудита\n";
  }

  ctx.reply(helpText);
});

// Команда профиля (доступна всем аутентифицированным)
bot.command("profile", auditMiddleware("profile"), (ctx) => {
  const user = ctx.state.user;

  let profileText = "👤 Ваш профиль:\n\n";
  profileText += `🆔 ID: ${user.id}\n`;
  profileText += `📱 Telegram ID: ${user.telegram_id}\n`;
  profileText += `👤 Роль: ${getRoleName(user.role)}\n`;
  profileText += `✅ Статус: ${user.is_active ? "Активен" : "Заблокирован"}\n`;

  if (user.city_id) {
    profileText += `🏙️ Город ID: ${user.city_id}\n`;
  }
  if (user.school_id) {
    profileText += `🏫 Школа ID: ${user.school_id}\n`;
  }
  if (user.class_name) {
    profileText += `📚 Класс: ${user.class_name}\n`;
  }
  if (user.child_name) {
    profileText += `👶 Ребенок: ${user.child_name}\n`;
  }
  if (user.shift) {
    profileText += `⏰ Смена: ${user.shift}\n`;
  }

  profileText += `\n📅 Зарегистрирован: ${new Date(user.created_at).toLocaleDateString("ru-RU")}`;

  ctx.reply(profileText);
});

// Пример команды только для админов
bot.command("users", allowAdmin, auditMiddleware("view_users"), (ctx) => {
  const { prepare } = require("../database/db");

  try {
    const users = prepare(`
            SELECT id, telegram_id, role, is_active, created_at
            FROM users
            ORDER BY created_at DESC
            LIMIT 10
        `).all();

    let text = "👥 Последние пользователи:\n\n";
    users.forEach((u) => {
      text += `🆔 ${u.id} | 📱 ${u.telegram_id} | 👤 ${getRoleName(u.role)} | ${u.is_active ? "✅" : "❌"}\n`;
    });

    ctx.reply(text);
  } catch (error) {
    logger.error("Failed to fetch users:", error);
    ctx.reply("❌ Ошибка получения списка пользователей");
  }
});

// Временная команда меню (заглушка)
bot.command("menu", allowUser, auditMiddleware("view_menu"), (ctx) => {
  ctx.reply(
    "🍽️ Меню на сегодня:\n\n" +
      "🍲 1. Борщ - 50₽\n" +
      "🍝 2. Макароны с котлетой - 80₽\n" +
      "🥤 3. Компот - 20₽\n\n" +
      "📝 Для заказа используйте /order",
  );
});

// Обработчик неизвестных команд
bot.on("text", (ctx) => {
  logger.debug("Unknown command", {
    userId: ctx.state.user?.id,
    text: ctx.message.text,
  });
  ctx.reply(
    "❓ Извините, я не понимаю эту команду. Используйте /help для списка доступных команд.",
  );
});

// Обработка ошибок
bot.catch(errorHandler);

// Вспомогательная функция для получения названия роли
function getRoleName(role) {
  const roles = {
    user: "👤 Пользователь",
    admin: "🔑 Администратор",
    class_teacher: "🍎 Классный руководитель",
    kitchen: "🍳 Кухня",
    parent: "👪 Родитель",
  };
  return roles[role] || role;
}

// Функция для экранирования HTML
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = bot;
