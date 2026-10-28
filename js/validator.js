/**
 * validator.js — [Core Layer] перевірка, очищення та форматування даних завдання (SP.Validator).
 * Не залежить від DOM: приймає «сирі» значення полів, повертає валідовані дані та словник помилок.
 * Версія 2.1.7 (build 217) Redstone 5 — Автор: Максим Ковалишин.
 * Оптимізації v2.1.7 RS5: мемоізація форматування дат (Map-кеш), підтримка валідації статусів та швидке очищення полів таблиці.
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});

  const LIMITS = Object.freeze({
    title: 100,
    subject: 80,
    description: 1500,
    imageUrl: 3000000,
    maxSubtasks: 25,
    subtaskText: 160,
    maxTags: 8,
    tagLength: 30
  });

  const MESSAGES = Object.freeze({
    titleRequired: 'Введіть назву завдання (1–100 символів)',
    titleTooLong: 'Назва не може перевищувати 100 символів',
    subjectRequired: 'Вкажіть предмет або дисципліну (1–80 символів)',
    subjectTooLong: 'Предмет не може перевищувати 80 символів',
    dateInvalid: 'Вкажіть коректну дату у форматі ДД.ММ.РРРР або РРРР-ММ-ДД',
    descriptionTooLong: 'Опис не може перевищувати 1500 символів',
    priorityInvalid: 'Оберіть пріоритет зі списку',
    statusInvalid: 'Оберіть коректний статус зі списку',
    imageTooLarge: 'Розмір зображення перевищує допустимий ліміт (до 2.5 МБ)'
  });

  const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
  const RE_UA = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
  const formatCache = new Map();

  /** Кількість символів за кодовими точками Unicode. */
  function length(text) {
    return Array.from(String(text || '')).length;
  }

  function isRealDate(year, month, day) {
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
  }

  /** «ДД.ММ.РРРР» або «РРРР-ММ-ДД» → «РРРР-ММ-ДД» або null. */
  function parseDisplayDate(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return null;

    const mIso = RE_ISO.exec(trimmed);
    if (mIso) {
      const y = Number(mIso[1]);
      const mo = Number(mIso[2]);
      const da = Number(mIso[3]);
      return (y >= 2000 && y <= 2100 && isRealDate(y, mo, da)) ? trimmed : null;
    }

    const m = RE_UA.exec(trimmed);
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (year < 2000 || year > 2100 || !isRealDate(year, month, day)) return null;
    return m[3] + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  /** Мемоізоване перетворення «РРРР-ММ-ДД» → «ДД.ММ.РРРР». */
  function formatDate(iso) {
    const key = String(iso || '');
    const cached = formatCache.get(key);
    if (cached !== undefined) return cached;

    const m = RE_ISO.exec(key);
    const formatted = m ? (m[3] + '.' + m[2] + '.' + m[1]) : key;
    if (formatCache.size > 512) formatCache.clear();
    formatCache.set(key, formatted);
    return formatted;
  }

  function sanitizeSubtasks(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (let i = 0; i < raw.length && out.length < LIMITS.maxSubtasks; i++) {
      const item = raw[i];
      if (!item || typeof item !== 'object') continue;
      const txt = String(item.text == null ? '' : item.text).trim().slice(0, LIMITS.subtaskText);
      if (!txt) continue;
      out.push({
        id: typeof item.id === 'string' && item.id ? item.id : 'st-' + Date.now().toString(36) + '-' + i,
        text: txt,
        done: Boolean(item.done)
      });
    }
    return out;
  }

  function sanitizeTags(raw) {
    let arr = [];
    if (Array.isArray(raw)) arr = raw;
    else if (typeof raw === 'string' && raw.trim()) arr = raw.split(',');

    const seen = new Set();
    const out = [];
    for (let i = 0; i < arr.length && out.length < LIMITS.maxTags; i++) {
      const clean = String(arr[i] || '').replace(/^#+/, '').trim().slice(0, LIMITS.tagLength);
      if (!clean) continue;
      const key = clean.toLocaleLowerCase('uk-UA');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(clean);
      }
    }
    return out;
  }

  /**
   * @param {object} data
   * @returns {{valid:boolean, errors:Object<string,string>, values:Object}}
   */
  function validate(data) {
    const src = data || {};
    const errors = {};
    const title = String(src.title == null ? '' : src.title).trim();
    const subject = String(src.subject == null ? '' : src.subject).trim();
    const description = String(src.description == null ? '' : src.description).trim();
    const dateText = String(src.dueDate == null ? '' : src.dueDate).trim();
    const priority = src.priority || 'MEDIUM';
    const status = src.status || 'PLANNED';
    const imageUrl = String(src.imageUrl == null ? '' : src.imageUrl).trim();
    const subtasks = sanitizeSubtasks(src.subtasks);
    const tags = sanitizeTags(src.tags);

    const titleLen = length(title);
    if (titleLen < 1) errors.title = MESSAGES.titleRequired;
    else if (titleLen > LIMITS.title) errors.title = MESSAGES.titleTooLong;

    const subjLen = length(subject);
    if (subjLen < 1) errors.subject = MESSAGES.subjectRequired;
    else if (subjLen > LIMITS.subject) errors.subject = MESSAGES.subjectTooLong;

    const dueDate = parseDisplayDate(dateText);
    if (dueDate === null) errors.dueDate = MESSAGES.dateInvalid;

    if (length(description) > LIMITS.description) errors.description = MESSAGES.descriptionTooLong;
    if (imageUrl && imageUrl.length > LIMITS.imageUrl) errors.imageUrl = MESSAGES.imageTooLarge;

    const knownPrio = SP.TaskManager ? SP.TaskManager.PRIORITY : null;
    if (knownPrio && !Object.prototype.hasOwnProperty.call(knownPrio, priority)) {
      errors.priority = MESSAGES.priorityInvalid;
    }

    const knownStat = SP.TaskManager ? SP.TaskManager.STATUS : null;
    if (knownStat && !Object.prototype.hasOwnProperty.call(knownStat, status)) {
      errors.status = MESSAGES.statusInvalid;
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors,
      values: {
        title: title,
        subject: subject,
        description: description,
        dueDate: dueDate,
        priority: priority,
        status: status,
        imageUrl: imageUrl,
        subtasks: subtasks,
        tags: tags
      }
    };
  }

  SP.Validator = {
    LIMITS: LIMITS,
    MESSAGES: MESSAGES,
    validate: validate,
    parseDisplayDate: parseDisplayDate,
    formatDate: formatDate,
    sanitizeSubtasks: sanitizeSubtasks,
    sanitizeTags: sanitizeTags,
    length: length
  };
})(window);
