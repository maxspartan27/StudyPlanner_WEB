/**
 * app.js — інтерфейс (клас UIController): маршрутизація, відображення, обробка дій користувача.
 * Версія 1.6 (build 170) — кольорові теми, анімації зеленого та червоного кольорів, конфеті, графіка.
 */
(function (global) {
  'use strict';
  const SP = global.StudyPlanner;
  SP.VERSION = '1.6';
  SP.BUILD = '170';

  const doc = global.document;
  const PRIORITY = SP.TaskManager.PRIORITY;
  const STATUS = SP.TaskManager.STATUS;

  const storage = new SP.TaskStorage();
  const manager = new SP.TaskManager(storage, SP.Validator);
  const filter = new SP.TaskFilter();
  const view = { sortMode: 'BY_DATE' };
  const main = doc.getElementById('main');

  const THEMES = {
    light: 'Класична лазур',
    dark: 'Глибокий космос',
    emerald: 'Смарагд & Природа',
    crimson: 'Рубінове полум’я',
    neon: 'Кіберпанк Неон',
    amber: 'Золотий бурштин'
  };

  /* ---------- Система анімації багатоколірного конфеті ---------- */
  let confettiRunning = false;
  function fireConfetti(durationMs) {
    const canvas = doc.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = (canvas.width = global.innerWidth);
    const height = (canvas.height = global.innerHeight);

    const colors = [
      '#10b981', '#34d399', // зелені
      '#ef4444', '#f43f5e', // червоні / рубін
      '#3b82f6', '#06b6d4', // блакитні / неон
      '#f59e0b', '#fbbf24', // золоті / бурштин
      '#a855f7', '#ec4899'  // фіолетові / рожеві
    ];

    const particles = [];
    const count = 120;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.4 - height * 0.1,
        w: Math.random() * 9 + 4,
        h: Math.random() * 9 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 4 + 3,
        rot: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    const startTime = Date.now();
    const duration = durationMs || 2500;
    confettiRunning = true;

    function render() {
      if (!confettiRunning) {
        ctx.clearRect(0, 0, width, height);
        return;
      }
      ctx.clearRect(0, 0, width, height);
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        confettiRunning = false;
        ctx.clearRect(0, 0, width, height);
        return;
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vRot;
        p.opacity = Math.max(0, 1 - progress * 1.2);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      global.requestAnimationFrame(render);
    }

    render();
  }

  /* ---------- Керування темами оформлення ---------- */
  function initTheme() {
    const saved = storage.getTheme();
    const current = THEMES[saved] ? saved : 'light';
    applyTheme(current);

    const themeMenuBtn = doc.getElementById('theme-menu-btn');
    const popover = doc.getElementById('theme-picker-popover');
    const footerThemeBtn = doc.getElementById('footer-btn-theme');

    function togglePopover(e) {
      if (e) e.stopPropagation();
      if (!popover) return;
      popover.classList.toggle('open');
    }

    if (themeMenuBtn) themeMenuBtn.addEventListener('click', togglePopover);
    if (footerThemeBtn) footerThemeBtn.addEventListener('click', togglePopover);

    doc.addEventListener('click', (e) => {
      if (popover && !popover.contains(e.target) && e.target !== themeMenuBtn && e.target !== footerThemeBtn) {
        popover.classList.remove('open');
      }
    });

    const optionBtns = doc.querySelectorAll('.theme-option-btn');
    optionBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-theme-val');
        if (val && THEMES[val]) {
          applyTheme(val);
          storage.setTheme(val);
          if (popover) popover.classList.remove('open');
          toast('Встановлено тему: ' + THEMES[val], false);
        }
      });
    });
  }

  function applyTheme(theme) {
    doc.documentElement.setAttribute('data-theme', theme);
    const label = doc.getElementById('current-theme-label');
    if (label && THEMES[theme]) {
      label.textContent = THEMES[theme];
    }
    const optionBtns = doc.querySelectorAll('.theme-option-btn');
    optionBtns.forEach((btn) => {
      if (btn.getAttribute('data-theme-val') === theme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /* ---------- Допоміжні функції DOM ---------- */
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
    (children || []).forEach((c) => {
      if (c) el.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
    });
    return el;
  }

  let toastTimer = null;
  function toast(message, isError) {
    const el = doc.getElementById('toast');
    if (!el) return;
    el.textContent = (isError ? '⚠️ ' : '✅ ') + message;
    el.className = 'toast show ' + (isError ? 'error' : 'success');
    global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(() => {
      el.className = 'toast';
    }, 3500);
  }

  function confirmDelete(task) {
    return new Promise((resolve) => {
      const dlg = doc.getElementById('confirm-dialog');
      doc.getElementById('confirm-text').textContent = 'Завдання «' + task.title + '» буде видалено без можливості відновлення.';
      const onClose = () => {
        dlg.removeEventListener('close', onClose);
        resolve(dlg.returnValue === 'ok');
      };
      dlg.returnValue = 'cancel';
      dlg.addEventListener('close', onClose);
      dlg.showModal();
      doc.getElementById('confirm-cancel').focus();
    });
  }

  function showLightbox(imageUrl, title) {
    const dlg = doc.getElementById('lightbox-dialog');
    const img = doc.getElementById('lightbox-img');
    const headerTitle = doc.getElementById('lightbox-title');
    if (!dlg || !img) return;
    img.src = imageUrl;
    if (headerTitle) headerTitle.textContent = title ? 'Зображення: ' + title : 'Прикріплене зображення';
    dlg.showModal();
  }

  function badge(cls, text) {
    return h('span', { class: 'badge ' + cls, text: text });
  }

  function optionList(map, selected) {
    return Object.keys(map).map((k) => h('option', { value: k, text: map[k].label, selected: k === selected }));
  }

  /* ---------- Маршрутизація ---------- */
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
    if (list) {
      if (page === '') list.setAttribute('aria-current', 'page');
      else list.removeAttribute('aria-current');
    }
    if (add) {
      if (page === 'new') add.setAttribute('aria-current', 'page');
      else add.removeAttribute('aria-current');
    }
  }

  function renderNotFound() {
    main.appendChild(h('div', { class: 'panel empty' }, [
      h('h1', { text: 'Сторінку не знайдено' }),
      h('p', { text: 'За вказаною адресою нічого немає.' }),
      h('a', { class: 'btn btn-primary', href: '#/', text: 'Повернутися до списку' })
    ]));
  }

  /* ---------- Екран «Список завдань» ---------- */
  function renderList() {
    const headerRow = h('div', { style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;' }, [
      h('h1', { style: 'margin:0;' }, [
        doc.createTextNode('Мої навчальні завдання'),
        h('span', { class: 'badge-version', style: 'font-size:0.75rem; vertical-align:middle;', text: 'v' + SP.VERSION })
      ]),
      h('div', { style: 'display:flex; gap:8px;' }, [
        h('a', { class: 'btn btn-primary', href: '#/new', text: '➕ Створити завдання' })
      ])
    ]);
    main.appendChild(headerRow);

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

    // Дашборд статистики та шкала прогресу
    main.appendChild(buildDashboard());

    // Панель фільтрів
    main.appendChild(buildToolbar());

    const results = h('div', { id: 'results' });
    main.appendChild(results);
    renderResults();
  }

  function buildDashboard() {
    const today = SP.todayISO();
    const stats = manager.getStats(today);

    const wrap = h('div', { id: 'dashboard-box' });

    // Якщо 100% завдань виконано
    if (stats.total > 0 && stats.percent === 100) {
      const celBox = h('div', { class: 'celebration-box' }, [
        h('img', { src: 'img/celebration.svg', alt: 'Кубок переможця', class: 'celebration-img' }),
        h('div', { class: 'celebration-content' }, [
          h('h2', { text: '🎉 Неймовірний успіх! Всі завдання виконано на 100%!' }),
          h('p', { text: 'Ви блискуче завершили всі заплановані навчальні справи. Час відпочити або додати нові цілі!' }),
          h('button', {
            type: 'button', class: 'btn btn-celebrate', text: '🎆 Запустити святковий салют!',
            onclick: () => fireConfetti(3500)
          })
        ])
      ]);
      wrap.appendChild(celBox);
    }

    if (stats.total > 0) {
      // Шкала прогресу
      const progressBox = h('div', { class: 'progress-container' }, [
        h('div', { class: 'progress-bar-wrap' }, [
          h('div', { style: 'font-size:0.9rem; font-weight:800; color:var(--text);' }, [doc.createTextNode('Загальний прогрес виконання:')]),
          h('div', { class: 'progress-track' }, [
            h('div', { class: 'progress-fill', style: 'width: ' + stats.percent + '%;' })
          ]),
          h('div', { class: 'progress-text', text: stats.percent + '% (' + stats.done + ' із ' + stats.total + ')' })
        ])
      ]);
      wrap.appendChild(progressBox);
    }

    const cards = [
      { key: 'total', label: 'Всього завдань', icon: '📚', val: stats.total, cls: '', action: () => { filter.reset(); renderResults(); } },
      { key: 'planned', label: 'Заплановано', icon: '🗓️', val: stats.planned, cls: '', action: () => { filter.status = 'PLANNED'; renderResults(); } },
      { key: 'progress', label: 'У роботі', icon: '⏳', val: stats.inProgress, cls: 'stat-progress', action: () => { filter.status = 'IN_PROGRESS'; renderResults(); } },
      { key: 'done', label: 'Виконано', icon: '✅', val: stats.done, cls: 'stat-done', action: () => { filter.status = 'DONE'; renderResults(); } },
      { key: 'overdue', label: 'Прострочено', icon: '🚨', val: stats.overdue, cls: stats.overdue > 0 ? 'stat-overdue' : '', action: () => { filter.overdueOnly = true; renderResults(); } }
    ];

    const grid = h('div', { class: 'stats-grid' }, cards.map((c) => {
      const card = h('div', { class: 'stat-card ' + c.cls, title: 'Клікніть для фільтрування' }, [
        h('div', { class: 'stat-card-header' }, [
          h('span', { class: 'stat-label', text: c.label }),
          h('span', { class: 'stat-icon', text: c.icon })
        ]),
        h('div', { class: 'stat-value', text: String(c.val) })
      ]);
      card.addEventListener('click', c.action);
      return card;
    }));

    wrap.appendChild(grid);
    return wrap;
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
    const search = h('input', { type: 'search', id: 'f-query', value: filter.query, placeholder: 'Пошук за назвою або предметом...', autocomplete: 'off' });
    const overdue = h('input', { type: 'checkbox', id: 'f-overdue', checked: filter.overdueOnly });
    const withImage = h('input', { type: 'checkbox', id: 'f-image', checked: filter.withImageOnly });

    search.addEventListener('input', () => { filter.query = search.value; renderResults(); });
    subjectSel.addEventListener('change', () => { filter.subject = subjectSel.value; renderResults(); });
    prioritySel.addEventListener('change', () => { filter.priority = prioritySel.value; renderResults(); });
    statusSel.addEventListener('change', () => { filter.status = statusSel.value; renderResults(); });
    overdue.addEventListener('change', () => { filter.overdueOnly = overdue.checked; renderResults(); });
    withImage.addEventListener('change', () => { filter.withImageOnly = withImage.checked; renderResults(); });
    sortSel.addEventListener('change', () => { view.sortMode = sortSel.value; renderResults(); });

    const reset = h('button', {
      type: 'button', class: 'btn', id: 'f-reset', text: '🔄 Скинути фільтри',
      onclick: () => { filter.reset(); view.sortMode = 'BY_DATE'; route(); }
    });

    return h('section', { class: 'panel', 'aria-label': 'Пошук, фільтри та сортування' }, [
      h('div', { class: 'toolbar' }, [
        h('div', { class: 'field', style: 'grid-column: span 2;' }, [h('label', { for: 'f-query', text: 'Пошук' }), search]),
        h('div', { class: 'field' }, [h('label', { for: 'f-subject', text: 'Предмет' }), subjectSel]),
        h('div', { class: 'field' }, [h('label', { for: 'f-priority', text: 'Пріоритет' }), prioritySel]),
        h('div', { class: 'field' }, [h('label', { for: 'f-status', text: 'Статус' }), statusSel]),
        h('div', { class: 'field' }, [h('label', { for: 'f-sort', text: 'Сортування' }), sortSel]),
        h('div', { class: 'field check' }, [overdue, h('label', { for: 'f-overdue', text: 'Лише прострочені' })]),
        h('div', { class: 'field check' }, [withImage, h('label', { for: 'f-image', text: '🖼️ Зображення' })]),
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
        h('img', { src: 'img/empty-tasks.svg', alt: 'Немає завдань', class: 'empty-illustration' }),
        h('h2', { text: 'У вас ще немає навчальних завдань' }),
        h('p', { text: 'Створіть своє перше завдання, додайте фото конспектів або схем, або завантажте готові приклади для перевірки можливостей v1.6.' }),
        h('div', { class: 'empty-actions' }, [
          h('a', { class: 'btn btn-primary', href: '#/new', text: '➕ Додати перше завдання' }),
          h('button', {
            type: 'button', class: 'btn', text: '✨ Завантажити демонстраційні завдання',
            onclick: () => {
              manager.loadSampleTasks();
              fireConfetti(2000);
              toast('Демонстраційні завдання з кресленнями завантажено!', false);
              route();
            }
          })
        ])
      ]));
      return;
    }

    const today = SP.todayISO();
    const tasks = manager.getVisibleTasks(filter, view.sortMode, today);
    if (tasks.length === 0) {
      box.appendChild(h('div', { class: 'panel empty', id: 'nothing-found' }, [
        h('img', { src: 'img/not-found.svg', alt: 'Нічого не знайдено', class: 'empty-illustration' }),
        h('h2', { text: 'За вказаними фільтрами завдань не знайдено' }),
        h('p', { text: 'Спробуйте змінити пошуковий запит або скинути активні фільтри.' }),
        h('button', {
          type: 'button', class: 'btn btn-primary', text: 'Скинути фільтри',
          onclick: () => { filter.reset(); view.sortMode = 'BY_DATE'; route(); }
        })
      ]));
      return;
    }

    const summaryBar = h('div', { class: 'summary-bar' }, [
      h('p', { class: 'summary', id: 'summary', text: 'Показано ' + tasks.length + ' із ' + total + ' завдань' }),
      h('div', { style: 'font-size:0.85rem; color:var(--muted);' }, [
        doc.createTextNode('Порада: клацніть чекбокс зліва для завершення із зеленим спалахом')
      ])
    ]);
    box.appendChild(summaryBar);

    const tbody = h('tbody');
    tasks.forEach((t) => tbody.appendChild(buildRow(t, today)));
    box.appendChild(h('div', { class: 'table-wrap' }, [
      h('table', { id: 'task-table' }, [
        h('thead', {}, [
          h('tr', {}, [
            h('th', { scope: 'col', style: 'width: 44px; text-align:center;', text: 'Готово' }),
            h('th', { scope: 'col', text: 'Назва завдання' }),
            h('th', { scope: 'col', text: 'Предмет' }),
            h('th', { scope: 'col', text: 'Дата виконання' }),
            h('th', { scope: 'col', text: 'Пріоритет' }),
            h('th', { scope: 'col', text: 'Статус' }),
            h('th', { scope: 'col', text: 'Дії' })
          ])
        ]),
        tbody
      ])
    ]));
  }

  function buildRow(t, today) {
    const overdue = t.isOverdue(today);
    const isDone = t.status === 'DONE';

    // Чекбокс швидкого завершення з зеленою анімацією
    const quickBtn = h('button', {
      type: 'button',
      class: 'quick-complete-btn' + (isDone ? ' is-done' : ''),
      'aria-label': isDone ? 'Позначити невиконаним' : 'Позначити виконаним',
      title: isDone ? 'Позначити невиконаним' : 'Позначити виконаним (із салютом)',
      onclick: () => {
        const nextStatus = isDone ? 'PLANNED' : 'DONE';
        const res = manager.changeStatus(t.id, nextStatus);
        if (res.ok && !isDone) {
          fireConfetti(1800);
        }
        applyChange(res, isDone ? 'Повернуто в план' : 'Завдання виконано! 🎉');
      }
    }, [isDone ? '✓' : '○']);

    // Прев'ю зображення якщо є
    const titleElements = [];
    if (t.imageUrl) {
      const imgThumb = h('img', {
        src: t.imageUrl,
        alt: 'Прев’ю завдання',
        class: 'task-thumb-mini',
        title: 'Клацніть для збільшення зображення',
        onclick: (e) => {
          e.stopPropagation();
          showLightbox(t.imageUrl, t.title);
        }
      });
      titleElements.push(imgThumb);
    }

    const titleLink = h('a', { class: 'task-link', href: '#/task/' + t.id, text: t.title });
    titleElements.push(titleLink);

    if (t.imageUrl) {
      titleElements.push(h('span', { class: 'badge-has-img', text: '🖼️' }));
    }

    const prio = h('select', { 'aria-label': 'Пріоритет завдання «' + t.title + '»', class: 'row-priority' }, optionList(PRIORITY, t.priority));
    const stat = h('select', { 'aria-label': 'Статус завдання «' + t.title + '»', class: 'row-status' }, optionList(STATUS, t.status));
    prio.addEventListener('change', () => applyChange(manager.changePriority(t.id, prio.value), 'Пріоритет змінено'));
    stat.addEventListener('change', () => {
      const isFinishing = stat.value === 'DONE';
      const res = manager.changeStatus(t.id, stat.value);
      if (res.ok && isFinishing) {
        fireConfetti(1800);
      }
      applyChange(res, 'Статус змінено');
    });

    const dateCell = h('td', { 'data-label': 'Дата виконання' }, [h('span', { text: SP.Validator.formatDate(t.dueDate) })]);
    if (overdue) {
      dateCell.appendChild(doc.createTextNode(' '));
      dateCell.appendChild(badge('badge-overdue', 'Прострочено'));
    }

    return h('tr', { class: (overdue ? 'is-overdue ' : '') + (isDone ? 'is-done' : ''), 'data-id': t.id }, [
      h('td', { 'data-label': 'Готово', style: 'text-align:center;' }, [quickBtn]),
      h('td', { class: 'task-title-cell', 'data-label': 'Назва' }, titleElements),
      h('td', { 'data-label': 'Предмет', text: t.subject }),
      dateCell,
      h('td', { 'data-label': 'Пріоритет' }, [prio]),
      h('td', { 'data-label': 'Статус' }, [stat]),
      h('td', { class: 'actions-cell' }, [h('div', { class: 'actions' }, [
        h('a', { class: 'btn btn-small', href: '#/edit/' + t.id, 'aria-label': 'Редагувати завдання «' + t.title + '»', text: '✏️ Редагувати' }),
        h('button', {
          type: 'button',
          class: 'btn btn-small btn-danger row-delete',
          'aria-label': 'Видалити завдання «' + t.title + '»',
          text: '🗑️',
          title: 'Видалити завдання',
          onclick: () => doDelete(t, false)
        })
      ])])
    ]);
  }

  function applyChange(res, okMessage) {
    if (res.ok) toast(okMessage, false);
    else toast(res.error, true);
    renderResults();
    // Оновити дашборд статистики
    const db = doc.getElementById('dashboard-box');
    if (db) {
      const parent = db.parentNode;
      parent.replaceChild(buildDashboard(), db);
    }
  }

  async function doDelete(task, goToList) {
    const ok = await confirmDelete(task);
    if (!ok) return;
    const res = manager.deleteTask(task.id);
    if (!res.ok) { toast(res.error, true); return; }
    toast('Завдання видалено', false);
    if (goToList) global.location.hash = '#/';
    else route();
  }

  /* ---------- Екран «Форма завдання» ---------- */
  function renderForm(id) {
    const editing = id !== null;
    const task = editing ? manager.getTask(id) : null;
    if (editing && !task) {
      main.appendChild(h('div', { class: 'panel empty' }, [
        h('h1', { text: 'Завдання не знайдено' }),
        h('a', { class: 'btn btn-primary', href: '#/', text: 'До списку завдань' })
      ]));
      return;
    }
    if (manager.readError) {
      main.appendChild(h('div', { class: 'banner', role: 'alert' }, [
        h('p', { text: 'Збереження недоступне: ' + manager.readError }),
        h('a', { class: 'btn', href: '#/', text: 'До списку завдань' })
      ]));
      return;
    }

    main.appendChild(h('h1', { text: editing ? '✏️ Редагування завдання' : '➕ Створення нового завдання' }));

    const fields = {
      title: h('input', { type: 'text', id: 'title', name: 'title', value: task ? task.title : '', autocomplete: 'off', 'aria-required': 'true' }),
      subject: h('input', { type: 'text', id: 'subject', name: 'subject', value: task ? task.subject : '', autocomplete: 'off', 'aria-required': 'true', list: 'subject-list' }),
      dueDate: h('input', { type: 'text', id: 'dueDate', name: 'dueDate', value: task ? SP.Validator.formatDate(task.dueDate) : '', placeholder: 'ДД.ММ.РРРР, наприклад 20.10.2026', inputmode: 'numeric', autocomplete: 'off', 'aria-required': 'true' }),
      priority: h('select', { id: 'priority', name: 'priority' }, optionList(PRIORITY, task ? task.priority : 'MEDIUM')),
      description: h('textarea', { id: 'description', name: 'description', placeholder: 'Вкажіть деталі завдання, формули, питання до викладача...' }),
      imageUrl: h('input', { type: 'hidden', id: 'imageUrl', name: 'imageUrl', value: task ? (task.imageUrl || '') : '' })
    };
    fields.description.value = task ? task.description : '';

    const datalist = h('datalist', { id: 'subject-list' }, manager.getSubjects().map((s) => h('option', { value: s })));
    const formError = h('p', { class: 'form-error', id: 'form-error', role: 'alert' });
    const errorEls = {};

    function field(key, label, hint, required, extra) {
      const err = h('div', { class: 'error-text', id: key + '-error' });
      errorEls[key] = err;
      const kids = [h('label', { for: key, text: label + (required ? ' *' : '') }), fields[key]];
      if (extra) kids.push(extra);
      if (hint) kids.push(h('div', { class: 'hint', text: hint }));
      kids.push(err);
      return h('div', { class: 'field' }, kids);
    }

    // Швидкі кнопки дати
    const now = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const fmtUa = (d) => p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
    const addD = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return fmtUa(d); };

    const dateShortcuts = h('div', { class: 'date-shortcuts' }, [
      h('button', { type: 'button', class: 'date-pill', text: 'Сьогодні', onclick: () => { fields.dueDate.value = fmtUa(now); } }),
      h('button', { type: 'button', class: 'date-pill', text: 'Завтра', onclick: () => { fields.dueDate.value = addD(1); } }),
      h('button', { type: 'button', class: 'date-pill', text: 'Через 3 дні', onclick: () => { fields.dueDate.value = addD(3); } }),
      h('button', { type: 'button', class: 'date-pill', text: 'Через тиждень', onclick: () => { fields.dueDate.value = addD(7); } })
    ]);

    // Область прикріплення зображення
    let currentImage = task ? (task.imageUrl || '') : '';
    const imagePreview = h('img', {
      class: 'image-preview-thumb',
      src: currentImage || '',
      style: currentImage ? 'display:block;' : 'display:none;'
    });
    const removeImgBtn = h('button', {
      type: 'button', class: 'btn btn-small btn-danger btn-remove-img',
      text: '🗑️ Видалити зображення',
      style: currentImage ? 'display:inline-block;' : 'display:none;',
      onclick: () => {
        currentImage = '';
        fields.imageUrl.value = '';
        imagePreview.style.display = 'none';
        imagePreview.src = '';
        removeImgBtn.style.display = 'none';
      }
    });

    const fileInput = h('input', {
      type: 'file',
      accept: 'image/png,image/jpeg,image/webp,image/svg+xml',
      style: 'display:none;'
    });

    const urlInput = h('input', {
      type: 'text',
      placeholder: 'Або вставте посилання на зображення (URL / локальний шлях)...',
      value: currentImage.startsWith('data:') ? '' : currentImage,
      style: 'margin-top:8px;'
    });

    urlInput.addEventListener('input', () => {
      const val = urlInput.value.trim();
      if (val) {
        currentImage = val;
        fields.imageUrl.value = val;
        imagePreview.src = val;
        imagePreview.style.display = 'block';
        removeImgBtn.style.display = 'inline-block';
      }
    });

    function setFromFile(file) {
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        toast('Розмір файлу перевищує 2 МБ', true);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        currentImage = ev.target.result;
        fields.imageUrl.value = currentImage;
        imagePreview.src = currentImage;
        imagePreview.style.display = 'block';
        removeImgBtn.style.display = 'inline-block';
        toast('Зображення прикріплено! 🖼️', false);
      };
      reader.readAsDataURL(file);
    }

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        setFromFile(fileInput.files[0]);
      }
    });

    const sampleImages = [
      { label: '📐 Математика', path: 'img/sample-math.svg' },
      { label: '⚡ Фізика', path: 'img/sample-physics.svg' },
      { label: '💻 Код', path: 'img/sample-code.svg' },
      { label: '🧪 Хімія', path: 'img/sample-chemistry.svg' },
      { label: '📖 Література', path: 'img/sample-literature.svg' }
    ];

    const dropZone = h('div', { class: 'image-upload-box' }, [
      h('p', { style: 'margin:0 0 8px; font-weight:700;' }, [doc.createTextNode('🖼️ Перетягніть сюди фото завдання або креслення')]),
      h('button', {
        type: 'button', class: 'btn btn-small', text: '📁 Обрати файл із пристрою',
        onclick: () => fileInput.click()
      }),
      fileInput,
      urlInput,
      h('div', { class: 'sample-images-bar' }, [
        h('span', { class: 'sample-images-label', text: 'Приклади схем:' })
      ].concat(sampleImages.map((s) => h('button', {
        type: 'button', class: 'sample-img-pill', text: s.label,
        onclick: () => {
          currentImage = s.path;
          fields.imageUrl.value = currentImage;
          urlInput.value = currentImage;
          imagePreview.src = currentImage;
          imagePreview.style.display = 'block';
          removeImgBtn.style.display = 'inline-block';
        }
      })))),
      h('div', { class: 'image-preview-wrapper' }, [imagePreview, removeImgBtn])
    ]);

    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        setFromFile(e.dataTransfer.files[0]);
      }
    });

    const imageFieldBox = h('div', { class: 'field' }, [
      h('label', { text: 'Прикріплене зображення / схема' }),
      fields.imageUrl,
      dropZone,
      h('div', { class: 'hint', text: 'Підтримуються фотографії конспектів, схеми, формули (PNG, JPG, SVG, WebP до 2 МБ)' })
    ]);

    function showErrors(errors) {
      let first = null;
      ['title', 'subject', 'dueDate', 'priority', 'description'].forEach((k) => {
        const msg = errors[k];
        if (errorEls[k]) errorEls[k].textContent = msg || '';
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
      field('title', 'Назва завдання', 'До 100 символів', true),
      field('subject', 'Предмет / Дисципліна', 'До 80 символів. Оберіть зі списку або введіть новий', true),
      field('dueDate', 'Дата виконання (дедлайн)', 'Формат ДД.ММ.РРРР', true, dateShortcuts),
      field('priority', 'Пріоритет', '', false),
      field('description', 'Опис завдання', 'Необов’язково, до 1000 символів', false),
      imageFieldBox,
      formError,
      h('div', { class: 'form-actions' }, [
        h('button', { type: 'submit', class: 'btn btn-primary', id: 'save-btn', text: editing ? '💾 Зберегти зміни' : '➕ Створити завдання' }),
        h('a', { class: 'btn', id: 'cancel-btn', href: editing ? '#/task/' + id : '#/', text: 'Скасувати' })
      ])
    ]);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      formError.textContent = '';
      const data = {
        title: fields.title.value,
        subject: fields.subject.value,
        dueDate: fields.dueDate.value,
        priority: fields.priority.value,
        description: fields.description.value,
        imageUrl: fields.imageUrl.value
      };
      const res = editing ? manager.updateTask(id, data) : manager.createTask(data);
      if (res.ok) {
        showErrors({});
        toast(editing ? 'Зміни успішно збережено' : 'Завдання додано до плану', false);
        global.location.hash = '#/';
        return;
      }
      if (res.errors) {
        showErrors(res.errors);
        return;
      }
      showErrors({});
      formError.textContent = res.error;
      toast(res.error, true);
    });

    main.appendChild(form);
    main.appendChild(datalist);
    fields.title.focus({ preventScroll: true });
  }

  /* ---------- Екран «Деталі завдання» ---------- */
  function renderDetail(id) {
    const t = manager.getTask(id);
    if (!t) {
      main.appendChild(h('div', { class: 'panel empty' }, [
        h('h1', { text: 'Завдання не знайдено' }),
        h('a', { class: 'btn btn-primary', href: '#/', text: 'До списку завдань' })
      ]));
      return;
    }
    const today = SP.todayISO();
    const overdue = t.isOverdue(today);
    const dateDd = h('dd', {}, [h('span', { text: SP.Validator.formatDate(t.dueDate) })]);
    if (overdue) {
      dateDd.appendChild(doc.createTextNode(' '));
      dateDd.appendChild(badge('badge-overdue', 'Прострочено'));
    }
    const fmt = (iso) => new Date(iso).toLocaleString('uk-UA');

    const titleRow = h('div', { style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;' }, [
      h('h1', { id: 'detail-title', style: 'margin:0;' }, [doc.createTextNode(t.title)])
    ]);
    main.appendChild(titleRow);

    const detailPanel = h('div', { class: 'panel' }, [
      h('dl', { class: 'details' }, [
        h('dt', { text: 'Предмет' }), h('dd', { text: t.subject }),
        h('dt', { text: 'Дата виконання' }), dateDd,
        h('dt', { text: 'Пріоритет' }), h('dd', {}, [badge('badge-' + t.priority, PRIORITY[t.priority].label)]),
        h('dt', { text: 'Статус' }), h('dd', {}, [badge('badge-' + t.status, STATUS[t.status].label)]),
        h('dt', { text: 'Опис' }), h('dd', { text: t.description || '—' }),
        h('dt', { text: 'Створено' }), h('dd', { text: fmt(t.createdAt) }),
        h('dt', { text: 'Змінено' }), h('dd', { text: fmt(t.updatedAt) })
      ])
    ]);

    // Якщо прикріплено зображення
    if (t.imageUrl) {
      const imgCard = h('div', { class: 'detail-image-card' }, [
        h('strong', { style: 'display:block; margin-bottom:8px;', text: '🖼️ Прикріплене зображення / схема' }),
        h('img', {
          src: t.imageUrl,
          alt: 'Ілюстрація до завдання «' + t.title + '»',
          title: 'Клацніть для перегляду на весь екран',
          onclick: () => showLightbox(t.imageUrl, t.title)
        }),
        h('div', { class: 'detail-image-caption' }, [
          doc.createTextNode('Натисніть на зображення, щоб відкрити його у повному розмірі'),
          h('button', {
            type: 'button', class: 'btn btn-small', text: '🔍 Збільшити',
            onclick: () => showLightbox(t.imageUrl, t.title)
          })
        ])
      ]);
      detailPanel.appendChild(imgCard);
    }

    // Швидка зміна статусу
    const isDone = t.status === 'DONE';
    const quickToggleBtn = h('button', {
      type: 'button',
      class: 'btn ' + (isDone ? '' : 'btn-primary'),
      text: isDone ? '↩️ Повернути в роботу' : '✅ Позначити як виконано',
      onclick: () => {
        const next = isDone ? 'IN_PROGRESS' : 'DONE';
        const res = manager.changeStatus(t.id, next);
        if (res.ok) {
          if (!isDone) fireConfetti(2200);
          toast(isDone ? 'Завдання повернуто в роботу' : 'Вітаємо! Завдання виконано!', false);
          route();
        } else {
          toast(res.error, true);
        }
      }
    });

    const actions = h('div', { class: 'form-actions', style: 'margin-top:20px;' }, [
      quickToggleBtn,
      h('a', { class: 'btn', href: '#/edit/' + t.id, text: '✏️ Редагувати' }),
      h('button', { type: 'button', class: 'btn btn-danger', id: 'detail-delete', text: '🗑️ Видалити', onclick: () => doDelete(t, true) }),
      h('a', { class: 'btn', href: '#/', text: '📋 До списку' })
    ]);
    detailPanel.appendChild(actions);

    main.appendChild(detailPanel);
  }

  /* ---------- Модальні вікна (Про версію, Резервні копії, Lightbox) ---------- */
  function initModals() {
    // Lightbox
    const lbClose = doc.getElementById('lightbox-close');
    const lbDlg = doc.getElementById('lightbox-dialog');
    if (lbClose && lbDlg) {
      lbClose.addEventListener('click', () => lbDlg.close());
    }

    // About Dialog
    const aboutDlg = doc.getElementById('about-dialog');
    const btnAbout = doc.getElementById('btn-about');
    const footerBtnAbout = doc.getElementById('footer-btn-about');
    const aboutClose = doc.getElementById('about-close');
    const aboutOk = doc.getElementById('about-ok');
    const openAbout = () => { if (aboutDlg) aboutDlg.showModal(); };
    if (btnAbout) btnAbout.addEventListener('click', openAbout);
    if (footerBtnAbout) footerBtnAbout.addEventListener('click', openAbout);
    if (aboutClose && aboutDlg) aboutClose.addEventListener('click', () => aboutDlg.close());
    if (aboutOk && aboutDlg) aboutOk.addEventListener('click', () => aboutDlg.close());

    // Backup Dialog
    const backupDlg = doc.getElementById('backup-dialog');
    const btnBackup = doc.getElementById('btn-backup');
    const footerBtnBackup = doc.getElementById('footer-btn-backup');
    const backupClose = doc.getElementById('backup-close');
    const backupDone = doc.getElementById('backup-done');
    const btnExport = doc.getElementById('btn-export-download');
    const btnImport = doc.getElementById('btn-import-run');
    const backupFileInput = doc.getElementById('backup-file-input');

    const openBackup = () => { if (backupDlg) backupDlg.showModal(); };
    if (btnBackup) btnBackup.addEventListener('click', openBackup);
    if (footerBtnBackup) footerBtnBackup.addEventListener('click', openBackup);
    if (backupClose && backupDlg) backupClose.addEventListener('click', () => backupDlg.close());
    if (backupDone && backupDlg) backupDone.addEventListener('click', () => backupDlg.close());

    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const json = manager.exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = doc.createElement('a');
        a.href = url;
        a.download = 'studyplanner-backup-v1.6.json';
        doc.body.appendChild(a);
        a.click();
        doc.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('Файл резервної копії v1.6 завантажено', false);
      });
    }

    if (btnImport && backupFileInput) {
      btnImport.addEventListener('click', () => {
        const file = backupFileInput.files && backupFileInput.files[0];
        if (!file) {
          toast('Оберіть JSON-файл для відновлення', true);
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const res = manager.importJSON(e.target.result);
          if (res.ok) {
            fireConfetti(2000);
            toast('Завдання успішно відновлено з файлу!', false);
            backupDlg.close();
            route();
          } else {
            toast(res.error, true);
          }
        };
        reader.readAsText(file);
      });
    }

    // Клавіша Esc для закриття діалогів, '?' для довідки
    global.addEventListener('keydown', (e) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        openAbout();
      }
    });
  }

  // Ініціалізація
  initTheme();
  initModals();
  global.addEventListener('hashchange', route);
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', route);
  } else {
    route();
  }
})(window);
