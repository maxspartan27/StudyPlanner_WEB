/**
 * validator.js — перевірка даних завдання (клас TaskValidator з діаграми класів).
 * Не залежить від DOM: приймає «сирі» значення полів, повертає очищені дані та помилки.
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});

  const LIMITS = { title: 100, subject: 80, description: 1000 };

  const MESSAGES = {
    titleRequired: 'Введіть назву (1–100 символів)',
    titleTooLong: 'Назва не може перевищувати 100 символів',
    subjectRequired: 'Вкажіть предмет (1–80 символів)',
    subjectTooLong: 'Предмет не може перевищувати 80 символів',
    dateInvalid: 'Вкажіть коректну дату у форматі ДД.ММ.РРРР',
    descriptionTooLong: 'Опис не може перевищувати 1000 символів',
    priorityInvalid: 'Оберіть пріоритет зі списку'
  };

  /** Кількість символів (за кодовими точками, щоб emoji не рахувалися двічі). */
  function length(text) {
    return Array.from(text).length;
  }

  function isRealDate(year, month, day) {
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
  }

  /** «ДД.ММ.РРРР» → «РРРР-ММ-ДД» або null, якщо дата некоректна. */
  function parseDisplayDate(text) {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(text).trim());
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (year < 2000 || year > 2100 || !isRealDate(year, month, day)) return null;
    return m[3] + '-' + m[2] + '-' + m[1];
  }

  /** «РРРР-ММ-ДД» → «ДД.ММ.РРРР». */
  function formatDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    return m ? m[3] + '.' + m[2] + '.' + m[1] : String(iso);
  }

  /**
   * @param {{title?:string, subject?:string, description?:string, dueDate?:string, priority?:string}} data
   *   dueDate — текст у форматі ДД.ММ.РРРР
   * @returns {{valid:boolean, errors:Object<string,string>, values:Object}}
   */
  function validate(data) {
    const errors = {};
    const title = String(data.title == null ? '' : data.title).trim();
    const subject = String(data.subject == null ? '' : data.subject).trim();
    const description = String(data.description == null ? '' : data.description).trim();
    const dateText = String(data.dueDate == null ? '' : data.dueDate).trim();
    const priority = data.priority || 'MEDIUM';

    if (length(title) < 1) errors.title = MESSAGES.titleRequired;
    else if (length(title) > LIMITS.title) errors.title = MESSAGES.titleTooLong;

    if (length(subject) < 1) errors.subject = MESSAGES.subjectRequired;
    else if (length(subject) > LIMITS.subject) errors.subject = MESSAGES.subjectTooLong;

    const dueDate = parseDisplayDate(dateText);
    if (dueDate === null) errors.dueDate = MESSAGES.dateInvalid;

    if (length(description) > LIMITS.description) errors.description = MESSAGES.descriptionTooLong;

    const known = SP.TaskManager ? SP.TaskManager.PRIORITY : null;
    if (known && !Object.prototype.hasOwnProperty.call(known, priority)) errors.priority = MESSAGES.priorityInvalid;

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors,
      values: { title: title, subject: subject, description: description, dueDate: dueDate, priority: priority }
    };
  }

  SP.Validator = { LIMITS: LIMITS, MESSAGES: MESSAGES, validate: validate, parseDisplayDate: parseDisplayDate, formatDate: formatDate, length: length };
})(window);
