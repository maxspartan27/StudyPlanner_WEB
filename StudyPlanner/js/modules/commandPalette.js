/**
 * modules/commandPalette.js — [UI Subsystem] миттєва Spotlight Командна палітра Ctrl+K / ⌘K (#command-palette-dialog).
 * Пошук завдань, Розумна Таблиця RS5, Журнал оцінок ECTS, 16 тем, вітальний Splash, Undo/Redo та експорт.
 * Версія 2.1.7 (build 217) Redstone 5 — Автор: Максим Ковалишин.
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});
  const doc = global.document;

  let deps = null;
  let activeIdx = 0;
  let currentItems = [];

  function buildCatalog(query) {
    const q = String(query || '').trim().toLocaleLowerCase('uk-UA');
    const items = [];
    const manager = deps.manager;

    const baseCommands = [
      { icon: '📋', title: 'Розумна Таблиця завдань Redstone 5', sub: 'Відкрити оновлену таблицю зі швидким додаванням і пакетними діями (V)', keywords: 'таблиця розумна вигляд table smartgrid rs5', run: () => deps.switchView('table') },
      { icon: '🎓', title: 'Відкрити Журнал оцінок та Калькулятор ECTS', sub: 'Таблиця балів, кредити ECTS, GPA 4.0 та розрахунок стипендії (G)', keywords: 'оцінки журнал заліковка стипендія ects gpa grades бали', run: () => { global.location.hash = '#/grades'; } },
      { icon: '➕', title: 'Створити нове завдання (повна форма)', sub: 'Перехід до розширеної форми створення з фото (N)', keywords: 'створити додати нове task new', run: () => { global.location.hash = '#/new'; } },
      { icon: '✨', title: 'Показати вітальне вікно (Welcome Splash)', sub: 'Переглянути анімоване привітання v2.1.7 RS5', keywords: 'вітання привітання splash welcome старт', run: () => { if (SP.WelcomeSplash) SP.WelcomeSplash.replay(); } },
      { icon: '⚡', title: 'Перемкнути плавність (60+ FPS GPU / Турбо)', sub: 'Керування швидкістю переходів та ефектами', keywords: 'турбо плавність прискорення turbo fps gpu', run: () => SP.ThemeEngine.togglePerfMode() },
      { icon: '🎨', title: 'Відкрити Студію 16 тем і шпалер', sub: 'Конструктор кольорів «Хамелеон» та 30 HD фото', keywords: 'студія тем шпалери кольори хамелеон themes', run: () => { global.location.hash = '#/themes'; } },
      { icon: '📊', title: 'Відкрити Центр візуальної аналітики', sub: 'SVG-діаграми та зведена матриця дисциплін (A)', keywords: 'аналітика статистика графік analytics stats', run: () => { global.location.hash = '#/analytics'; } },
      { icon: '🧠', title: 'Відкрити 3D Флеш-картки', sub: 'Тренажер самоперевірки термінів і формул', keywords: 'флеш картки пам’ять flashcards', run: () => { global.location.hash = '#/flashcards'; } },
      { icon: '🗂️', title: 'Вигляд завдань: Картки з фото', sub: 'Перемкнути робочий простір на сітку карток', keywords: 'картки вигляд cards', run: () => deps.switchView('cards') },
      { icon: '📌', title: 'Вигляд завдань: Канбан-дошка Drag & Drop', sub: 'Колонки Заплановано / У роботі / Виконано', keywords: 'канбан дошка kanban', run: () => deps.switchView('kanban') },
      { icon: '📅', title: 'Вигляд завдань: Календар дедлайнів', sub: 'Місячна сітка дедлайнів', keywords: 'календар місяць calendar', run: () => deps.switchView('calendar') },
      { icon: '⏱️', title: (SP.FocusHub.isRunning() ? 'Поставити Pomodoro на паузу' : 'Запустити фокус-таймер Pomodoro (25 хв)'), sub: 'Керування таймером концентрації', keywords: 'помодоро таймер старт пауза pomodoro focus', run: () => SP.FocusHub.togglePomo() },
      { icon: '🌧️', title: 'Фокус-аудіо: М’який дощ (Увімк/Вимк)', sub: 'Процедурний синтезатор Web Audio', keywords: 'дощ звук аудіо rain audio', run: () => SP.FocusHub.toggleAmbientSound('rain') },
      { icon: '🌊', title: 'Фокус-аудіо: Прибій океану (Увімк/Вимк)', sub: 'Процедурний синтезатор Web Audio', keywords: 'океан море прибій звук ocean', run: () => SP.FocusHub.toggleAmbientSound('ocean') },
      { icon: '🖼️', title: 'Перемкнути режим фону (Фото / Колір / Градієнт)', sub: 'Швидка зміна атмосфери (клавіша W)', keywords: 'фон шпалери колір градієнт скло wallpaper', run: () => SP.ThemeEngine.cycleVisualMode() },
      { icon: '📅', title: 'Експорт дедлайнів у Календар (.ICS)', sub: 'Стандарт iCalendar для Google / Apple / Outlook', keywords: 'експорт календар ics export', run: () => deps.exportICS() },
      { icon: '📦', title: 'Завантажити резервну копію (.JSON)', sub: 'Повний бекап усіх завдань і підзавдань', keywords: 'експорт бекап json backup', run: () => deps.exportJSON() },
      { icon: '📊', title: 'Експорт таблиці для Excel (.CSV)', sub: 'UTF-8 таблиця успішності', keywords: 'експорт таблиця excel csv', run: () => deps.exportCSV() },
      { icon: '📖', title: 'Про проєкт StudyPlanner v2.1.7 Redstone 5', sub: 'Огляд архітектури, таблиць RS5 та авторства', keywords: 'про проєкт стаття автор article redstone', run: () => { global.location.hash = '#/article'; } }
    ];

    if (manager.canRedo && manager.canRedo()) {
      baseCommands.unshift({
        icon: '↪️',
        title: 'Повторити скасовану дію (Redo)',
        sub: 'Відновити дію після Undo (Ctrl+Y / Ctrl+Shift+Z)',
        keywords: 'повторити повернути redo',
        run: () => deps.performRedo()
      });
    }

    if (manager.canUndo()) {
      baseCommands.unshift({
        icon: '↩️',
        title: 'Скасувати останню дію (Undo)',
        sub: 'Миттєве відновлення попереднього стану (Ctrl+Z)',
        keywords: 'скасувати відмінити повернути undo',
        run: () => deps.performUndo()
      });
    }

    // Додавання всіх 16 тем у палітру команд
    SP.THEME_GALLERY.forEach((th) => {
      baseCommands.push({
        icon: '🎨',
        title: 'Тема: ' + th.title,
        sub: (th.type === 'light' ? 'Світла палітра' : 'Темна палітра') + ' • StudyPlanner RS5',
        keywords: 'тема theme ' + th.name.toLocaleLowerCase('uk-UA') + ' ' + th.id,
        run: () => SP.ThemeEngine.selectTheme(th.id, true)
      });
    });

    // Пошук серед завдань користувача за O(1) _searchIndex
    const matchedTasks = [];
    for (let i = 0; i < manager.tasks.length && matchedTasks.length < 10; i++) {
      const t = manager.tasks[i];
      if (!q || (t._searchIndex && t._searchIndex.indexOf(q) !== -1)) {
        matchedTasks.push({
          icon: t.status === 'DONE' ? '✅' : (t.priority === 'HIGH' ? '🔥' : '📘'),
          title: t.title,
          sub: t.subject + ' • ' + SP.Validator.formatDate(t.dueDate),
          keywords: '',
          run: () => { global.location.hash = '#/task/' + t.id; }
        });
      }
    }

    if (!q) {
      return matchedTasks.slice(0, 4).concat(baseCommands.slice(0, 16));
    }

    for (let i = 0; i < baseCommands.length; i++) {
      const c = baseCommands[i];
      const hay = (c.title + ' ' + c.sub + ' ' + c.keywords).toLocaleLowerCase('uk-UA');
      if (hay.indexOf(q) !== -1) items.push(c);
    }

    return matchedTasks.concat(items).slice(0, 24);
  }

  function renderList(listEl) {
    const h = SP.DOM.h;
    listEl.textContent = '';
    if (currentItems.length === 0) {
      listEl.appendChild(h('div', {
        style: 'padding:24px; text-align:center; color:var(--muted); font-size:0.9rem;',
        text: 'За вашим запитом команд або завдань не знайдено.'
      }));
      return;
    }

    const frag = SP.DOM.fragment(currentItems.map((item, idx) => {
      const btn = h('button', {
        type: 'button',
        class: 'cmd-item' + (idx === activeIdx ? ' active' : ''),
        onmouseenter: () => {
          activeIdx = idx;
          syncActiveClass(listEl);
        },
        onclick: () => executeItem(idx)
      }, [
        h('div', { class: 'cmd-item-main' }, [
          h('span', { style: 'font-size:1.1rem; flex-shrink:0;', text: item.icon }),
          h('span', { class: 'cmd-item-title', text: item.title })
        ]),
        h('span', { class: 'cmd-item-sub', text: item.sub })
      ]);
      return btn;
    }));
    listEl.appendChild(frag);
  }

  function syncActiveClass(listEl) {
    const children = listEl.querySelectorAll('.cmd-item');
    children.forEach((el, idx) => {
      const isAct = idx === activeIdx;
      el.classList.toggle('active', isAct);
      if (isAct) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function executeItem(idx) {
    const chosen = currentItems[idx];
    const dlg = doc.getElementById('command-palette-dialog');
    if (dlg && dlg.open) dlg.close();
    if (chosen && typeof chosen.run === 'function') {
      chosen.run();
    }
  }

  function open() {
    const dlg = doc.getElementById('command-palette-dialog');
    const input = doc.getElementById('cmd-palette-input');
    const listEl = doc.getElementById('cmd-palette-list');
    if (!dlg || !input || !listEl) return;

    input.value = '';
    activeIdx = 0;
    currentItems = buildCatalog('');
    renderList(listEl);
    if (!dlg.open) dlg.showModal();
    input.focus();
  }

  function init(options) {
    deps = options;
    const dlg = doc.getElementById('command-palette-dialog');
    const input = doc.getElementById('cmd-palette-input');
    const listEl = doc.getElementById('cmd-palette-list');
    const closeBtn = doc.getElementById('cmd-palette-close');
    const triggerBtn = doc.getElementById('btn-cmd-palette');

    if (triggerBtn) triggerBtn.addEventListener('click', open);
    if (closeBtn && dlg) closeBtn.addEventListener('click', () => dlg.close());

    if (dlg) {
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg) dlg.close();
      });
    }

    if (input && listEl) {
      input.addEventListener('input', () => {
        activeIdx = 0;
        currentItems = buildCatalog(input.value);
        renderList(listEl);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (currentItems.length > 0) {
            activeIdx = (activeIdx + 1) % currentItems.length;
            syncActiveClass(listEl);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (currentItems.length > 0) {
            activeIdx = (activeIdx - 1 + currentItems.length) % currentItems.length;
            syncActiveClass(listEl);
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (currentItems.length > 0) executeItem(activeIdx);
        }
      });
    }

    global.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.key === 'л' || e.key === 'Л')) {
        e.preventDefault();
        if (dlg && dlg.open) dlg.close();
        else open();
      }
    });
  }

  SP.CommandPalette = {
    init: init,
    open: open
  };
})(window);
