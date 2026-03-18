const { Markup } = require("telegraf");
const { prepare } = require("../database/db");
const logger = require("../utils/logger");
const escapeHtml = require("escape-html");

// Константы для классов
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const LETTERS = ["А", "Б", "В", "Г", "Д", "Е"];

// Обработчик нажатий на кнопки
async function handleRegistrationAction(ctx) {
  await ctx.answerCbQuery();

  try {
    const data = ctx.callbackQuery.data;

    // Обработка выбора цифры класса
    if (data.startsWith("classGrade_")) {
      const grade = data.replace("classGrade_", "");
      return await handleClassGradeSelection(ctx, parseInt(grade));
    }

    // Обработка выбора буквы класса
    if (data.startsWith("classLetter_")) {
      const letter = data.replace("classLetter_", "");
      return await handleClassLetterSelection(ctx, letter);
    }

    // Обработка выбора города
    if (data.startsWith("register_selectCity_")) {
      const cityId = parseInt(data.replace("register_selectCity_", ""));
      const session = ctx.session;
      if (!session.registration) {
        return ctx.reply(
          "❌ Ошибка: сессия регистрации не найдена. Нажмите /start заново.",
        );
      }
      session.registration.cityId = cityId;
      await askForNextStep(ctx);
      return;
    }

    // Обработка выбора школы
    if (data.startsWith("register_selectSchool_")) {
      const schoolId = parseInt(data.replace("register_selectSchool_", ""));
      const session = ctx.session;
      if (!session.registration) {
        return ctx.reply(
          "❌ Ошибка: сессия регистрации не найдена. Нажмите /start заново.",
        );
      }
      session.registration.schoolId = schoolId;
      await askForNextStep(ctx);
      return;
    }

    ctx.reply("❌ Неизвестное действие");
  } catch (error) {
    logger.error("Error in handleRegistrationAction:", error);
    ctx.reply("❌ Произошла ошибка");
  }
}

// Обработчик текстового ввода (только для имени ребенка)
async function handleRegistrationInput(ctx) {
  try {
    const session = ctx.session;
    if (!session.registration) return;

    const text = ctx.message.text.trim();
    const step = session.registration.step;

    if (!text) {
      return ctx.reply("❌ Ввод не может быть пустым.");
    }

    if (step === "childName") {
      await handleChildNameInput(ctx, text);
    } else {
      await completeRegistration(ctx);
    }
  } catch (error) {
    logger.error("Error in handleRegistrationInput:", error);
    ctx.reply("❌ Произошла ошибка");
  }
}

// Обработка выбора цифры класса
async function handleClassGradeSelection(ctx, grade) {
  const session = ctx.session;
  if (!session.registration) return;

  session.registration.classGrade = grade;
  session.registration.classLetter = null;
  session.registration.step = "classLetter";

  await askForClassLetter(ctx);
}

// Обработка выбора буквы класса
async function handleClassLetterSelection(ctx, letter) {
  const session = ctx.session;
  if (!session.registration) return;

  const grade = session.registration.classGrade;
  const fullClassName = `${grade}${letter}`;

  session.registration.className = fullClassName;
  session.registration.classLetter = letter;

  // Для родителя после выбора класса запрашиваем имя ребенка
  if (session.registration.role === "parent") {
    session.registration.step = "childName";
    await ctx.reply(
      `✅ Вы выбрали класс: **${fullClassName}**\n\n` +
        "👤 **Введите имя и фамилию ученика**\n\n" +
        "✅ **Правила:**\n" +
        "• Только буквы, пробел и дефис\n" +
        "• Максимум 30 символов\n" +
        "• Нельзя использовать цифры\n\n" +
        "📝 **Примеры:** Иван Петров, Анна-Мария Сидорова",
      { parse_mode: "Markdown" },
    );
  } else {
    // Для учителя после выбора класса сразу завершаем регистрацию
    session.registration.step = "complete";
    await completeRegistration(ctx);
  }
}

