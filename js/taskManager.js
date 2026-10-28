/**
 * taskManager.js — [Core Layer] предметна модель та бізнес-логіка (SP.Task, SP.TaskManager).
 * Версія 2.1.7 (build 217) Redstone 5 — Автор: Максим Ковалишин.
 * Архітектурні покращення та оптимізації v2.1.7 Redstone 5:
 * - O(1) хеш-індекс завдань за ID (Map) та кешований _searchIndex у кожному Task.
 * - Двосторонній стек Undo / Redo (Ctrl+Z / Ctrl+Y, до 15 знімків стану).
 * - Пакетні табличні операції (bulkChangeStatus, bulkChangePriority, bulkShiftDueDate, bulkDeleteTasks, bulkDuplicateTasks, patchTask).
 * - Експорт вибірок у CSV, Markdown-таблицю та стандарт календаря iCalendar (.ICS).
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});

  const PRIORITY = Object.freeze({
    LOW: { code: 'LOW', label: 'Низький', rank: 0 },
    MEDIUM: { code: 'MEDIUM', label: 'Середній', rank: 1 },
    HIGH: { code: 'HIGH', label: 'Високий', rank: 2 }
  });

  const STATUS = Object.freeze({
    PLANNED: { code: 'PLANNED', label: 'Заплановано' },
    IN_PROGRESS: { code: 'IN_PROGRESS', label: 'У роботі' },
    DONE: { code: 'DONE', label: 'Виконано' }
  });

  const SORT_MODE = Object.freeze({
    BY_DATE: 'BY_DATE',
    BY_PRIORITY: 'BY_PRIORITY',
    BY_STATUS: 'BY_STATUS',
    BY_PROGRESS: 'BY_PROGRESS',
    BY_SUBJECT: 'BY_SUBJECT',
    BY_TITLE: 'BY_TITLE',
    BY_NEWEST: 'BY_NEWEST'
  });

  const RANKS = Object.freeze([
    { min: 0, title: '🌱 Новачок планування', next: 80 },
    { min: 80, title: '📘 Бакалавр фокусу', next: 180 },
    { min: 180, title: '⚡ Дослідник дисциплін', next: 300 },
    { min: 300, title: '🎓 Магістр продуктивності', next: 450 },
    { min: 450, title: '🏆 Академічна легенда', next: 650 },
    { min: 650, title: '👑 Грандмайстер Redstone 5', next: 1000 }
  ]);

  function todayISO(now) {
    const d = now || new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function shiftIsoDate(iso, deltaDays) {
    const parts = String(iso || '').split('-').map(Number);
    if (parts.length !== 3) return todayISO();
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + Number(deltaDays || 0));
    return todayISO(d);
  }

  function newId(prefix) {
    return (prefix || 't-') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  class Task {
    constructor(fields) {
      Object.assign(this, fields);
      if (!this.imageUrl) this.imageUrl = '';
      if (!Array.isArray(this.subtasks)) this.subtasks = [];
      if (!Array.isArray(this.tags)) this.tags = [];
      this._rebuildSearchIndex();
    }

    _rebuildSearchIndex() {
      const subText = this.subtasks.map((s) => s.text).join(' ');
      this._searchIndex = (
        (this.title || '') + '\n' +
        (this.subject || '') + '\n' +
        (this.description || '') + '\n' +
        this.tags.join(' ') + '\n' +
        subText
      ).toLocaleLowerCase('uk-UA');
    }

    clone() {
      return new Task(this.toJSON());
    }

    toJSON() {
      return {
        id: this.id,
        title: this.title,
        subject: this.subject,
        description: this.description,
        dueDate: this.dueDate,
        priority: this.priority,
        status: this.status,
        imageUrl: this.imageUrl || '',
        subtasks: this.subtasks.map((s) => ({
          id: s.id || newId('st-'),
          text: String(s.text || ''),
          done: Boolean(s.done)
        })),
        tags: this.tags.slice(),
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
      };
    }

    touch() {
      this.updatedAt = new Date().toISOString();
      this._rebuildSearchIndex();
    }

    update(values) {
      this.title = values.title;
      this.subject = values.subject;
      this.description = values.description;
      this.dueDate = values.dueDate;
      if (values.priority) this.priority = values.priority;
      if (values.status) this.status = values.status;
      if (values.imageUrl !== undefined) this.imageUrl = values.imageUrl;
      if (values.subtasks !== undefined) this.subtasks = values.subtasks;
      if (values.tags !== undefined) this.tags = values.tags;
      this.touch();
    }

    changePriority(code) { this.priority = code; this.touch(); }
    changeStatus(code) { this.status = code; this.touch(); }

    subtaskProgress() {
      const total = this.subtasks.length;
      if (total === 0) return { total: 0, done: 0, percent: 0 };
      let done = 0;
      for (let i = 0; i < total; i++) {
        if (this.subtasks[i].done) done++;
      }
      return { total, done, percent: Math.round((done / total) * 100) };
    }

    isOverdue(today) {
      return this.status !== 'DONE' && this.dueDate < (today || todayISO());
    }

    daysUntilDue(today) {
      const tStr = today || todayISO();
      const tParts = tStr.split('-').map(Number);
      const dParts = String(this.dueDate).split('-').map(Number);
      if (tParts.length !== 3 || dParts.length !== 3) return 0;
      const tDate = new Date(tParts[0], tParts[1] - 1, tParts[2]);
      const dDate = new Date(dParts[0], dParts[1] - 1, dParts[2]);
      return Math.round((dDate - tDate) / 86400000);
    }
  }

  class TaskManager {
    constructor(storage, validator) {
      this.storage = storage;
      this.validator = validator;
      this.tasks = [];
      this._byId = new Map();
      this._undoStack = [];
      this._redoStack = [];
      this.readError = null;
      this.reload();
    }

    _syncIndex(taskList) {
      this.tasks = taskList;
      this._byId.clear();
      for (let i = 0; i < taskList.length; i++) {
        this._byId.set(taskList[i].id, taskList[i]);
      }
    }

    _pushUndo(actionLabel) {
      if (this._undoStack.length >= 15) this._undoStack.shift();
      this._undoStack.push({
        label: actionLabel,
        snapshot: this.tasks.map((t) => t.toJSON())
      });
      this._redoStack = [];
    }

    canUndo() {
      return this._undoStack.length > 0 && !this.readError;
    }

    canRedo() {
      return this._redoStack.length > 0 && !this.readError;
    }

    /** Скасування останньої мутації з підтримкою Redo (v2.1.7 RS5) */
    undoLast() {
      if (!this.canUndo()) return { ok: false, error: 'Немає дій для скасування.' };
      const entry = this._undoStack.pop();
      const currentSnapshot = this.tasks.map((t) => t.toJSON());
      const restored = entry.snapshot.map((raw) => new Task(raw));
      const res = this._persist(restored);
      if (res.ok) {
        if (this._redoStack.length >= 15) this._redoStack.shift();
        this._redoStack.push({ label: entry.label, snapshot: currentSnapshot });
        return { ok: true, label: entry.label };
      }
      return { ok: false, error: res.error };
    }

    /** Повтор скасованої дії (Ctrl+Y / Ctrl+Shift+Z) */
    redoLast() {
      if (!this.canRedo()) return { ok: false, error: 'Немає скасованих дій для повтору.' };
      const entry = this._redoStack.pop();
      const currentSnapshot = this.tasks.map((t) => t.toJSON());
      const restored = entry.snapshot.map((raw) => new Task(raw));
      const res = this._persist(restored);
      if (res.ok) {
        if (this._undoStack.length >= 15) this._undoStack.shift();
        this._undoStack.push({ label: entry.label, snapshot: currentSnapshot });
        return { ok: true, label: entry.label };
      }
      return { ok: false, error: res.error };
    }

    reload() {
      const res = this.storage.load();
      if (res.ok) {
        this._syncIndex(res.tasks.map((t) => new Task(t)));
        this.readError = null;
      } else {
        this._syncIndex([]);
        this.readError = res.error;
      }
      return res;
    }

    startEmpty() {
      this.storage.backupRaw();
      this._syncIndex([]);
      this._undoStack = [];
      this._redoStack = [];
      this.readError = null;
    }

    _persist(nextTasks) {
      if (this.readError) return { ok: false, error: 'Збереження вимкнено через помилку читання даних.' };
      const res = this.storage.save(nextTasks.map((t) => t.toJSON()));
      if (res.ok) this._syncIndex(nextTasks);
      return res;
    }

    /** Пошук завдання за O(1) через Map-індекс */
    getTask(id) {
      return this._byId.get(id) || null;
    }

    getSubjects() {
      const collator = SP.ukCollator || { compare: (a, b) => a.localeCompare(b, 'uk') };
      return Array.from(new Set(this.tasks.map((t) => t.subject))).sort(collator.compare);
    }

    getTags() {
      const set = new Set();
      for (let i = 0; i < this.tasks.length; i++) {
        const tags = this.tasks[i].tags;
        for (let j = 0; j < tags.length; j++) set.add(tags[j]);
      }
      const collator = SP.ukCollator || { compare: (a, b) => a.localeCompare(b, 'uk') };
      return Array.from(set).sort(collator.compare);
    }

    createTask(data) {
      const check = this.validator.validate(data);
      if (!check.valid) return { ok: false, errors: check.errors };
      this._pushUndo('створення завдання');
      const now = new Date().toISOString();
      const task = new Task({
        id: newId('t-'),
        title: check.values.title,
        subject: check.values.subject,
        description: check.values.description,
        dueDate: check.values.dueDate,
        priority: check.values.priority || 'MEDIUM',
        status: check.values.status || 'PLANNED',
        imageUrl: check.values.imageUrl || '',
        subtasks: check.values.subtasks || [],
        tags: check.values.tags || [],
        createdAt: now,
        updatedAt: now
      });
      const res = this._persist(this.tasks.concat([task]));
      if (!res.ok) this._undoStack.pop();
      return res.ok ? { ok: true, task: task } : { ok: false, error: res.error };
    }

    /** Швидке часткове inline-оновлення комірок у Розумній Таблиці (v2.1.7 RS5) */
    patchTask(id, partial) {
      const current = this.getTask(id);
      if (!current) return { ok: false, error: 'Завдання не знайдено.' };
      const merged = {
        title: partial.title !== undefined ? partial.title : current.title,
        subject: partial.subject !== undefined ? partial.subject : current.subject,
        description: partial.description !== undefined ? partial.description : current.description,
        dueDate: partial.dueDate !== undefined ? partial.dueDate : current.dueDate,
        priority: partial.priority !== undefined ? partial.priority : current.priority,
        status: partial.status !== undefined ? partial.status : current.status,
        imageUrl: partial.imageUrl !== undefined ? partial.imageUrl : current.imageUrl,
        subtasks: partial.subtasks !== undefined ? partial.subtasks : current.subtasks,
        tags: partial.tags !== undefined ? partial.tags : current.tags
      };
      const check = this.validator.validate(merged);
      if (!check.valid) {
        const firstErr = Object.values(check.errors)[0] || 'Некоректні дані поля.';
        return { ok: false, error: firstErr, errors: check.errors };
      }
      this._pushUndo('швидке редагування в таблиці');
      const next = current.clone();
      next.update(check.values);
      const res = this._persist(this.tasks.map((t) => (t.id === id ? next : t)));
      if (!res.ok) this._undoStack.pop();
      return res.ok ? { ok: true, task: next } : { ok: false, error: res.error };
    }

    duplicateTask(id) {
      const current = this.getTask(id);
      if (!current) return { ok: false, error: 'Завдання не знайдено.' };
      this._pushUndo('дублювання завдання');
      const now = new Date().toISOString();
      const copy = new Task({
        id: newId('t-'),
        title: (current.title + ' (копія)').slice(0, 100),
        subject: current.subject,
        description: current.description,
        dueDate: current.dueDate,
        priority: current.priority,
        status: 'PLANNED',
        imageUrl: current.imageUrl || '',
        subtasks: current.subtasks.map((s) => ({ id: newId('st-'), text: s.text, done: false })),
        tags: current.tags.slice(),
        createdAt: now,
        updatedAt: now
      });
      const res = this._persist(this.tasks.concat([copy]));
      if (!res.ok) this._undoStack.pop();
      return res.ok ? { ok: true, task: copy } : { ok: false, error: res.error };
    }

    updateTask(id, data) {
      const current = this.getTask(id);
      if (!current) return { ok: false, error: 'Завдання не знайдено.' };
      const check = this.validator.validate(Object.assign({ status: current.status }, data));
      if (!check.valid) return { ok: false, errors: check.errors };
      this._pushUndo('редагування завдання');
      const next = current.clone();
      next.update(check.values);
      const res = this._persist(this.tasks.map((t) => (t.id === id ? next : t)));
      if (!res.ok) this._undoStack.pop();
      return res.ok ? { ok: true, task: next } : { ok: false, error: res.error };
    }

    changePriority(id, code) {
      return this._mutate(id, code, PRIORITY, 'зміну пріоритету', (t) => t.changePriority(code));
    }

    changeStatus(id, code) {
      return this._mutate(id, code, STATUS, 'зміну статусу', (t) => t.changeStatus(code));
    }

    /** Циклічне перемикання статусу в 1 клік: PLANNED → IN_PROGRESS → DONE → PLANNED */
    cycleTaskStatus(id) {
      const current = this.getTask(id);
      if (!current) return { ok: false, error: 'Завдання не знайдено.' };
      const order = ['PLANNED', 'IN_PROGRESS', 'DONE'];
      const nextCode = order[(order.indexOf(current.status) + 1) % order.length];
      return this.changeStatus(id, nextCode);
    }

    toggleSubtask(taskId, subId) {
      const current = this.getTask(taskId);
      if (!current) return { ok: false, error: 'Завдання не знайдено.' };
      const next = current.clone();
      let found = false;
      next.subtasks = next.subtasks.map((s) => {
        if (s.id === subId) {
          found = true;
          return { id: s.id, text: s.text, done: !s.done };
        }
        return s;
      });
      if (!found) return { ok: false, error: 'Етап не знайдено.' };
      next.touch();
      const res = this._persist(this.tasks.map((t) => (t.id === taskId ? next : t)));
      return res.ok ? { ok: true, task: next } : { ok: false, error: res.error };
    }

    addSubtask(taskId, text) {
      const current = this.getTask(taskId);
      if (!current) return { ok: false, error: 'Завдання не знайдено.' };
      const clean = String(text || '').trim().slice(0, 160);
      if (!clean) return { ok: false, error: 'Введіть текст етапу.' };
      if (current.subtasks.length >= 25) return { ok: false, error: 'Досягнуто ліміт підзавдань (25).' };
      const next = current.clone();
      next.subtasks.push({ id: newId('st-'), text: clean, done: false });
      next.touch();
      const res = this._persist(this.tasks.map((t) => (t.id === taskId ? next : t)));
      return res.ok ? { ok: true, task: next } : { ok: false, error: res.error };
    }

    removeSubtask(taskId, subId) {
      const current = this.getTask(taskId);
      if (!current) return { ok: false, error: 'Завдання не знайдено.' };
      const next = current.clone();
      next.subtasks = next.subtasks.filter((s) => s.id !== subId);
      next.touch();
      const res = this._persist(this.tasks.map((t) => (t.id === taskId ? next : t)));
      return res.ok ? { ok: true, task: next } : { ok: false, error: res.error };
    }

    _mutate(id, code, allowed, undoLabel, apply) {
      const current = this.getTask(id);
      if (!current) return { ok: false, error: 'Завдання не знайдено.' };
      if (!Object.prototype.hasOwnProperty.call(allowed, code)) return { ok: false, error: 'Недопустиме значення.' };
      this._pushUndo(undoLabel);
      const next = current.clone();
      apply(next);
      const res = this._persist(this.tasks.map((t) => (t.id === id ? next : t)));
      if (!res.ok) this._undoStack.pop();
      return res.ok ? { ok: true, task: next } : { ok: false, error: res.error };
    }

    deleteTask(id) {
      const target = this.getTask(id);
      if (!target) return { ok: false, error: 'Завдання не знайдено.' };
      this._pushUndo('видалення «' + target.title.slice(0, 28) + '»');
      const res = this._persist(this.tasks.filter((t) => t.id !== id));
      if (!res.ok) this._undoStack.pop();
      return res.ok ? { ok: true, undoAvailable: true } : { ok: false, error: res.error };
    }

    /* ---------- Потужні пакетні інструменти для Розумної Таблиці Redstone 5 ---------- */
    bulkChangeStatus(ids, code) {
      if (!Object.prototype.hasOwnProperty.call(STATUS, code)) return { ok: false, error: 'Некоректний статус.' };
      const idSet = new Set(ids || []);
      let changed = 0;
      const preview = this.tasks.map((t) => {
        if (idSet.has(t.id) && t.status !== code) {
          changed++;
          const c = t.clone();
          c.changeStatus(code);
          return c;
        }
        return t;
      });
      if (changed === 0) return { ok: true, count: 0 };
      this._pushUndo('масову зміну статусу (' + changed + ')');
      const res = this._persist(preview);
      if (!res.ok) this._undoStack.pop();
      return res.ok ? { ok: true, count: changed } : res;
    }

    bulkChangePriority(ids, code) {
      if (!Object.prototype.hasOwnProperty.call(PRIORITY, code)) return { ok: false, error: 'Некоректний пріоритет.' };
      const idSet = new Set(ids || []);
      let changed = 0;
      const preview = this.tasks.map((t) => {
        if (idSet.has(t.id) && t.priority !== code) {
          changed++;
          const c = t.clone();
          c.changePriority(code);
          return c;
        }
        return t;
      });
      if (changed === 0) return { ok: true, count: 0 };
      this._pushUndo('масову зміну пріоритету (' + changed + ')');
      const res = this._persist(preview);
      if (!res.ok) this._undoStack.pop();
      return res.ok ? { ok: true, count: changed } : res;
    }

    bulkShiftDueDate(ids, deltaDays) {
      const idSet = new Set(ids || []);
      let changed = 0;
      const preview = this.tasks.map((t) => {
        if (idSet.has(t.id)) {
          changed++;
          const c = t.clone();
          c.dueDate = shiftIsoDate(c.dueDate, deltaDays);
          c.touch();
          return c;
        }
        return t;
      });
      if (changed === 0) return { ok: true, count: 0 };
      this._pushUndo('перенесення дедлайнів (' + changed + ')');
      const res = this._persist(preview);
      if (!res.ok) this._undoStack.pop();
      return res.ok ? { ok: true, count: changed } : res;
    }

    bulkDeleteTasks(ids) {
      const idSet = new Set(ids || []);
      const remaining = this.tasks.filter((t) => !idSet.has(t.id));
      const removed = this.tasks.length - remaining.length;
      if (removed === 0) return { ok: true, count: 0 };
      this._pushUndo('масове видалення (' + removed + ' завд.)');
      const res = this._persist(remaining);
      if (!res.ok) this._undoStack.pop();
      return res.ok ? { ok: true, count: removed } : res;
    }

    bulkDuplicateTasks(ids) {
      const idSet = new Set(ids || []);
      const copies = [];
      const now = new Date().toISOString();
      for (let i = 0; i < this.tasks.length; i++) {
        const t = this.tasks[i];
        if (!idSet.has(t.id)) continue;
        copies.push(new Task({
          id: newId('t-'),
          title: (t.title + ' (копія)').slice(0, 100),
          subject: t.subject,
          description: t.description,
          dueDate: t.dueDate,
          priority: t.priority,
          status: 'PLANNED',
          imageUrl: t.imageUrl || '',
          subtasks: t.subtasks.map((s) => ({ id: newId('st-'), text: s.text, done: false })),
          tags: t.tags.slice(),
          createdAt: now,
          updatedAt: now
        }));
      }
      if (copies.length === 0) return { ok: true, count: 0 };
      this._pushUndo('дублювання обраних (' + copies.length + ')');
      const res = this._persist(this.tasks.concat(copies));
      if (!res.ok) this._undoStack.pop();
      return res.ok ? { ok: true, count: copies.length } : res;
    }

    completeAllTasks(ids) {
      return this.bulkChangeStatus(ids, 'DONE');
    }

    clearCompletedTasks() {
      const before = this.tasks.length;
      const remaining = this.tasks.filter((t) => t.status !== 'DONE');
      const removed = before - remaining.length;
      if (removed === 0) return { ok: true, removed: 0 };
      this._pushUndo('очищення виконаних (' + removed + ')');
      const res = this._persist(remaining);
      if (!res.ok) this._undoStack.pop();
      return { ok: res.ok, error: res.error, removed: removed, undoAvailable: res.ok };
    }

    /** Зведена аналітика, баланс пріоритетів і ранг XP v2.1.7 Redstone 5 */
    getStats(today, extraStats) {
      const day = today || todayISO();
      const total = this.tasks.length;
      let planned = 0, inProgress = 0, done = 0, overdue = 0;
      let high = 0, medium = 0, low = 0;
      let subtasksDone = 0, subtasksTotal = 0, withImages = 0, dueSoon = 0;

      for (let i = 0; i < total; i++) {
        const t = this.tasks[i];
        if (t.imageUrl) withImages++;
        if (t.priority === 'HIGH') high++;
        else if (t.priority === 'LOW') low++;
        else medium++;

        const sp = t.subtaskProgress();
        subtasksDone += sp.done;
        subtasksTotal += sp.total;

        if (t.status === 'DONE') {
          done++;
        } else {
          if (t.status === 'IN_PROGRESS') inProgress++;
          else planned++;
          if (t.isOverdue(day)) overdue++;
          else {
            const diff = t.daysUntilDue(day);
            if (diff >= 0 && diff <= 3) dueSoon++;
          }
        }
      }

      const pomoSessions = extraStats && extraStats.pomoSessions ? extraStats.pomoSessions : 0;
      const masteredCards = extraStats && extraStats.masteredCards ? extraStats.masteredCards : 0;
      const passedCourses = extraStats && extraStats.passedCourses ? extraStats.passedCourses : 0;

      const percent = total > 0 ? Math.round((done / total) * 100) : 0;
      const xp = done * 50 + inProgress * 20 + planned * 5 + subtasksDone * 10 + pomoSessions * 25 + masteredCards * 15 + passedCourses * 30;

      let currentRank = RANKS[0];
      for (let r = 0; r < RANKS.length; r++) {
        if (xp >= RANKS[r].min) currentRank = RANKS[r];
      }
      const span = Math.max(1, currentRank.next - currentRank.min);
      const rankProgress = Math.min(100, Math.round(((xp - currentRank.min) / span) * 100));

      return {
        total, planned, inProgress, done, overdue, dueSoon,
        high, medium, low,
        withImages, subtasksDone, subtasksTotal,
        percent, xp,
        rankTitle: currentRank.title,
        nextRankXp: currentRank.next,
        rankProgress
      };
    }

    /** Детальна матриця успішності за предметами для віджетів і зведеної таблиці */
    getSubjectBreakdown(today) {
      const day = today || todayISO();
      const map = {};
      for (let i = 0; i < this.tasks.length; i++) {
        const t = this.tasks[i];
        const s = t.subject;
        if (!map[s]) {
          map[s] = { total: 0, planned: 0, inProgress: 0, done: 0, overdue: 0, subtasksDone: 0, subtasksTotal: 0 };
        }
        const m = map[s];
        m.total++;
        const sp = t.subtaskProgress();
        m.subtasksDone += sp.done;
        m.subtasksTotal += sp.total;
        if (t.status === 'DONE') m.done++;
        else if (t.status === 'IN_PROGRESS') m.inProgress++;
        else m.planned++;
        if (t.isOverdue(day)) m.overdue++;
      }
      return Object.keys(map)
        .sort((a, b) => map[b].total - map[a].total)
        .map((s) => ({
          subject: s,
          total: map[s].total,
          planned: map[s].planned,
          inProgress: map[s].inProgress,
          done: map[s].done,
          overdue: map[s].overdue,
          subtasksDone: map[s].subtasksDone,
          subtasksTotal: map[s].subtasksTotal,
          percent: map[s].total > 0 ? Math.round((map[s].done / map[s].total) * 100) : 0
        }));
    }

    loadSampleTasks(useSvgDiagrams) {
      this._pushUndo('завантаження демо-завдань');
      const today = new Date();
      const addDays = (n) => {
        const d = new Date(today);
        d.setDate(d.getDate() + n);
        return todayISO(d);
      };
      const now = new Date().toISOString();

      const samples = [
        {
          id: newId('t-'),
          title: 'Інтерактивна Розумна Таблиця та Журнал ECTS у StudyPlanner v2.1.7 (build 217) RS5',
          subject: 'Вебпрограмування',
          description: 'Впровадити нове покоління Розумної Таблиці Redstone 5 зі швидким додаванням рядків, inline-редагуванням, пакетними діями, групуванням та калькулятором балів ECTS.',
          dueDate: addDays(0),
          priority: 'HIGH',
          status: 'IN_PROGRESS',
          imageUrl: useSvgDiagrams ? 'img/sample-code.svg' : 'img/web/photo-code.jpg',
          tags: ['v2.1.7', 'Redstone 5', 'Таблиця'],
          subtasks: [
            { id: newId('st-'), text: 'Реалізувати швидке додавання, видалення та зміну статусу прямо в таблиці', done: true },
            { id: newId('st-'), text: 'Додати мульти-вибір, масовий зсув дедлайнів, групування й сортування колонок', done: true },
            { id: newId('st-'), text: 'Запустити інтерактивний Журнал оцінок та Калькулятор стипендії ECTS', done: false }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: newId('t-'),
          title: 'Розрахункова робота: Кратні інтеграли, ряди Фур’є та векторний аналіз',
          subject: 'Вища математика',
          description: 'Побудувати графіки поверхонь другого порядку, обчислити потік векторного поля та перевірити формулу Остроградського-Гаусса.',
          dueDate: addDays(2),
          priority: 'HIGH',
          status: 'IN_PROGRESS',
          imageUrl: useSvgDiagrams ? 'img/sample-math.svg' : 'img/web/photo-math.jpg',
          tags: ['Колоквіум', 'Розрахункова'],
          subtasks: [
            { id: newId('st-'), text: 'Обчислити подвійний інтеграл у полярних координатах', done: true },
            { id: newId('st-'), text: 'Розкласти періодичну функцію в тригонометричний ряд Фур’є', done: false },
            { id: newId('st-'), text: 'Оформити чистові креслення областей інтегрування', done: false }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: newId('t-'),
          title: 'Експериментальне дослідження електромагнітної індукції та спектра світла',
          subject: 'Фізика',
          description: 'Виміряти ЕРС індукції у котушці, побудувати графік дисперсії світла у скляній призмі та оцінити похибки вимірювань.',
          dueDate: addDays(4),
          priority: 'MEDIUM',
          status: 'PLANNED',
          imageUrl: useSvgDiagrams ? 'img/sample-physics.svg' : 'img/web/photo-physics.jpg',
          tags: ['Лабораторна', 'Оптика'],
          subtasks: [
            { id: newId('st-'), text: 'Зібрати електричне коло та зняти покази приладів', done: false },
            { id: newId('st-'), text: 'Побудувати таблицю похибок та висновки', done: false }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: newId('t-'),
          title: 'Якісні реакції органічних сполук і спектрофотометрія розчинів',
          subject: 'Органічна хімія',
          description: 'Дослідити властивості ароматичних вуглеводнів, провести титрування та визначити показник кислотності pH буферних систем.',
          dueDate: addDays(-1),
          priority: 'HIGH',
          status: 'PLANNED',
          imageUrl: useSvgDiagrams ? 'img/sample-chemistry.svg' : 'img/web/photo-chemistry.jpg',
          tags: ['Лабораторна', 'Терміново'],
          subtasks: [
            { id: newId('st-'), text: 'Повторити правила техніки безпеки у хімічній лабораторії', done: true },
            { id: newId('st-'), text: 'Записати рівняння реакцій заміщення та окиснення', done: false }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: newId('t-'),
          title: 'Мікроскопічний аналіз клітинних структур і реплікації подвійної спіралі ДНК',
          subject: 'Біологія',
          description: 'Описати фази мітозу, комплементарність нуклеотидних пар А-Т, Г-Ц та роль ферментів ДНК-полімерази.',
          dueDate: addDays(3),
          priority: 'MEDIUM',
          status: 'PLANNED',
          imageUrl: useSvgDiagrams ? 'img/sample-biology.svg' : 'img/web/photo-biology.jpg',
          tags: ['Семінар', 'Генетика'],
          subtasks: [
            { id: newId('st-'), text: 'Підготувати мікропрепарат та замалювати стадії поділу клітини', done: true },
            { id: newId('st-'), text: 'Повторити терміни у 3D-тренажері Флеш-карток', done: false }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: newId('t-'),
          title: 'Спостереження екзопланет та еволюції туманностей у глибокому космосі',
          subject: 'Астрономія та космологія',
          description: 'Розрахувати світність зір за діаграмою Герцшпрунга-Рассела та проаналізувати знімки космічного телескопа.',
          dueDate: addDays(6),
          priority: 'MEDIUM',
          status: 'IN_PROGRESS',
          imageUrl: 'img/web/photo-astronomy.jpg',
          tags: ['Доповідь', 'Презентація'],
          subtasks: [
            { id: newId('st-'), text: 'Зібрати астрофотографії туманності Оріона', done: true },
            { id: newId('st-'), text: 'Розрахувати парсеки та зоряну величину', done: true },
            { id: newId('st-'), text: 'Підготувати слайди до захисту', done: false }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: newId('t-'),
          title: 'Картографічний аналіз кліматичних поясів та геоінформаційних систем',
          subject: 'Географія',
          description: 'Визначити географічні координати ключових метеостанцій, побудувати розу вітрів та кліматограми.',
          dueDate: addDays(5),
          priority: 'LOW',
          status: 'DONE',
          imageUrl: useSvgDiagrams ? 'img/sample-geography.svg' : 'img/web/photo-geography.jpg',
          tags: ['Практична', 'ГІС'],
          subtasks: [
            { id: newId('st-'), text: 'Нанести ізотерми на контурну карту', done: true },
            { id: newId('st-'), text: 'Здати роботу на перевірку', done: true }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: newId('t-'),
          title: 'Есе-дослідження модернізму та символізму в українській класиці',
          subject: 'Українська література',
          description: 'Проаналізувати художні образи, підібрати цитати та розкрити філософський зміст творів.',
          dueDate: addDays(1),
          priority: 'LOW',
          status: 'DONE',
          imageUrl: useSvgDiagrams ? 'img/sample-literature.svg' : 'img/web/photo-literature.jpg',
          tags: ['Есе', 'Читання'],
          subtasks: [
            { id: newId('st-'), text: 'Скласти план і виписати ключові цитати', done: true },
            { id: newId('st-'), text: 'Написати чистовий текст есе', done: true }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: newId('t-'),
          title: 'Кольорознавство та модульні дизайн-системи сучасних вебзастосунків',
          subject: 'Архітектура та дизайн',
          description: 'Підібрати гармонійні колірні тріади за колом Іттена, оптимізувати контрастність WCAG та адаптивну сітку.',
          dueDate: addDays(7),
          priority: 'MEDIUM',
          status: 'PLANNED',
          imageUrl: 'img/web/photo-art.jpg',
          tags: ['Дизайн', 'Палітра'],
          subtasks: [
            { id: newId('st-'), text: 'Протестувати світлі й темні кольорові теми', done: true },
            { id: newId('st-'), text: 'Підготувати мудборд із фотографіями', done: false }
          ],
          createdAt: now,
          updatedAt: now
        }
      ].map((s) => new Task(s));

      return this._persist(samples);
    }

    exportJSON(subset) {
      const list = Array.isArray(subset) ? subset : this.tasks;
      return JSON.stringify(list.map((t) => t.toJSON()), null, 2);
    }

    exportCSV(subset) {
      const list = Array.isArray(subset) ? subset : this.tasks;
      const esc = (val) => '"' + String(val == null ? '' : val).replace(/"/g, '""') + '"';
      const header = ['ID', 'Назва', 'Предмет', 'Дата (ISO)', 'Пріоритет', 'Статус', 'Підзавдання', 'Теги', 'Опис'];
      const rows = [header.map(esc).join(';')];
      list.forEach((t) => {
        const sp = t.subtaskProgress();
        rows.push([
          t.id,
          t.title,
          t.subject,
          t.dueDate,
          PRIORITY[t.priority] ? PRIORITY[t.priority].label : t.priority,
          STATUS[t.status] ? STATUS[t.status].label : t.status,
          sp.total > 0 ? sp.done + '/' + sp.total : '0/0',
          t.tags.join(', '),
          t.description
        ].map(esc).join(';'));
      });
      return '\uFEFF' + rows.join('\r\n');
    }

    /** Генерація чистої Markdown-таблиці для буфера обміну / Notion / GitHub (v2.1.7 RS5) */
    exportMarkdownTable(subset) {
      const list = Array.isArray(subset) ? subset : this.tasks;
      const escMd = (s) => String(s || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
      const lines = [
        '| № | Назва завдання | Предмет | Дедлайн | Пріоритет | Статус | Етапи |',
        '|---:|---|---|---|---|---|---|'
      ];
      list.forEach((t, idx) => {
        const sp = t.subtaskProgress();
        lines.push(
          '| ' + (idx + 1) +
          ' | ' + escMd(t.title) +
          ' | ' + escMd(t.subject) +
          ' | ' + SP.Validator.formatDate(t.dueDate) +
          ' | ' + (PRIORITY[t.priority] ? PRIORITY[t.priority].label : t.priority) +
          ' | ' + (STATUS[t.status] ? STATUS[t.status].label : t.status) +
          ' | ' + (sp.total > 0 ? sp.done + '/' + sp.total : '—') + ' |'
        );
      });
      return lines.join('\n');
    }

    exportMarkdown() {
      const lines = [
        '# 📚 Навчальний план — StudyPlanner v2.1.7 (build 217) Redstone 5',
        '',
        '> Згенеровано: ' + new Date().toLocaleString('uk-UA') + ' | Автор системи: Максим Ковалишин',
        ''
      ];
      if (this.tasks.length === 0) {
        lines.push('_Список завдань порожній._');
        return lines.join('\n');
      }
      lines.push('## 📋 Зведена таблиця завдань');
      lines.push('');
      lines.push(this.exportMarkdownTable(this.tasks));
      lines.push('');
      lines.push('## 📝 Деталізація плану');
      lines.push('');
      this.tasks.forEach((t, idx) => {
        const mark = t.status === 'DONE' ? 'x' : ' ';
        lines.push('### ' + (idx + 1) + '. [' + mark + '] ' + t.title);
        lines.push('- **Предмет:** ' + t.subject + ' | **Дедлайн:** ' + t.dueDate + ' | **Пріоритет:** ' + PRIORITY[t.priority].label + ' | **Статус:** ' + STATUS[t.status].label);
        if (t.tags.length) lines.push('- **Теги:** ' + t.tags.map((x) => '`' + x + '`').join(' '));
        if (t.description) lines.push('- **Опис:** ' + t.description);
        if (t.subtasks.length) {
          lines.push('- **Етапи виконання:**');
          t.subtasks.forEach((s) => lines.push('  - [' + (s.done ? 'x' : ' ') + '] ' + s.text));
        }
        lines.push('');
      });
      return lines.join('\n');
    }

    /** Експорт дедлайнів у стандарт iCalendar (.ICS) для Google / Apple / Outlook Calendar (v2.1.7 RS5) */
    exportICS() {
      const escIcs = (str) => String(str || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, '\\$&');
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
      const out = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//StudyPlanner v2.1.7 b217 RS5//Maksim Kovalyshyn//UK',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
      ];
      this.tasks.forEach((t) => {
        const dt = String(t.dueDate).replace(/-/g, '');
        out.push('BEGIN:VEVENT');
        out.push('UID:' + t.id + '@studyplanner.local');
        out.push('DTSTAMP:' + stamp);
        out.push('DTSTART;VALUE=DATE:' + dt);
        out.push('SUMMARY:' + escIcs('[' + t.subject + '] ' + t.title));
        out.push('DESCRIPTION:' + escIcs((t.description || '') + (t.tags.length ? '\nТеги: ' + t.tags.join(', ') : '')));
        out.push('STATUS:' + (t.status === 'DONE' ? 'COMPLETED' : 'CONFIRMED'));
        out.push('END:VEVENT');
      });
      out.push('END:VCALENDAR');
      return out.join('\r\n');
    }

    importJSON(jsonString) {
      try {
        const data = JSON.parse(jsonString);
        if (!Array.isArray(data)) return { ok: false, error: 'Дані мають бути масивом завдань.' };
        this._pushUndo('імпорт резервної копії');
        const imported = [];
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          if (!item || typeof item.title !== 'string' || !item.dueDate) {
            this._undoStack.pop();
            return { ok: false, error: 'Завдання №' + (i + 1) + ' має некоректний формат.' };
          }
          imported.push(new Task({
            id: item.id || newId('t-'),
            title: String(item.title).slice(0, 100),
            subject: String(item.subject || 'Загальне').slice(0, 80),
            description: String(item.description || '').slice(0, 1500),
            dueDate: /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) ? item.dueDate : todayISO(),
            priority: ['LOW', 'MEDIUM', 'HIGH'].includes(item.priority) ? item.priority : 'MEDIUM',
            status: ['PLANNED', 'IN_PROGRESS', 'DONE'].includes(item.status) ? item.status : 'PLANNED',
            imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : '',
            subtasks: SP.Validator.sanitizeSubtasks(item.subtasks),
            tags: SP.Validator.sanitizeTags(item.tags),
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString()
          }));
        }
        const res = this._persist(imported);
        if (!res.ok) this._undoStack.pop();
        return res;
      } catch (e) {
        return { ok: false, error: 'Помилка розбору JSON: ' + e.message };
      }
    }

    getVisibleTasks(filter, sortMode, today, sortDir) {
      const day = today || todayISO();
      const compare = SP.createComparator(sortMode, sortDir);
      return this.tasks.filter((t) => filter.matches(t, day)).sort(compare);
    }
  }

  const DEFAULT_FLASHCARDS = [
    {
      id: 'fc-1',
      subject: 'Вища математика',
      front: 'Формула Ньютона — Лейбніца для визначеного інтеграла',
      back: '∫[a..b] f(x) dx = F(b) − F(a), де F′(x) = f(x) — первісна неперервної функції на відрізку [a, b].',
      mastered: false
    },
    {
      id: 'fc-2',
      subject: 'Фізика',
      front: 'Закон електромагнітної індукції Фарадея',
      back: 'ЕРС індукції у замкненому контурі дорівнює швидкості зміни магнітного потоку з протилежним знаком: εᵢ = −dΦ / dt.',
      mastered: false
    },
    {
      id: 'fc-3',
      subject: 'Вебпрограмування',
      front: 'Перевага делегування подій (Event Delegation) у таблиці на 100+ рядків',
      back: 'Замість створення сотень обробників на кожній кнопці рядка використовується один обробник на tbody, що радикально зменшує витрати пам’яті та час рендерингу.',
      mastered: true
    },
    {
      id: 'fc-4',
      subject: 'Біологія',
      front: 'Правило комплементарності Чаргаффа у молекулі ДНК',
      back: 'Аденін (А) з’єднується з Тиміном (Т) двома водневими зв’язками, а Гуанін (Г) — із Цитозином (Ц) трьома водневими зв’язками.',
      mastered: false
    },
    {
      id: 'fc-5',
      subject: 'Органічна хімія',
      front: 'Особливість ароматичного зв’язку в молекулі бензену (C₆H₆)',
      back: 'Шість π-електронів утворюють єдину делокалізовану циклічну π-електронну систему (довжина зв’язків однакова — 0,140 нм).',
      mastered: false
    },
    {
      id: 'fc-6',
      subject: 'Астрономія та космологія',
      front: 'Чому дорівнює 1 парсек (пк) у світлових роках?',
      back: '1 парсек ≈ 3,26 світлового року (або 206 265 астрономічних одиниць ≈ 3,086 × 10¹⁶ м).',
      mastered: false
    }
  ];

  SP.TaskManager = TaskManager;
  SP.TaskManager.PRIORITY = PRIORITY;
  SP.TaskManager.STATUS = STATUS;
  SP.TaskManager.SORT_MODE = SORT_MODE;
  SP.TaskManager.RANKS = RANKS;
  SP.Task = Task;
  SP.DEFAULT_FLASHCARDS = DEFAULT_FLASHCARDS;
  SP.todayISO = todayISO;
  SP.shiftIsoDate = shiftIsoDate;
  SP.newId = newId;
})(window);
