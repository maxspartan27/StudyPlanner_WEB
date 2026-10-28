/**
 * modules/gradebook.js — [UI Subsystem] Інтерактивний Журнал оцінок та Калькулятор стипендії ECTS / GPA (#/grades).
 * Версія 2.1.7 (build 217) Redstone 5 — Автор: Максим Ковалишин.
 * Можливості:
 * - Жива інтерактивна таблиця оцінок і кредитів ECTS: додавання, редагування балів/кредитів, зміна статусів та видалення рядків.
 * - Автоматичний перерахунок середнього зваженого бала (0–100), шкали ECTS (A–F), GPA (4.0) та прогнозу стипендії.
 * - Синхронізація дисциплін із завданнями користувача, експорт у CSV / Markdown та підтримка скасування дій (Undo).
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});

  const COURSE_STATUS = Object.freeze({
    STUDYING: { code: 'STUDYING', label: '⏳ Вивчається' },
    PASSED: { code: 'PASSED', label: '✅ Складено' },
    AUTO: { code: 'AUTO', label: '🌟 Автомат' },
    RETAKE: { code: 'RETAKE', label: '🔄 Перездача' }
  });

  const CONTROL_TYPES = Object.freeze({
    EXAM: 'Іспит',
    CREDIT: 'Залік',
    COURSEWORK: 'Курсова'
  });

  const DEMO_GRADES = [
    { id: 'gr-1', subject: 'Вебпрограмування', credits: 5, score: 96, control: 'EXAM', status: 'AUTO' },
    { id: 'gr-2', subject: 'Вища математика', credits: 6, score: 91, control: 'EXAM', status: 'PASSED' },
    { id: 'gr-3', subject: 'Фізика', credits: 5, score: 86, control: 'EXAM', status: 'STUDYING' },
    { id: 'gr-4', subject: 'Алгоритми і структури даних', credits: 5, score: 94, control: 'COURSEWORK', status: 'PASSED' },
    { id: 'gr-5', subject: 'Біологія та генетика', credits: 3, score: 88, control: 'CREDIT', status: 'PASSED' },
    { id: 'gr-6', subject: 'Англійська мова за проф. спрямуванням', credits: 4, score: 92, control: 'CREDIT', status: 'AUTO' },
    { id: 'gr-7', subject: 'Архітектура та дизайн інтерфейсів', credits: 4, score: 95, control: 'CREDIT', status: 'STUDYING' }
  ];

  let undoBuffer = null;

  function scoreToEcts(score) {
    const s = Number(score) || 0;
    if (s >= 90) return { letter: 'A', national: 'Відмінно (5)', gpa: 4.0, cls: 'badge-DONE' };
    if (s >= 82) return { letter: 'B', national: 'Добре (4+)', gpa: 3.5, cls: 'badge-IN_PROGRESS' };
    if (s >= 74) return { letter: 'C', national: 'Добре (4)', gpa: 3.0, cls: 'badge-IN_PROGRESS' };
    if (s >= 64) return { letter: 'D', national: 'Задовільно (3+)', gpa: 2.5, cls: 'badge-today' };
    if (s >= 60) return { letter: 'E', national: 'Задовільно (3)', gpa: 2.0, cls: 'badge-PLANNED' };
    if (s >= 35) return { letter: 'FX', national: 'Незадовільно (перездача)', gpa: 0.0, cls: 'badge-overdue' };
    return { letter: 'F', national: 'Незадовільно (повторний курс)', gpa: 0.0, cls: 'badge-overdue' };
  }

  function getCourses(storage) {
    let list = storage.getGrades();
    if (!list) {
      list = DEMO_GRADES.map((g) => Object.assign({}, g));
      storage.setGrades(list);
    }
    return list;
  }

  function getPassedCount(storage) {
    const list = getCourses(storage);
    let count = 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i].status === 'PASSED' || list[i].status === 'AUTO') count++;
    }
    return count;
  }

  function computeSummary(courses) {
    let totalCredits = 0;
    let passedCredits = 0;
    let weightedSum = 0;
    let gpaWeighted = 0;
    let hasRetake = false;

    for (let i = 0; i < courses.length; i++) {
      const c = courses[i];
      const cr = Math.max(1, Math.min(30, Number(c.credits) || 3));
      const sc = Math.max(0, Math.min(100, Number(c.score) || 0));
      const ects = scoreToEcts(sc);

      totalCredits += cr;
      weightedSum += sc * cr;
      gpaWeighted += ects.gpa * cr;

      if (c.status === 'PASSED' || c.status === 'AUTO') passedCredits += cr;
      if (c.status === 'RETAKE' || sc < 60) hasRetake = true;
    }

    const avgScore = totalCredits > 0 ? Math.round((weightedSum / totalCredits) * 100) / 100 : 0;
    const gpa = totalCredits > 0 ? (gpaWeighted / totalCredits).toFixed(2) : '0.00';
    const overallEcts = scoreToEcts(Math.round(avgScore));

    let scholarshipLabel = 'Додайте предмети';
    let scholarshipCls = 'badge-PLANNED';
    if (courses.length > 0) {
      if (hasRetake) {
        scholarshipLabel = '⚠️ Потрібно закрити заборгованість (бал ≥ 60)';
        scholarshipCls = 'badge-overdue';
      } else if (avgScore >= 90) {
        scholarshipLabel = '🏆 Претендент на підвищену стипендію!';
        scholarshipCls = 'badge-DONE';
      } else if (avgScore >= 75) {
        scholarshipLabel = '🎓 Рейтинг академічної стипендії';
        scholarshipCls = 'badge-IN_PROGRESS';
      } else {
        const diff = (75 - avgScore).toFixed(1);
        scholarshipLabel = '📈 Ще +' + diff + ' б. до стипендіального порогу';
        scholarshipCls = 'badge-today';
      }
    }

    return {
      count: courses.length,
      totalCredits: totalCredits,
      passedCredits: passedCredits,
      avgScore: avgScore,
      gpa: gpa,
      overallLetter: courses.length > 0 ? overallEcts.letter : '—',
      scholarshipLabel: scholarshipLabel,
      scholarshipCls: scholarshipCls
    };
  }

  function exportGradesCSV(courses) {
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [
      ['№', 'Дисципліна', 'Форма контролю', 'Кредити ECTS', 'Бал (0-100)', 'ECTS', 'Національна шкала', 'Статус'].map(esc).join(';')
    ];
    courses.forEach((c, idx) => {
      const e = scoreToEcts(c.score);
      const st = COURSE_STATUS[c.status] ? COURSE_STATUS[c.status].label : c.status;
      rows.push([
        idx + 1,
        c.subject,
        CONTROL_TYPES[c.control] || 'Іспит',
        c.credits,
        c.score,
        e.letter,
        e.national,
        st
      ].map(esc).join(';'));
    });
    return '\uFEFF' + rows.join('\r\n');
  }

  function exportGradesMarkdown(courses, sum) {
    const lines = [
      '| № | Дисципліна | Контроль | ECTS кредити | Бал | Оцінка ECTS | Статус |',
      '|---:|---|---|---:|---:|:---:|---|'
    ];
    courses.forEach((c, i) => {
      const e = scoreToEcts(c.score);
      const st = COURSE_STATUS[c.status] ? COURSE_STATUS[c.status].label : c.status;
      lines.push(
        '| ' + (i + 1) +
        ' | ' + String(c.subject).replace(/\|/g, '\\|') +
        ' | ' + (CONTROL_TYPES[c.control] || 'Іспит') +
        ' | ' + c.credits +
        ' | **' + c.score + '**' +
        ' | `' + e.letter + '`' +
        ' | ' + st + ' |'
      );
    });
    lines.push('');
    lines.push('**Середній зважений бал:** ' + sum.avgScore + ' / 100 • **GPA:** ' + sum.gpa + ' • **Кредитів ECTS:** ' + sum.totalCredits);
    return lines.join('\n');
  }

  function render(container, opts) {
    const h = SP.DOM.h;
    const fragment = SP.DOM.fragment;
    const badge = SP.DOM.badge;
    const toast = SP.DOM.toast;

    const storage = opts.storage;
    const manager = opts.manager;
    const refresh = opts.onRouteRefresh;

    const courses = getCourses(storage);
    const summary = computeSummary(courses);

    function saveWithUndo(nextList, label) {
      undoBuffer = {
        label: label,
        snapshot: courses.map((c) => Object.assign({}, c))
      };
      storage.setGrades(nextList);
    }

    function undoGradeChange() {
      if (!undoBuffer) return;
      storage.setGrades(undoBuffer.snapshot);
      const lbl = undoBuffer.label;
      undoBuffer = null;
      toast('Скасовано: ' + lbl + ' ↩️', false);
      refresh();
    }

    container.appendChild(h('div', { style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;' }, [
      h('h1', { style: 'margin:0;' }, [
        '🎓 Журнал оцінок та Калькулятор стипендії ECTS ',
        h('span', { class: 'badge-version', text: 'v2.1.7 RS5' })
      ]),
      h('div', { style: 'display:flex; gap:8px; flex-wrap:wrap;' }, [
        undoBuffer ? h('button', {
          type: 'button',
          class: 'btn btn-small',
          text: '↩️ Скасувати',
          onclick: undoGradeChange
        }) : null,
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          title: 'Автоматично додати у заліковку нові предмети з ваших завдань',
          text: '📥 Імпорт предметів із завдань',
          onclick: () => {
            const taskSubjects = manager.getSubjects();
            if (taskSubjects.length === 0) {
              toast('Спочатку додайте навчальні завдання зі списку дисциплін', true);
              return;
            }
            const existing = new Set(courses.map((c) => c.subject.toLocaleLowerCase('uk-UA')));
            const added = [];
            taskSubjects.forEach((subj) => {
              if (!existing.has(subj.toLocaleLowerCase('uk-UA'))) {
                added.push({
                  id: SP.newId('gr-'),
                  subject: subj,
                  credits: 4,
                  score: 85,
                  control: 'EXAM',
                  status: 'STUDYING'
                });
              }
            });
            if (added.length === 0) {
              toast('Усі предмети з ваших завдань уже є у журналі оцінок!', false);
              return;
            }
            saveWithUndo(courses.concat(added), 'імпорт предметів');
            toast('Додано дисциплін із завдань: ' + added.length + ' 📘', false, {
              actionLabel: '↩️ Скасувати',
              onAction: undoGradeChange
            });
            refresh();
          }
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          text: '📋 Копіювати MD',
          onclick: () => {
            SP.DOM.copyText(exportGradesMarkdown(courses, summary)).then((ok) => {
              toast(ok ? 'Таблицю оцінок скопійовано у Markdown! 📋' : 'Не вдалося скопіювати', !ok);
            });
          }
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-small btn-primary',
          text: '📊 Експорт .CSV',
          onclick: () => {
            SP.DOM.downloadFile(exportGradesCSV(courses), 'studyplanner-grades-ects-v2.1.7.csv', 'text/csv;charset=utf-8');
            toast('Журнал оцінок ECTS вивантажено у CSV!', false);
          }
        }),
        h('a', { class: 'btn btn-small', href: '#/', text: '← До завдань' })
      ])
    ]));

    // Верхні KPI-картки успішності
    const kpiGrid = h('div', { class: 'stats-grid' }, [
      h('div', { class: 'stat-card stat-progress' }, [
        h('div', { class: 'stat-card-header' }, [h('span', { class: 'stat-label', text: 'Середній зважений бал' }), h('span', { class: 'stat-icon', text: '🎯' })]),
        h('div', { class: 'stat-value', text: String(summary.avgScore) }),
        h('span', { style: 'font-size:0.78rem; color:var(--muted); margin-top:6px;', text: 'Зі 100 балів (зважено за ECTS)' })
      ]),
      h('div', { class: 'stat-card stat-done' }, [
        h('div', { class: 'stat-card-header' }, [h('span', { class: 'stat-label', text: 'Міжнародний GPA / ECTS' }), h('span', { class: 'stat-icon', text: '🏅' })]),
        h('div', { class: 'stat-value', text: summary.gpa + ' (' + summary.overallLetter + ')' }),
        h('span', { style: 'font-size:0.78rem; color:var(--muted); margin-top:6px;', text: 'За 4.0-бальною академічною шкалою' })
      ]),
      h('div', { class: 'stat-card' }, [
        h('div', { class: 'stat-card-header' }, [h('span', { class: 'stat-label', text: 'Кредити ECTS' }), h('span', { class: 'stat-icon', text: '📚' })]),
        h('div', { class: 'stat-value', text: summary.passedCredits + ' / ' + summary.totalCredits }),
        h('span', { style: 'font-size:0.78rem; color:var(--muted); margin-top:6px;', text: 'Зараховано із загального обсягу (' + summary.count + ' дисц.)' })
      ]),
      h('div', { class: 'stat-card' }, [
        h('div', { class: 'stat-card-header' }, [h('span', { class: 'stat-label', text: 'Стипендіальний статус' }), h('span', { class: 'stat-icon', text: '💎' })]),
        h('div', { style: 'margin-top:4px;' }, [badge(summary.scholarshipCls, summary.scholarshipLabel)]),
        h('span', { style: 'font-size:0.76rem; color:var(--muted); margin-top:8px;', text: 'Поріг: ≥75 звичайна • ≥90 підвищена' })
      ])
    ]);
    container.appendChild(kpiGrid);

    // Рядок додавання нової дисципліни у таблицю заліковки
    const subjInp = h('input', { type: 'text', placeholder: '➕ Нова дисципліна (напр. Комп’ютерні мережі)...', 'aria-label': 'Назва дисципліни' });
    const controlSel = h('select', { 'aria-label': 'Форма контролю' }, [
      h('option', { value: 'EXAM', text: '📝 Іспит' }),
      h('option', { value: 'CREDIT', text: '☑️ Залік' }),
      h('option', { value: 'COURSEWORK', text: '🎓 Курсова' })
    ]);
    const creditsInp = h('input', { type: 'number', min: '1', max: '30', value: '4', 'aria-label': 'Кредити ECTS', title: 'Кількість кредитів ECTS (1–30)' });
    const scoreInp = h('input', { type: 'number', min: '0', max: '100', value: '90', 'aria-label': 'Бал (0–100)', title: 'Оцінка за 100-бальною шкалою' });
    const statusSel = h('select', { 'aria-label': 'Статус дисципліни' }, [
      h('option', { value: 'STUDYING', text: '⏳ Вивчається' }),
      h('option', { value: 'PASSED', text: '✅ Складено' }),
      h('option', { value: 'AUTO', text: '🌟 Автомат' }),
      h('option', { value: 'RETAKE', text: '🔄 Перездача' })
    ]);

    const addCourse = () => {
      const name = subjInp.value.trim();
      if (!name) {
        subjInp.focus();
        toast('Введіть назву навчальної дисципліни', true);
        return;
      }
      const cr = Math.max(1, Math.min(30, Number(creditsInp.value) || 4));
      const sc = Math.max(0, Math.min(100, Number(scoreInp.value) || 0));
      const next = courses.concat([{
        id: SP.newId('gr-'),
        subject: name.slice(0, 90),
        control: controlSel.value,
        credits: cr,
        score: sc,
        status: statusSel.value
      }]);
      saveWithUndo(next, 'додавання дисципліни');
      if (sc >= 90) SP.DOM.fireConfetti(1400);
      toast('Дисципліну «' + name + '» додано до журналу оцінок!', false, {
        actionLabel: '↩️ Скасувати',
        onAction: undoGradeChange
      });
      refresh();
    };
    subjInp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); addCourse(); }
    });

    const quickAddRow = h('div', { class: 'smart-quick-add-bar grades-quick-add' }, [
      h('div', { class: 'qa-cell qa-title' }, [subjInp]),
      h('div', { class: 'qa-cell' }, [controlSel]),
      h('div', { class: 'qa-cell qa-num' }, [creditsInp]),
      h('div', { class: 'qa-cell qa-num' }, [scoreInp]),
      h('div', { class: 'qa-cell' }, [statusSel]),
      h('div', { class: 'qa-cell qa-submit' }, [
        h('button', { type: 'button', class: 'btn btn-small btn-primary', text: '➕ Додати курс', onclick: addCourse })
      ])
    ]);

    const tbody = h('tbody');
    if (courses.length === 0) {
      tbody.appendChild(h('tr', {}, [
        h('td', { colspan: '8', class: 'smart-empty-cell' }, [
          h('div', { class: 'smart-empty-box' }, [
            h('strong', { text: '🎓 Журнал оцінок порожній' }),
            h('p', { text: 'Додайте ваші семестрові предмети вище або завантажте демонстраційну заліковку з 7 дисциплін.' }),
            h('button', {
              type: 'button',
              class: 'btn btn-small btn-primary',
              text: '✨ Завантажити демо-заліковку (7 предметів)',
              onclick: () => {
                saveWithUndo(DEMO_GRADES.map((g) => Object.assign({}, g)), 'завантаження демо-заліковки');
                SP.DOM.fireConfetti(1600);
                refresh();
              }
            })
          ])
        ])
      ]));
    } else {
      tbody.appendChild(fragment(courses.map((c, idx) => {
        const ects = scoreToEcts(c.score);

        const rowSubjInput = h('input', {
          type: 'text',
          class: 'grade-inline-text',
          value: c.subject,
          'aria-label': 'Назва предмета'
        });
        rowSubjInput.addEventListener('change', () => {
          const val = rowSubjInput.value.trim();
          if (!val) { rowSubjInput.value = c.subject; return; }
          const next = courses.map((x) => x.id === c.id ? Object.assign({}, x, { subject: val.slice(0, 90) }) : x);
          saveWithUndo(next, 'зміну назви предмета');
          refresh();
        });

        const rowControl = h('select', { class: 'smart-pill-select', 'aria-label': 'Форма контролю' }, [
          h('option', { value: 'EXAM', text: '📝 Іспит', selected: c.control === 'EXAM' }),
          h('option', { value: 'CREDIT', text: '☑️ Залік', selected: c.control === 'CREDIT' }),
          h('option', { value: 'COURSEWORK', text: '🎓 Курсова', selected: c.control === 'COURSEWORK' })
        ]);
        rowControl.addEventListener('change', () => {
          const next = courses.map((x) => x.id === c.id ? Object.assign({}, x, { control: rowControl.value }) : x);
          saveWithUndo(next, 'зміну форми контролю');
          refresh();
        });

        const rowCredits = h('input', {
          type: 'number',
          min: '1',
          max: '30',
          class: 'grade-num-input',
          value: String(c.credits),
          'aria-label': 'Кредити ECTS'
        });
        rowCredits.addEventListener('change', () => {
          const cr = Math.max(1, Math.min(30, Number(rowCredits.value) || 3));
          const next = courses.map((x) => x.id === c.id ? Object.assign({}, x, { credits: cr }) : x);
          saveWithUndo(next, 'зміну кредитів ECTS');
          refresh();
        });

        const rowScore = h('input', {
          type: 'number',
          min: '0',
          max: '100',
          class: 'grade-num-input score-input',
          value: String(c.score),
          'aria-label': 'Бал 0-100'
        });
        rowScore.addEventListener('change', () => {
          const sc = Math.max(0, Math.min(100, Number(rowScore.value) || 0));
          const next = courses.map((x) => x.id === c.id ? Object.assign({}, x, { score: sc }) : x);
          saveWithUndo(next, 'оновлення бала');
          if (sc >= 90 && c.score < 90) SP.DOM.fireConfetti(1200);
          refresh();
        });

        const stCls = (c.status === 'PASSED' || c.status === 'AUTO')
          ? 'status-DONE'
          : (c.status === 'RETAKE' ? 'prio-HIGH' : 'status-IN_PROGRESS');

        const rowStatus = h('select', { class: 'smart-pill-select ' + stCls, 'aria-label': 'Статус предмета' }, [
          h('option', { value: 'STUDYING', text: '⏳ Вивчається', selected: c.status === 'STUDYING' }),
          h('option', { value: 'PASSED', text: '✅ Складено', selected: c.status === 'PASSED' }),
          h('option', { value: 'AUTO', text: '🌟 Автомат', selected: c.status === 'AUTO' }),
          h('option', { value: 'RETAKE', text: '🔄 Перездача', selected: c.status === 'RETAKE' })
        ]);
        rowStatus.addEventListener('change', () => {
          const next = courses.map((x) => x.id === c.id ? Object.assign({}, x, { status: rowStatus.value }) : x);
          saveWithUndo(next, 'зміну статусу дисципліни');
          if (rowStatus.value === 'PASSED' || rowStatus.value === 'AUTO') SP.DOM.fireConfetti(1300);
          toast('Статус дисципліни оновлено!', false);
          refresh();
        });

        return h('tr', { class: 'smart-row' }, [
          h('td', { 'data-label': '№', style: 'font-weight:800; color:var(--muted); width:46px;', text: String(idx + 1) }),
          h('td', { 'data-label': 'Дисципліна' }, [rowSubjInput]),
          h('td', { 'data-label': 'Контроль' }, [rowControl]),
          h('td', { 'data-label': 'Кредити ECTS' }, [rowCredits]),
          h('td', { 'data-label': 'Бал (0–100)' }, [rowScore]),
          h('td', { 'data-label': 'Шкала ECTS' }, [
            h('div', { style: 'display:flex; align-items:center; gap:6px; flex-wrap:wrap;' }, [
              badge(ects.cls, ects.letter),
              h('span', { style: 'font-size:0.8rem; color:var(--text-secondary); font-weight:600;', text: ects.national })
            ])
          ]),
          h('td', { 'data-label': 'Статус' }, [rowStatus]),
          h('td', { class: 'actions-cell', 'data-label': 'Дії' }, [
            h('div', { class: 'cell-actions-wrap' }, [
              h('button', {
                type: 'button',
                class: 'table-icon-action danger',
                title: 'Видалити дисципліну з журналу оцінок',
                text: '🗑️',
                onclick: () => {
                  const next = courses.filter((x) => x.id !== c.id);
                  saveWithUndo(next, 'видалення «' + c.subject.slice(0, 22) + '»');
                  toast('Дисципліну видалено з журналу', false, {
                    actionLabel: '↩️ Скасувати',
                    onAction: undoGradeChange
                  });
                  refresh();
                }
              })
            ])
          ])
        ]);
      })));
    }

    const tableShell = h('section', { class: 'smart-table-shell', 'aria-label': 'Таблиця оцінок та кредитів ECTS' }, [
      h('div', { class: 'smart-table-toolbar' }, [
        h('div', { class: 'smart-toolbar-left' }, [
          h('span', { class: 'smart-table-badge', text: '🎓 Таблиця ECTS Redstone 5' }),
          h('span', { style: 'font-size:0.84rem; color:var(--text-secondary); font-weight:600;', text: 'Редагуйте бали, кредити та статуси прямо в комірках — рейтинг перераховується миттєво!' })
        ]),
        h('div', { class: 'smart-toolbar-right' }, [
          courses.length > 0 ? h('button', {
            type: 'button',
            class: 'btn btn-small',
            text: '🔄 Скинути на демо',
            onclick: () => {
              saveWithUndo(DEMO_GRADES.map((g) => Object.assign({}, g)), 'скидання демо-заліковки');
              toast('Відновлено 7 демонстраційних дисциплін', false, {
                actionLabel: '↩️ Скасувати',
                onAction: undoGradeChange
              });
              refresh();
            }
          }) : null,
          courses.length > 0 ? h('button', {
            type: 'button',
            class: 'btn btn-small btn-danger',
            text: '🧹 Очистити всі',
            onclick: async () => {
              const ok = await SP.DOM.confirmDelete('Очистити журнал оцінок?', 'Усі записи заліковки буде очищено (можна повернути кнопкою Скасувати).');
              if (!ok) return;
              saveWithUndo([], 'очищення заліковки');
              toast('Журнал оцінок очищено', false, {
                actionLabel: '↩️ Скасувати',
                onAction: undoGradeChange
              });
              refresh();
            }
          }) : null
        ])
      ]),
      quickAddRow,
      h('div', { class: 'smart-table-scroll' }, [
        h('table', { id: 'grades-table', class: 'smart-table is-zebra' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', { scope: 'col', text: '№' }),
              h('th', { scope: 'col', text: 'Навчальна дисципліна' }),
              h('th', { scope: 'col', text: 'Контроль' }),
              h('th', { scope: 'col', text: 'ECTS' }),
              h('th', { scope: 'col', text: 'Бал (0–100)' }),
              h('th', { scope: 'col', text: 'Оцінка ECTS' }),
              h('th', { scope: 'col', text: 'Статус здачі' }),
              h('th', { scope: 'col', text: 'Дії' })
            ])
          ]),
          tbody,
          courses.length > 0 ? h('tfoot', {}, [
            h('tr', { class: 'smart-summary-foot' }, [
              h('td', { colspan: '8' }, [
                h('div', { class: 'smart-tfoot-inner' }, [
                  h('strong', { text: '📊 Підсумок семестру:' }),
                  h('span', { text: 'Дисциплін: ' + summary.count }),
                  h('span', { text: 'Сума кредитів: ' + summary.totalCredits + ' ECTS' }),
                  h('span', { style: 'color:var(--primary); font-weight:800;', text: 'Середній зважений бал: ' + summary.avgScore }),
                  h('span', { style: 'color:var(--ok); font-weight:800;', text: 'GPA: ' + summary.gpa + ' / 4.00 (' + summary.overallLetter + ')' })
                ])
              ])
            ])
          ]) : null
        ])
      ])
    ]);

    container.appendChild(tableShell);
  }

  SP.GradebookView = {
    render: render,
    getCourses: getCourses,
    getPassedCount: getPassedCount,
    computeSummary: computeSummary
  };
})(window);

