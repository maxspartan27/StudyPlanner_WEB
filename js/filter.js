/**
 * filter.js — [Core Layer] швидкий пошук, фільтрування та двонапрямне сортування (SP.TaskFilter).
 * Версія 2.1.7 (build 217) Redstone 5 — Автор: Максим Ковалишин.
 * Оптимізації v2.1.7 RS5:
 * - Попередньо побудований пошуковий індекс (_searchIndex) за O(1) без зайвих алокацій.
 * - Підтримка двонапрямного сортування (asc / desc) для всіх колонок Розумної Таблиці (включно зі статусом і прогресом етапів).
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});

  const ukCollator = (typeof Intl !== 'undefined' && Intl.Collator)
    ? new Intl.Collator('uk', { sensitivity: 'base', numeric: true })
    : { compare: (a, b) => String(a).localeCompare(String(b), 'uk') };

  const STATUS_RANK = Object.freeze({
    PLANNED: 0,
    IN_PROGRESS: 1,
    DONE: 2
  });

  class TaskFilter {
    constructor() {
      this.reset();
    }

    reset() {
      this.query = '';
      this.subject = '';
      this.priority = '';
      this.status = '';
      this.tag = '';
      this.overdueOnly = false;
      this.withImageOnly = false;
    }

    isActive() {
      return Boolean(
        this.query.trim() ||
        this.subject ||
        this.priority ||
        this.status ||
        this.tag ||
        this.overdueOnly ||
        this.withImageOnly
      );
    }

    /** Перевірка відповідності завдання за O(1) завдяки кешованому _searchIndex */
    matches(task, today) {
      if (this.subject && task.subject !== this.subject) return false;
      if (this.priority && task.priority !== this.priority) return false;
      if (this.status && task.status !== this.status) return false;
      if (this.tag && (!Array.isArray(task.tags) || task.tags.indexOf(this.tag) === -1)) return false;
      if (this.overdueOnly && !task.isOverdue(today)) return false;
      if (this.withImageOnly && !task.imageUrl) return false;

      const q = this.query.trim();
      if (q) {
        const needle = q.toLocaleLowerCase('uk-UA');
        if (typeof task._searchIndex === 'string') {
          if (task._searchIndex.indexOf(needle) === -1) return false;
        } else {
          const hay = (task.title + '\n' + task.subject + '\n' + (task.description || '') + '\n' + (task.tags || []).join(' ')).toLocaleLowerCase('uk-UA');
          if (hay.indexOf(needle) === -1) return false;
        }
      }
      return true;
    }
  }

  function byDate(a, b) { return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0; }
  function byCreated(a, b) { return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0; }
  function byNewest(a, b) { return a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0; }
  function byTitle(a, b) { return ukCollator.compare(a.title, b.title); }
  function bySubject(a, b) { return ukCollator.compare(a.subject, b.subject) || byDate(a, b); }
  function rank(task) {
    const p = SP.TaskManager.PRIORITY[task.priority];
    return p ? p.rank : 0;
  }
  function statusRank(task) {
    return Object.prototype.hasOwnProperty.call(STATUS_RANK, task.status) ? STATUS_RANK[task.status] : 0;
  }
  function progressScore(task) {
    if (task.status === 'DONE') return 101;
    return task.subtaskProgress().percent;
  }

  function createComparator(mode, sortDir) {
    const mul = sortDir === 'desc' ? -1 : 1;
    let baseCmp;
    switch (mode) {
      case 'BY_PRIORITY':
        baseCmp = (a, b) => (rank(b) - rank(a)) || byDate(a, b) || byCreated(a, b);
        break;
      case 'BY_STATUS':
        baseCmp = (a, b) => (statusRank(a) - statusRank(b)) || byDate(a, b);
        break;
      case 'BY_PROGRESS':
        baseCmp = (a, b) => (progressScore(b) - progressScore(a)) || byDate(a, b);
        break;
      case 'BY_TITLE':
        baseCmp = (a, b) => byTitle(a, b) || byDate(a, b);
        break;
      case 'BY_SUBJECT':
        baseCmp = (a, b) => bySubject(a, b);
        break;
      case 'BY_NEWEST':
        baseCmp = (a, b) => byNewest(a, b);
        break;
      default:
        baseCmp = (a, b) => byDate(a, b) || byCreated(a, b);
        break;
    }
    return mul === 1 ? baseCmp : (a, b) => -baseCmp(a, b);
  }

  SP.TaskFilter = TaskFilter;
  SP.createComparator = createComparator;
  SP.ukCollator = ukCollator;
})(window);
