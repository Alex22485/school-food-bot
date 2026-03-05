const { Markup } = require("telegraf");
const { prepare } = require("../database/db");
const logger = require("../utils/logger");
const escapeHtml = require("escape-html");

// Регулярные выражения для валидации
const VALIDATION_RULES = {
  className: /^([1-9]|1[01])[АБВГДЕ]?$/,
  classNameWithSpace: /^([1-9]|1[01])\s[АБВГДЕ]$/,
  classNameQuoted: /^«([1-9]|1[01])[АБВГДЕ]?»$/,
  childName: /^[А-Яа-яA-Za-z\s-]+$/,
  notEmpty: /^(?!\s*$).+/,
  maxLength: 50,
  validClassLetters: ["А", "Б", "В", "Г", "Д", "Е"],
};

// Обработчик нажатий на кнопки
async function handleRegistrationAction(ctx) {
  await ctx.answerCbQuery();

  try {
    const data = ctx.callbackQuery.data;
    const parts = data.replace("register_", "").split("_");
    const action = parts[0];
    const value = parts[1];

    const session = ctx.session;
    if (!session.registration) {
      return ctx.reply(
        "❌ Ошибка: сессия регистрации не найдена. Нажмите /start заново.",
      );
    }

    switch (action) {
      case "selectCity":
        session.registration.cityId = parseInt(value);
        await askForSchool(ctx, session.registration.cityId);
        break;
      case "selectSchool":
        session.registration.schoolId = parseInt(value);
        await completeRegistration(ctx);
        break;
      case "skip":
        await completeRegistration(ctx);
        break;
      default:
        ctx.reply("❌ Неизвестное действие");
    }
  } catch (error) {
    logger.error("Error in handleRegistrationAction:", error);
    ctx.reply("❌ Произошла ошибка");
  }
}

// Обработчик текстового ввода
async function handleRegistrationInput(ctx) {
  try {
    const session = ctx.session;
    if (!session.registration) return;

    const text = ctx.message.text.trim();
    const step = session.registration.step;

    if (!VALIDATION_RULES.notEmpty.test(text)) {
      return ctx.reply("❌ Ввод не может быть пустым.");
    }

    if (text.length > VALIDATION_RULES.maxLength) {
      return ctx.reply(
        `❌ Слишком длинное значение. Максимум ${VALIDATION_RULES.maxLength} символов.`,
      );
    }

    switch (step) {
      case "class":
        await handleClassInput(ctx, text);
        break;
      case "childName":
        await handleChildNameInput(ctx, text);
        break;
      default:
        await completeRegistration(ctx);
    }
  } catch (error) {
    logger.error("Error in handleRegistrationInput:", error);
    ctx.reply("❌ Произошла ошибка");
  }
}

// Обработка ввода класса
async function handleClassInput(ctx, text) {
  const isValid =
    VALIDATION_RULES.className.test(text) ||
    VALIDATION_RULES.classNameWithSpace.test(text) ||
    VALIDATION_RULES.classNameQuoted.test(text);

  if (!isValid) {
    return ctx.reply(
      "❌ **Некорректный формат класса**\n\n" +
        "✅ **Допустимые форматы:**\n" +
        "• 5А, 11Б (цифра + буква)\n" +
        "• 5 А, 11 Б (цифра + пробел + буква)\n" +
        "• «5А», «11Б» (в кавычках)\n\n" +
        "📊 **Допустимые цифры:** 1-11\n" +
        "🔤 **Допустимые буквы:** А, Б, В, Г, Д, Е",
    );
  }

  let num = null;
  let letter = null;

  if (text.includes(" ")) {
    const parts = text.split(" ");
    num = parseInt(parts[0]);
    letter = parts[1];
  } else if (text.startsWith("«")) {
    const match = text.match(/«(\d+)([АБВГДЕ]?)»/);
    if (match) {
      num = parseInt(match[1]);
      letter = match[2];
    }
  } else {
    const match = text.match(/^(\d+)([АБВГДЕ]?)$/);
    if (match) {
      num = parseInt(match[1]);
      letter = match[2];
    }
  }

  if (num !== null && (num < 1 || num > 11)) {
    return ctx.reply(
      `❌ Номер класса должен быть от 1 до 11. Вы ввели: ${num}`,
    );
  }

  if (letter && !VALIDATION_RULES.validClassLetters.includes(letter)) {
    return ctx.reply(
      `❌ Недопустимая буква класса: "${letter}".\n` +
        `Допустимые буквы: А, Б, В, Г, Д, Е`,
    );
  }

  ctx.session.registration.className = escapeHtml(text);
  ctx.session.registration.step = "childName";

  await ctx.reply(
    "👶 **Введите имя ребенка**\n\n" +
      "✅ **Правила:**\n" +
      "• Только буквы, пробел и дефис\n" +
      "• Нельзя использовать цифры\n\n" +
      "📝 **Примеры:** Анна, Анна-Мария, София Анна",
  );
}