// Обработка ввода имени и фамилии ученика (только для родителя)
async function handleChildNameInput(ctx, text) {
  const session = ctx.session;
  const fullName = text.trim();

  if (!fullName) {
    return ctx.reply("❌ Имя и фамилия не могут быть пустыми.");
  }

  if (fullName.length > 30) {
    return ctx.reply("❌ Слишком длинное имя. Максимум 30 символов.");
  }

  if (fullName.length < 5) {
    return ctx.reply(
      "❌ Слишком короткое имя. Введите имя и фамилию (минимум 5 символов).",
    );
  }

  if (!fullName.includes(" ")) {
    return ctx.reply(
      "❌ **Введите имя и фамилию через пробел**\n\n" +
        "📝 **Примеры:** Иван Петров, Анна-Мария Сидорова",
      { parse_mode: "Markdown" },
    );
  }

  if (!/^[А-Яа-яA-Za-z\s-]+$/.test(fullName)) {
    return ctx.reply(
      "❌ **Некорректный формат**\n\n" +
        "✅ **Правила:**\n" +
        "• Только буквы, пробел и дефис\n" +
        "• Нельзя использовать цифры\n\n" +
        "📝 **Примеры:** Иван Петров, Анна-Мария Сидорова",
      { parse_mode: "Markdown" },
    );
  }

  if (fullName.includes("  ")) {
    return ctx.reply("❌ Не используйте двойные пробелы между словами.");
  }

  const nameParts = fullName.split(/\s+/);

  if (nameParts.length !== 2) {
    return ctx.reply(
      "❌ Введите только имя и фамилию через один пробел (без отчества).",
    );
  }

  for (const part of nameParts) {
    if (part.length < 2) {
      return ctx.reply(
        `❌ Слишком короткая часть имени: "${part}". Каждая часть должна содержать хотя бы 2 символа.`,
      );
    }
  }

  session.registration.childName = escapeHtml(fullName);
  session.registration.step = "complete";
  await completeRegistration(ctx);
}

// Запрос выбора города
async function askForCity(ctx) {
  try {
    const cities = prepare("SELECT id, name FROM cities ORDER BY name").all();

    if (cities.length === 0) {
      return ctx.reply(
        "❌ В системе нет городов. Обратитесь к администратору.",
      );
    }

    const buttons = cities.map((city) =>
      Markup.button.callback(city.name, `register_selectCity_${city.id}`),
    );

    const keyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      keyboard.push(buttons.slice(i, i + 2));
    }

    await ctx.reply(
      "🏙️ **Выберите ваш город**",
      Markup.inlineKeyboard(keyboard),
    );
  } catch (error) {
    logger.error("Error in askForCity:", error);
    ctx.reply("❌ Ошибка при загрузке списка городов");
  }
}

// Запрос выбора школы
async function askForSchool(ctx, cityId) {
  try {
    if (!cityId) {
      return ctx.reply("❌ Ошибка: город не выбран");
    }

    const schools = prepare(
      "SELECT id, name FROM schools WHERE city_id = ? ORDER BY name",
    ).all(cityId);

    if (schools.length === 0) {
      return ctx.reply(
        "❌ В выбранном городе нет школ. Обратитесь к администратору.",
      );
    }

    const buttons = schools.map((school) =>
      Markup.button.callback(school.name, `register_selectSchool_${school.id}`),
    );

    const keyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      keyboard.push(buttons.slice(i, i + 2));
    }

    await ctx.reply(
      "🏫 **Выберите вашу школу**",
      Markup.inlineKeyboard(keyboard),
    );
  } catch (error) {
    logger.error("Error in askForSchool:", error);
    ctx.reply("❌ Ошибка при загрузке списка школ");
  }
}

// Выбор цифры класса
async function askForClassGrade(ctx) {
  const buttons = GRADES.map((grade) =>
    Markup.button.callback(`${grade}`, `classGrade_${grade}`),
  );

  const keyboard = [];
  for (let i = 0; i < buttons.length; i += 4) {
    keyboard.push(buttons.slice(i, i + 4));
  }

  await ctx.reply(
    "🔢 **Выберите цифру класса**",
    Markup.inlineKeyboard(keyboard),
  );
}

// Выбор буквы класса
async function askForClassLetter(ctx) {
  const buttons = LETTERS.map((letter) =>
    Markup.button.callback(letter, `classLetter_${letter}`),
  );

  const keyboard = [];
  for (let i = 0; i < buttons.length; i += 3) {
    keyboard.push(buttons.slice(i, i + 3));
  }

  await ctx.reply(
    "🔤 **Выберите букву класса**",
    Markup.inlineKeyboard(keyboard),
  );
}

