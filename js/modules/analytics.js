/**
 * modules/analytics.js — [UI Subsystem] Центр візуальної аналітики SVG Donut, Зведеної Таблиці предметів та телеметрії (#/analytics).
 * Версія 2.1.7 (build 217) Redstone 5 — Автор: Максим Ковалишин.
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});

  /** Побудова векторної кільцевої SVG-діаграми (Donut Chart) без сторонніх бібліотек */
  function buildDonutChart(segments, centerValue, centerLabel) {
    const h = SP.DOM.h;
    const svgEl = SP.DOM.svgEl;
    const radius = 56;
    const circumference = 2 * Math.PI * radius;
    const total = segments.reduce((sum, s) => sum + s.value, 0);

    const circles = [
      svgEl('circle', {
        cx: '76', cy: '76', r: String(radius),
        fill: 'none',
        stroke: 'rgba(148,163,184,0.2)',
        'stroke-width': '18'
      })
    ];

    if (total > 0) {
      let offset = 0;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (seg.value <= 0) continue;
        const len = (seg.value / total) * circumference;
        circles.push(svgEl('circle', {
          cx: '76',
          cy: '76',
          r: String(radius),
          fill: 'none',
          stroke: seg.color,
          'stroke-width': '18',
          'stroke-dasharray': len.toFixed(2) + ' ' + circumference.toFixed(2),
          'stroke-dashoffset': (-offset).toFixed(2)
        }));
        offset += len;
      }
    }

    const svgWrap = h('div', { style: 'position:relative; width:152px; height:152px; flex-shrink:0;' }, [
      svgEl('svg', { viewBox: '0 0 152 152', class: 'donut-svg', 'aria-hidden': 'true' }, circles),
      h('div', {
        style: 'position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; pointer-events:none;'
      }, [
        h('strong', { style: 'font-size:1.35rem; line-height:1.1;', text: centerValue }),
        h('span', { style: 'font-size:0.72rem; color:var(--muted); font-weight:700;', text: centerLabel })
      ])
    ]);

    const legend = h('div', { class: 'donut-legend' }, segments.map((s) => {
      const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
      return h('div', { class: 'donut-legend-row' }, [
        h('span', {}, [
          h('span', { class: 'legend-dot', style: 'background:' + s.color + ';' }),
          s.label
        ]),
        h('span', { style: 'color:var(--text-secondary);', text: s.value + ' (' + pct + '%)' })
      ]);
    }));

    return h('div', { class: 'donut-wrap' }, [svgWrap, legend]);
  }

  function render(container, opts) {
    const h = SP.DOM.h;
    const badge = SP.DOM.badge;
    const manager = opts.manager;
    const storage = opts.storage;
    const filter = opts.filter;

    const today = SP.todayISO();
    const pomoStats = storage.getPomoStats();
    const allCards = SP.FlashcardsView.getDeck(storage);
    const masteredCards = SP.FlashcardsView.getMasteredCount(storage);
    const passedCourses = SP.GradebookView ? SP.GradebookView.getPassedCount(storage) : 0;
    const gradeSummary = SP.GradebookView ? SP.GradebookView.computeSummary(SP.GradebookView.getCourses(storage)) : null;

    const stats = manager.getStats(today, {
      pomoSessions: pomoStats.sessions,
      masteredCards: masteredCards,
      passedCourses: passedCourses
    });
    const diag = storage.getDiagnostics();
    const breakdown = manager.getSubjectBreakdown(today);

    container.appendChild(h('div', { style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;' }, [
      h('h1', { style: 'margin:0;', text: '📊 Центр візуальної аналітики та телеметрії v2.1.7 RS5' }),
      h('div', { style: 'display:flex; gap:8px; flex-wrap:wrap;' }, [
        h('a', { class: 'btn btn-small', href: '#/grades', text: '🎓 Журнал ECTS' }),
        h('button', {
          type: 'button',
          class: 'btn btn-small btn-primary',
          text: '📅 Експорт у Календар (.ICS)',
          onclick: () => {
            SP.DOM.downloadFile(manager.exportICS(), 'studyplanner-deadlines-v2.1.7-rs5.ics', 'text/calendar;charset=utf-8');
            SP.DOM.toast('Файл календаря .ICS завантажено! Імпортуйте у Google/Apple/Outlook Calendar.', false);
          }
        }),
        h('a', { class: 'btn btn-small', href: '#/', text: '← До завдань' })
      ])
    ]));

    const statusCard = h('section', { class: 'analytics-card', 'aria-label': 'Діаграма статусів завдань' }, [
      h('div', { style: 'display:flex; justify-content:space-between; align-items:center;' }, [
        h('h3', { style: 'margin:0; font-size:1.05rem;', text: '🎯 Баланс виконання завдань' }),
        badge('badge-DONE', stats.percent + '% виконано')
      ]),
      buildDonutChart([
        { label: 'Виконано', value: stats.done, color: '#16a34a' },
        { label: 'У роботі', value: stats.inProgress, color: '#2563eb' },
        { label: 'Заплановано', value: stats.planned, color: '#94a3b8' }
      ], stats.done + '/' + stats.total, 'Готово'),
      h('div', { style: 'display:flex; gap:8px; flex-wrap:wrap; font-size:0.82rem; color:var(--text-secondary);' }, [
        badge(stats.overdue > 0 ? 'badge-overdue' : 'badge-DONE', '🚨 Прострочено: ' + stats.overdue),
        badge('badge-soon', '⏳ Найближчі 3 дні: ' + stats.dueSoon),
        badge('badge-IN_PROGRESS', '☑️ Підзавдання: ' + stats.subtasksDone + '/' + stats.subtasksTotal)
      ])
    ]);

    const priorityCard = h('section', { class: 'analytics-card', 'aria-label': 'Діаграма пріоритетів' }, [
      h('div', { style: 'display:flex; justify-content:space-between; align-items:center;' }, [
        h('h3', { style: 'margin:0; font-size:1.05rem;', text: '⚡ Розподіл за пріоритетами' }),
        badge('badge-IN_PROGRESS', 'Всього: ' + stats.total)
      ]),
      buildDonutChart([
        { label: 'Високий пріоритет', value: stats.high, color: '#dc2626' },
        { label: 'Середній пріоритет', value: stats.medium, color: '#d97706' },
        { label: 'Низький пріоритет', value: stats.low, color: '#10b981' }
      ], String(stats.high), 'Високий'),
      h('p', { style: 'margin:0; font-size:0.84rem; color:var(--muted);', text: 'Починайте день із завдань високого пріоритету — у Розумній Таблиці їх можна відібрати або згрупувати в 1 клік.' })
    ]);

    const telemetryCard = h('section', { class: 'analytics-card', 'aria-label': 'Прогрес XP та діагностика системи' }, [
      h('div', { style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;' }, [
        h('h3', { style: 'margin:0; font-size:1.05rem;', text: '🏆 Академічний ранг та Оптимізація' }),
        badge('badge-IN_PROGRESS', stats.xp + ' XP')
      ]),
      h('div', { class: 'telemetry-meter' }, [
        h('div', { style: 'display:flex; justify-content:space-between; font-size:0.86rem; font-weight:800;' }, [
          h('span', { text: stats.rankTitle }),
          h('span', { style: 'color:var(--muted);', text: stats.xp + ' / ' + stats.nextRankXp + ' XP' })
        ]),
        h('div', { class: 'progress-track', style: 'height:10px; min-width:0;' }, [
          h('div', { class: 'progress-fill', style: 'width:' + stats.rankProgress + '%;' })
        ]),
        h('div', { style: 'display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;' }, [
          badge('badge-IN_PROGRESS', '⏱️ Pomodoro: ' + pomoStats.sessions + ' сес.'),
          badge('badge-DONE', '🧠 Карток: ' + masteredCards + '/' + allCards.length),
          gradeSummary ? badge('badge-DONE', '🎓 GPA: ' + gradeSummary.gpa + ' (' + gradeSummary.avgScore + ' б.)') : null
        ])
      ]),
      h('div', { class: 'telemetry-meter' }, [
        h('div', { style: 'display:flex; justify-content:space-between; font-size:0.84rem; font-weight:700;' }, [
          h('span', { text: '💾 Пам’ять localStorage (UTF-16):' }),
          h('span', { style: 'color:var(--primary);', text: diag.usedKB + ' КБ (' + diag.percent + '% від 5 МБ)' })
        ]),
        h('div', { class: 'progress-track', style: 'height:8px; min-width:0;' }, [
          h('div', { class: 'subject-stat-fill', style: 'width:' + Math.max(2, diag.percent) + '%;' })
        ]),
        h('div', { style: 'font-size:0.78rem; color:var(--muted);' }, [
          '⚡ Двигун v2.1.7 (build 217) Redstone 5: Map O(1) (' + manager.tasks.length + ' зап.), делегування подій таблиці активне.'
        ])
      ])
    ]);

    container.appendChild(h('div', { class: 'analytics-grid' }, [statusCard, priorityCard, telemetryCard]));

    // Зведена аналітична таблиця успішності за предметами (Redstone 5 Matrix)
    if (breakdown.length === 0) {
      container.appendChild(h('section', { class: 'panel empty' }, [
        h('p', { text: 'Додайте завдання у навчальний план, щоб побудувати зведену таблицю успішності за дисциплінами.' })
      ]));
      return;
    }

    const matrixTbody = h('tbody', {}, breakdown.map((item, idx) =>
      h('tr', { class: 'smart-row' }, [
        h('td', { 'data-label': '№', style: 'font-weight:800; color:var(--muted); width:44px;', text: String(idx + 1) }),
        h('td', { 'data-label': 'Дисципліна' }, [
          h('strong', { style: 'color:var(--text);', text: '📘 ' + item.subject })
        ]),
        h('td', { 'data-label': 'Всього', style: 'font-weight:800;', text: String(item.total) }),
        h('td', { 'data-label': 'План', text: String(item.planned) }),
        h('td', { 'data-label': 'У роботі', text: String(item.inProgress) }),
        h('td', { 'data-label': 'Виконано' }, [badge('badge-DONE', String(item.done))]),
        h('td', { 'data-label': 'Прострочено' }, [
          item.overdue > 0 ? badge('badge-overdue', String(item.overdue)) : h('span', { style: 'color:var(--muted);', text: '0' })
        ]),
        h('td', { 'data-label': 'Підзавдання', text: item.subtasksTotal > 0 ? (item.subtasksDone + '/' + item.subtasksTotal) : '—' }),
        h('td', { 'data-label': 'Прогрес', style: 'min-width:140px;' }, [
          h('div', { style: 'display:flex; align-items:center; gap:8px;' }, [
            h('div', { class: 'subject-stat-bar', style: 'flex:1;' }, [
              h('div', { class: 'subject-stat-fill', style: 'width:' + item.percent + '%;' })
            ]),
            h('strong', { style: 'font-size:0.82rem; min-width:38px;', text: item.percent + '%' })
          ])
        ]),
        h('td', { class: 'actions-cell', 'data-label': 'Дія' }, [
          h('button', {
            type: 'button',
            class: 'btn btn-small',
            text: '📋 Відкрити в таблиці',
            onclick: () => {
              filter.reset();
              filter.subject = item.subject;
              storage.setViewMode('table');
              global.location.hash = '#/';
            }
          })
        ])
      ])
    ));

    container.appendChild(h('section', { class: 'smart-table-shell', 'aria-label': 'Зведена таблиця успішності за предметами' }, [
      h('div', { class: 'smart-table-toolbar' }, [
        h('div', { class: 'smart-toolbar-left' }, [
          h('span', { class: 'smart-table-badge', text: '📊 Матриця дисциплін RS5' }),
          h('strong', { style: 'font-size:0.95rem;', text: 'Детальна таблиця виконання завдань за предметами' })
        ]),
        h('div', { class: 'smart-toolbar-right' }, [
          h('a', { class: 'btn btn-small btn-primary', href: '#/grades', text: '🎓 Перейти до оцінок ECTS →' })
        ])
      ]),
      h('div', { class: 'smart-table-scroll' }, [
        h('table', { id: 'analytics-subject-table', class: 'smart-table is-zebra' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', { scope: 'col', text: '№' }),
              h('th', { scope: 'col', text: 'Дисципліна' }),
              h('th', { scope: 'col', text: 'Всього' }),
              h('th', { scope: 'col', text: '🗓️ План' }),
              h('th', { scope: 'col', text: '⏳ Робота' }),
              h('th', { scope: 'col', text: '✅ Готово' }),
              h('th', { scope: 'col', text: '🚨 Борг' }),
              h('th', { scope: 'col', text: '☑️ Етапи' }),
              h('th', { scope: 'col', text: 'Прогрес' }),
              h('th', { scope: 'col', text: 'Перехід' })
            ])
          ]),
          matrixTbody
        ])
      ])
    ]));
  }

  SP.AnalyticsView = {
    buildDonutChart: buildDonutChart,
    render: render
  };
})(window);
