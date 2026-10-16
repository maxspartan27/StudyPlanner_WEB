/**
 * taskManager.js — предметна модель і керування завданнями
 * (класи Task, TaskManager та переліки Priority, Status, SortMode з діаграми класів).
 * Версія 1.6 (build 171) RS2 — розширені навчальні схеми, аналітика RS2, дублювання, CSV-експорт та підтримка тем.
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});

  const PRIORITY = {
    LOW: { code: 'LOW', label: 'Низький', rank: 0 },
    MEDIUM: { code: 'MEDIUM', label: 'Середній', rank: 1 },
    HIGH: { code: 'HIGH', label: 'Високий', rank: 2 }
  };
  const STATUS = {
    PLANNED: { code: 'PLANNED', label: 'Заплановано' },
    IN_PROGRESS: { code: 'IN_PROGRESS', label: 'У роботі' },
    DONE: { code: 'DONE', label: 'Виконано' }
  };
  const SORT_MODE = {
    BY_DATE: 'BY_DATE',
    BY_PRIORITY: 'BY_PRIORITY',
    BY_STATUS: 'BY_STATUS',
    BY_TITLE: 'BY_TITLE'
  };

  /** Поточна локальна дата пристрою у форматі РРРР-ММ-ДД. */
  function todayISO(now) {
    const d = now || new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function newId() {
    return 't-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  class Task {
    constructor(fields) {
      Object.assign(this, fields);
      if (!this.imageUrl) this.imageUrl = '';
    }
    clone() { return new Task(this.toJSON()); }
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
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
      };
    }
    touch() { this.updatedAt = new Date().toISOString(); }
    /** Зміна назви, предмета, опису, дати, пріоритету та зображення; ID і дата створення не змінюються. */
    update(values) {
      this.title = values.title;
      this.subject = values.subject;
      this.description = values.description;
      this.dueDate = values.dueDate;
      if (values.priority) this.priority = values.priority;
      if (values.imageUrl !== undefined) this.imageUrl = values.imageUrl;
      this.touch();
    }
    changePriority(code) { this.priority = code; this.touch(); }
    changeStatus(code) { this.status = code; this.touch(); }
    /** Прострочення — обчислювана ознака: дата менша за поточну, а статус не «Виконано». */
    isOverdue(today) {
      return this.status !== 'DONE' && this.dueDate < (today || todayISO());
    }
  }

  class TaskManager {
    /**
     * @param {SP.TaskStorage} storage
     * @param {object} validator — об'єкт з методом validate(data)
     */
    constructor(storage, validator) {
      this.storage = storage;
      this.validator = validator;
      this.tasks = [];
      this.readError = null; // текст помилки читання; поки він заданий, запис у сховище заблоковано
      this.reload();
    }

    reload() {
      const res = this.storage.load();
      if (res.ok) {
        this.tasks = res.tasks.map((t) => new Task(t));
        this.readError = null;
      } else {
        this.tasks = [];
        this.readError = res.error;
      }
      return res;
    }

    /** Користувач свідомо починає з порожнього списку після помилки читання (старі дані копіюються в резерв). */
    startEmpty() {
      this.storage.backupRaw();
      this.tasks = [];
      this.readError = null;
    }

    _persist(nextTasks) {
      if (this.readError) return { ok: false, error: 'Збереження вимкнено через помилку читання даних.' };
      const res = this.storage.save(nextTasks.map((t) => t.toJSON()));
      if (res.ok) this.tasks = nextTasks;
      return res;
    }

    getTask(id) { return this.tasks.find((t) => t.id === id) || null; }

    getSubjects() {
      return Array.from(new Set(this.tasks.map((t) => t.subject))).sort((a, b) => a.localeCompare(b, 'uk'));
    }

    /** @returns {{ok:boolean, task?:Task, errors?:Object, error?:string}} */
    createTask(data) {
      const check = this.validator.validate(data);
      if (!check.valid) return { ok: false, errors: check.errors };
      const now = new Date().toISOString();
      const task = new Task({
        id: newId(),
        title: check.values.title,
        subject: check.values.subject,
        description: check.values.description,
        dueDate: check.values.dueDate,
        priority: check.values.priority || 'MEDIUM',
        status: 'PLANNED',
        imageUrl: check.values.imageUrl || '',
        createdAt: now,
        updatedAt: now
      });
      const res = this._persist(this.tasks.concat([task]));
      return res.ok ? { ok: true, task: task } : { ok: false, error: res.error };
    }

    updateTask(id, data) {
      const current = this.getTask(id);
      if (!current) return { ok: false, error: 'Завдання не знайдено.' };
      const check = this.validator.validate(data);
      if (!check.valid) return { ok: false, errors: check.errors };
      const next = current.clone();
      next.update(check.values);
      const res = this._persist(this.tasks.map((t) => (t.id === id ? next : t)));
      return res.ok ? { ok: true, task: next } : { ok: false, error: res.error };
    }

    /** Дублювання наявного завдання (RS2) */
    duplicateTask(id) {
      const orig = this.getTask(id);
      if (!orig) return { ok: false, error: 'Завдання для дублювання не знайдено.' };
      const now = new Date().toISOString();
      const suffix = ' (копія)';
      const maxBase = 100 - suffix.length;
      const baseTitle = Array.from(orig.title).slice(0, maxBase).join('');
      const copy = new Task({
        id: newId(),
        title: baseTitle + suffix,
        subject: orig.subject,
        description: orig.description,
        dueDate: orig.dueDate,
        priority: orig.priority,
        status: 'PLANNED',
        imageUrl: orig.imageUrl || '',
        createdAt: now,
        updatedAt: now
      });
      const res = this._persist(this.tasks.concat([copy]));
      return res.ok ? { ok: true, task: copy } : { ok: false, error: res.error };
    }

    /** Масове очищення всіх виконаних завдань (RS2) */
    clearCompleted() {
      const remaining = this.tasks.filter((t) => t.status !== 'DONE');
      const removedCount = this.tasks.length - remaining.length;
      if (removedCount === 0) return { ok: false, error: 'Немає виконаних завдань для очищення.' };
      const res = this._persist(remaining);
      return res.ok ? { ok: true, count: removedCount } : { ok: false, error: res.error };
    }

    changePriority(id, code) {
      return this._mutate(id, code, PRIORITY, (t) => t.changePriority(code));
    }

    changeStatus(id, code) {
      return this._mutate(id, code, STATUS, (t) => t.changeStatus(code));
    }

    _mutate(id, code, allowed, apply) {
      const current = this.getTask(id);
      if (!current) return { ok: false, error: 'Завдання не знайдено.' };
      if (!Object.prototype.hasOwnProperty.call(allowed, code)) return { ok: false, error: 'Недопустиме значення.' };
      const next = current.clone();
      apply(next);
      const res = this._persist(this.tasks.map((t) => (t.id === id ? next : t)));
      return res.ok ? { ok: true, task: next } : { ok: false, error: res.error };
    }

    deleteTask(id) {
      if (!this.getTask(id)) return { ok: false, error: 'Завдання не знайдено.' };
      const res = this._persist(this.tasks.filter((t) => t.id !== id));
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    }

    /** Статистика для панелі дашборду та аналітики RS2 */
    getStats(today) {
      const day = today || todayISO();
      const total = this.tasks.length;
      let planned = 0;
      let inProgress = 0;
      let done = 0;
      let overdue = 0;
      let dueToday = 0;
      let dueSoon = 0;
      let highPriority = 0;
      let withImages = 0;

      for (let i = 0; i < total; i++) {
        const t = this.tasks[i];
        if (t.imageUrl) withImages++;
        if (t.priority === 'HIGH' && t.status !== 'DONE') highPriority++;
        if (t.status === 'DONE') {
          done++;
        } else {
          if (t.status === 'IN_PROGRESS') inProgress++;
          else planned++;
          if (t.isOverdue(day)) {
            overdue++;
          } else if (t.dueDate === day) {
            dueToday++;
          } else if (SP.Validator && SP.Validator.daysUntil) {
            const diff = SP.Validator.daysUntil(t.dueDate, day);
            if (diff !== null && diff > 0 && diff <= 3) dueSoon++;
          }
        }
      }

      const percent = total > 0 ? Math.round((done / total) * 100) : 0;
      const inProgressPct = total > 0 ? Math.round((inProgress / total) * 100) : 0;
      // Індекс продуктивності RS2: враховує виконані, активні в роботі та штрафує за прострочені
      const rawScore = total > 0
        ? Math.round(((done * 1.0 + inProgress * 0.45 - overdue * 0.35) / total) * 100)
        : 0;
      const productivityScore = Math.max(0, Math.min(100, rawScore));

      return {
        total,
        planned,
        inProgress,
        done,
        overdue,
        percent,
        inProgressPct,
        dueToday,
        dueSoon,
        highPriority,
        withImages,
        productivityScore
      };
    }

    /** Завантаження демонстраційних завдань із зображеннями (RS2 — 6 предметів) */
    loadSampleTasks() {
      const today = new Date();
      const addDays = (n) => {
        const d = new Date(today);
        d.setDate(d.getDate() + n);
        return todayISO(d);
      };

      const samples = [
        {
          id: newId(),
          title: 'Підготувати розв’язання теореми Піфагора та тригонометрії',
          subject: 'Вища математика',
          description: 'Зробити креслення прямокутного трикутника, вивести співвідношення сторін та знайти гіпотенузу.',
          dueDate: addDays(2),
          priority: 'HIGH',
          status: 'IN_PROGRESS',
          imageUrl: 'img/sample-math.svg',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: newId(),
          title: 'Розрахувати електричне коло постійного струму за законом Ома',
          subject: 'Фізика',
          description: 'Накреслити схему джерела з напругою 220В та опором 10 Ом, перевірити амперметром силу струму.',
          dueDate: addDays(4),
          priority: 'MEDIUM',
          status: 'PLANNED',
          imageUrl: 'img/sample-physics.svg',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: newId(),
          title: 'Модернізувати вебзастосунок StudyPlanner до v1.6 (build 171) RS2',
          subject: 'Вебпрограмування',
          description: 'Реалізувати Канбан-дошку, режим карток, таймер Помодоро, 8 тем оформлення та аналітику дедлайнів RS2.',
          dueDate: addDays(-1), // навмисно прострочене для демонстрації червоної анімації
          priority: 'HIGH',
          status: 'PLANNED',
          imageUrl: 'img/sample-code.svg',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: newId(),
          title: 'Лабораторна робота: Дослідження структури бензену та розчинів',
          subject: 'Органічна хімія',
          description: 'Скласти структурні формули ароматичних сполук та виміряти показник кислотності pH.',
          dueDate: addDays(0), // на сьогодні
          priority: 'MEDIUM',
          status: 'IN_PROGRESS',
          imageUrl: 'img/sample-chemistry.svg',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: newId(),
          title: 'Моделювання реплікації подвійної спіралі ДНК та комплементарності',
          subject: 'Молекулярна біологія',
          description: 'Побудувати схему водневих зв’язків між парами нуклеотидів Аденін-Тимін та Гуанін-Цитозин.',
          dueDate: addDays(5),
          priority: 'MEDIUM',
          status: 'PLANNED',
          imageUrl: 'img/sample-biology.svg',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: newId(),
          title: 'Підготувати аналіз поеми «Кавказ» Тараса Шевченка',
          subject: 'Українська література',
          description: 'Опрацювати цитати, виписати ідейно-художні особливості твору та підготувати тези.',
          dueDate: addDays(1),
          priority: 'LOW',
          status: 'DONE',
          imageUrl: 'img/sample-literature.svg',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ].map((s) => new Task(s));

      const res = this._persist(samples);
      return res;
    }

    /** Експорт у формат JSON */
    exportJSON() {
      return JSON.stringify(this.tasks.map((t) => t.toJSON()), null, 2);
    }

    /** Експорт у формат CSV (UTF-8 з BOM для коректного відкриття в Excel) */
    exportCSV() {
      const esc = (val) => {
        const s = String(val == null ? '' : val).replace(/"/g, '""');
        return '"' + s + '"';
      };
      const header = ['ID', 'Назва завдання', 'Предмет', 'Дата виконання', 'Пріоритет', 'Статус', 'Опис'];
      const rows = [header.map(esc).join(';')];
      for (let i = 0; i < this.tasks.length; i++) {
        const t = this.tasks[i];
        rows.push([
          t.id,
          t.title,
          t.subject,
          SP.Validator ? SP.Validator.formatDate(t.dueDate) : t.dueDate,
          PRIORITY[t.priority] ? PRIORITY[t.priority].label : t.priority,
          STATUS[t.status] ? STATUS[t.status].label : t.status,
          t.description || ''
        ].map(esc).join(';'));
      }
      return '\uFEFF' + rows.join('\r\n');
    }

    /** Імпорт із JSON */
    importJSON(jsonString) {
      try {
        const data = JSON.parse(jsonString);
        if (!Array.isArray(data)) return { ok: false, error: 'Дані мають бути масивом завдань.' };
        const imported = [];
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          if (!item || typeof item.title !== 'string' || typeof item.dueDate !== 'string') {
            return { ok: false, error: 'Завдання №' + (i + 1) + ' має некоректний формат.' };
          }
          // Ті самі правила, що й у формі: назва, предмет, дата, довжина полів.
          const check = this.validator.validate({
            title: item.title,
            subject: item.subject || 'Загальне',
            description: typeof item.description === 'string' ? item.description : '',
            dueDate: SP.Validator.formatDate(item.dueDate),
            priority: ['LOW', 'MEDIUM', 'HIGH'].includes(item.priority) ? item.priority : 'MEDIUM',
            imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : ''
          });
          if (!check.valid) {
            const reason = Object.keys(check.errors).map((k) => check.errors[k])[0];
            return { ok: false, error: 'Завдання №' + (i + 1) + ': ' + reason + '. Імпорт скасовано, наявні дані не змінено.' };
          }
          imported.push(new Task({
            id: item.id || newId(),
            title: check.values.title,
            subject: check.values.subject,
            description: check.values.description,
            dueDate: check.values.dueDate,
            priority: check.values.priority,
            status: ['PLANNED', 'IN_PROGRESS', 'DONE'].includes(item.status) ? item.status : 'PLANNED',
            imageUrl: check.values.imageUrl,
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString()
          }));
        }
        const res = this._persist(imported);
        return res;
      } catch (e) {
        return { ok: false, error: 'Помилка розбору JSON: ' + e.message };
      }
    }

    /** Видимий перелік: відбір за умовами («І») і впорядкування за вибраним режимом. */
    getVisibleTasks(filter, sortMode, today) {
      const day = today || todayISO();
      const compare = SP.createComparator(sortMode);
      return this.tasks.filter((t) => filter.matches(t, day)).sort(compare);
    }
  }

  SP.TaskManager = TaskManager;
  SP.TaskManager.PRIORITY = PRIORITY;
  SP.TaskManager.STATUS = STATUS;
  SP.TaskManager.SORT_MODE = SORT_MODE;
  SP.Task = Task;
  SP.todayISO = todayISO;
})(window);