// Обработка ввода имени ребенка
async function handleChildNameInput(ctx, text) {
  if (!VALIDATION_RULES.childName.test(text)) {
    return ctx.reply(
      "❌ **Некорректный формат имени**\n\n" +
        "✅ **Правила:**\n" +
        "• Только буквы, пробел и дефис\n" +
        "• Нельзя использовать цифры\n\n" +
        "📝 **Примеры:** Анна, Анна-Мария, София Анна",
    );
  }

  if (text.trim().length < 2) {
    return ctx.reply("❌ Имя должно содержать хотя бы 2 символа.");
  }

  ctx.session.registration.childName = escapeHtml(text);
  ctx.session.registration.step = "city";
  await askForCity(ctx);
}

// Запрос выбора города
async function askForCity(ctx) {
  try {
    const cities = prepare("SELECT id, name FROM cities ORDER BY name").all();

    if (cities.length === 0) {
      return await completeRegistration(ctx);
    }

    const buttons = cities.map((city) =>
      Markup.button.callback(city.name, `register_selectCity_${city.id}`),
    );

    const keyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      keyboard.push(buttons.slice(i, i + 2));
    }
    keyboard.push([Markup.button.callback("⏭️ Пропустить", "register_skip")]);

    await ctx.reply(
      "🏙️ **Выберите ваш город**\n\nЕсли вашего города нет, нажмите 'Пропустить'",
      Markup.inlineKeyboard(keyboard),
    );
  } catch (error) {
    logger.error("Error in askForCity:", error);
    await completeRegistration(ctx);
  }
}

// Запрос выбора школы - ИСПРАВЛЕНО
async function askForSchool(ctx, cityId) {
  try {
    console.log("📌 askForSchool called with cityId:", cityId);

    if (!cityId) {
      console.log("❌ cityId is undefined or null");
      return await completeRegistration(ctx);
    }

    // ИСПРАВЛЕНО: правильный способ передачи параметра
    const schools = prepare(
      "SELECT id, name FROM schools WHERE city_id = ? ORDER BY name",
    ).all(cityId);

    console.log("📌 Schools found:", schools.length);

    if (schools.length === 0) {
      return await completeRegistration(ctx);
    }

    const buttons = schools.map((school) =>
      Markup.button.callback(school.name, `register_selectSchool_${school.id}`),
    );

    const keyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      keyboard.push(buttons.slice(i, i + 2));
    }
    keyboard.push([Markup.button.callback("⏭️ Пропустить", "register_skip")]);

    await ctx.reply(
      "🏫 **Выберите вашу школу**\n\nЕсли вашей школы нет, нажмите 'Пропустить'",
      Markup.inlineKeyboard(keyboard),
    );
  } catch (error) {
    console.log("❌ Error in askForSchool:", error);
    logger.error("Error in askForSchool:", error);
    await completeRegistration(ctx);
  }
}

// Определение следующего шага
async function askForNextStep(ctx) {
  const registration = ctx.session.registration;
  const role = registration.role;

  if (role === "parent") {
    if (!registration.className) {
      registration.step = "class";
      await ctx.reply(
        "📚 **Введите класс ребенка**\n\n" +
          "✅ **Форматы:** 5А, 5 А, «5А»\n" +
          "📊 **Цифры:** 1-11\n" +
          "🔤 **Буквы:** А, Б, В, Г, Д, Е",
      );
    } else if (!registration.childName) {
      registration.step = "childName";
      await ctx.reply(
        "👶 **Введите имя ребенка**\n\n" +
          "✅ **Правила:** только буквы, пробел, дефис\n" +
          "📝 **Примеры:** Анна, Анна-Мария",
      );
    } else {
      registration.step = "city";
      await askForCity(ctx);
    }
  } else if (role === "class_teacher") {
    if (!registration.className) {
      registration.step = "class";
      await ctx.reply(
        "📚 **Введите ваш класс**\n\n" +
          "✅ **Форматы:** 5А, 5 А, «5А»\n" +
          "📊 **Цифры:** 1-11\n" +
          "🔤 **Буквы:** А, Б, В, Г, Д, Е",
      );
    } else {
      registration.step = "city";
      await askForCity(ctx);
    }
  } else if (role === "kitchen") {
    registration.step = "city";
    await askForCity(ctx);
  } else {
    await completeRegistration(ctx);
  }
}

