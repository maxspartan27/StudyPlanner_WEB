/**
 * storage.js — збереження завдань у localStorage (клас TaskStorage з діаграми класів).
 * Дані зберігаються як JSON-масив під ключем «studyplanner.tasks».
 * Помилка читання ніколи не призводить до автоматичного перезапису сховища порожнім списком.
 * Версія 1.4 (build 114) — підтримка поля imageUrl з повною зворотною сумісністю.
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});

  const STORAGE_KEY = 'studyplanner.tasks';
  const BACKUP_KEY = 'studyplanner.tasks.backup';
  const THEME_KEY = 'studyplanner.theme';

  function looksLikeTask(t) {
    return t && typeof t === 'object' &&
      typeof t.id === 'string' && typeof t.title === 'string' && typeof t.subject === 'string' &&
      typeof t.description === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(String(t.dueDate)) &&
      typeof t.priority === 'string' && typeof t.status === 'string' &&
      typeof t.createdAt === 'string' && typeof t.updatedAt === 'string' &&
      (t.imageUrl === undefined || typeof t.imageUrl === 'string');
  }

  class TaskStorage {
    constructor(storageKey) {
      this.storageKey = storageKey || STORAGE_KEY;
    }

    /** @returns {{ok:boolean, tasks:Array, error?:string}} */
    load() {
      let raw;
      try {
        raw = global.localStorage.getItem(this.storageKey);
      } catch (e) {
        return { ok: false, tasks: [], error: 'Локальне сховище браузера недоступне.' };
      }
      if (raw === null) return { ok: true, tasks: [] };
      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        return { ok: false, tasks: [], error: 'Збережені дані пошкоджено й не можуть бути прочитані.' };
      }
      if (!Array.isArray(data) || !data.every(looksLikeTask)) {
        return { ok: false, tasks: [], error: 'Збережені дані мають невідомий формат.' };
      }
      return { ok: true, tasks: data };
    }

    /** @returns {{ok:boolean, error?:string}} */
    save(tasks) {
      try {
        global.localStorage.setItem(this.storageKey, JSON.stringify(tasks));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: 'Не вдалося зберегти дані. Спробуйте ще раз.' };
      }
    }

    /** Копіює «сирі» збережені дані в резервний ключ перед початком роботи з порожнім списком. */
    backupRaw() {
      try {
        const raw = global.localStorage.getItem(this.storageKey);
        if (raw !== null) global.localStorage.setItem(BACKUP_KEY, raw);
        return true;
      } catch (e) {
        return false;
      }
    }

    /** Отримання збереженої теми оформлення (light/dark/auto) */
    getTheme() {
      try {
        return global.localStorage.getItem(THEME_KEY) || 'auto';
      } catch (e) {
        return 'auto';
      }
    }

    /** Збереження вибраної теми */
    setTheme(theme) {
      try {
        global.localStorage.setItem(THEME_KEY, theme);
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  SP.TaskStorage = TaskStorage;
  SP.STORAGE_KEY = STORAGE_KEY;
  SP.BACKUP_KEY = BACKUP_KEY;
  SP.THEME_KEY = THEME_KEY;
})(window);
