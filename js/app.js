/**
 * app.js — інтерфейс (клас UIController): маршрутизація, відображення, обробка дій користувача.
 * Увесь текст користувача виводиться через textContent, тому HTML-розмітка в даних не виконується.
 */
(function (global) {
  'use strict';
  const SP = global.StudyPlanner;
  const doc = global.document;
  const PRIORITY = SP.TaskManager.PRIORITY;
  const STATUS = SP.TaskManager.STATUS;

  const storage = new SP.TaskStorage();
  const manager = new SP.TaskManager(storage, SP.Validator);
  const filter = new SP.TaskFilter();
  const view = { sortMode: 'BY_DATE' };
  const main = doc.getElementById('main');

  /* ---------- допоміжні функції DOM ---------- */
  function h(tag, attrs, children) {
    const el = doc.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      const v = attrs[k];
      if (v === false || v === null || v === undefined) return;
      if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    (children || []).forEach((c) => { if (c) el.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return el;
  }

  let toastTimer = null;
  function toast(message, isError) {
    const el = doc.getElementById('toast');
    el.textContent = message;
    el.className = 'toast show' + (isError ? ' error' : '');
    global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(() => { el.className = 'toast' + (isError ? ' error' : ''); }, 3500);
  }

  function confirmDelete(task) {
    return new Promise((resolve) => {
      const dlg = doc.getElementById('confirm-dialog');
      doc.getElementById('confirm-text').textContent = 'Завдання «' + task.title + '» буде видалено без можливості відновлення.';
      const onClose = () => { dlg.removeEventListener('close', onClose); resolve(dlg.returnValue === 'ok'); };
      dlg.returnValue = 'cancel';
      dlg.addEventListener('close', onClose);
      dlg.showModal();
      doc.getElementById('confirm-cancel').focus();
    });
  }

  function badge(cls, text) { return h('span', { class: 'badge ' + cls, text: text }); }

  function optionList(map, selected) {
    return Object.keys(map).map((k) => h('option', { value: k, text: map[k].label, selected: k === selected }));
  }

  /* ---------- маршрутизація ---------- */
  function route() {
    const hash = global.location.hash || '#/';
    const parts = hash.replace(/^#\/?/, '').split('/');
    const page = parts[0] || '';
    main.textContent = '';
    global.scrollTo(0, 0);
    setNav(page);
    if (page === '') renderList();
    else if (page === 'new') renderForm(null);
    else if (page === 'edit' && parts[1]) renderForm(parts[1]);
    else if (page === 'task' && parts[1]) renderDetail(parts[1]);
    else renderNotFound();
    main.focus({ preventScroll: true });
  }

  function setNav(page) {
    const list = doc.getElementById('nav-list');
    const add = doc.getElementById('nav-new');
    if (page === '') list.setAttribute('aria-current', 'page'); else list.removeAttribute('aria-current');
    if (page === 'new') add.setAttribute('aria-current', 'page'); else add.removeAttribute('aria-current');
  }

  function renderNotFound() {
    main.appendChild(h('h1', { text: 'Сторінку не знайдено' }));
    main.appendChild(h('a', { class: 'btn', href: '#/', text: 'До списку завдань' }));
  }

  /* ---------- екран «Список завдань» ---------- */
  function renderList() {
    main.appendChild(h('h1', { text: 'Мої завдання' }));

    if (manager.readError) {
      main.appendChild(h('div', { class: 'banner', role: 'alert' }, [
        h('p', { text: 'Не вдалося прочитати збережені завдання: ' + manager.readError }),
        h('div', { class: 'actions' }, [
          h('button', { type: 'button', class: 'btn', id: 'retry-read', text: 'Спробувати ще раз', onclick: () => { manager.reload(); route(); } }),
          h('button', { type: 'button', class: 'btn btn-danger', id: 'start-empty', text: 'Почати з порожнього списку', onclick: () => { manager.startEmpty(); route(); } })
        ])
      ]));
      return;
    }

    main.appendChild(buildToolbar());
    const results = h('div', { id: 'results' });
    main.appendChild(results);
    renderResults();
  }

  function buildToolbar() {
    const subjects = manager.getSubjects();
    const subjectSel = h('select', { id: 'f-subject' }, [h('option', { value: '', text: 'Усі предмети' })].concat(
      subjects.map((s) => h('option', { value: s, text: s, selected: s === filter.subject }))));
    const prioritySel = h('select', { id: 'f-priority' }, [h('option', { value: '', text: 'Усі пріоритети' })].concat(optionList(PRIORITY, filter.priority)));
    const statusSel = h('select', { id: 'f-status' }, [h('option', { value: '', text: 'Усі статуси' })].concat(optionList(STATUS, filter.status)));
    const sortSel = h('select', { id: 'f-sort' }, [
      h('option', { value: 'BY_DATE', text: 'За датою виконання', selected: view.sortMode === 'BY_DATE' }),
      h('option', { value: 'BY_PRIORITY', text: 'За пріоритетом', selected: view.sortMode === 'BY_PRIORITY' })
    ]);
    const search = h('input', { type: 'search', id: 'f-query', value: filter.query, placeholder: 'Частина назви', autocomplete: 'off' });
    const overdue = h('input', { type: 'checkbox', id: 'f-overdue', checked: filter.overdueOnly });

    search.addEventListener('input', () => { filter.query = search.value; renderResults(); });
    subjectSel.addEventListener('change', () => { filter.subject = subjectSel.value; renderResults(); });
    prioritySel.addEventListener('change', () => { filter.priority = prioritySel.value; renderResults(); });
    statusSel.addEventListener('change', () => { filter.status = statusSel.value; renderResults(); });
    overdue.addEventListener('change', () => { filter.overdueOnly = overdue.checked; renderResults(); });
    sortSel.addEventListener('change', () => { view.sortMode = sortSel.value; renderResults(); });

    const reset = h('button', {
      type: 'button', class: 'btn', id: 'f-reset', text: 'Скинути фільтри',
      onclick: () => { filter.reset(); view.sortMode = 'BY_DATE'; route(); }
    });

    return h('section', { class: 'panel', 'aria-label': 'Пошук, фільтри та сортування' }, [
      h('div', { class: 'toolbar' }, [
        h('div', { class: 'field' }, [h('label', { for: 'f-query', text: 'Пошук за назвою' }), search]),
        h('div', { class: 'field' }, [h('label', { for: 'f-subject', text: 'Предмет' }), subjectSel]),
        h('div', { class: 'field' }, [h('label', { for: 'f-priority', text: 'Пріоритет' }), prioritySel]),
        h('div', { class: 'field' }, [h('label', { for: 'f-status', text: 'Статус' }), statusSel]),
        h('div', { class: 'field' }, [h('label', { for: 'f-sort', text: 'Сортування' }), sortSel]),
        h('div', { class: 'field check' }, [overdue, h('label', { for: 'f-overdue', text: 'Лише прострочені' })]),
        h('div', { class: 'field' }, [reset])
      ])
    ]);
  }

  function renderResults() {
    const box = doc.getElementById('results');
    if (!box) return;
    box.textContent = '';
    const total = manager.tasks.length;

    if (total === 0) {
      box.appendChild(h('div', { class: 'panel empty' }, [
        h('p', { text: 'У вас ще немає завдань.' }),
        h('a', { class: 'btn btn-primary', href: '#/new', text: 'Додати перше завдання' })
      ]));
      return;
    }

    const today = SP.todayISO();
    const tasks = manager.getVisibleTasks(filter, view.sortMode, today);
    if (tasks.length === 0) {
      box.appendChild(h('div', { class: 'panel empty', id: 'nothing-found' }, [
        h('p', { text: 'За вказаними умовами завдань не знайдено.' }),
        h('button', { type: 'button', class: 'btn', text: 'Скинути фільтри', onclick: () => { filter.reset(); view.sortMode = 'BY_DATE'; route(); } })
      ]));
      return;
    }

    box.appendChild(h('p', { class: 'summary', id: 'summary', text: 'Показано ' + tasks.length + ' із ' + total }));
    const tbody = h('tbody');
    tasks.forEach((t) => tbody.appendChild(buildRow(t, today)));
    box.appendChild(h('div', { class: 'table-wrap' }, [
      h('table', { id: 'task-table' }, [
        h('thead', {}, [h('tr', {}, ['Назва', 'Предмет', 'Дата виконання', 'Пріоритет', 'Статус', 'Дії'].map((c) => h('th', { scope: 'col', text: c })))]),
        tbody
      ])
    ]));
  }

  function buildRow(t, today) {
    const overdue = t.isOverdue(today);
    const prio = h('select', { 'aria-label': 'Пріоритет завдання «' + t.title + '»', class: 'row-priority' }, optionList(PRIORITY, t.priority));
    const stat = h('select', { 'aria-label': 'Статус завдання «' + t.title + '»', class: 'row-status' }, optionList(STATUS, t.status));
    prio.addEventListener('change', () => applyChange(manager.changePriority(t.id, prio.value), 'Пріоритет змінено'));
    stat.addEventListener('change', () => applyChange(manager.changeStatus(t.id, stat.value), 'Статус змінено'));

    const dateCell = h('td', { 'data-label': 'Дата виконання' }, [h('span', { text: SP.Validator.formatDate(t.dueDate) })]);
    if (overdue) { dateCell.appendChild(doc.createTextNode(' ')); dateCell.appendChild(badge('badge-overdue', 'Прострочено')); }

    return h('tr', { class: (overdue ? 'is-overdue ' : '') + (t.status === 'DONE' ? 'is-done' : ''), 'data-id': t.id }, [
      h('td', { class: 'title-cell', 'data-label': 'Назва' }, [h('a', { href: '#/task/' + t.id, text: t.title })]),
      h('td', { 'data-label': 'Предмет', text: t.subject }),
      dateCell,
      h('td', { 'data-label': 'Пріоритет' }, [prio]),
      h('td', { 'data-label': 'Статус' }, [stat]),
      h('td', { class: 'actions-cell' }, [h('div', { class: 'actions' }, [
        h('a', { class: 'btn btn-small', href: '#/edit/' + t.id, 'aria-label': 'Редагувати завдання «' + t.title + '»', text: 'Редагувати' }),
        h('button', { type: 'button', class: 'btn btn-small btn-danger row-delete', 'aria-label': 'Видалити завдання «' + t.title + '»', text: 'Видалити', onclick: () => doDelete(t, false) })
      ])])
    ]);
  }

  /** Успіх — показати повідомлення й оновити список; помилка — повідомити й повернути попередні значення. */
  function applyChange(res, okMessage) {
    if (res.ok) toast(okMessage, false);
    else toast(res.error, true);
    renderResults();
  }

  async function doDelete(task, goToList) {
    const ok = await confirmDelete(task);
    if (!ok) return;
    const res = manager.deleteTask(task.id);
    if (!res.ok) { toast(res.error, true); return; }
    toast('Завдання видалено', false);
    if (goToList) global.location.hash = '#/'; else route();
  }

  /* ---------- екран «Форма завдання» ---------- */
  function renderForm(id) {
    const editing = id !== null;
    const task = editing ? manager.getTask(id) : null;
    if (editing && !task) { main.appendChild(h('h1', { text: 'Завдання не знайдено' })); main.appendChild(h('a', { class: 'btn', href: '#/', text: 'До списку завдань' })); return; }
    if (manager.readError) { main.appendChild(h('div', { class: 'banner', role: 'alert' }, [h('p', { text: 'Збереження недоступне: ' + manager.readError }), h('a', { class: 'btn', href: '#/', text: 'До списку завдань' })])); return; }

    main.appendChild(h('h1', { text: editing ? 'Редагування завдання' : 'Нове завдання' }));

    const fields = {
      title: h('input', { type: 'text', id: 'title', name: 'title', value: task ? task.title : '', autocomplete: 'off', 'aria-required': 'true' }),
      subject: h('input', { type: 'text', id: 'subject', name: 'subject', value: task ? task.subject : '', autocomplete: 'off', 'aria-required': 'true', list: 'subject-list' }),
      dueDate: h('input', { type: 'text', id: 'dueDate', name: 'dueDate', value: task ? SP.Validator.formatDate(task.dueDate) : '', placeholder: 'ДД.ММ.РРРР', inputmode: 'numeric', autocomplete: 'off', 'aria-required': 'true' }),
      priority: h('select', { id: 'priority', name: 'priority' }, optionList(PRIORITY, task ? task.priority : 'MEDIUM')),
      description: h('textarea', { id: 'description', name: 'description' })
    };
    fields.description.value = task ? task.description : '';

    const datalist = h('datalist', { id: 'subject-list' }, manager.getSubjects().map((s) => h('option', { value: s })));
    const formError = h('p', { class: 'form-error', id: 'form-error', role: 'alert' });
    const errorEls = {};

    function field(key, label, hint, required) {
      const err = h('div', { class: 'error-text', id: key + '-error' });
      errorEls[key] = err;
      const kids = [h('label', { for: key, text: label + (required ? ' *' : '') }), fields[key]];
      if (hint) kids.push(h('div', { class: 'hint', text: hint }));
      kids.push(err);
      return h('div', { class: 'field' }, kids);
    }

    function showErrors(errors) {
      let first = null;
      Object.keys(fields).forEach((k) => {
        const msg = errors[k];
        errorEls[k].textContent = msg || '';
        if (msg) {
          fields[k].setAttribute('aria-invalid', 'true');
          fields[k].setAttribute('aria-describedby', k + '-error');
          if (!first) first = fields[k];
        } else {
          fields[k].removeAttribute('aria-invalid');
          fields[k].removeAttribute('aria-describedby');
        }
      });
      if (first) first.focus();
    }

    const form = h('form', { class: 'form-grid', id: 'task-form', novalidate: true }, [
      field('title', 'Назва', 'До 100 символів', true),
      field('subject', 'Предмет', 'До 80 символів', true),
      field('dueDate', 'Дата виконання', 'Формат ДД.ММ.РРРР, наприклад 25.12.2026', true),
      field('priority', 'Пріоритет', '', false),
      field('description', 'Опис', 'Необов’язково, до 1000 символів', false),
      formError,
      h('div', { class: 'form-actions' }, [
        h('button', { type: 'submit', class: 'btn btn-primary', id: 'save-btn', text: 'Зберегти' }),
        h('a', { class: 'btn', id: 'cancel-btn', href: editing ? '#/task/' + id : '#/', text: 'Скасувати' })
      ])
    ]);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      formError.textContent = '';
      const data = {
        title: fields.title.value, subject: fields.subject.value, dueDate: fields.dueDate.value,
        priority: fields.priority.value, description: fields.description.value
      };
      const res = editing ? manager.updateTask(id, data) : manager.createTask(data);
      if (res.ok) {
        showErrors({});
        toast(editing ? 'Зміни збережено' : 'Завдання додано', false);
        global.location.hash = '#/';
        return;
      }
      if (res.errors) { showErrors(res.errors); return; }
      showErrors({});
      formError.textContent = res.error;
      toast(res.error, true);
    });

    main.appendChild(form);
    main.appendChild(datalist);
    fields.title.focus({ preventScroll: true });
  }

  /* ---------- екран «Деталі завдання» ---------- */
  function renderDetail(id) {
    const t = manager.getTask(id);
    if (!t) { main.appendChild(h('h1', { text: 'Завдання не знайдено' })); main.appendChild(h('a', { class: 'btn', href: '#/', text: 'До списку завдань' })); return; }
    const today = SP.todayISO();
    const overdue = t.isOverdue(today);
    const dateDd = h('dd', {}, [h('span', { text: SP.Validator.formatDate(t.dueDate) })]);
    if (overdue) { dateDd.appendChild(doc.createTextNode(' ')); dateDd.appendChild(badge('badge-overdue', 'Прострочено')); }
    const fmt = (iso) => new Date(iso).toLocaleString('uk-UA');

    main.appendChild(h('h1', { id: 'detail-title', text: t.title }));
    main.appendChild(h('div', { class: 'panel' }, [
      h('dl', { class: 'details' }, [
        h('dt', { text: 'Предмет' }), h('dd', { text: t.subject }),
        h('dt', { text: 'Дата виконання' }), dateDd,
        h('dt', { text: 'Пріоритет' }), h('dd', {}, [badge('badge-' + t.priority, PRIORITY[t.priority].label)]),
        h('dt', { text: 'Статус' }), h('dd', {}, [badge('badge-' + t.status, STATUS[t.status].label)]),
        h('dt', { text: 'Опис' }), h('dd', { text: t.description || '—' }),
        h('dt', { text: 'Створено' }), h('dd', { text: fmt(t.createdAt) }),
        h('dt', { text: 'Змінено' }), h('dd', { text: fmt(t.updatedAt) })
      ]),
      h('div', { class: 'form-actions' }, [
        h('a', { class: 'btn btn-primary', href: '#/edit/' + t.id, text: 'Редагувати' }),
        h('button', { type: 'button', class: 'btn btn-danger', id: 'detail-delete', text: 'Видалити', onclick: () => doDelete(t, true) }),
        h('a', { class: 'btn', href: '#/', text: 'До списку' })
      ])
    ]));
  }

  global.addEventListener('hashchange', route);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', route); else route();
})(window);