// Завершение регистрации и создание пользователя
async function completeRegistration(ctx) {
  try {
    const registration = ctx.session.registration;
    const telegramId = ctx.from.id;

    console.log("📌 completeRegistration called with:", registration);

    if (!registration) {
      return ctx.reply("❌ Ошибка: данные регистрации не найдены");
    }

    // Проверяем, есть ли уже пользователь
    const existing = prepare(`SELECT id FROM users WHERE telegram_id = ?`).get(
      telegramId,
    );

    let user;

    if (!existing) {
      // СОЗДАЕМ нового пользователя
      console.log("📌 Creating new user with data:", {
        telegramId,
        role: registration.role,
        cityId: registration.cityId,
        schoolId: registration.schoolId,
        className: registration.className,
        childName: registration.childName,
      });

      const insert = prepare(`
        INSERT INTO users (
          telegram_id, role, city_id, school_id, class_name, child_name,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      const result = insert.run(
        telegramId,
        registration.role,
        registration.cityId || null,
        registration.schoolId || null,
        registration.className || null,
        registration.childName || null,
      );

      console.log("✅ User created with ID:", result.lastInsertRowid);

      user = prepare("SELECT * FROM users WHERE id = ?").get(
        result.lastInsertRowid,
      );
    } else {
      // Обновляем существующего
      console.log("📌 Updating existing user");

      const update = prepare(`
        UPDATE users 
        SET city_id = ?, school_id = ?, class_name = ?, child_name = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE telegram_id = ?
      `);

      update.run(
        registration.cityId || null,
        registration.schoolId || null,
        registration.className || null,
        registration.childName || null,
        telegramId,
      );

      user = prepare("SELECT * FROM users WHERE telegram_id = ?").get(
        telegramId,
      );
    }

    ctx.state.user = user;
    ctx.session.registration = null;

    console.log("✅ Final user data:", {
      id: user.id,
      role: user.role,
      city_id: user.city_id,
      school_id: user.school_id,
      class_name: user.class_name,
      child_name: user.child_name,
    });

    // Показываем приветственное сообщение
    let welcomeText = `✅ **Регистрация успешно завершена!**\n\n`;
    welcomeText += `👤 **Роль:** ${getRoleDisplay(user.role)}\n`;

    if (user.city_id)
      welcomeText += `🏙️ **Город:** ${getCityName(user.city_id)}\n`;
    if (user.school_id)
      welcomeText += `🏫 **Школа:** ${getSchoolName(user.school_id)}\n`;
    if (user.class_name) welcomeText += `📚 **Класс:** ${user.class_name}\n`;
    if (user.child_name) welcomeText += `👶 **Ребенок:** ${user.child_name}\n`;

    welcomeText += `\n🎉 **Теперь вы можете пользоваться ботом!**`;

    await ctx.reply(welcomeText, { parse_mode: "Markdown" });

    // Показываем меню без приветствия
    const { showRoleBasedMenu } = require("./start");
    await showRoleBasedMenu(ctx, user, true);
  } catch (error) {
    console.log("❌ Error in completeRegistration:", error);
    logger.error("Error in completeRegistration:", error);
    ctx.reply("❌ Ошибка при сохранении данных");
  }
}

// Вспомогательные функции
function getRoleDisplay(role) {
  const roles = {
    admin: "🔑 Администратор",
    class_teacher: "🍎 Классный руководитель",
    kitchen: "🍳 Кухня",
    parent: "👪 Родитель",
    user: "👤 Пользователь",
  };
  return roles[role] || role;
}

function getCityName(cityId) {
  try {
    const city = prepare("SELECT name FROM cities WHERE id = ?").get(cityId);
    return city ? city.name : "Неизвестный город";
  } catch {
    return "Неизвестный город";
  }
}

function getSchoolName(schoolId) {
  try {
    const school = prepare("SELECT name FROM schools WHERE id = ?").get(
      schoolId,
    );
    return school ? school.name : "Неизвестная школа";
  } catch {
    return "Неизвестная школа";
  }
}

module.exports = {
  handleRegistrationAction,
  handleRegistrationInput,
  askForCity,
  askForSchool,
  askForNextStep,
  completeRegistration,
};
