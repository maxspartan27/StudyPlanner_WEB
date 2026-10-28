/**
 * modules/smartTable.js — [UI Subsystem] Інтерактивна Розумна Таблиця завдань нового покоління (SP.SmartTable).
 * Версія 2.1.7 (build 217) Redstone 5 — Автор: Максим Ковалишин.
 * Можливості Redstone 5:
 * - Миттєве додавання нових завдань прямо в таблиці (Quick-Add Row з вибором статусу, пріоритету, предмета й дати).
 * - 3 способи зміни статусу (швидка галочка ✓, циклічна кнопка ↻, кольоровий селект статусів) + кольоровий селект пріоритету.
 * - Inline-редагування назви, предмета та дедлайну подвійним кліком або кнопкою ✎ без перезавантаження сторінки.
 * - Вбудоване розгортання чек-листа підзавдань прямо під рядком таблиці.
 * - Мульти-вибір рядків (включно з Shift+Клік) і панель масових операцій: зміна статусів/пріоритетів, зсув дедлайнів (+1/+3/+7 дн.), дублювання, видалення, CSV.
 * - Сортування за кліком на заголовки колонок (▲/▼), групування рядків, щільність (Компакт/Стандарт/Простора), пагінація, копіювання Markdown-таблиці та підсумковий рядок tfoot.
 * - Виправлено всі CSS/DOM баги таблиць: жодного display:flex на <td>, плавний горизонтальний скрол без обрізання, збереження позиції прокрутки при видаленні.
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});
  const doc = global.document;

  const SUGGESTED_SUBJECTS = [
    'Вища математика', 'Вебпрограмування', 'Фізика', 'Органічна хімія',
    'Біологія', 'Астрономія та космологія', 'Географія', 'Українська література',
    'Архітектура та дизайн', 'Англійська мова', 'Алгоритми і структури даних', 'Історія України'
  ];

  const STATUS_ICONS = {
    PLANNED: '🗓️',
    IN_PROGRESS: '⏳',
    DONE: '✅'
  };

  const PRIO_ICONS = {
    HIGH: '🔥',
    MEDIUM: '⚡',
    LOW: '🌱'
  };

  const state = {
    selectedIds: new Set(),
    expandedIds: new Set(),
    collapsedGroups: new Set(),
    lastClickedId: null,
    editingCell: null, // { id, field: 'title' | 'subject' | 'dueDate' }
    page: 1,
    draft: {
      title: '',
      subject: '',
      dueDate: '',
      priority: 'MEDIUM',
      status: 'PLANNED'
    }
  };

  function pruneState(manager) {
    Array.from(state.selectedIds).forEach((id) => {
      if (!manager.getTask(id)) state.selectedIds.delete(id);
    });
    Array.from(state.expandedIds).forEach((id) => {
      if (!manager.getTask(id)) state.expandedIds.delete(id);
    });
    if (state.editingCell && !manager.getTask(state.editingCell.id)) {
      state.editingCell = null;
    }
  }

  function clearSelection() {
    state.selectedIds.clear();
    state.lastClickedId = null;
  }

  function getSelectedCount() {
    return state.selectedIds.size;
  }

  function buildGroupBuckets(tasks, groupBy, PRIORITY, STATUS) {
    if (!groupBy || groupBy === 'none') {
      return [{ key: '__all__', label: '', tasks: tasks }];
    }
    const map = new Map();
    const order = [];

    if (groupBy === 'status') {
      ['IN_PROGRESS', 'PLANNED', 'DONE'].forEach((k) => {
        map.set(k, { key: 'st:' + k, label: STATUS_ICONS[k] + ' ' + STATUS[k].label, tasks: [] });
        order.push(k);
      });
      tasks.forEach((t) => {
        const bucket = map.get(t.status) || map.get('PLANNED');
        bucket.tasks.push(t);
      });
      return order.map((k) => map.get(k)).filter((b) => b.tasks.length > 0);
    }

    if (groupBy === 'priority') {
      ['HIGH', 'MEDIUM', 'LOW'].forEach((k) => {
        map.set(k, { key: 'pr:' + k, label: PRIO_ICONS[k] + ' Пріоритет: ' + PRIORITY[k].label, tasks: [] });
        order.push(k);
      });
      tasks.forEach((t) => {
        const bucket = map.get(t.priority) || map.get('MEDIUM');
        bucket.tasks.push(t);
      });
      return order.map((k) => map.get(k)).filter((b) => b.tasks.length > 0);
    }

    // groupBy === 'subject'
    tasks.forEach((t) => {
      const s = t.subject || 'Інше';
      if (!map.has(s)) {
        map.set(s, { key: 'sb:' + s, label: '📘 ' + s, tasks: [] });
        order.push(s);
      }
      map.get(s).tasks.push(t);
    });
    return order.map((k) => map.get(k));
  }

  /** Головна функція побудови Розумної Таблиці v2.1.7 Redstone 5 */
  function build(opts) {
    const h = SP.DOM.h;
    const fragment = SP.DOM.fragment;
    const badge = SP.DOM.badge;
    const toast = SP.DOM.toast;

    const tasks = opts.tasks || [];
    const today = opts.today || SP.todayISO();
    const manager = opts.manager;
    const storage = opts.storage;
    const filter = opts.filter;
    const view = opts.view;
    const applyChange = opts.applyChange;
    const doDelete = opts.doDelete;
    const renderResults = opts.renderResults;
    const onFilterMutate = opts.onFilterMutate;
    const performUndo = opts.performUndo;

    const PRIORITY = SP.TaskManager.PRIORITY;
    const STATUS = SP.TaskManager.STATUS;

    pruneState(manager);

    const prefs = storage.getTablePrefs();
    if (!state.draft.dueDate) state.draft.dueDate = today;

    function updatePrefs(patch) {
      const next = Object.assign({}, prefs, patch);
      storage.setTablePrefs(next);
      renderResults();
    }

    // Пагінація рядків для миттєвої швидкодії DOM
    const pageSize = prefs.pageSize || 0;
    const totalVisible = tasks.length;
    const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(totalVisible / pageSize)) : 1;
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;

    const startIdx = pageSize > 0 ? (state.page - 1) * pageSize : 0;
    const pageTasks = pageSize > 0 ? tasks.slice(startIdx, startIdx + pageSize) : tasks;

    const visibleIdList = pageTasks.map((t) => t.id);
    let selectedOnPage = 0;
    for (let i = 0; i < visibleIdList.length; i++) {
      if (state.selectedIds.has(visibleIdList[i])) selectedOnPage++;
    }
    const allPageSelected = pageTasks.length > 0 && selectedOnPage === pageTasks.length;
    const somePageSelected = selectedOnPage > 0 && !allPageSelected;

    /* ---------- 1. Верхня панель потужних інструментів таблиці ---------- */
    const groupSelect = h('select', {
      class: 'smart-tool-select',
      'aria-label': 'Групування рядків таблиці',
      title: 'Групувати рядки таблиці'
    }, [
      h('option', { value: 'none', text: '📂 Без групування', selected: prefs.groupBy === 'none' }),
      h('option', { value: 'status', text: '📊 Групи: за статусом', selected: prefs.groupBy === 'status' }),
      h('option', { value: 'subject', text: '📘 Групи: за предметом', selected: prefs.groupBy === 'subject' }),
      h('option', { value: 'priority', text: '🔥 Групи: за пріоритетом', selected: prefs.groupBy === 'priority' })
    ]);
    groupSelect.addEventListener('change', () => updatePrefs({ groupBy: groupSelect.value }));

    const densityBar = h('div', { class: 'smart-segmented', role: 'group', 'aria-label': 'Щільність рядків' }, [
      { id: 'compact', label: 'Компакт' },
      { id: 'comfortable', label: 'Стандарт' },
      { id: 'spacious', label: 'Простора' }
    ].map((d) =>
      h('button', {
        type: 'button',
        class: 'smart-seg-btn' + (prefs.density === d.id ? ' active' : ''),
        text: d.label,
        onclick: () => updatePrefs({ density: d.id })
      })
    ));

    const targetExportList = () => {
      if (state.selectedIds.size > 0) {
        return tasks.filter((t) => state.selectedIds.has(t.id));
      }
      return tasks;
    };

    const topToolsBar = h('div', { class: 'smart-table-toolbar' }, [
      h('div', { class: 'smart-toolbar-left' }, [
        h('span', { class: 'smart-table-badge', text: '📋 SmartGrid RS5' }),
        h('button', {
          type: 'button',
          class: 'btn btn-small ' + (prefs.showQuickAdd ? 'btn-primary' : ''),
          title: 'Показати або сховати рядок швидкого створення завдання в таблиці',
          text: prefs.showQuickAdd ? '➖ Сховати форму' : '➕ Додати рядок',
          onclick: () => updatePrefs({ showQuickAdd: !prefs.showQuickAdd })
        }),
        groupSelect,
        densityBar
      ]),
      h('div', { class: 'smart-toolbar-right' }, [
        h('button', {
          type: 'button',
          class: 'smart-chip-toggle' + (prefs.zebra ? ' active' : ''),
          title: 'Чередування відтінків рядків (Зебра)',
          text: '🦓 Зебра',
          onclick: () => updatePrefs({ zebra: !prefs.zebra })
        }),
        h('button', {
          type: 'button',
          class: 'smart-chip-toggle' + (prefs.gridLines ? ' active' : ''),
          title: 'Вертикальні лінії сітки між стовпцями',
          text: '▦ Сітка',
          onclick: () => updatePrefs({ gridLines: !prefs.gridLines })
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          title: 'Скопіювати поточну або виділену таблицю у форматі Markdown',
          text: '📋 Копіювати MD',
          onclick: () => {
            const list = targetExportList();
            if (list.length === 0) {
              toast('Немає рядків для копіювання', true);
              return;
            }
            const md = manager.exportMarkdownTable(list);
            SP.DOM.copyText(md).then((ok) => {
              toast(ok ? 'Таблицю (' + list.length + ' рядк.) скопійовано у Markdown! 📋' : 'Не вдалося скопіювати таблицю', !ok);
            });
          }
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          title: 'Експортувати показані або виділені рядки таблиці в Excel (.CSV)',
          text: '📊 CSV',
          onclick: () => {
            const list = targetExportList();
            if (list.length === 0) {
              toast('Немає рядків для експорту', true);
              return;
            }
            SP.DOM.downloadFile(manager.exportCSV(list), 'studyplanner-table-v2.1.7-rs5.csv', 'text/csv;charset=utf-8');
            toast('Вивантажено у CSV: ' + list.length + ' рядк. 📊', false);
          }
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          title: 'Роздрукувати таблицю навчального плану',
          text: '🖨️',
          onclick: () => global.print()
        })
      ])
    ]);

    /* ---------- 2. Рядок миттєвого додавання завдання прямо в таблицю ---------- */
    const allSubjects = Array.from(new Set(manager.getSubjects().concat(SUGGESTED_SUBJECTS)));
    const subjectDatalist = h('datalist', { id: 'smart-table-subjects-list' },
      allSubjects.map((s) => h('option', { value: s }))
    );

    let quickAddBar = null;
    if (prefs.showQuickAdd) {
      const qaTitle = h('input', {
        type: 'text',
        id: 'st-quick-title',
        value: state.draft.title,
        placeholder: '➕ Швидке додавання: введіть назву завдання та натисніть Enter...',
        autocomplete: 'off',
        'aria-label': 'Назва нового завдання'
      });
      const qaSubject = h('input', {
        type: 'text',
        id: 'st-quick-subject',
        value: state.draft.subject || filter.subject || '',
        list: 'smart-table-subjects-list',
        placeholder: 'Предмет (напр. Фізика)...',
        autocomplete: 'off',
        'aria-label': 'Предмет нового завдання'
      });
      const qaDate = h('input', {
        type: 'date',
        id: 'st-quick-date',
        value: state.draft.dueDate || today,
        'aria-label': 'Дата дедлайну'
      });
      const qaPrio = h('select', { id: 'st-quick-prio', 'aria-label': 'Пріоритет' }, [
        h('option', { value: 'HIGH', text: '🔥 Високий', selected: state.draft.priority === 'HIGH' }),
        h('option', { value: 'MEDIUM', text: '⚡ Середній', selected: state.draft.priority === 'MEDIUM' }),
        h('option', { value: 'LOW', text: '🌱 Низький', selected: state.draft.priority === 'LOW' })
      ]);
      const qaStatus = h('select', { id: 'st-quick-status', 'aria-label': 'Початковий статус' }, [
        h('option', { value: 'PLANNED', text: '🗓️ Заплановано', selected: state.draft.status === 'PLANNED' }),
        h('option', { value: 'IN_PROGRESS', text: '⏳ У роботі', selected: state.draft.status === 'IN_PROGRESS' }),
        h('option', { value: 'DONE', text: '✅ Виконано', selected: state.draft.status === 'DONE' })
      ]);

      qaTitle.addEventListener('input', () => { state.draft.title = qaTitle.value; });
      qaSubject.addEventListener('input', () => { state.draft.subject = qaSubject.value; });
      qaDate.addEventListener('change', () => { state.draft.dueDate = qaDate.value; });
      qaPrio.addEventListener('change', () => { state.draft.priority = qaPrio.value; });
      qaStatus.addEventListener('change', () => { state.draft.status = qaStatus.value; });

      const submitQuickAdd = () => {
        const titleVal = qaTitle.value.trim();
        const subjVal = qaSubject.value.trim() || filter.subject || 'Загальне';
        const dateVal = qaDate.value || today;

        if (!titleVal) {
          qaTitle.setAttribute('aria-invalid', 'true');
          qaTitle.focus();
          toast('Введіть назву завдання для додавання в таблицю', true);
          return;
        }
        qaTitle.removeAttribute('aria-invalid');

        const res = manager.createTask({
          title: titleVal,
          subject: subjVal,
          dueDate: dateVal,
          priority: qaPrio.value,
          status: qaStatus.value,
          description: '',
          tags: filter.tag ? [filter.tag] : []
        });

        if (!res.ok) {
          const msg = res.errors ? Object.values(res.errors)[0] : res.error;
          toast(msg || 'Помилка додавання завдання', true);
          return;
        }

        state.draft.title = '';
        state.draft.subject = subjVal;
        if (qaStatus.value === 'DONE') SP.DOM.fireConfetti(1500);
        applyChange(res, 'Додано в таблицю: «' + res.task.title + '» ✨');
        const nextTitleInput = doc.getElementById('st-quick-title');
        if (nextTitleInput) nextTitleInput.focus({ preventScroll: true });
      };

      const onEnterKey = (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          submitQuickAdd();
        }
      };
      qaTitle.addEventListener('keydown', onEnterKey);
      qaSubject.addEventListener('keydown', onEnterKey);
      qaDate.addEventListener('keydown', onEnterKey);

      quickAddBar = h('div', { class: 'smart-quick-add-bar', role: 'region', 'aria-label': 'Швидке додавання завдання в таблицю' }, [
        h('div', { class: 'qa-cell qa-title' }, [qaTitle]),
        h('div', { class: 'qa-cell qa-subject' }, [qaSubject]),
        h('div', { class: 'qa-cell qa-date' }, [qaDate]),
        h('div', { class: 'qa-cell qa-prio' }, [qaPrio]),
        h('div', { class: 'qa-cell qa-status' }, [qaStatus]),
        h('div', { class: 'qa-cell qa-submit' }, [
          h('button', {
            type: 'button',
            class: 'btn btn-small btn-primary',
            id: 'st-quick-submit',
            text: '➕ Додати',
            onclick: submitQuickAdd
          })
        ])
      ]);
    }

    /* ---------- 3. Контекстна панель масових дій для обраних рядків ---------- */
    let bulkBar = null;
    if (state.selectedIds.size > 0) {
      const selArr = Array.from(state.selectedIds);
      const count = selArr.length;

      bulkBar = h('div', { class: 'smart-bulk-bar', role: 'region', 'aria-label': 'Пакетні операції над обраними рядками' }, [
        h('div', { class: 'bulk-left' }, [
          badge('badge-IN_PROGRESS', '☑️ Обрано: ' + count),
          h('button', {
            type: 'button',
            class: 'btn btn-small',
            text: '✕ Зняти вибір',
            onclick: () => { clearSelection(); renderResults(); }
          })
        ]),
        h('div', { class: 'bulk-actions-group' }, [
          h('span', { class: 'bulk-group-label', text: 'Статус:' }),
          h('button', {
            type: 'button', class: 'btn btn-small', text: '🗓️ В план',
            onclick: () => applyChange(manager.bulkChangeStatus(selArr, 'PLANNED'), 'Статус «Заплановано» для ' + count + ' завд.')
          }),
          h('button', {
            type: 'button', class: 'btn btn-small', text: '⏳ У роботу',
            onclick: () => applyChange(manager.bulkChangeStatus(selArr, 'IN_PROGRESS'), 'Статус «У роботі» для ' + count + ' завд.')
          }),
          h('button', {
            type: 'button', class: 'btn btn-small btn-celebrate', text: '✅ Виконано',
            onclick: () => {
              const res = manager.bulkChangeStatus(selArr, 'DONE');
              if (res.ok && res.count > 0) SP.DOM.fireConfetti(2000);
              applyChange(res, 'Виконано обраних завдань: ' + count + ' 🎉');
            }
          }),
          h('span', { class: 'bulk-divider' }),
          h('span', { class: 'bulk-group-label', text: 'Пріоритет:' }),
          h('button', {
            type: 'button', class: 'btn btn-small', title: 'Встановити високий пріоритет', text: '🔥 Високий',
            onclick: () => applyChange(manager.bulkChangePriority(selArr, 'HIGH'), 'Встановлено високий пріоритет (' + count + ')')
          }),
          h('button', {
            type: 'button', class: 'btn btn-small', title: 'Встановити середній пріоритет', text: '⚡ Середній',
            onclick: () => applyChange(manager.bulkChangePriority(selArr, 'MEDIUM'), 'Встановлено середній пріоритет (' + count + ')')
          }),
          h('button', {
            type: 'button', class: 'btn btn-small', title: 'Встановити низький пріоритет', text: '🌱 Низький',
            onclick: () => applyChange(manager.bulkChangePriority(selArr, 'LOW'), 'Встановлено низький пріоритет (' + count + ')')
          }),
          h('span', { class: 'bulk-divider' }),
          h('span', { class: 'bulk-group-label', text: 'Дедлайн:' }),
          h('button', {
            type: 'button', class: 'btn btn-small', title: 'Перенести дедлайн обраних на +1 день', text: '+1 дн.',
            onclick: () => applyChange(manager.bulkShiftDueDate(selArr, 1), 'Дедлайни перенесено на +1 день')
          }),
          h('button', {
            type: 'button', class: 'btn btn-small', title: 'Перенести дедлайн обраних на +3 дні', text: '+3 дн.',
            onclick: () => applyChange(manager.bulkShiftDueDate(selArr, 3), 'Дедлайни перенесено на +3 дні')
          }),
          h('button', {
            type: 'button', class: 'btn btn-small', title: 'Перенести дедлайн обраних на +7 днів', text: '+7 дн.',
            onclick: () => applyChange(manager.bulkShiftDueDate(selArr, 7), 'Дедлайни перенесено на +7 днів')
          }),
          h('span', { class: 'bulk-divider' }),
          h('button', {
            type: 'button', class: 'btn btn-small', title: 'Дублювати всі обрані рядки', text: '📋 Копії',
            onclick: () => applyChange(manager.bulkDuplicateTasks(selArr), 'Створено копій: ' + count)
          }),
          h('button', {
            type: 'button',
            class: 'btn btn-small btn-danger',
            text: '🗑️ Видалити (' + count + ')',
            onclick: async () => {
              const ok = await SP.DOM.confirmDelete(
                'Видалити обрані завдання (' + count + ')?',
                'Буде видалено ' + count + ' обраних рядків із таблиці. Дію можна миттєво скасувати через Undo (Ctrl+Z).'
              );
              if (!ok) return;
              const res = manager.bulkDeleteTasks(selArr);
              clearSelection();
              applyChange(res, 'Видалено завдань: ' + (res.count || count));
            }
          })
        ])
      ]);
    }

    /* ---------- 4. Заголовки колонок із інтерактивним сортуванням ▲/▼ ---------- */
    function sortableTh(label, sortCode, extraClass) {
      const isActive = view.sortMode === sortCode;
      const arrow = isActive ? (prefs.sortDir === 'desc' ? ' ▼' : ' ▲') : ' ⇅';
      return h('th', { scope: 'col', class: (extraClass || '') + (isActive ? ' is-sorted' : '') }, [
        h('button', {
          type: 'button',
          class: 'th-sort-btn' + (isActive ? ' active' : ''),
          title: 'Сортувати за колонкою «' + label + '»',
          onclick: () => {
            if (view.sortMode === sortCode) {
              const nextDir = prefs.sortDir === 'asc' ? 'desc' : 'asc';
              storage.setTablePrefs(Object.assign({}, prefs, { sortDir: nextDir }));
            } else {
              view.sortMode = sortCode;
              storage.setTablePrefs(Object.assign({}, prefs, { sortDir: 'asc' }));
              const sortSelEl = doc.getElementById('f-sort');
              if (sortSelEl) sortSelEl.value = sortCode;
            }
            renderResults();
          }
        }, [
          h('span', { text: label }),
          h('span', { class: 'th-sort-icon', text: arrow })
        ])
      ]);
    }

    const selectAllCb = h('input', {
      type: 'checkbox',
      class: 'smart-row-checkbox',
      checked: allPageSelected,
      'aria-label': 'Вибрати всі рядки на сторінці',
      title: 'Вибрати всі / Зняти виділення'
    });
    if (somePageSelected) {
      selectAllCb.indeterminate = true;
    }
    selectAllCb.addEventListener('change', () => {
      if (selectAllCb.checked) {
        visibleIdList.forEach((id) => state.selectedIds.add(id));
      } else {
        visibleIdList.forEach((id) => state.selectedIds.delete(id));
      }
      renderResults();
    });

    const thead = h('thead', {}, [
      h('tr', {}, [
        h('th', { scope: 'col', class: 'col-select' }, [selectAllCb]),
        h('th', { scope: 'col', class: 'col-done', text: '✓' }),
        sortableTh('Назва завдання та етапи', 'BY_TITLE', 'col-title'),
        sortableTh('Предмет', 'BY_SUBJECT', 'col-subject'),
        sortableTh('Дедлайн', 'BY_DATE', 'col-date'),
        sortableTh('Пріоритет', 'BY_PRIORITY', 'col-prio'),
        sortableTh('Статус', 'BY_STATUS', 'col-status'),
        h('th', { scope: 'col', class: 'col-actions', text: 'Інструменти' })
      ])
    ]);

    /* ---------- 5. Тіло таблиці з делегуванням подій, inline-редагуванням і групуванням ---------- */
    const tbody = h('tbody');

    function startInlineEdit(taskId, field) {
      state.editingCell = { id: taskId, field: field };
      renderResults();
      global.requestAnimationFrame(() => {
        const inp = doc.getElementById('inline-editor-active');
        if (inp) {
          inp.focus({ preventScroll: true });
          if (typeof inp.select === 'function' && inp.type !== 'date') inp.select();
        }
      });
    }

    function commitInlineEdit(taskId, field, rawVal) {
      const task = manager.getTask(taskId);
      state.editingCell = null;
      if (!task) { renderResults(); return; }
      const val = String(rawVal == null ? '' : rawVal).trim();
      if (!val || String(task[field]) === val) {
        renderResults();
        return;
      }
      const patch = {};
      patch[field] = val;
      const res = manager.patchTask(taskId, patch);
      if (!res.ok) {
        toast(res.error || 'Некоректне значення', true);
        renderResults();
        return;
      }
      applyChange(res, 'Оновлено поле у таблиці ✨');
    }

    function buildInlineInput(t, field) {
      const isDate = field === 'dueDate';
      const inp = h('input', {
        type: isDate ? 'date' : 'text',
        id: 'inline-editor-active',
        class: 'smart-inline-input',
        value: t[field] || '',
        list: field === 'subject' ? 'smart-table-subjects-list' : null
      });
      let finished = false;
      inp.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          finished = true;
          commitInlineEdit(t.id, field, inp.value);
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          finished = true;
          state.editingCell = null;
          renderResults();
        }
      });
      inp.addEventListener('blur', () => {
        if (!finished) {
          finished = true;
          commitInlineEdit(t.id, field, inp.value);
        }
      });
      return inp;
    }

    function buildTaskRows(t, rowNumber) {
      const rowsOut = [];
      const overdue = t.isOverdue(today);
      const isDone = t.status === 'DONE';
      const isSelected = state.selectedIds.has(t.id);
      const isExpanded = state.expandedIds.has(t.id);
      const sp = t.subtaskProgress();
      const editingField = (state.editingCell && state.editingCell.id === t.id) ? state.editingCell.field : null;

      // 1) Чекбокс вибору рядка (підтримує Shift+Клік діапазон!)
      const rowCb = h('input', {
        type: 'checkbox',
        class: 'smart-row-checkbox',
        checked: isSelected,
        'data-action': 'select-row',
        'aria-label': 'Вибрати завдання «' + t.title + '»'
      });

      // 2) Швидка кнопка виконання ✓
      const quickDoneBtn = h('button', {
        type: 'button',
        class: 'quick-complete-btn' + (isDone ? ' is-done' : ''),
        'data-action': 'toggle-done',
        title: isDone ? 'Повернути завдання в план' : 'Позначити виконаним (+50 XP)',
        'aria-label': isDone ? 'Позначити невиконаним' : 'Позначити виконаним',
        text: isDone ? '✓' : '○'
      });

      // 3) Комірка Назви, мініатюри, тегів та прогресу підзавдань (обгорнуто у div.cell-title-wrap!)
      let titleMainNode;
      if (editingField === 'title') {
        titleMainNode = buildInlineInput(t, 'title');
      } else {
        const metaRow = [];
        if (t.tags && t.tags.length > 0) {
          t.tags.forEach((tg) => {
            metaRow.push(h('button', {
              type: 'button',
              class: 'tag-chip table-tag-chip',
              'data-action': 'filter-tag',
              'data-tag': tg,
              title: 'Відфільтрувати за тегом #' + tg,
              text: '#' + tg
            }));
          });
        }
        metaRow.push(h('button', {
          type: 'button',
          class: 'subtask-inline-toggle' + (isExpanded ? ' open' : '') + (sp.total > 0 && sp.done === sp.total ? ' all-done' : ''),
          'data-action': 'toggle-subtasks',
          title: 'Розгорнути або додати етапи чек-листа прямо в таблиці',
          text: sp.total > 0 ? ('☑️ ' + sp.done + '/' + sp.total + ' (' + sp.percent + '%) ' + (isExpanded ? '▴' : '▾')) : '➕ Етапи'
        }));

        titleMainNode = h('div', { class: 'cell-title-stack' }, [
          h('div', { class: 'cell-title-top' }, [
            h('span', { class: 'row-index-num', text: '#' + rowNumber }),
            h('a', {
              class: 'task-link',
              href: '#/task/' + t.id,
              title: 'Відкрити картку завдання (подвійний клік по комірці — швидке редагування)',
              text: t.title
            }),
            h('button', {
              type: 'button',
              class: 'cell-inline-edit-btn',
              'data-action': 'edit-title',
              title: 'Редагувати назву прямо в таблиці',
              text: '✎'
            })
          ]),
          sp.total > 0 ? h('div', { class: 'table-mini-progress' }, [
            h('div', { class: 'table-mini-progress-fill', style: 'width:' + sp.percent + '%;' })
          ]) : null,
          h('div', { class: 'cell-meta-chips' }, metaRow)
        ]);
      }

      const titleCellInner = h('div', { class: 'cell-title-wrap' }, [
        t.imageUrl ? h('img', {
          src: t.imageUrl,
          alt: t.title,
          class: 'task-thumb-mini',
          loading: 'lazy',
          'data-action': 'lightbox',
          title: 'Натисніть для збільшення фото'
        }) : null,
        titleMainNode
      ]);

      // 4) Комірка Предмета (клік — фільтр, подвійний клік / ✎ — редагування)
      const subjectCellInner = editingField === 'subject'
        ? buildInlineInput(t, 'subject')
        : h('div', { class: 'cell-subject-wrap' }, [
            h('button', {
              type: 'button',
              class: 'table-subject-pill',
              'data-action': 'filter-subject',
              'data-subject': t.subject,
              title: 'Відфільтрувати предмет «' + t.subject + '» (подвійний клік — змінити)',
              text: '📘 ' + t.subject
            }),
            h('button', {
              type: 'button',
              class: 'cell-inline-edit-btn',
              'data-action': 'edit-subject',
              title: 'Змінити предмет',
              text: '✎'
            })
          ]);

      // 5) Комірка Дедлайну з відносним індикатором та inline-редагуванням дати
      const dateCellInner = editingField === 'dueDate'
        ? buildInlineInput(t, 'dueDate')
        : h('div', { class: 'cell-date-wrap' }, [
            h('span', {
              class: 'table-date-text',
              title: 'Подвійний клік для швидкої зміни дати дедлайну',
              text: SP.Validator.formatDate(t.dueDate)
            }),
            h('button', {
              type: 'button',
              class: 'cell-inline-edit-btn',
              'data-action': 'edit-date',
              title: 'Змінити дедлайн',
              text: '📅'
            }),
            SP.DOM.dueRelativeBadge(t, today)
          ]);

      // 6) Кольоровий селект Пріоритету
      const prioSelect = h('select', {
        class: 'smart-pill-select prio-' + t.priority + ' row-priority',
        'data-action': 'change-priority',
        'aria-label': 'Пріоритет завдання «' + t.title + '»'
      }, [
        h('option', { value: 'HIGH', text: '🔥 Високий', selected: t.priority === 'HIGH' }),
        h('option', { value: 'MEDIUM', text: '⚡ Середній', selected: t.priority === 'MEDIUM' }),
        h('option', { value: 'LOW', text: '🌱 Низький', selected: t.priority === 'LOW' })
      ]);

      // 7) Інтерактивний блок Статусу: кольоровий селект + циклічна кнопка ↻
      const statusSelect = h('select', {
        class: 'smart-pill-select status-' + t.status + ' row-status',
        'data-action': 'change-status',
        'aria-label': 'Статус завдання «' + t.title + '»'
      }, [
        h('option', { value: 'PLANNED', text: '🗓️ Заплановано', selected: t.status === 'PLANNED' }),
        h('option', { value: 'IN_PROGRESS', text: '⏳ У роботі', selected: t.status === 'IN_PROGRESS' }),
        h('option', { value: 'DONE', text: '✅ Виконано', selected: t.status === 'DONE' })
      ]);

      const statusCellInner = h('div', { class: 'cell-status-wrap' }, [
        statusSelect,
        h('button', {
          type: 'button',
          class: 'status-cycle-btn',
          'data-action': 'cycle-status',
          title: 'Перемкнути наступний статус у 1 клік (План → У роботі → Виконано)',
          text: '↻'
        })
      ]);

      // 8) Компактна панель дій рядка
      const actionsInner = h('div', { class: 'cell-actions-wrap' }, [
        h('button', {
          type: 'button',
          class: 'table-icon-action',
          'data-action': 'focus-pomo',
          title: 'Взяти завдання у Фокус-таймер Pomodoro',
          text: '🎯'
        }),
        h('button', {
          type: 'button',
          class: 'table-icon-action',
          'data-action': 'duplicate',
          title: 'Дублювати рядок завдання',
          text: '📋'
        }),
        h('a', {
          class: 'table-icon-action',
          href: '#/edit/' + t.id,
          title: 'Повне редагування завдання (опис, теги, фото)',
          text: '✏️'
        }),
        h('button', {
          type: 'button',
          class: 'table-icon-action danger row-delete',
          'data-action': 'delete',
          title: 'Видалити завдання (утримуйте Shift для миттєвого видалення без діалогу)',
          text: '🗑️'
        })
      ]);

      const trClass = [
        'smart-row',
        overdue ? 'is-overdue' : '',
        isDone ? 'is-done' : '',
        isSelected ? 'is-selected' : ''
      ].filter(Boolean).join(' ');

      rowsOut.push(h('tr', {
        class: trClass,
        'data-id': t.id,
        'data-task-id': t.id
      }, [
        h('td', { class: 'col-select', 'data-label': 'Вибір' }, [rowCb]),
        h('td', { class: 'col-done', 'data-label': 'Готово' }, [quickDoneBtn]),
        h('td', { class: 'col-title', 'data-label': 'Завдання', 'data-dbl-edit': 'title' }, [titleCellInner]),
        h('td', { class: 'col-subject', 'data-label': 'Предмет', 'data-dbl-edit': 'subject' }, [subjectCellInner]),
        h('td', { class: 'col-date', 'data-label': 'Дедлайн', 'data-dbl-edit': 'dueDate' }, [dateCellInner]),
        h('td', { class: 'col-prio', 'data-label': 'Пріоритет' }, [prioSelect]),
        h('td', { class: 'col-status', 'data-label': 'Статус' }, [statusCellInner]),
        h('td', { class: 'col-actions actions-cell', 'data-label': 'Дії' }, [actionsInner])
      ]));

      // Розгорнута панель підзавдань прямо всередині таблиці
      if (isExpanded) {
        const subInput = h('input', {
          type: 'text',
          class: 'smart-subtask-input',
          placeholder: 'Новий крок чек-листа (натисніть Enter)...'
        });
        const addSubNow = () => {
          const res = manager.addSubtask(t.id, subInput.value);
          if (res.ok) {
            applyChange(res, 'Етап додано до «' + t.title.slice(0, 24) + '»', false);
          } else {
            toast(res.error, true);
          }
        };
        subInput.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            addSubNow();
          }
        });

        const subItems = (t.subtasks || []).length === 0
          ? [h('span', { style: 'font-size:0.82rem; color:var(--muted);', text: 'Ще немає етапів — додайте перший крок праворуч!' })]
          : t.subtasks.map((st) => {
              const scb = h('input', { type: 'checkbox', checked: st.done });
              scb.addEventListener('change', () => {
                const res = manager.toggleSubtask(t.id, st.id);
                if (res.ok) {
                  const nsp = res.task.subtaskProgress();
                  if (nsp.total > 0 && nsp.done === nsp.total) SP.DOM.fireConfetti(1200);
                  applyChange(res, 'Оновлено чек-лист етапів', false);
                }
              });
              return h('div', { class: 'smart-drawer-item' + (st.done ? ' done' : '') }, [
                h('label', {}, [scb, h('span', { text: st.text })]),
                h('button', {
                  type: 'button',
                  class: 'smart-drawer-del',
                  title: 'Видалити етап',
                  text: '✕',
                  onclick: () => {
                    const res = manager.removeSubtask(t.id, st.id);
                    applyChange(res, 'Етап видалено', false);
                  }
                })
              ]);
            });

        rowsOut.push(h('tr', { class: 'smart-subtask-drawer-row', 'data-parent-id': t.id }, [
          h('td', { colspan: '8', 'data-label': 'Етапи' }, [
            h('div', { class: 'smart-subtask-drawer' }, [
              h('div', { class: 'smart-drawer-list' }, subItems),
              h('div', { class: 'smart-drawer-form' }, [
                subInput,
                h('button', { type: 'button', class: 'btn btn-small btn-primary', text: '➕ Крок', onclick: addSubNow })
              ])
            ])
          ])
        ]));
      }

      return rowsOut;
    }

    if (pageTasks.length === 0) {
      const hasAnyTasks = manager.tasks.length > 0;
      tbody.appendChild(h('tr', { class: 'smart-empty-row' }, [
        h('td', { colspan: '8', class: 'smart-empty-cell' }, [
          h('div', { class: 'smart-empty-box' }, [
            h('strong', {
              text: hasAnyTasks
                ? '🔍 За поточними фільтрами завдань у таблиці не знайдено'
                : '📋 Таблиця порожня — додайте перше завдання у рядку швидкого створення вище!'
            }),
            h('p', {
              text: hasAnyTasks
                ? 'Скиньте фільтри або створіть нове завдання прямо у верхньому рядку таблиці.'
                : 'Також ви можете завантажити 9 готових демонстраційних завдань із HD-фотографіями в 1 клік:'
            }),
            h('div', { style: 'display:flex; gap:8px; justify-content:center; flex-wrap:wrap;' }, [
              hasAnyTasks ? h('button', {
                type: 'button',
                class: 'btn btn-small btn-primary',
                text: '🔄 Скинути всі фільтри',
                onclick: () => { filter.reset(); if (onFilterMutate) onFilterMutate(); }
              }) : h('button', {
                type: 'button',
                class: 'btn btn-small btn-primary',
                text: '📸 Завантажити 9 демо-завдань Redstone 5',
                onclick: () => {
                  const res = manager.loadSampleTasks(false);
                  if (res.ok) SP.DOM.fireConfetti(1800);
                  applyChange(res, 'Завантажено 9 демо-завдань у таблицю! 📸');
                }
              }),
              manager.canUndo() ? h('button', {
                type: 'button',
                class: 'btn btn-small',
                text: '↩️ Скасувати останню дію',
                onclick: performUndo
              }) : null
            ])
          ])
        ])
      ]));
    } else {
      const buckets = buildGroupBuckets(pageTasks, prefs.groupBy, PRIORITY, STATUS);
      let runningIdx = startIdx + 1;
      const bodyNodes = [];

      buckets.forEach((b) => {
        if (b.label) {
          const isCollapsed = state.collapsedGroups.has(b.key);
          const doneInGroup = b.tasks.filter((x) => x.status === 'DONE').length;
          const pctGroup = Math.round((doneInGroup / b.tasks.length) * 100);
          bodyNodes.push(h('tr', { class: 'smart-group-header-row' }, [
            h('td', { colspan: '8' }, [
              h('button', {
                type: 'button',
                class: 'smart-group-toggle',
                onclick: () => {
                  if (isCollapsed) state.collapsedGroups.delete(b.key);
                  else state.collapsedGroups.add(b.key);
                  renderResults();
                }
              }, [
                h('span', { text: (isCollapsed ? '▶ ' : '▼ ') + b.label }),
                badge('badge-IN_PROGRESS', b.tasks.length + ' завд. • ' + pctGroup + '% готово')
              ])
            ])
          ]));
          if (isCollapsed) {
            runningIdx += b.tasks.length;
            return;
          }
        }

        b.tasks.forEach((t) => {
          const built = buildTaskRows(t, runningIdx++);
          for (let k = 0; k < built.length; k++) bodyNodes.push(built[k]);
        });
      });

      tbody.appendChild(fragment(bodyNodes));
    }

    /* ---------- Делегування подій на <tbody> (висока швидкодія без сотень замикань) ---------- */
    tbody.addEventListener('click', (ev) => {
      const actionEl = ev.target.closest('[data-action]');
      if (!actionEl) return;
      const tr = actionEl.closest('tr[data-task-id]');
      if (!tr) return;
      const id = tr.getAttribute('data-task-id');
      const task = manager.getTask(id);
      if (!task) return;

      const action = actionEl.getAttribute('data-action');

      if (action === 'select-row') {
        if (ev.shiftKey && state.lastClickedId && state.lastClickedId !== id) {
          const a = visibleIdList.indexOf(state.lastClickedId);
          const b = visibleIdList.indexOf(id);
          if (a !== -1 && b !== -1) {
            const lo = Math.min(a, b);
            const hi = Math.max(a, b);
            const shouldCheck = actionEl.checked;
            for (let i = lo; i <= hi; i++) {
              if (shouldCheck) state.selectedIds.add(visibleIdList[i]);
              else state.selectedIds.delete(visibleIdList[i]);
            }
          }
        } else {
          if (actionEl.checked) state.selectedIds.add(id);
          else state.selectedIds.delete(id);
        }
        state.lastClickedId = id;
        renderResults();
      } else if (action === 'toggle-done') {
        const wasDone = task.status === 'DONE';
        const res = manager.changeStatus(id, wasDone ? 'PLANNED' : 'DONE');
        if (res.ok && !wasDone) SP.DOM.fireConfetti(1600);
        applyChange(res, wasDone ? 'Повернуто в план' : 'Завдання виконано! 🎉');
      } else if (action === 'cycle-status') {
        const res = manager.cycleTaskStatus(id);
        if (res.ok && res.task.status === 'DONE') SP.DOM.fireConfetti(1500);
        applyChange(res, 'Статус змінено на «' + STATUS[res.task.status].label + '»');
      } else if (action === 'toggle-subtasks') {
        if (state.expandedIds.has(id)) state.expandedIds.delete(id);
        else state.expandedIds.add(id);
        renderResults();
      } else if (action === 'edit-title') {
        startInlineEdit(id, 'title');
      } else if (action === 'edit-subject') {
        startInlineEdit(id, 'subject');
      } else if (action === 'edit-date') {
        startInlineEdit(id, 'dueDate');
      } else if (action === 'filter-subject') {
        filter.subject = actionEl.getAttribute('data-subject') || '';
        if (onFilterMutate) onFilterMutate();
      } else if (action === 'filter-tag') {
        filter.tag = actionEl.getAttribute('data-tag') || '';
        if (onFilterMutate) onFilterMutate();
      } else if (action === 'lightbox') {
        if (task.imageUrl) SP.DOM.showLightbox(task.imageUrl, task.title);
      } else if (action === 'focus-pomo') {
        if (SP.FocusHub && typeof SP.FocusHub.setFocusTask === 'function') {
          SP.FocusHub.setFocusTask(task);
        }
      } else if (action === 'duplicate') {
        applyChange(manager.duplicateTask(id), 'Створено копію завдання в таблиці 📋');
      } else if (action === 'delete') {
        if (ev.shiftKey) {
          const res = manager.deleteTask(id);
          state.selectedIds.delete(id);
          applyChange(res, 'Завдання миттєво видалено (Shift+Клік)');
        } else {
          doDelete(task, false);
        }
      }
    });

    tbody.addEventListener('change', (ev) => {
      const sel = ev.target.closest('select[data-action]');
      if (!sel) return;
      const tr = sel.closest('tr[data-task-id]');
      if (!tr) return;
      const id = tr.getAttribute('data-task-id');
      const act = sel.getAttribute('data-action');

      if (act === 'change-priority') {
        applyChange(manager.changePriority(id, sel.value), 'Пріоритет змінено на «' + PRIORITY[sel.value].label + '»');
      } else if (act === 'change-status') {
        const finishing = sel.value === 'DONE';
        const res = manager.changeStatus(id, sel.value);
        if (res.ok && finishing) SP.DOM.fireConfetti(1600);
        applyChange(res, 'Статус змінено на «' + STATUS[sel.value].label + '»');
      }
    });

    tbody.addEventListener('dblclick', (ev) => {
      if (ev.target.closest('a, button, select, input')) return;
      const cell = ev.target.closest('td[data-dbl-edit]');
      if (!cell) return;
      const tr = cell.closest('tr[data-task-id]');
      if (!tr) return;
      startInlineEdit(tr.getAttribute('data-task-id'), cell.getAttribute('data-dbl-edit'));
    });

    /* ---------- 6. Живий підсумковий рядок <tfoot> та Пагінація ---------- */
    let sumPlanned = 0, sumProg = 0, sumDone = 0, sumOverdue = 0, sumSubDone = 0, sumSubTotal = 0;
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (t.status === 'DONE') sumDone++;
      else if (t.status === 'IN_PROGRESS') sumProg++;
      else sumPlanned++;
      if (t.isOverdue(today)) sumOverdue++;
      const sp = t.subtaskProgress();
      sumSubDone += sp.done;
      sumSubTotal += sp.total;
    }
    const visPct = tasks.length > 0 ? Math.round((sumDone / tasks.length) * 100) : 0;

    const tfoot = tasks.length > 0 ? h('tfoot', {}, [
      h('tr', { class: 'smart-summary-foot' }, [
        h('td', { colspan: '8' }, [
          h('div', { class: 'smart-tfoot-inner' }, [
            h('span', {}, [h('strong', { text: '📊 Підсумок вибірки (' + tasks.length + '):' })]),
            h('span', { text: '🗓️ План: ' + sumPlanned }),
            h('span', { text: '⏳ У роботі: ' + sumProg }),
            h('span', { style: 'color:var(--ok); font-weight:800;', text: '✅ Виконано: ' + sumDone + ' (' + visPct + '%)' }),
            sumOverdue > 0 ? h('span', { style: 'color:var(--danger); font-weight:800;', text: '🚨 Прострочено: ' + sumOverdue }) : null,
            sumSubTotal > 0 ? h('span', { text: '☑️ Етапи: ' + sumSubDone + '/' + sumSubTotal }) : null,
            h('span', { class: 'smart-tfoot-hint', text: '💡 Порада: подвійний клік на комірці — швидке редагування • Shift+Клік — вибір діапазону' })
          ])
        ])
      ])
    ]) : null;

    const pageSizeSelect = h('select', { class: 'smart-tool-select', 'aria-label': 'Кількість рядків на сторінку' }, [
      h('option', { value: '10', text: 'По 10 рядків', selected: pageSize === 10 }),
      h('option', { value: '25', text: 'По 25 рядків', selected: pageSize === 25 }),
      h('option', { value: '50', text: 'По 50 рядків', selected: pageSize === 50 }),
      h('option', { value: '0', text: 'Показати всі (' + totalVisible + ')', selected: pageSize === 0 })
    ]);
    pageSizeSelect.addEventListener('change', () => {
      state.page = 1;
      updatePrefs({ pageSize: Number(pageSizeSelect.value) });
    });

    const paginationBar = totalVisible > 10 ? h('div', { class: 'smart-pagination-bar' }, [
      h('div', { style: 'font-size:0.82rem; color:var(--muted); font-weight:700;' }, [
        pageSize > 0
          ? ('Рядки ' + (startIdx + 1) + '–' + Math.min(startIdx + pageSize, totalVisible) + ' із ' + totalVisible)
          : ('Показано всі ' + totalVisible + ' рядків')
      ]),
      h('div', { style: 'display:flex; align-items:center; gap:8px; flex-wrap:wrap;' }, [
        pageSizeSelect,
        totalPages > 1 ? h('button', {
          type: 'button',
          class: 'btn btn-small',
          disabled: state.page <= 1,
          text: '◀ Попередня',
          onclick: () => { state.page--; renderResults(); }
        }) : null,
        totalPages > 1 ? h('span', { style: 'font-size:0.83rem; font-weight:800;', text: 'Стор. ' + state.page + ' / ' + totalPages }) : null,
        totalPages > 1 ? h('button', {
          type: 'button',
          class: 'btn btn-small',
          disabled: state.page >= totalPages,
          text: 'Наступна ▶',
          onclick: () => { state.page++; renderResults(); }
        }) : null
      ])
    ]) : null;

    const tableCls = [
      'smart-table',
      'density-' + prefs.density,
      prefs.zebra ? 'is-zebra' : '',
      prefs.gridLines ? 'is-gridlines' : ''
    ].filter(Boolean).join(' ');

    return h('div', { class: 'smart-table-shell' }, [
      topToolsBar,
      quickAddBar,
      bulkBar,
      subjectDatalist,
      h('div', { class: 'smart-table-scroll' }, [
        h('table', { id: 'task-table', class: tableCls }, [
          thead,
          tbody,
          tfoot
        ])
      ]),
      paginationBar
    ]);
  }

  SP.SmartTable = {
    build: build,
    clearSelection: clearSelection,
    getSelectedCount: getSelectedCount
  };
})(window);
