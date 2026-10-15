/**
 * filter.js — пошук, фільтрування та сортування (клас TaskFilter і режими SortMode).
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});

  class TaskFilter {
    constructor() { this.reset(); }

    reset() {
      this.query = '';
      this.subject = '';
      this.priority = '';
      this.status = '';
      this.overdueOnly = false;
    }

    /** Чи задано хоча б одну умову. */
    isActive() {
      return Boolean(this.query.trim() || this.subject || this.priority || this.status || this.overdueOnly);
    }

    /** Усі задані умови поєднуються через «І». Пошук — за частиною назви без урахування регістру. */
    matches(task, today) {
      const q = this.query.trim().toLocaleLowerCase('uk-UA');
      if (q && !task.title.toLocaleLowerCase('uk-UA').includes(q)) return false;
      if (this.subject && task.subject !== this.subject) return false;
      if (this.priority && task.priority !== this.priority) return false;
      if (this.status && task.status !== this.status) return false;
      if (this.overdueOnly && !task.isOverdue(today)) return false;
      return true;
    }
  }

  function byDate(a, b) { return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0; }
  function byCreated(a, b) { return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0; }
  function rank(task) { return SP.TaskManager.PRIORITY[task.priority].rank; }

  /**
   * BY_DATE: від найближчої дати; за однакових дат — за часом створення від давнішого.
   * BY_PRIORITY: від високого пріоритету; за однакових пріоритетів — за датою; за однакових дат — за часом створення.
   */
  function createComparator(mode) {
    if (mode === 'BY_PRIORITY') {
      return (a, b) => (rank(b) - rank(a)) || byDate(a, b) || byCreated(a, b);
    }
    return (a, b) => byDate(a, b) || byCreated(a, b);
  }

  SP.TaskFilter = TaskFilter;
  SP.createComparator = createComparator;
})(window);
