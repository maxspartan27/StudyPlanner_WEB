/**
 * storage.js — [Core Layer] безпечний шар збереження стану в localStorage (SP.TaskStorage).
 * Помилка читання ніколи не призводить до автоматичного перезапису сховища порожнім списком.
 * Версія 2.1.7 (build 217) Redstone 5 — Автор: Максим Ковалишин.
 * Оптимізації v2.1.7 RS5: збереження налаштувань Розумної Таблиці (tablePrefs), Журналу оцінок ECTS (grades), 16 тем і телеметрія пам'яті.
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});

  const KEYS = Object.freeze({
    TASKS: 'studyplanner.tasks',
    BACKUP: 'studyplanner.tasks.backup',
    THEME: 'studyplanner.theme',
    THEME_CONFIG: 'studyplanner.themeConfig',
    THEME_CONFIG_LEGACY: 'studyplanner.themeConfig.rs3',
    VIEW_MODE: 'studyplanner.viewMode',
    TABLE_PREFS: 'studyplanner.tablePrefs',
    GRADES: 'studyplanner.grades',
    NOTES: 'studyplanner.notes',
    FLASHCARDS: 'studyplanner.flashcards',
    POMO_STATS: 'studyplanner.pomoStats'
  });

  const DEFAULT_THEME_CONFIG = Object.freeze({
    visualMode: 'photo', // 'photo' | 'color' | 'mesh'
    thumbStyle: 'photo', // 'photo' | 'svg'
    perfMode: 'smooth',  // 'smooth' (60+ FPS GPU) | 'turbo' (миттєвий)
    customWallpaper: '',
    wallpaperDim: 58,
    wallpaperBlur: 3,
    glassAlpha: 88,
    customColors: {
      enabled: false,
      primary: '#2563eb',
      bg: '#0f172a',
      surface: '#1e293b',
      text: '#f8fafc'
    },
    savedPresets: []
  });

  const DEFAULT_TABLE_PREFS = Object.freeze({
    density: 'comfortable', // 'compact' | 'comfortable' | 'spacious'
    zebra: true,
    gridLines: false,
    groupBy: 'none',        // 'none' | 'status' | 'subject' | 'priority'
    pageSize: 25,           // 10 | 25 | 50 | 0 (усі)
    sortDir: 'asc',         // 'asc' | 'desc'
    showQuickAdd: true
  });

  const RE_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  function cloneDefaultThemeConfig() {
    return {
      visualMode: DEFAULT_THEME_CONFIG.visualMode,
      thumbStyle: DEFAULT_THEME_CONFIG.thumbStyle,
      perfMode: DEFAULT_THEME_CONFIG.perfMode,
      customWallpaper: DEFAULT_THEME_CONFIG.customWallpaper,
      wallpaperDim: DEFAULT_THEME_CONFIG.wallpaperDim,
      wallpaperBlur: DEFAULT_THEME_CONFIG.wallpaperBlur,
      glassAlpha: DEFAULT_THEME_CONFIG.glassAlpha,
      customColors: Object.assign({}, DEFAULT_THEME_CONFIG.customColors),
      savedPresets: []
    };
  }

  function looksLikeTask(t) {
    return Boolean(
      t && typeof t === 'object' &&
      typeof t.id === 'string' &&
      typeof t.title === 'string' &&
      typeof t.subject === 'string' &&
      typeof t.description === 'string' &&
      RE_ISO_DATE.test(String(t.dueDate)) &&
      typeof t.priority === 'string' &&
      typeof t.status === 'string' &&
      typeof t.createdAt === 'string' &&
      typeof t.updatedAt === 'string' &&
      (t.imageUrl === undefined || typeof t.imageUrl === 'string') &&
      (t.subtasks === undefined || Array.isArray(t.subtasks)) &&
      (t.tags === undefined || Array.isArray(t.tags))
    );
  }

  class TaskStorage {
    constructor(storageKey) {
      this.storageKey = storageKey || KEYS.TASKS;
    }

    _readRaw(key) {
      try {
        return { ok: true, value: global.localStorage.getItem(key) };
      } catch (e) {
        return { ok: false, value: null };
      }
    }

    _writeRaw(key, value) {
      try {
        global.localStorage.setItem(key, value);
        return true;
      } catch (e) {
        return false;
      }
    }

    /** @returns {{ok:boolean, tasks:Array, error?:string}} */
    load() {
      const rawRes = this._readRaw(this.storageKey);
      if (!rawRes.ok) {
        return { ok: false, tasks: [], error: 'Локальне сховище браузера недоступне.' };
      }
      if (rawRes.value === null) return { ok: true, tasks: [] };

      let data;
      try {
        data = JSON.parse(rawRes.value);
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
      const ok = this._writeRaw(this.storageKey, JSON.stringify(tasks));
      return ok
        ? { ok: true }
        : { ok: false, error: 'Не вдалося зберегти дані (можливо, перевищено квоту локального сховища).' };
    }

    backupRaw() {
      const rawRes = this._readRaw(this.storageKey);
      if (rawRes.ok && rawRes.value !== null) {
        return this._writeRaw(KEYS.BACKUP, rawRes.value);
      }
      return false;
    }

    getTheme() {
      const r = this._readRaw(KEYS.THEME);
      return (r.ok && r.value) ? r.value : 'light';
    }

    setTheme(theme) {
      return this._writeRaw(KEYS.THEME, String(theme || 'light'));
    }

    /** Читання конфігурації тем v2.1.7 RS5 із безшовною міграцією попередніх версій */
    getThemeConfig() {
      let r = this._readRaw(KEYS.THEME_CONFIG);
      if (!r.value) {
        const legacy = this._readRaw(KEYS.THEME_CONFIG_LEGACY);
        if (legacy.ok && legacy.value) {
          this._writeRaw(KEYS.THEME_CONFIG, legacy.value);
          r = legacy;
        }
      }
      if (!r.ok || !r.value) return cloneDefaultThemeConfig();

      try {
        const parsed = JSON.parse(r.value);
        const base = cloneDefaultThemeConfig();
        return Object.assign(base, parsed, {
          perfMode: parsed.perfMode === 'turbo' ? 'turbo' : 'smooth',
          customColors: Object.assign(base.customColors, parsed.customColors || {}),
          savedPresets: Array.isArray(parsed.savedPresets) ? parsed.savedPresets : []
        });
      } catch (e) {
        return cloneDefaultThemeConfig();
      }
    }

    setThemeConfig(cfg) {
      return this._writeRaw(KEYS.THEME_CONFIG, JSON.stringify(cfg));
    }

    getViewMode() {
      const r = this._readRaw(KEYS.VIEW_MODE);
      return (r.ok && r.value) ? r.value : 'cards';
    }

    setViewMode(mode) {
      return this._writeRaw(KEYS.VIEW_MODE, String(mode || 'cards'));
    }

    /** Налаштування Розумної Таблиці Redstone 5 */
    getTablePrefs() {
      const r = this._readRaw(KEYS.TABLE_PREFS);
      const base = Object.assign({}, DEFAULT_TABLE_PREFS);
      if (!r.ok || !r.value) return base;
      try {
        const parsed = JSON.parse(r.value);
        return {
          density: ['compact', 'comfortable', 'spacious'].indexOf(parsed.density) !== -1 ? parsed.density : base.density,
          zebra: parsed.zebra !== undefined ? Boolean(parsed.zebra) : base.zebra,
          gridLines: Boolean(parsed.gridLines),
          groupBy: ['none', 'status', 'subject', 'priority'].indexOf(parsed.groupBy) !== -1 ? parsed.groupBy : 'none',
          pageSize: [0, 10, 25, 50].indexOf(Number(parsed.pageSize)) !== -1 ? Number(parsed.pageSize) : 25,
          sortDir: parsed.sortDir === 'desc' ? 'desc' : 'asc',
          showQuickAdd: parsed.showQuickAdd !== undefined ? Boolean(parsed.showQuickAdd) : true
        };
      } catch (e) {
        return base;
      }
    }

    setTablePrefs(prefs) {
      return this._writeRaw(KEYS.TABLE_PREFS, JSON.stringify(prefs));
    }

    /** Журнал оцінок та кредитів ECTS (v2.1.7 Redstone 5) */
    getGrades() {
      const r = this._readRaw(KEYS.GRADES);
      if (!r.ok || r.value === null) return null;
      try {
        const arr = JSON.parse(r.value);
        return Array.isArray(arr) ? arr : null;
      } catch (e) {
        return null;
      }
    }

    setGrades(grades) {
      return this._writeRaw(KEYS.GRADES, JSON.stringify(grades));
    }

    getNotes() {
      const r = this._readRaw(KEYS.NOTES);
      return (r.ok && r.value) ? r.value : '';
    }

    setNotes(text) {
      return this._writeRaw(KEYS.NOTES, String(text || ''));
    }

    getFlashcards() {
      const r = this._readRaw(KEYS.FLASHCARDS);
      if (!r.ok || r.value === null) return null;
      try {
        const arr = JSON.parse(r.value);
        return Array.isArray(arr) ? arr : null;
      } catch (e) {
        return null;
      }
    }

    setFlashcards(cards) {
      return this._writeRaw(KEYS.FLASHCARDS, JSON.stringify(cards));
    }

    getPomoStats() {
      const r = this._readRaw(KEYS.POMO_STATS);
      if (!r.ok || !r.value) return { sessions: 0, totalMinutes: 0 };
      try {
        const parsed = JSON.parse(r.value);
        return {
          sessions: Number(parsed.sessions) || 0,
          totalMinutes: Number(parsed.totalMinutes) || 0
        };
      } catch (e) {
        return { sessions: 0, totalMinutes: 0 };
      }
    }

    addPomoSession(minutes) {
      const cur = this.getPomoStats();
      cur.sessions += 1;
      cur.totalMinutes += Math.max(1, Number(minutes) || 25);
      this._writeRaw(KEYS.POMO_STATS, JSON.stringify(cur));
      return cur;
    }

    /** Телеметрія використання локального сховища браузера (v2.1.7 RS5 Optimization) */
    getDiagnostics() {
      let bytes = 0;
      const quotaBytes = 5 * 1024 * 1024;
      try {
        for (let i = 0; i < global.localStorage.length; i++) {
          const k = global.localStorage.key(i);
          if (k && k.indexOf('studyplanner.') === 0) {
            const val = global.localStorage.getItem(k) || '';
            bytes += (k.length + val.length) * 2;
          }
        }
      } catch (e) {
        bytes = 0;
      }
      const usedKB = Math.round((bytes / 1024) * 10) / 10;
      const percent = Math.min(100, Math.round((bytes / quotaBytes) * 1000) / 10);
      return { bytes, usedKB, percent };
    }
  }

  SP.TaskStorage = TaskStorage;
  SP.DEFAULT_THEME_CONFIG = DEFAULT_THEME_CONFIG;
  SP.DEFAULT_TABLE_PREFS = DEFAULT_TABLE_PREFS;
  SP.STORAGE_KEYS = KEYS;
  SP.STORAGE_KEY = KEYS.TASKS;
})(window);