// Определение следующего шага в зависимости от роли
async function askForNextStep(ctx) {
  const registration = ctx.session.registration;
  const role = registration.role;

  console.log("📌 askForNextStep - role:", role, "step:", registration.step);
  console.log("📌 Current data:", {
    cityId: registration.cityId,
    schoolId: registration.schoolId,
    className: registration.className,
    childName: registration.childName,
  });

  // Город обязателен для всех
  if (!registration.cityId) {
    registration.step = "city";
    await askForCity(ctx);
    return;
  }

  // Школа обязательна для всех
  if (!registration.schoolId) {
    registration.step = "school";
    await askForSchool(ctx, registration.cityId);
    return;
  }

  // Дальнейшие шаги зависят от роли
  if (role === "parent") {
    // Для родителя нужны класс и имя ребенка
    if (!registration.className) {
      registration.step = "classGrade";
      await askForClassGrade(ctx);
      return;
    }
    if (!registration.childName) {
      registration.step = "childName";
      return;
    }
  } else if (role === "class_teacher") {
    // Для учителя нужен только класс
    if (!registration.className) {
      registration.step = "classGrade";
      await askForClassGrade(ctx);
      return;
    }
    console.log("✅ Teacher registration complete");
    await completeRegistration(ctx);
    return;
  } else if (role === "kitchen") {
    // Для кухни больше ничего не нужно
    console.log("✅ Kitchen registration complete");
    await completeRegistration(ctx);
    return;
  }

  await completeRegistration(ctx);
}

// Завершение регистрации с проверкой уникальности кухни
async function completeRegistration(ctx) {
  try {
    const registration = ctx.session.registration;
    const telegramId = ctx.from.id;

    console.log("📌 completeRegistration called with:", registration);

    if (!registration) {
      return ctx.reply("❌ Ошибка: данные регистрации не найдены");
    }

    if (!registration.cityId || !registration.schoolId) {
      console.log("❌ Missing required fields:", {
        cityId: registration.cityId,
        schoolId: registration.schoolId,
      });
      return ctx.reply("❌ Ошибка: не выбраны город и школа");
    }

    if (registration.role === "parent") {
      if (!registration.className) {
        return ctx.reply("❌ Ошибка: не выбран класс");
      }
      if (!registration.childName) {
        return ctx.reply("❌ Ошибка: не указано имя ученика");
      }
    }

    if (registration.role === "class_teacher" && !registration.className) {
      return ctx.reply("❌ Ошибка: не выбран класс");
    }

    if (registration.role === "kitchen") {
      const existingKitchen = prepare(`
        SELECT id, telegram_id FROM users 
        WHERE role = 'kitchen' AND school_id = ?
      `).get(registration.schoolId);

      if (existingKitchen) {
        logger.warn("Attempt to register second kitchen for school", {
          schoolId: registration.schoolId,
          existingKitchenId: existingKitchen.id,
          newUserTelegramId: telegramId,
        });

        return ctx.reply(
          "❌ **Ошибка регистрации**\n\n" +
            "Для этой школы уже зарегистрирован сотрудник кухни.\n" +
            "Если это ошибка, обратитесь к администратору.",
        );
      }
    }

    const existing = prepare(`SELECT id FROM users WHERE telegram_id = ?`).get(
      telegramId,
    );

    let user;

    if (!existing) {
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
        registration.cityId,
        registration.schoolId,
        registration.className || null,
        registration.childName || null,
      );

      console.log("✅ User created with ID:", result.lastInsertRowid);

      user = prepare("SELECT * FROM users WHERE id = ?").get(
        result.lastInsertRowid,
      );
    } else {
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

    // Финальное сообщение - ТОЛЬКО ПОЗДРАВЛЕНИЕ, без дублирования данных
    let welcomeText = `✅ **Регистрация успешно завершена!**\n\n`;
    welcomeText += `🎉 **Теперь вы можете пользоваться ботом!**`;

    await ctx.reply(welcomeText, { parse_mode: "Markdown" });

    // Сразу показываем меню, где уже есть вся информация
    if (user.role === "kitchen") {
      const kitchenHandler = require("./kitchen");
      await kitchenHandler.showKitchenMenu(ctx);
    } else {
      const { showRoleBasedMenu } = require("./start");
      await showRoleBasedMenu(ctx, user, true);
    }
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
    parent: "👪 Родитель/Ученик",
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
