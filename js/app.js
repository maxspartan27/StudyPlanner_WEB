/**
 * app.js — [Controller Layer] головний контролер застосунку (UIController): маршрутизація, робочий простір, форми та події.
 * Версія 2.1.7 (build 217) Redstone 5 — Автор: Максим Ковалишин.
 * Архітектура v2.1.7 Redstone 5:
 * - Модульна побудова (Core Layer + 9 спеціалізованих UI-модулів включно зі SmartTable RS5, Gradebook ECTS та WelcomeSplash).
 * - Повністю оновлена Розумна Таблиця без CSS/DOM багів: швидке додавання, inline-редагування, зміна статусів, пакетні дії, групування, сортування ▲/▼.
 * - Журнал оцінок та Калькулятор стипендії ECTS/GPA (#/grades), Фокус-ціль у Pomodoro, двосторонній стек Undo/Redo (Ctrl+Z / Ctrl+Y).
 */
(function (global) {
  'use strict';
  const SP = global.StudyPlanner;
  SP.VERSION = '2.1.7';
  SP.BUILD = '217';
  SP.CODENAME = 'Redstone 5';
  SP.AUTHOR = 'Максим Ковалишин';

  const doc = global.document;
  const h = SP.DOM.h;
  const fragment = SP.DOM.fragment;
  const badge = SP.DOM.badge;
  const toast = SP.DOM.toast;
  const PRIORITY = SP.TaskManager.PRIORITY;
  const STATUS = SP.TaskManager.STATUS;

  const storage = new SP.TaskStorage();
  const manager = new SP.TaskManager(storage, SP.Validator);
  const filter = new SP.TaskFilter();

  const nowInit = new Date();
  const view = {
    sortMode: 'BY_DATE',
    viewMode: storage.getViewMode() || 'cards',
    calYear: nowInit.getFullYear(),
    calMonth: nowInit.getMonth()
  };

  const main = doc.getElementById('main');

  function getExtraXpStats() {
    const pomoStats = storage.getPomoStats();
    const mastered = SP.FlashcardsView.getMasteredCount(storage);
    const passedCourses = SP.GradebookView ? SP.GradebookView.getPassedCount(storage) : 0;
    return {
      pomoSessions: pomoStats.sessions,
      pomoMinutes: pomoStats.totalMinutes,
      masteredCards: mastered,
      passedCourses: passedCourses
    };
  }

  /** Плавне оновлення робочого простору без скидання позиції прокрутки */
  function refreshWorkspaceInPlace() {
    if (doc.getElementById('results')) {
      refreshToolbar();
      renderResults();
      refreshDashboardWidgets();
    } else {
      route();
    }
  }

  function performUndo() {
    const res = manager.undoLast();
    if (res.ok) {
      toast('Скасовано: ' + res.label + ' ↩️', false, manager.canRedo() ? {
        actionLabel: '↪️ Повторити',
        onAction: performRedo
      } : null);
      refreshWorkspaceInPlace();
    } else {
      toast(res.error || 'Немає дій для скасування', true);
    }
  }

  function performRedo() {
    const res = manager.redoLast();
    if (res.ok) {
      toast('Повторено: ' + res.label + ' ↪️', false, manager.canUndo() ? {
        actionLabel: '↩️ Скасувати',
        onAction: performUndo
      } : null);
      refreshWorkspaceInPlace();
    } else {
      toast(res.error || 'Немає дій для повтору', true);
    }
  }

  function applyChange(res, okMessage, offerUndo) {
    if (res.ok) {
      const opts = (offerUndo !== false && manager.canUndo())
        ? { actionLabel: '↩️ Скасувати', onAction: performUndo }
        : null;
      if (okMessage) toast(okMessage, false, opts);
    } else if (res.error) {
      toast(res.error, true);
    }
    refreshToolbar();
    renderResults();
    refreshDashboardWidgets();
  }

  async function doDelete(task, goToList) {
    const ok = await SP.DOM.confirmDelete(task);
    if (!ok) return;
    const res = manager.deleteTask(task.id);
    if (!res.ok) {
      toast(res.error, true);
      return;
    }
    toast('Завдання видалено', false, { actionLabel: '↩️ Скасувати', onAction: performUndo });
    if (goToList) {
      global.location.hash = '#/';
    } else {
      refreshWorkspaceInPlace();
    }
  }

  function switchView(mode) {
    view.viewMode = mode;
    storage.setViewMode(mode);
    if ((global.location.hash || '#/') !== '#/') {
      global.location.hash = '#/';
    } else {
      renderResults();
    }
  }

  function cycleViewMode() {
    const modes = ['cards', 'table', 'kanban', 'calendar'];
    const labels = { cards: '🗂️ Картки', table: '📋 Розумна Таблиця RS5', kanban: '📊 Канбан', calendar: '📅 Календар' };
    const next = modes[(modes.indexOf(view.viewMode) + 1) % modes.length];
    switchView(next);
    toast('Режим відображення: ' + labels[next], false);
  }

  /* ---------- Маршрутизація SPA ---------- */
  function route() {
    const rawHash = global.location.hash || '#/';
    const qIdx = rawHash.indexOf('?');
    const cleanHash = qIdx >= 0 ? rawHash.slice(0, qIdx) : rawHash;
    const queryStr = qIdx >= 0 ? rawHash.slice(qIdx + 1) : '';
    const queryParams = new URLSearchParams(queryStr);

    const parts = cleanHash.replace(/^#\/?/, '').split('/');
    const page = parts[0] || '';
    const requestedView = queryParams.get('view') || (page === 'table' ? 'table' : '');
    if (['cards', 'table', 'kanban', 'calendar'].indexOf(requestedView) !== -1) {
      view.viewMode = requestedView;
      storage.setViewMode(requestedView);
    }

    main.textContent = '';
    if (doc.documentElement.getAttribute('data-perf') !== 'turbo') {
      main.classList.remove('route-enter');
      void main.offsetWidth;
      main.classList.add('route-enter');
    }
    global.scrollTo(0, 0);
    setNav(page === 'table' ? '' : page);

    if (page === '' || page === 'table') renderList();
    else if (page === 'analytics') SP.AnalyticsView.render(main, { manager: manager, storage: storage, filter: filter });
    else if (page === 'grades') SP.GradebookView.render(main, { storage: storage, manager: manager, onRouteRefresh: route });
    else if (page === 'flashcards') SP.FlashcardsView.render(main, { storage: storage, manager: manager, onRouteRefresh: route });
    else if (page === 'themes') renderThemesPage();
    else if (page === 'article') renderArticlePage();
    else if (page === 'new') renderForm(null, queryParams.get('date'));
    else if (page === 'edit' && parts[1]) renderForm(parts[1], null);
    else if (page === 'task' && parts[1]) renderDetail(parts[1]);
    else renderNotFound();

    main.focus({ preventScroll: true });
  }

  function setNav(page) {
    const navMap = {
      '': 'nav-list',
      'analytics': 'nav-analytics',
      'grades': 'nav-grades',
      'flashcards': 'nav-flashcards',
      'themes': 'nav-themes',
      'article': 'nav-article',
      'new': 'nav-new'
    };
    ['nav-list', 'nav-analytics', 'nav-grades', 'nav-flashcards', 'nav-themes', 'nav-article', 'nav-new'].forEach((id) => {
      const el = doc.getElementById(id);
      if (!el) return;
      if (navMap[page] === id) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
  }

  function renderNotFound() {
    main.appendChild(h('div', { class: 'panel empty' }, [
      h('img', { src: 'img/not-found.svg', alt: 'Сторінку не знайдено', class: 'empty-illustration' }),
      h('h1', { text: 'Сторінку не знайдено' }),
      h('p', { text: 'За вказаною адресою нічого немає.' }),
      h('a', { class: 'btn btn-primary', href: '#/', text: 'Повернутися до списку' })
    ]));
  }

  function renderThemesPage() {
    main.appendChild(h('h1', { text: '🎨 Студія 16 Тем, 30 HD-шпалер та Кольорів (v2.1.7 build 217 RS5)' }));
    main.appendChild(SP.ThemeEngine.buildActiveThemeBanner());
    main.appendChild(SP.ThemeEngine.buildThemeStudioPanel());
    main.appendChild(SP.ThemeEngine.buildThemesShowcase(true));
  }

  function renderArticlePage() {
    main.appendChild(h('h1', { text: '📖 Про проєкт StudyPlanner v2.1.7 (build 217) Redstone 5' }));
    main.appendChild(buildArticleSection(true));
    main.appendChild(SP.ThemeEngine.buildThemesShowcase(true));
  }

  /* ---------- Головний екран «Список завдань» ---------- */
  function refreshDashboardWidgets() {
    const db = doc.getElementById('dashboard-box');
    if (db && db.parentNode) db.parentNode.replaceChild(buildDashboard(), db);
    const ew = doc.getElementById('extra-widgets-box');
    if (ew && ew.parentNode) ew.parentNode.replaceChild(buildExtraWidgets(), ew);
  }

  function refreshToolbar() {
    const tb = doc.getElementById('toolbar-panel');
    if (!tb || !tb.parentNode) return;
    const activeEl = doc.activeElement;
    if (activeEl && activeEl.id === 'f-query') return;
    tb.parentNode.replaceChild(buildToolbar(), tb);
  }

  function renderList() {
    const headerRow = h('div', { style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;' }, [
      h('h1', { style: 'margin:0;' }, [
        doc.createTextNode('Мої навчальні завдання '),
        h('span', { class: 'badge-version', style: 'font-size:0.74rem; vertical-align:middle;', text: 'v' + SP.VERSION + ' (build ' + SP.BUILD + ') • RS5' })
      ]),
      h('div', { style: 'display:flex; gap:8px; flex-wrap:wrap;' }, [
        h('button', {
          type: 'button',
          class: 'btn' + (view.viewMode === 'table' ? ' btn-primary' : ''),
          title: 'Відкрити оновлену Розумну Таблицю Redstone 5 (клавіша V)',
          text: '📋 Таблиця RS5',
          onclick: () => switchView('table')
        }),
        h('a', { class: 'btn', href: '#/grades', text: '🎓 Оцінки ECTS' }),
        h('a', { class: 'btn', href: '#/analytics', text: '📊 Аналітика' }),
        h('a', { class: 'btn btn-primary', href: '#/new', text: '➕ Створити завдання' })
      ])
    ]);

    if (manager.readError) {
      main.appendChild(fragment([
        headerRow,
        h('div', { class: 'banner', role: 'alert' }, [
          h('p', { text: 'Не вдалося прочитати збережені завдання: ' + manager.readError }),
          h('div', { class: 'actions', style: 'display:flex; gap:10px; flex-wrap:wrap;' }, [
            h('button', { type: 'button', class: 'btn', id: 'retry-read', text: 'Спробувати ще раз', onclick: () => { manager.reload(); route(); } }),
            h('button', { type: 'button', class: 'btn btn-danger', id: 'start-empty', text: 'Почати з порожнього списку', onclick: () => { manager.startEmpty(); route(); } })
          ])
        ])
      ]));
      return;
    }

    const results = h('div', { id: 'results' });
    main.appendChild(fragment([
      headerRow,
      SP.ThemeEngine.buildActiveThemeBanner(),
      buildDashboard(),
      SP.FocusHub.buildWidget(),
      buildToolbar(),
      results,
      buildExtraWidgets(),
      SP.ThemeEngine.buildThemesShowcase(false),
      buildArticleSection(false)
    ]));
    renderResults();
  }

  function buildDashboard() {
    const today = SP.todayISO();
    const extra = getExtraXpStats();
    const stats = manager.getStats(today, extra);
    const wrap = h('div', { id: 'dashboard-box' });

    if (stats.total > 0 && stats.percent === 100) {
      wrap.appendChild(h('div', { class: 'celebration-box' }, [
        h('img', { src: 'img/celebration.svg', alt: 'Кубок переможця', class: 'celebration-img' }),
        h('div', { class: 'celebration-content' }, [
          h('h2', { text: '🎉 Блискучий результат! Усі завдання виконано на 100%!' }),
          h('p', { text: 'Ви завершили весь навчальний план! Поточний ранг: ' + stats.rankTitle + ' (' + stats.xp + ' XP).' }),
          h('button', {
            type: 'button', class: 'btn btn-celebrate', text: '🎆 Запустити святковий салют!',
            onclick: () => { SP.FocusHub.playVictoryChime(); SP.DOM.fireConfetti(3200); }
          })
        ])
      ]));
    }

    if (stats.total > 0 || stats.xp > 0) {
      wrap.appendChild(h('div', { class: 'progress-container' }, [
        h('div', { class: 'progress-bar-wrap' }, [
          h('div', { style: 'font-size:0.9rem; font-weight:800; color:var(--text);', text: 'Прогрес виконання:' }),
          h('div', { class: 'progress-track' }, [
            h('div', { class: 'progress-fill', style: 'width: ' + stats.percent + '%;' })
          ]),
          h('div', { class: 'progress-text', text: stats.percent + '% (' + stats.done + '/' + stats.total + ')' }),
          stats.subtasksTotal > 0 ? badge('badge-IN_PROGRESS', '☑️ Етапи: ' + stats.subtasksDone + '/' + stats.subtasksTotal) : null,
          h('a', {
            href: '#/analytics',
            class: 'xp-rank-pill',
            style: 'text-decoration:none;',
            title: 'Натисніть, щоб відкрити Центр візуальної аналітики (до наступного рангу: ' + stats.nextRankXp + ' XP)'
          }, [
            h('span', { text: stats.rankTitle }),
            h('span', { style: 'opacity:0.85;', text: '• ' + stats.xp + ' XP 📊' })
          ])
        ])
      ]));
    }

    const cards = [
      { label: 'Всього завдань', icon: '📚', val: stats.total, cls: '', action: () => { filter.reset(); refreshWorkspaceInPlace(); } },
      { label: 'Заплановано', icon: '🗓️', val: stats.planned, cls: '', action: () => { filter.reset(); filter.status = 'PLANNED'; refreshWorkspaceInPlace(); } },
      { label: 'У роботі', icon: '⏳', val: stats.inProgress, cls: 'stat-progress', action: () => { filter.reset(); filter.status = 'IN_PROGRESS'; refreshWorkspaceInPlace(); } },
      { label: 'Виконано', icon: '✅', val: stats.done, cls: 'stat-done', action: () => { filter.reset(); filter.status = 'DONE'; refreshWorkspaceInPlace(); } },
      { label: 'Прострочено', icon: '🚨', val: stats.overdue, cls: stats.overdue > 0 ? 'stat-overdue' : '', action: () => { filter.reset(); filter.overdueOnly = true; refreshWorkspaceInPlace(); } },
      { label: 'З фото / схемами', icon: '🖼️', val: stats.withImages, cls: '', action: () => { filter.reset(); filter.withImageOnly = true; refreshWorkspaceInPlace(); } }
    ];

    wrap.appendChild(h('div', { class: 'stats-grid' }, cards.map((c) =>
      h('div', { class: 'stat-card ' + c.cls, title: 'Натисніть для швидкого відбору', onclick: c.action }, [
        h('div', { class: 'stat-card-header' }, [
          h('span', { class: 'stat-label', text: c.label }),
          h('span', { class: 'stat-icon', text: c.icon })
        ]),
        h('div', { class: 'stat-value', text: String(c.val) })
      ])
    )));

    return wrap;
  }

  function buildExtraWidgets() {
    const breakdown = manager.getSubjectBreakdown();
    const subjectRows = breakdown.length === 0
      ? [h('p', { style: 'color:var(--muted); margin:0;', text: 'Додайте завдання у Розумній Таблиці або завантажте 9 демо-прикладів Redstone 5, щоб побачити аналітику за предметами.' })]
      : breakdown.map((item) =>
          h('div', {
            class: 'subject-stat-row',
            title: 'Натисніть, щоб відфільтрувати предмет «' + item.subject + '»',
            onclick: () => { filter.subject = item.subject; refreshWorkspaceInPlace(); }
          }, [
            h('div', { class: 'subject-stat-top' }, [
              h('span', { text: '📘 ' + item.subject }),
              h('span', { style: 'color:var(--muted);', text: item.done + ' / ' + item.total + ' (' + item.percent + '%)' })
            ]),
            h('div', { class: 'subject-stat-bar' }, [
              h('div', { class: 'subject-stat-fill', style: 'width:' + item.percent + '%;' })
            ])
          ])
        );

    const subjectPanel = h('div', { class: 'panel', style: 'margin:0;' }, [
      h('div', { style: 'display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:12px;' }, [
        h('h3', { style: 'margin:0; font-size:1.05rem;', text: '📊 Успішність за предметами' }),
        h('div', { style: 'display:flex; gap:6px;' }, [
          filter.subject ? h('button', {
            type: 'button', class: 'btn btn-small', text: 'Усі предмети',
            onclick: () => { filter.subject = ''; refreshWorkspaceInPlace(); }
          }) : null,
          h('a', { class: 'btn btn-small', href: '#/grades', text: '🎓 Оцінки ECTS' }),
          h('a', { class: 'btn btn-small', href: '#/analytics', text: 'Матриця →' })
        ])
      ]),
      h('div', {}, subjectRows)
    ]);

    const notesArea = h('textarea', {
      class: 'quick-notes-area',
      placeholder: 'Запишіть сюди формули, ідеї до курсової, розклад іспитів або конспект лекції (зберігається автоматично з Debounce)...'
    });
    notesArea.value = storage.getNotes();

    const saveStatus = h('span', { style: 'font-size:0.78rem; color:var(--muted);', text: '💾 Автозбереження (' + notesArea.value.length + ' симв.)' });
    const debouncedSaveNotes = SP.DOM.debounce(() => {
      storage.setNotes(notesArea.value);
      saveStatus.textContent = '✅ Збережено о ' + new Date().toLocaleTimeString('uk-UA') + ' (' + notesArea.value.length + ' симв.)';
    }, 250);

    notesArea.addEventListener('input', () => {
      saveStatus.textContent = '⏳ Збереження...';
      debouncedSaveNotes();
    });

    const notesPanel = h('div', { class: 'panel', style: 'margin:0;' }, [
      h('div', { style: 'display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px;' }, [
        h('h3', { style: 'margin:0; font-size:1.05rem;', text: '📝 Швидкий студентський нотатник' }),
        saveStatus
      ]),
      notesArea
    ]);

    return h('section', { id: 'extra-widgets-box', class: 'extra-widgets-grid', 'aria-label': 'Аналітика та нотатник' }, [
      subjectPanel,
      notesPanel
    ]);
  }

  function buildToolbar() {
    const subjects = manager.getSubjects();
    const tags = manager.getTags();

    const subjectSel = h('select', { id: 'f-subject' }, [h('option', { value: '', text: 'Усі предмети' })].concat(
      subjects.map((s) => h('option', { value: s, text: s, selected: s === filter.subject }))
    ));
    const prioritySel = h('select', { id: 'f-priority' }, [h('option', { value: '', text: 'Усі пріоритети' })].concat(SP.DOM.optionList(PRIORITY, filter.priority)));
    const statusSel = h('select', { id: 'f-status' }, [h('option', { value: '', text: 'Усі статуси' })].concat(SP.DOM.optionList(STATUS, filter.status)));
    const tagSel = h('select', { id: 'f-tag' }, [h('option', { value: '', text: 'Усі теги' })].concat(
      tags.map((tg) => h('option', { value: tg, text: '#' + tg, selected: tg === filter.tag }))
    ));

    const sortSel = h('select', { id: 'f-sort' }, [
      h('option', { value: 'BY_DATE', text: 'За датою дедлайну', selected: view.sortMode === 'BY_DATE' }),
      h('option', { value: 'BY_PRIORITY', text: 'За пріоритетом', selected: view.sortMode === 'BY_PRIORITY' }),
      h('option', { value: 'BY_STATUS', text: 'За статусом виконання', selected: view.sortMode === 'BY_STATUS' }),
      h('option', { value: 'BY_PROGRESS', text: 'За прогресом етапів', selected: view.sortMode === 'BY_PROGRESS' }),
      h('option', { value: 'BY_SUBJECT', text: 'За предметом (А–Я)', selected: view.sortMode === 'BY_SUBJECT' }),
      h('option', { value: 'BY_TITLE', text: 'За назвою (А–Я)', selected: view.sortMode === 'BY_TITLE' }),
      h('option', { value: 'BY_NEWEST', text: 'Спочатку новіші', selected: view.sortMode === 'BY_NEWEST' })
    ]);

    const search = h('input', {
      type: 'search',
      id: 'f-query',
      value: filter.query,
      placeholder: 'Швидкий пошук за індексом O(1): назва, предмет, опис, тег ( / )...',
      autocomplete: 'off'
    });
    const overdue = h('input', { type: 'checkbox', id: 'f-overdue', checked: filter.overdueOnly });
    const withImage = h('input', { type: 'checkbox', id: 'f-image', checked: filter.withImageOnly });

    const debouncedSearch = SP.DOM.debounce(() => {
      filter.query = search.value;
      renderResults();
    }, 90);

    search.addEventListener('input', debouncedSearch);
    subjectSel.addEventListener('change', () => { filter.subject = subjectSel.value; renderResults(); });
    prioritySel.addEventListener('change', () => { filter.priority = prioritySel.value; renderResults(); });
    statusSel.addEventListener('change', () => { filter.status = statusSel.value; renderResults(); });
    tagSel.addEventListener('change', () => { filter.tag = tagSel.value; renderResults(); });
    overdue.addEventListener('change', () => { filter.overdueOnly = overdue.checked; renderResults(); });
    withImage.addEventListener('change', () => { filter.withImageOnly = withImage.checked; renderResults(); });
    sortSel.addEventListener('change', () => {
      view.sortMode = sortSel.value;
      const prefs = storage.getTablePrefs();
      if (prefs.sortDir !== 'asc') {
        storage.setTablePrefs(Object.assign({}, prefs, { sortDir: 'asc' }));
      }
      renderResults();
    });

    const reset = h('button', {
      type: 'button', class: 'btn', id: 'f-reset', text: '🔄 Скинути',
      onclick: () => {
        filter.reset();
        view.sortMode = 'BY_DATE';
        const prefs = storage.getTablePrefs();
        storage.setTablePrefs(Object.assign({}, prefs, { sortDir: 'asc' }));
        refreshWorkspaceInPlace();
      }
    });

    return h('section', { id: 'toolbar-panel', class: 'panel', 'aria-label': 'Пошук, фільтри та сортування' }, [
      h('div', { class: 'toolbar' }, [
        h('div', { class: 'field', style: 'grid-column: span 2;' }, [h('label', { for: 'f-query', text: 'Інтелектуальний мультипошук' }), search]),
        h('div', { class: 'field' }, [h('label', { for: 'f-subject', text: 'Предмет' }), subjectSel]),
        h('div', { class: 'field' }, [h('label', { for: 'f-priority', text: 'Пріоритет' }), prioritySel]),
        h('div', { class: 'field' }, [h('label', { for: 'f-status', text: 'Статус' }), statusSel]),
        h('div', { class: 'field' }, [h('label', { for: 'f-tag', text: 'Тег' }), tagSel]),
        h('div', { class: 'field' }, [h('label', { for: 'f-sort', text: 'Сортування' }), sortSel]),
        h('div', { class: 'field check' }, [overdue, h('label', { for: 'f-overdue', text: '🚨 Прострочені' })]),
        h('div', { class: 'field check' }, [withImage, h('label', { for: 'f-image', text: '🖼️ З фото' })]),
        h('div', { class: 'field' }, [reset])
      ])
    ]);
  }

  function pickRandomActiveTask(tasks) {
    const active = tasks.filter((t) => t.status !== 'DONE');
    if (active.length === 0) {
      toast('Усі показані завдання вже виконано! 🎉', false);
      return;
    }
    const chosen = active[Math.floor(Math.random() * active.length)];
    doc.querySelectorAll('.spotlight-active').forEach((el) => el.classList.remove('spotlight-active'));
    const targetEl = doc.querySelector('[data-task-id="' + chosen.id + '"]');
    if (targetEl) {
      targetEl.classList.add('spotlight-active');
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    toast('🎲 Рулетка фокусу обрала: «' + chosen.title + '» (' + chosen.subject + ')', false);
  }

  function renderResults() {
    const box = doc.getElementById('results');
    if (!box) return;
    box.textContent = '';
    const total = manager.tasks.length;

    const viewSwitcher = h('div', { class: 'view-switcher', role: 'group', 'aria-label': 'Режим відображення завдань' }, [
      h('button', {
        type: 'button',
        class: 'view-btn' + (view.viewMode === 'cards' ? ' active' : ''),
        text: '🗂️ Картки',
        onclick: () => { view.viewMode = 'cards'; storage.setViewMode('cards'); renderResults(); }
      }),
      h('button', {
        type: 'button',
        class: 'view-btn' + (view.viewMode === 'table' ? ' active' : ''),
        text: '📋 Таблиця RS5',
        onclick: () => { view.viewMode = 'table'; storage.setViewMode('table'); renderResults(); }
      }),
      h('button', {
        type: 'button',
        class: 'view-btn' + (view.viewMode === 'kanban' ? ' active' : ''),
        text: '📊 Канбан',
        onclick: () => { view.viewMode = 'kanban'; storage.setViewMode('kanban'); renderResults(); }
      }),
      h('button', {
        type: 'button',
        class: 'view-btn' + (view.viewMode === 'calendar' ? ' active' : ''),
        text: '📅 Календар',
        onclick: () => { view.viewMode = 'calendar'; storage.setViewMode('calendar'); renderResults(); }
      })
    ]);

    // Якщо завдань ще 0 і користувач НЕ у режимі Таблиці чи Календаря — показуємо ілюстрований стартовий екран із перемикачем режимів
    if (total === 0 && view.viewMode !== 'table' && view.viewMode !== 'calendar') {
      box.appendChild(h('div', { class: 'panel empty' }, [
        h('div', { style: 'margin-bottom:6px;' }, [viewSwitcher]),
        h('img', { src: 'img/empty-tasks.svg', alt: 'Немає завдань', class: 'empty-illustration' }),
        h('h2', { text: 'У вас ще немає навчальних завдань' }),
        h('p', { text: 'Додайте завдання через повну форму, відкрийте оновлену Розумну Таблицю Redstone 5 зі швидким вводом рядків або завантажте 9 демо-завдань із HD-фотографіями!' }),
        h('div', { class: 'empty-actions' }, [
          h('button', {
            type: 'button',
            class: 'btn btn-primary',
            text: '📋 Відкрити Розумну Таблицю RS5',
            onclick: () => { view.viewMode = 'table'; storage.setViewMode('table'); renderResults(); }
          }),
          h('a', { class: 'btn', href: '#/new', text: '➕ Форма з фото' }),
          h('button', {
            type: 'button', class: 'btn', text: '📸 Завантажити 9 завдань із HD фото',
            onclick: () => {
              manager.loadSampleTasks(false);
              SP.DOM.fireConfetti(2000);
              toast('9 демонстраційних завдань v2.1.7 RS5 завантажено!', false, { actionLabel: '↩️ Скасувати', onAction: performUndo });
              refreshWorkspaceInPlace();
            }
          }),
          h('button', {
            type: 'button', class: 'btn', text: '📐 Завантажити зі схемами SVG',
            onclick: () => {
              manager.loadSampleTasks(true);
              SP.DOM.fireConfetti(1600);
              toast('Демо-завдання з векторними схемами завантажено!', false, { actionLabel: '↩️ Скасувати', onAction: performUndo });
              refreshWorkspaceInPlace();
            }
          }),
          manager.canUndo() ? h('button', {
            type: 'button', class: 'btn', text: '↩️ Скасувати останню дію', onclick: performUndo
          }) : null
        ])
      ]));
      return;
    }

    const today = SP.todayISO();
    const tablePrefs = storage.getTablePrefs();
    const sortDir = view.viewMode === 'table' ? tablePrefs.sortDir : 'asc';
    const tasks = manager.getVisibleTasks(filter, view.sortMode, today, sortDir);

    const bulkControls = h('div', { style: 'display:flex; gap:8px; flex-wrap:wrap; align-items:center;' }, [
      manager.canUndo() ? h('button', {
        type: 'button',
        class: 'btn btn-small',
        title: 'Скасувати останню дію (Ctrl+Z)',
        text: '↩️ Undo',
        onclick: performUndo
      }) : null,
      manager.canRedo() ? h('button', {
        type: 'button',
        class: 'btn btn-small',
        title: 'Повторити скасовану дію (Ctrl+Y)',
        text: '↪️ Redo',
        onclick: performRedo
      }) : null,
      h('button', {
        type: 'button',
        class: 'btn btn-small',
        title: 'Завантажити 9 демонстраційних завдань Redstone 5 із реальними HD фото',
        text: '📸 Демо RS5 (9 HD фото)',
        onclick: () => {
          const res = manager.loadSampleTasks(false);
          if (res.ok) SP.DOM.fireConfetti(1800);
          applyChange(res, 'Завантажено 9 завдань v2.1.7 RS5 із реальними HD фото! 📸');
        }
      }),
      h('button', {
        type: 'button',
        class: 'btn btn-small',
        title: 'Випадково обрати актуальне завдання для фокусу',
        text: '🎲 З чого почати?',
        onclick: () => pickRandomActiveTask(tasks)
      }),
      h('button', {
        type: 'button',
        class: 'btn btn-small',
        text: '✅ Виконати показані',
        onclick: () => {
          const ids = tasks.filter((t) => t.status !== 'DONE').map((t) => t.id);
          if (ids.length === 0) {
            toast('Усі показані завдання вже виконані', false);
            return;
          }
          const res = manager.completeAllTasks(ids);
          if (res.ok) SP.DOM.fireConfetti(2200);
          applyChange(res, 'Виконано завдань: ' + ids.length + ' 🎉');
        }
      }),
      h('button', {
        type: 'button',
        class: 'btn btn-small',
        text: '🧹 Очистити виконані',
        onclick: () => {
          const res = manager.clearCompletedTasks();
          if (res.ok && res.removed === 0) {
            toast('Немає завершених завдань для очищення', false);
            return;
          }
          applyChange(res, 'Очищено виконаних завдань: ' + (res.removed || 0));
        }
      }),
      viewSwitcher
    ]);

    const summaryBar = h('div', { class: 'summary-bar' }, [
      h('p', { class: 'summary', id: 'summary', text: 'Показано ' + tasks.length + ' із ' + total + ' завдань' }),
      bulkControls
    ]);

    if (tasks.length === 0 && view.viewMode !== 'calendar' && view.viewMode !== 'table') {
      box.appendChild(fragment([
        summaryBar,
        h('div', { class: 'panel empty', id: 'nothing-found' }, [
          h('img', { src: 'img/not-found.svg', alt: 'Нічого не знайдено', class: 'empty-illustration' }),
          h('h2', { text: 'За вказаними фільтрами завдань не знайдено' }),
          h('p', { text: 'Спробуйте змінити пошуковий запит або скинути активні фільтри.' }),
          h('button', {
            type: 'button', class: 'btn btn-primary', text: '🔄 Скинути фільтри',
            onclick: () => { filter.reset(); view.sortMode = 'BY_DATE'; refreshWorkspaceInPlace(); }
          })
        ])
      ]));
      return;
    }

    let viewNode;
    if (view.viewMode === 'cards') {
      const grid = h('div', { class: 'tasks-cards-grid' });
      grid.appendChild(fragment(tasks.map((t, idx) => buildCard(t, today, idx))));
      viewNode = grid;
    } else if (view.viewMode === 'kanban') {
      viewNode = buildKanbanBoard(tasks, today);
    } else if (view.viewMode === 'calendar') {
      viewNode = buildCalendarView(tasks, today);
    } else {
      viewNode = SP.SmartTable.build({
        tasks: tasks,
        today: today,
        manager: manager,
        storage: storage,
        filter: filter,
        view: view,
        applyChange: applyChange,
        doDelete: doDelete,
        renderResults: renderResults,
        onFilterMutate: refreshWorkspaceInPlace,
        performUndo: performUndo
      });
    }

    box.appendChild(fragment([summaryBar, viewNode]));
  }

  /* ---------- Режими Карток, Канбану та Календаря ---------- */
  function buildCard(t, today, idx) {
    const overdue = t.isOverdue(today);
    const isDone = t.status === 'DONE';
    const cardChildren = [];

    if (t.imageUrl) {
      cardChildren.push(h('img', {
        src: t.imageUrl,
        alt: t.title,
        class: 'task-card-cover',
        loading: 'lazy',
        title: 'Натисніть для збільшення зображення',
        onclick: () => SP.DOM.showLightbox(t.imageUrl, t.title)
      }));
    }

    const dateRow = h('div', { style: 'display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:0.83rem; color:var(--muted);' }, [
      h('span', { text: '📅 ' + SP.Validator.formatDate(t.dueDate) }),
      SP.DOM.dueRelativeBadge(t, today),
      SP.DOM.subtaskBadge(t)
    ]);

    const tagsRow = (t.tags && t.tags.length > 0)
      ? h('div', { class: 'task-tags-row' }, t.tags.map((tg) =>
          h('span', {
            class: 'tag-chip',
            text: '#' + tg,
            onclick: () => { filter.tag = tg; refreshWorkspaceInPlace(); }
          })
        ))
      : null;

    cardChildren.push(h('div', { class: 'task-card-body' }, [
      h('div', { class: 'task-card-top' }, [
        h('span', { class: 'task-card-subject', text: t.subject }),
        badge('badge-' + t.priority, PRIORITY[t.priority].label)
      ]),
      h('h3', { class: 'task-card-title' }, [
        h('a', { href: '#/task/' + t.id, text: t.title })
      ]),
      t.description ? h('p', { class: 'task-card-desc', text: t.description }) : null,
      tagsRow,
      dateRow
    ]));

    const quickBtn = h('button', {
      type: 'button',
      class: 'btn btn-small ' + (isDone ? '' : 'btn-primary'),
      text: isDone ? '↩️ В план' : '✅ Виконати',
      onclick: () => {
        const nextStatus = isDone ? 'PLANNED' : 'DONE';
        const res = manager.changeStatus(t.id, nextStatus);
        if (res.ok && !isDone) SP.DOM.fireConfetti(1600);
        applyChange(res, isDone ? 'Повернуто в план' : 'Завдання виконано! 🎉');
      }
    });

    cardChildren.push(h('div', { class: 'task-card-footer' }, [
      quickBtn,
      h('div', { class: 'actions', style: 'display:flex; gap:6px;' }, [
        h('button', {
          type: 'button', class: 'btn btn-small', title: 'Взяти у Фокус-таймер Pomodoro', text: '🎯',
          onclick: () => { if (SP.FocusHub) SP.FocusHub.setFocusTask(t); }
        }),
        h('button', {
          type: 'button', class: 'btn btn-small', title: 'Дублювати завдання', text: '📋',
          onclick: () => applyChange(manager.duplicateTask(t.id), 'Створено копію завдання')
        }),
        h('a', { class: 'btn btn-small', href: '#/edit/' + t.id, title: 'Редагувати', text: '✏️' }),
        h('button', {
          type: 'button', class: 'btn btn-small btn-danger', title: 'Видалити', text: '🗑️',
          onclick: () => doDelete(t, false)
        })
      ])
    ]));

    return h('article', {
      class: 'task-card ' + (overdue ? 'is-overdue ' : '') + (isDone ? 'is-done' : ''),
      style: '--stagger:' + Math.min(idx || 0, 10) + ';',
      'data-task-id': t.id
    }, cardChildren);
  }

  function buildKanbanBoard(tasks, today) {
    const columns = [
      { status: 'PLANNED', title: '🗓️ Заплановано', badgeCls: 'badge-PLANNED' },
      { status: 'IN_PROGRESS', title: '⏳ У роботі', badgeCls: 'badge-IN_PROGRESS' },
      { status: 'DONE', title: '✅ Виконано', badgeCls: 'badge-DONE' }
    ];

    return h('div', { class: 'kanban-board' }, columns.map((col) => {
      const colTasks = tasks.filter((t) => t.status === col.status);
      const listContainer = h('div', { style: 'display:flex; flex-direction:column; gap:10px; flex:1;' });

      if (colTasks.length === 0) {
        listContainer.appendChild(h('p', {
          style: 'color:var(--muted); font-size:0.84rem; text-align:center; margin:24px 0;',
          text: 'Перетягніть сюди картку завдання'
        }));
      } else {
        listContainer.appendChild(fragment(colTasks.map((t) => {
          const overdue = t.isOverdue(today);
          const isDone = t.status === 'DONE';
          const moveBtns = [];
          if (t.status !== 'PLANNED') {
            moveBtns.push(h('button', {
              type: 'button', class: 'btn btn-small', text: '← В план',
              onclick: () => applyChange(manager.changeStatus(t.id, 'PLANNED'), 'Переміщено в Заплановані')
            }));
          }
          if (t.status !== 'IN_PROGRESS') {
            moveBtns.push(h('button', {
              type: 'button', class: 'btn btn-small', text: '⏳ В роботу',
              onclick: () => applyChange(manager.changeStatus(t.id, 'IN_PROGRESS'), 'Переміщено в Роботу')
            }));
          }
          if (t.status !== 'DONE') {
            moveBtns.push(h('button', {
              type: 'button', class: 'btn btn-small btn-primary', text: '✅ Готово',
              onclick: () => {
                const res = manager.changeStatus(t.id, 'DONE');
                if (res.ok) SP.DOM.fireConfetti(1600);
                applyChange(res, 'Завдання виконано! 🎉');
              }
            }));
          }

          const cardEl = h('article', {
            class: 'kanban-item ' + (overdue ? 'is-overdue ' : '') + (isDone ? 'is-done' : ''),
            'data-task-id': t.id,
            draggable: 'true'
          }, [
            t.imageUrl ? h('img', {
              src: t.imageUrl,
              alt: t.title,
              loading: 'lazy',
              style: 'width:100%; height:105px; object-fit:cover; border-radius:7px; margin-bottom:4px; cursor:zoom-in;',
              onclick: () => SP.DOM.showLightbox(t.imageUrl, t.title)
            }) : null,
            h('div', { style: 'display:flex; justify-content:space-between; gap:6px; align-items:center; flex-wrap:wrap;' }, [
              h('span', { class: 'task-card-subject', text: t.subject }),
              badge('badge-' + t.priority, PRIORITY[t.priority].label)
            ]),
            h('a', {
              href: '#/task/' + t.id,
              style: 'font-weight:700; display:block; color:var(--text); text-decoration:none;',
              text: t.title
            }),
            h('div', { style: 'display:flex; gap:6px; align-items:center; flex-wrap:wrap; font-size:0.79rem; color:var(--muted);' }, [
              doc.createTextNode('📅 ' + SP.Validator.formatDate(t.dueDate)),
              SP.DOM.dueRelativeBadge(t, today),
              SP.DOM.subtaskBadge(t)
            ]),
            h('div', { style: 'display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;' }, moveBtns)
          ]);

          cardEl.addEventListener('dragstart', (ev) => {
            cardEl.classList.add('dragging');
            if (ev.dataTransfer) {
              ev.dataTransfer.effectAllowed = 'move';
              ev.dataTransfer.setData('text/plain', t.id);
            }
          });
          cardEl.addEventListener('dragend', () => cardEl.classList.remove('dragging'));
          return cardEl;
        })));
      }

      const colEl = h('div', { class: 'kanban-column', 'data-col-status': col.status }, [
        h('div', { class: 'kanban-column-header' }, [
          h('strong', { text: col.title }),
          badge(col.badgeCls, String(colTasks.length))
        ]),
        listContainer
      ]);

      colEl.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        colEl.classList.add('drag-over');
      });
      colEl.addEventListener('dragleave', () => colEl.classList.remove('drag-over'));
      colEl.addEventListener('drop', (ev) => {
        ev.preventDefault();
        colEl.classList.remove('drag-over');
        const draggedId = ev.dataTransfer ? ev.dataTransfer.getData('text/plain') : '';
        if (!draggedId) return;
        const draggedTask = manager.getTask(draggedId);
        if (!draggedTask || draggedTask.status === col.status) return;
        const res = manager.changeStatus(draggedId, col.status);
        if (res.ok && col.status === 'DONE') SP.DOM.fireConfetti(1700);
        applyChange(res, 'Переміщено у колонку «' + STATUS[col.status].label + '»');
      });

      return colEl;
    }));
  }

  function buildCalendarView(tasks, today) {
    const monthNames = [
      'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
      'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
    ];
    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

    const y = view.calYear;
    const m = view.calMonth;
    const firstDay = new Date(y, m, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const byIso = {};
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (!byIso[t.dueDate]) byIso[t.dueDate] = [];
      byIso[t.dueDate].push(t);
    }

    const cells = [];
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      const cellDate = new Date(y, m, 1 - startOffset + i);
      const iso = SP.todayISO(cellDate);
      const inCurrentMonth = cellDate.getMonth() === m;
      const isToday = iso === today;
      const dayTasks = byIso[iso] || [];

      const pills = dayTasks.slice(0, 4).map((t) =>
        h('a', {
          href: '#/task/' + t.id,
          class: 'cal-task-pill prio-' + t.priority + (t.status === 'DONE' ? ' is-done' : ''),
          title: t.title + ' (' + t.subject + ')',
          text: (t.status === 'DONE' ? '✓ ' : '') + t.title
        })
      );
      if (dayTasks.length > 4) {
        pills.push(h('span', { style: 'font-size:0.7rem; color:var(--muted); font-weight:700;', text: '+ ще ' + (dayTasks.length - 4) }));
      }

      cells.push(h('div', {
        class: 'calendar-cell' + (!inCurrentMonth ? ' is-other-month' : '') + (isToday ? ' is-today' : '')
      }, [
        h('div', { class: 'calendar-day-top' }, [
          h('span', { text: String(cellDate.getDate()) + (isToday ? ' • Сьогодні' : '') }),
          h('button', {
            type: 'button',
            class: 'calendar-add-mini',
            title: 'Додати завдання на ' + SP.Validator.formatDate(iso),
            text: '+',
            onclick: () => { global.location.hash = '#/new?date=' + iso; }
          })
        ]),
        h('div', { style: 'display:flex; flex-direction:column; gap:3px;' }, pills)
      ]));
    }

    const gridEl = h('div', { class: 'calendar-grid' });
    gridEl.appendChild(fragment(cells));

    return h('div', { class: 'calendar-panel' }, [
      h('div', { class: 'calendar-header' }, [
        h('h3', { class: 'calendar-month-title', text: '📅 ' + monthNames[m] + ' ' + y }),
        h('div', { style: 'display:flex; gap:8px; flex-wrap:wrap;' }, [
          h('button', {
            type: 'button', class: 'btn btn-small', text: '◀ Попередній',
            onclick: () => {
              view.calMonth--;
              if (view.calMonth < 0) { view.calMonth = 11; view.calYear--; }
              renderResults();
            }
          }),
          h('button', {
            type: 'button', class: 'btn btn-small btn-primary', text: 'Сьогодні',
            onclick: () => {
              const d = new Date();
              view.calYear = d.getFullYear();
              view.calMonth = d.getMonth();
              renderResults();
            }
          }),
          h('button', {
            type: 'button', class: 'btn btn-small', text: 'Наступний ▶',
            onclick: () => {
              view.calMonth++;
              if (view.calMonth > 11) { view.calMonth = 0; view.calYear++; }
              renderResults();
            }
          }),
          h('button', {
            type: 'button', class: 'btn btn-small', text: '📥 Експорт .ICS',
            onclick: exportICS
          })
        ])
      ]),
      h('div', { class: 'calendar-weekdays' }, weekDays.map((wd) => h('div', { text: wd }))),
      gridEl
    ]);
  }

  /* ---------- Огляд проєкту v2.1.7 (build 217) Redstone 5 + Таблиця еволюції ---------- */
  function buildArticleSection(isStandalonePage) {
    return h('article', { class: 'article-section', 'aria-label': 'Стаття про проєкт StudyPlanner v2.1.7 Redstone 5' }, [
      h('div', { class: 'article-hero-banner' }, [
        h('div', {}, [
          h('span', { class: 'badge-version', style: 'margin-bottom:10px;', text: '📖 ОФІЦІЙНИЙ ОГЛЯД РЕЛІЗУ • v2.1.7 (build 217) Redstone 5' }),
          h('h2', { style: 'font-size:1.54rem; margin:6px 0 12px;', text: 'StudyPlanner v2.1.7 Redstone 5: Розумна Таблиця нового покоління, Журнал ECTS та Прискорення' }),
          h('p', { style: 'color:var(--text-secondary); margin:0 0 12px; line-height:1.6;', text: 'У релізі StudyPlanner v2.1.7 (build 217) Redstone 5 під авторством Максима Ковалишина повністю перероблено та модернізовано табличну підсистему (SP.SmartTable): тепер додавати нові завдання, редагувати назву, предмет і дату подвійним кліком, розгортати підзавдання, змінювати статуси й виконувати масові дії можна прямо всередині красивої таблиці без жодних лагів.' }),
          h('p', { style: 'color:var(--text-secondary); margin:0; line-height:1.6;', text: 'Додано інтерактивний Журнал оцінок та Калькулятор стипендії ECTS / GPA 4.0 (#/grades), прив’язку фокус-завдання до таймера Pomodoro, двостороннє скасування та повтор дій Undo / Redo (Ctrl+Z / Ctrl+Y) і делегування подій для миттєвого рендерингу.' })
        ]),
        h('div', { style: 'display:flex; flex-direction:column; gap:8px;' }, [
          h('img', {
            src: 'img/web/hero-rs3.jpg',
            alt: 'Робочий простір студента StudyPlanner v2.1.7 Redstone 5',
            class: 'article-hero-img',
            loading: 'lazy',
            style: 'cursor:zoom-in;',
            onclick: () => SP.DOM.showLightbox('img/web/hero-rs3.jpg', 'StudyPlanner v2.1.7 (build 217) Redstone 5')
          }),
          h('button', {
            type: 'button',
            class: 'btn btn-small',
            text: '📐 Переглянути векторну схему архітектури',
            onclick: () => SP.DOM.showLightbox('img/project-hero.svg', 'Архітектура StudyPlanner v2.1.7 RS5')
          })
        ])
      ]),

      h('div', { class: 'article-grid' }, [
        h('div', { class: 'article-card' }, [
          h('h3', { text: '📋 Розумна Таблиця SmartGrid RS5' }),
          h('p', { text: 'Швидке додавання рядків, inline-редагування комірок, 3 способи зміни статусу, розгортання етапів, групування, сортування ▲/▼ і копіювання Markdown.' })
        ]),
        h('div', { class: 'article-card' }, [
          h('h3', { text: '🎓 Журнал оцінок та Калькулятор ECTS' }),
          h('p', { text: 'Інтерактивна таблиця семестрових дисциплін із автоматичним розрахунком зваженого бала (0–100), шкали ECTS (A–F), GPA 4.0 і прогнозом стипендії.' })
        ]),
        h('div', { class: 'article-card' }, [
          h('h3', { text: '⚡ Делегування подій & Undo / Redo' }),
          h('p', { text: 'Єдиний обробник подій на tbody замість сотень замикань, оновлення без стрибків прокрутки та 15-рівневий стек Undo / Redo (Ctrl+Z / Ctrl+Y).' })
        ]),
        h('div', { class: 'article-card' }, [
          h('h3', { text: '🎨 16 Тем, 30 HD шпалер & Фокус-ціль' }),
          h('p', { text: 'Вітальний екран Welcome Splash, 16 кольорових і фото-тем без GPU overdraw та кнопка 🎯 прив’язки завдання до Фокус-таймера Pomodoro.' })
        ])
      ]),

      isStandalonePage ? h('div', { class: 'smart-table-shell', style: 'margin-bottom:20px;' }, [
        h('div', { class: 'smart-table-toolbar' }, [
          h('span', { class: 'smart-table-badge', text: '📈 Еволюція платформи' }),
          h('strong', { style: 'font-size:0.92rem;', text: 'Порівняльна таблиця можливостей релізу v2.1.7 (build 217) Redstone 5' })
        ]),
        h('div', { class: 'smart-table-scroll' }, [
          h('table', { class: 'smart-table is-zebra density-compact' }, [
            h('thead', {}, [
              h('tr', {}, [
                h('th', { scope: 'col', text: 'Підсистема' }),
                h('th', { scope: 'col', text: 'Попередні версії' }),
                h('th', { scope: 'col', text: 'v2.1.7 (build 217) Redstone 5' })
              ])
            ]),
            h('tbody', {}, [
              h('tr', { class: 'smart-row' }, [
                h('td', { 'data-label': 'Підсистема' }, [h('strong', { text: '📋 Таблиця завдань' })]),
                h('td', { 'data-label': 'Раніше', text: 'Базовий перегляд без швидкого додавання, статичні заголовки, flex-баг на <td>' }),
                h('td', { 'data-label': 'Redstone 5' }, [badge('badge-DONE', 'SmartGrid RS5: Quick-Add, Inline-Edit, Групи, Пакетні дії, MD/CSV')])
              ]),
              h('tr', { class: 'smart-row' }, [
                h('td', { 'data-label': 'Підсистема' }, [h('strong', { text: '🎓 Академічний облік' })]),
                h('td', { 'data-label': 'Раніше', text: 'Лише перелік завдань та флеш-картки' }),
                h('td', { 'data-label': 'Redstone 5' }, [badge('badge-DONE', 'Інтерактивний Журнал оцінок ECTS + GPA 4.0 + Стипендія')])
              ]),
              h('tr', { class: 'smart-row' }, [
                h('td', { 'data-label': 'Підсистема' }, [h('strong', { text: '↩️ Безпека змін' })]),
                h('td', { 'data-label': 'Раніше', text: 'Однобічний Undo, скидання скролу при видаленні' }),
                h('td', { 'data-label': 'Redstone 5' }, [badge('badge-IN_PROGRESS', 'Двосторонній Undo/Redo (15 кроків) + In-place рендеринг')])
              ]),
              h('tr', { class: 'smart-row' }, [
                h('td', { 'data-label': 'Підсистема' }, [h('strong', { text: '🎯 Таймер Pomodoro' })]),
                h('td', { 'data-label': 'Раніше', text: 'Автономний таймер без прив’язки до завдання' }),
                h('td', { 'data-label': 'Redstone 5' }, [badge('badge-IN_PROGRESS', 'Кнопка 🎯 Фокус-ціль у рядку таблиці зі швидким завершенням')])
              ])
            ])
          ])
        ])
      ]) : null,

      h('div', { class: 'author-spotlight-card' }, [
        h('div', { style: 'display:flex; align-items:center; gap:16px;' }, [
          h('div', { class: 'author-avatar-badge', text: 'МК' }),
          h('div', {}, [
            h('div', { style: 'font-size:0.8rem; font-weight:800; text-transform:uppercase; color:var(--primary);', text: 'Автор та архітектор проєкту' }),
            h('h3', { style: 'margin:2px 0 4px; font-size:1.25rem;', text: 'Максим Ковалишин' }),
            h('p', { style: 'margin:0; font-size:0.88rem; color:var(--text-secondary);', text: '© 2026, StudyPlanner v2.1.7 (build 217) Redstone 5. Автор: Максим Ковалишин. Всі права захищені, вміст захищений під авторським правом.' })
          ])
        ]),
        h('div', { style: 'display:flex; gap:10px; flex-wrap:wrap;' }, [
          !isStandalonePage
            ? h('a', { class: 'btn btn-primary', href: '#/article', text: '📖 Відкрити повну статтю' })
            : h('a', { class: 'btn btn-primary', href: '#/', text: '📋 Перейти до завдань' })
        ])
      ])
    ]);
  }

  /* ---------- Форма створення / редагування завдання ---------- */
  function renderForm(id, presetIsoDate) {
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

    main.appendChild(h('h1', { text: editing ? '✏️ Редагування завдання' : '➕ Створення нового завдання v2.1.7 RS5' }));

    const initialDateDisplay = task
      ? SP.Validator.formatDate(task.dueDate)
      : (presetIsoDate ? SP.Validator.formatDate(presetIsoDate) : '');

    const fields = {
      title: h('input', { type: 'text', id: 'title', name: 'title', value: task ? task.title : '', autocomplete: 'off', 'aria-required': 'true', placeholder: 'Наприклад: Підготувати захист курсової роботи...' }),
      subject: h('input', { type: 'text', id: 'subject', name: 'subject', value: task ? task.subject : '', autocomplete: 'off', 'aria-required': 'true', list: 'subject-list', placeholder: 'Оберіть або введіть назву дисципліни...' }),
      dueDate: h('input', { type: 'text', id: 'dueDate', name: 'dueDate', value: initialDateDisplay, placeholder: 'ДД.ММ.РРРР, наприклад 30.10.2026', inputmode: 'numeric', autocomplete: 'off', 'aria-required': 'true' }),
      priority: h('select', { id: 'priority', name: 'priority' }, SP.DOM.optionList(PRIORITY, task ? task.priority : 'MEDIUM')),
      status: h('select', { id: 'status', name: 'status' }, SP.DOM.optionList(STATUS, task ? task.status : 'PLANNED')),
      tags: h('input', { type: 'text', id: 'tags', name: 'tags', value: task && task.tags ? task.tags.join(', ') : '', placeholder: 'Теги через кому: Іспит, Лабораторна, Проєкт...' }),
      description: h('textarea', { id: 'description', name: 'description', placeholder: 'Вкажіть деталі завдання, літературу, формули або питання до викладача...' }),
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

    const now = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const fmtUa = (d) => p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
    const addD = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return fmtUa(d); };

    const dateShortcuts = h('div', { class: 'date-shortcuts' }, [
      h('button', { type: 'button', class: 'date-pill', text: 'Сьогодні', onclick: () => { fields.dueDate.value = fmtUa(now); } }),
      h('button', { type: 'button', class: 'date-pill', text: 'Завтра', onclick: () => { fields.dueDate.value = addD(1); } }),
      h('button', { type: 'button', class: 'date-pill', text: 'Через 3 дні', onclick: () => { fields.dueDate.value = addD(3); } }),
      h('button', { type: 'button', class: 'date-pill', text: 'Через тиждень', onclick: () => { fields.dueDate.value = addD(7); } }),
      h('button', { type: 'button', class: 'date-pill', text: 'Через 2 тижні', onclick: () => { fields.dueDate.value = addD(14); } })
    ]);

    const quickTags = ['Іспит', 'Лабораторна', 'Курсова', 'Семінар', 'Колоквіум', 'Терміново'];
    const tagShortcuts = h('div', { class: 'date-shortcuts' }, quickTags.map((qt) =>
      h('button', {
        type: 'button',
        class: 'date-pill',
        text: '+ #' + qt,
        onclick: () => {
          const cur = fields.tags.value.trim();
          if (cur.toLocaleLowerCase('uk-UA').indexOf(qt.toLocaleLowerCase('uk-UA')) === -1) {
            fields.tags.value = cur ? cur + ', ' + qt : qt;
          }
        }
      })
    ));

    let draftSubtasks = task && Array.isArray(task.subtasks)
      ? task.subtasks.map((s) => ({ id: s.id, text: s.text, done: Boolean(s.done) }))
      : [];

    const draftSubListEl = h('div', { class: 'subtask-list' });
    const newSubInput = h('input', { type: 'text', placeholder: 'Додати етап (напр. «Оформити список джерел»)...' });

    function renderDraftSubtasks() {
      draftSubListEl.textContent = '';
      if (draftSubtasks.length === 0) {
        draftSubListEl.appendChild(h('p', { style: 'margin:0; font-size:0.84rem; color:var(--muted);', text: 'Етапів ще не додано. Додайте кроки для зручного контролю прогресу!' }));
        return;
      }
      draftSubListEl.appendChild(fragment(draftSubtasks.map((st, idx) => {
        const cb = h('input', { type: 'checkbox', checked: st.done });
        cb.addEventListener('change', () => {
          st.done = cb.checked;
          renderDraftSubtasks();
        });
        return h('div', { class: 'subtask-row' + (st.done ? ' done' : '') }, [
          h('label', {}, [cb, h('span', { text: st.text })]),
          h('button', {
            type: 'button',
            class: 'btn btn-small btn-danger',
            text: '✕',
            onclick: () => {
              draftSubtasks.splice(idx, 1);
              renderDraftSubtasks();
            }
          })
        ]);
      })));
    }
    renderDraftSubtasks();

    function pushDraftSubtask() {
      const txt = newSubInput.value.trim();
      if (!txt) return;
      if (draftSubtasks.length >= 25) { toast('Максимум 25 етапів', true); return; }
      draftSubtasks.push({ id: 'st-' + Date.now().toString(36) + '-' + draftSubtasks.length, text: txt.slice(0, 160), done: false });
      newSubInput.value = '';
      renderDraftSubtasks();
    }
    newSubInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); pushDraftSubtask(); }
    });

    const subtasksFieldBox = h('div', { class: 'subtasks-box' }, [
      h('strong', { style: 'display:block; margin-bottom:6px;', text: '☑️ Чек-лист підзавдань (Етапи виконання)' }),
      draftSubListEl,
      h('div', { class: 'subtask-add-row' }, [
        newSubInput,
        h('button', { type: 'button', class: 'btn btn-small btn-primary', text: '➕ Додати крок', onclick: pushDraftSubtask })
      ])
    ]);

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

    const fileInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml', style: 'display:none;' });
    const urlInput = h('input', {
      type: 'text',
      placeholder: 'Або вставте пряме посилання на зображення з Інтернету (URL)...',
      value: currentImage.indexOf('data:') === 0 ? '' : currentImage,
      style: 'margin-top:8px;'
    });

    function applyChosenImg(src) {
      currentImage = src;
      fields.imageUrl.value = src;
      if (src.indexOf('data:') !== 0) urlInput.value = src;
      imagePreview.src = src;
      imagePreview.style.display = 'block';
      removeImgBtn.style.display = 'inline-block';
    }

    urlInput.addEventListener('input', () => {
      const val = urlInput.value.trim();
      if (val) applyChosenImg(val);
    });

    function setFromFile(file) {
      if (!file) return;
      if (file.size > 2.5 * 1024 * 1024) {
        toast('Розмір файлу перевищує 2.5 МБ', true);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        applyChosenImg(ev.target.result);
        toast('Зображення прикріплено! 🖼️', false);
      };
      reader.readAsDataURL(file);
    }

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) setFromFile(fileInput.files[0]);
    });

    const webPhotos = [
      { label: '📸 Математика', path: 'img/web/photo-math.jpg' },
      { label: '📸 Фізика', path: 'img/web/photo-physics.jpg' },
      { label: '📸 Код / ІТ', path: 'img/web/photo-code.jpg' },
      { label: '📸 Хімія', path: 'img/web/photo-chemistry.jpg' },
      { label: '📸 Біологія', path: 'img/web/photo-biology.jpg' },
      { label: '📸 Географія', path: 'img/web/photo-geography.jpg' },
      { label: '📸 Література', path: 'img/web/photo-literature.jpg' },
      { label: '📸 Астрономія', path: 'img/web/photo-astronomy.jpg' },
      { label: '📸 Дизайн / Арт', path: 'img/web/photo-art.jpg' }
    ];

    const svgSchemas = [
      { label: '📐 Схема Матем.', path: 'img/sample-math.svg' },
      { label: '⚡ Схема Фізика', path: 'img/sample-physics.svg' },
      { label: '💻 Схема Код', path: 'img/sample-code.svg' },
      { label: '🧪 Схема Хімія', path: 'img/sample-chemistry.svg' },
      { label: '🧬 Схема ДНК', path: 'img/sample-biology.svg' },
      { label: '🌍 Схема Карта', path: 'img/sample-geography.svg' },
      { label: '📖 Схема Літ.', path: 'img/sample-literature.svg' }
    ];

    const dropZone = h('div', { class: 'image-upload-box' }, [
      h('p', { style: 'margin:0 0 8px; font-weight:700;', text: '🖼️ Додайте фотографію з Інтернету, власний файл або навчальну схему' }),
      h('div', { style: 'display:flex; gap:8px; justify-content:center; flex-wrap:wrap;' }, [
        h('button', { type: 'button', class: 'btn btn-small btn-primary', text: '📁 Обрати файл із пристрою', onclick: () => fileInput.click() }),
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          text: '🌐 Випадкове навчальне фото з Інтернету',
          onclick: () => {
            const seed = Math.floor(Math.random() * 8000) + 100;
            applyChosenImg('https://picsum.photos/seed/study' + seed + '/900/560');
            toast('Підтягнуто випадкове зображення з Інтернету!', false);
          }
        })
      ]),
      fileInput,
      urlInput,
      h('div', { class: 'sample-images-bar' }, [
        h('span', { class: 'sample-images-label', text: 'HD Фото предметів:' })
      ].concat(webPhotos.map((s) => h('button', {
        type: 'button', class: 'sample-img-pill', text: s.label,
        onclick: () => applyChosenImg(s.path)
      })))),
      h('div', { class: 'sample-images-bar' }, [
        h('span', { class: 'sample-images-label', text: 'Векторні креслення:' })
      ].concat(svgSchemas.map((s) => h('button', {
        type: 'button', class: 'sample-img-pill', text: s.label,
        onclick: () => applyChosenImg(s.path)
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
      h('label', { text: 'Ілюстрація / Фотографія / Креслення' }),
      fields.imageUrl,
      dropZone
    ]);

    function showErrors(errors) {
      let first = null;
      ['title', 'subject', 'dueDate', 'priority', 'status', 'description'].forEach((k) => {
        if (!fields[k]) return;
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

    const form = h('form', { class: 'panel form-grid', id: 'task-form', novalidate: true }, [
      field('title', 'Назва завдання', 'До 100 символів', true),
      field('subject', 'Предмет / Дисципліна', 'До 80 символів', true),
      field('dueDate', 'Дата виконання (дедлайн)', 'Формат ДД.ММ.РРРР', true, dateShortcuts),
      h('div', { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px;' }, [
        field('priority', 'Пріоритет', '', false),
        field('status', 'Статус виконання', '', false)
      ]),
      field('tags', 'Теги / Категорії', 'До 8 тегів через кому', false, tagShortcuts),
      field('description', 'Детальний опис', 'До 1500 символів', false),
      subtasksFieldBox,
      imageFieldBox,
      formError,
      h('div', { class: 'form-actions' }, [
        h('button', { type: 'submit', class: 'btn btn-primary', id: 'save-btn', text: editing ? '💾 Зберегти зміни' : '➕ Створити завдання' }),
        h('a', { class: 'btn', id: 'cancel-btn', href: editing ? '#/task/' + id : '#/', text: 'Скасувати' })
      ])
    ]);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (newSubInput.value.trim()) pushDraftSubtask();

      formError.textContent = '';
      const data = {
        title: fields.title.value,
        subject: fields.subject.value,
        dueDate: fields.dueDate.value,
        priority: fields.priority.value,
        status: fields.status.value,
        tags: fields.tags.value,
        description: fields.description.value,
        imageUrl: fields.imageUrl.value,
        subtasks: draftSubtasks
      };
      const res = editing ? manager.updateTask(id, data) : manager.createTask(data);
      if (res.ok) {
        showErrors({});
        if (data.status === 'DONE' && (!task || task.status !== 'DONE')) SP.DOM.fireConfetti(1600);
        toast(editing ? 'Зміни успішно збережено' : 'Завдання додано до плану! 🎉', false, {
          actionLabel: '↩️ Скасувати',
          onAction: performUndo
        });
        global.location.hash = editing ? '#/task/' + id : '#/';
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

    main.appendChild(fragment([form, datalist]));
    fields.title.focus({ preventScroll: true });
  }

  /* ---------- Деталі завдання з живим чек-листом підзавдань ---------- */
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
    const dateDd = h('dd', {}, [h('span', { text: SP.Validator.formatDate(t.dueDate) })]);
    const rel = SP.DOM.dueRelativeBadge(t, today);
    if (rel) {
      dateDd.appendChild(doc.createTextNode(' '));
      dateDd.appendChild(rel);
    }
    const fmt = (iso) => new Date(iso).toLocaleString('uk-UA');

    main.appendChild(h('div', { style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;' }, [
      h('h1', { id: 'detail-title', style: 'margin:0;', text: t.title })
    ]));

    const tagsDd = (t.tags && t.tags.length > 0)
      ? h('dd', {}, [h('div', { class: 'task-tags-row' }, t.tags.map((tg) => h('span', { class: 'tag-chip', text: '#' + tg })))])
      : h('dd', { text: '—' });

    const statusSelectDetail = h('select', { class: 'smart-pill-select status-' + t.status, style: 'max-width:200px;' }, SP.DOM.optionList(STATUS, t.status));
    statusSelectDetail.addEventListener('change', () => {
      const res = manager.changeStatus(t.id, statusSelectDetail.value);
      if (res.ok) {
        if (statusSelectDetail.value === 'DONE') SP.DOM.fireConfetti(1800);
        toast('Статус завдання оновлено!', false, { actionLabel: '↩️ Скасувати', onAction: performUndo });
        route();
      }
    });

    const detailPanel = h('div', { class: 'panel' }, [
      h('dl', { class: 'details' }, [
        h('dt', { text: 'Предмет' }), h('dd', { text: t.subject }),
        h('dt', { text: 'Дата виконання' }), dateDd,
        h('dt', { text: 'Пріоритет' }), h('dd', {}, [badge('badge-' + t.priority, PRIORITY[t.priority].label)]),
        h('dt', { text: 'Статус' }), h('dd', {}, [statusSelectDetail]),
        h('dt', { text: 'Теги' }), tagsDd,
        h('dt', { text: 'Опис' }), h('dd', { text: t.description || '—' }),
        h('dt', { text: 'Створено' }), h('dd', { text: fmt(t.createdAt) }),
        h('dt', { text: 'Оновлено' }), h('dd', { text: fmt(t.updatedAt) })
      ])
    ]);

    const sp = t.subtaskProgress();
    const quickSubInput = h('input', { type: 'text', placeholder: 'Додати новий крок чек-листа...' });
    const addStepHandler = () => {
      const res = manager.addSubtask(t.id, quickSubInput.value);
      if (res.ok) {
        toast('Етап додано!', false);
        route();
      } else {
        toast(res.error, true);
      }
    };
    quickSubInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); addStepHandler(); }
    });

    const subtasksSection = h('div', { class: 'subtasks-box' }, [
      h('div', { style: 'display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;' }, [
        h('strong', { text: '☑️ Етапи виконання (Чек-лист підзавдань)' }),
        sp.total > 0 ? badge(sp.done === sp.total ? 'badge-DONE' : 'badge-IN_PROGRESS', sp.done + ' із ' + sp.total + ' (' + sp.percent + '%)') : null
      ]),
      sp.total > 0 ? h('div', { class: 'progress-track', style: 'margin-bottom:10px; height:8px;' }, [
        h('div', { class: 'progress-fill', style: 'width:' + sp.percent + '%;' })
      ]) : null,
      h('div', { class: 'subtask-list' }, (t.subtasks || []).length === 0
        ? [h('p', { style: 'margin:0; font-size:0.86rem; color:var(--muted);', text: 'Ще немає підзавдань. Додайте перший етап нижче!' })]
        : t.subtasks.map((st) => {
            const cb = h('input', { type: 'checkbox', checked: st.done });
            cb.addEventListener('change', () => {
              const res = manager.toggleSubtask(t.id, st.id);
              if (res.ok) {
                const updatedSp = res.task.subtaskProgress();
                if (updatedSp.total > 0 && updatedSp.done === updatedSp.total) {
                  SP.DOM.fireConfetti(1500);
                  toast('Усі етапи чек-листа виконано! 🎉', false);
                }
                route();
              }
            });
            return h('div', { class: 'subtask-row' + (st.done ? ' done' : '') }, [
              h('label', {}, [cb, h('span', { text: st.text })]),
              h('button', {
                type: 'button',
                class: 'btn btn-small btn-danger',
                text: '✕',
                title: 'Видалити етап',
                onclick: () => {
                  manager.removeSubtask(t.id, st.id);
                  route();
                }
              })
            ]);
          })
      ),
      h('div', { class: 'subtask-add-row' }, [
        quickSubInput,
        h('button', { type: 'button', class: 'btn btn-small btn-primary', text: '➕ Додати етап', onclick: addStepHandler })
      ])
    ]);
    detailPanel.appendChild(subtasksSection);

    if (t.imageUrl) {
      detailPanel.appendChild(h('div', { class: 'detail-image-card' }, [
        h('strong', { style: 'display:block; margin-bottom:8px;', text: '🖼️ Прикріплене зображення / схема' }),
        h('img', {
          src: t.imageUrl,
          alt: 'Ілюстрація до завдання «' + t.title + '»',
          onclick: () => SP.DOM.showLightbox(t.imageUrl, t.title)
        }),
        h('div', { class: 'detail-image-caption' }, [
          doc.createTextNode('Натисніть на зображення для повноекранного перегляду'),
          h('div', { style: 'display:flex; gap:8px; flex-wrap:wrap;' }, [
            h('button', {
              type: 'button',
              class: 'btn btn-small',
              text: '🖼️ Зробити шпалерами сайту',
              onclick: () => SP.ThemeEngine.setCustomWallpaper(t.imageUrl, 'Зображення завдання встановлено на шпалери сайту! 🎨')
            }),
            h('button', { type: 'button', class: 'btn btn-small btn-primary', text: '🔍 Збільшити', onclick: () => SP.DOM.showLightbox(t.imageUrl, t.title) })
          ])
        ])
      ]));
    }

    const isDone = t.status === 'DONE';
    const quickToggleBtn = h('button', {
      type: 'button',
      class: 'btn ' + (isDone ? '' : 'btn-primary'),
      text: isDone ? '↩️ Повернути в роботу' : '✅ Позначити як виконано',
      onclick: () => {
        const next = isDone ? 'IN_PROGRESS' : 'DONE';
        const res = manager.changeStatus(t.id, next);
        if (res.ok) {
          if (!isDone) SP.DOM.fireConfetti(2000);
          toast(isDone ? 'Завдання повернуто в роботу' : 'Вітаємо! Завдання виконано! (+50 XP)', false, {
            actionLabel: '↩️ Скасувати',
            onAction: performUndo
          });
          route();
        } else {
          toast(res.error, true);
        }
      }
    });

    const duplicateBtn = h('button', {
      type: 'button',
      class: 'btn',
      text: '📋 Дублювати',
      onclick: () => {
        const res = manager.duplicateTask(t.id);
        if (res.ok) {
          toast('Створено копію завдання', false, { actionLabel: '↩️ Скасувати', onAction: performUndo });
          global.location.hash = '#/';
        } else {
          toast(res.error, true);
        }
      }
    });

    detailPanel.appendChild(h('div', { class: 'form-actions', style: 'margin-top:20px;' }, [
      quickToggleBtn,
      duplicateBtn,
      h('a', { class: 'btn', href: '#/edit/' + t.id, text: '✏️ Редагувати' }),
      h('button', { type: 'button', class: 'btn btn-danger', id: 'detail-delete', text: '🗑️ Видалити', onclick: () => doDelete(t, true) }),
      h('a', { class: 'btn', href: '#/', text: '📋 До списку' })
    ]));

    main.appendChild(detailPanel);
  }

  /* ---------- Модальні вікна, Мультиекспорт (JSON / CSV / MD / ICS) та Гарячі клавіші ---------- */
  function exportJSON() {
    SP.DOM.downloadFile(manager.exportJSON(), 'studyplanner-backup-v2.1.7-b217-rs5.json', 'application/json');
    toast('JSON-бекап v2.1.7 RS5 завантажено!', false);
  }
  function exportCSV() {
    SP.DOM.downloadFile(manager.exportCSV(), 'studyplanner-tasks-v2.1.7-rs5.csv', 'text/csv;charset=utf-8');
    toast('CSV-таблицю для Excel завантажено!', false);
  }
  function exportMD() {
    SP.DOM.downloadFile(manager.exportMarkdown(), 'studyplanner-plan-v2.1.7-rs5.md', 'text/markdown;charset=utf-8');
    toast('Markdown-звіт зі зведеною таблицею завантажено!', false);
  }
  function exportICS() {
    SP.DOM.downloadFile(manager.exportICS(), 'studyplanner-deadlines-v2.1.7-rs5.ics', 'text/calendar;charset=utf-8');
    toast('Календар дедлайнів .ICS завантажено!', false);
  }

  function initModalsAndShortcuts() {
    const lbClose = doc.getElementById('lightbox-close');
    const lbDlg = doc.getElementById('lightbox-dialog');
    if (lbClose && lbDlg) lbClose.addEventListener('click', () => lbDlg.close());

    const aboutDlg = doc.getElementById('about-dialog');
    const btnAbout = doc.getElementById('btn-about');
    const footerBtnAbout = doc.getElementById('footer-btn-about');
    const aboutClose = doc.getElementById('about-close');
    const aboutOk = doc.getElementById('about-ok');
    const btnReplaySplash = doc.getElementById('btn-replay-splash');
    const openAbout = () => { if (aboutDlg) aboutDlg.showModal(); };
    if (btnAbout) btnAbout.addEventListener('click', openAbout);
    if (footerBtnAbout) footerBtnAbout.addEventListener('click', openAbout);
    if (aboutClose && aboutDlg) aboutClose.addEventListener('click', () => aboutDlg.close());
    if (aboutOk && aboutDlg) aboutOk.addEventListener('click', () => aboutDlg.close());
    if (btnReplaySplash) {
      btnReplaySplash.addEventListener('click', () => {
        if (aboutDlg && aboutDlg.open) aboutDlg.close();
        if (SP.WelcomeSplash) SP.WelcomeSplash.replay();
      });
    }

    const backupDlg = doc.getElementById('backup-dialog');
    const btnBackup = doc.getElementById('btn-backup');
    const footerBtnBackup = doc.getElementById('footer-btn-backup');
    const backupClose = doc.getElementById('backup-close');
    const backupDone = doc.getElementById('backup-done');
    const btnExportJson = doc.getElementById('btn-export-download');
    const btnExportCsv = doc.getElementById('btn-export-csv');
    const btnExportMd = doc.getElementById('btn-export-md');
    const btnExportIcs = doc.getElementById('btn-export-ics');
    const btnImport = doc.getElementById('btn-import-run');
    const backupFileInput = doc.getElementById('backup-file-input');

    const openBackup = () => { if (backupDlg) backupDlg.showModal(); };
    if (btnBackup) btnBackup.addEventListener('click', openBackup);
    if (footerBtnBackup) footerBtnBackup.addEventListener('click', openBackup);
    if (backupClose && backupDlg) backupClose.addEventListener('click', () => backupDlg.close());
    if (backupDone && backupDlg) backupDone.addEventListener('click', () => backupDlg.close());

    if (btnExportJson) btnExportJson.addEventListener('click', exportJSON);
    if (btnExportCsv) btnExportCsv.addEventListener('click', exportCSV);
    if (btnExportMd) btnExportMd.addEventListener('click', exportMD);
    if (btnExportIcs) btnExportIcs.addEventListener('click', exportICS);

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
            SP.DOM.fireConfetti(1800);
            toast('Завдання успішно відновлено з резервної копії!', false, {
              actionLabel: '↩️ Скасувати',
              onAction: performUndo
            });
            backupDlg.close();
            route();
          } else {
            toast(res.error, true);
          }
        };
        reader.readAsText(file);
      });
    }

    global.addEventListener('keydown', (e) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(e.target.tagName) !== -1;

      if ((e.ctrlKey || e.metaKey) && !inInput) {
        const k = e.key.toLowerCase();
        if (!e.shiftKey && (k === 'z' || k === 'я')) {
          if (manager.canUndo()) {
            e.preventDefault();
            performUndo();
          }
          return;
        }
        if (k === 'y' || k === 'н' || (e.shiftKey && (k === 'z' || k === 'я'))) {
          if (manager.canRedo()) {
            e.preventDefault();
            performRedo();
          }
          return;
        }
      }

      if (inInput || e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === '?') {
        e.preventDefault();
        openAbout();
      } else if (e.key === 't' || e.key === 'T' || e.key === 'е' || e.key === 'Е') {
        e.preventDefault();
        SP.ThemeEngine.cycleNextTheme();
      } else if (e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц') {
        e.preventDefault();
        SP.ThemeEngine.cycleVisualMode();
      } else if (e.key === 'v' || e.key === 'V' || e.key === 'м' || e.key === 'М') {
        e.preventDefault();
        cycleViewMode();
      } else if (e.key === 'g' || e.key === 'G' || e.key === 'п' || e.key === 'П') {
        e.preventDefault();
        global.location.hash = '#/grades';
      } else if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') {
        e.preventDefault();
        global.location.hash = '#/new';
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф') {
        e.preventDefault();
        global.location.hash = '#/analytics';
      } else if (e.key === '/') {
        const qEl = doc.getElementById('f-query');
        if (qEl) {
          e.preventDefault();
          qEl.focus();
        }
      }
    });
  }

  /* ---------- Ініціалізація всіх підсистем v2.1.7 (build 217) Redstone 5 ---------- */
  SP.ThemeEngine.init({ storage: storage, onRouteRefresh: route });
  SP.FocusHub.init({
    storage: storage,
    manager: manager,
    onSessionComplete: refreshDashboardWidgets,
    onTaskMutate: applyChange
  });
  SP.CommandPalette.init({
    manager: manager,
    switchView: switchView,
    performUndo: performUndo,
    performRedo: performRedo,
    exportICS: exportICS,
    exportJSON: exportJSON,
    exportCSV: exportCSV
  });
  initModalsAndShortcuts();
  if (SP.WelcomeSplash) {
    SP.WelcomeSplash.init({ manager: manager, storage: storage });
  }

  global.addEventListener('hashchange', route);
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', route);
  } else {
    route();
  }
})(window);
