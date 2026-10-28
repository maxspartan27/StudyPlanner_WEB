/**
 * modules/welcome.js — [UI Subsystem] Анімований вітальний екран при відкритті сайту (SP.WelcomeSplash).
 * Плавна GPU-анімація (transform3d + opacity + scaleX без Layout/Paint лагів) на ~2.2 секунди з автоприховуванням.
 * Версія 2.1.7 (build 217) Redstone 5 — Автор: Максим Ковалишин.
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});
  const doc = global.document;

  let deps = null;
  let autoTimer = null;
  let hideTimer = null;
  let isDismissed = false;

  function getTimeGreeting(dateObj) {
    const h = (dateObj || new Date()).getHours();
    if (h >= 5 && h < 12) return '🌅 Доброго ранку! Натхненного старту';
    if (h >= 12 && h < 18) return '☀️ Доброго дня! Час для нових звершень';
    if (h >= 18 && h < 23) return '🌆 Доброго вечора! Продуктивного фокусу';
    return '🌙 Доброї ночі! Спокійного навчання';
  }

  function populateDynamicInfo() {
    if (!deps) return;
    const greetEl = doc.getElementById('welcome-greeting-text');
    const subEl = doc.getElementById('welcome-subtext');
    const tasksChip = doc.getElementById('welcome-chip-tasks');
    const themeChip = doc.getElementById('welcome-chip-theme');

    if (greetEl) {
      greetEl.textContent = getTimeGreeting(new Date());
    }

    if (deps.manager && deps.storage) {
      const today = SP.todayISO ? SP.todayISO() : '';
      const pomo = deps.storage.getPomoStats();
      const mastered = SP.FlashcardsView ? SP.FlashcardsView.getMasteredCount(deps.storage) : 0;
      const stats = deps.manager.getStats(today, { pomoSessions: pomo.sessions, masteredCards: mastered });
      const activeCount = Math.max(0, stats.total - stats.done);
      const themeId = SP.ThemeEngine ? SP.ThemeEngine.getThemeId() : 'light';
      const themeName = (SP.THEMES && SP.THEMES[themeId]) ? SP.THEMES[themeId] : 'Класична лазур';

      if (subEl) {
        subEl.textContent = stats.total > 0
          ? 'Ласкаво просимо у ваш модернізований простір! Виконано ' + stats.percent + '% плану • Ранг: ' + stats.rankTitle + '.'
          : 'Ласкаво просимо до швидкого та сучасного простору планування навчання без жодних лагів!';
      }
      if (tasksChip) {
        tasksChip.textContent = stats.total > 0
          ? '📋 Активних завдань: ' + activeCount + ' (усього ' + stats.total + ')'
          : '✨ Готово до планування (16 тем)';
      }
      if (themeChip) {
        themeChip.textContent = '🎨 Тема: ' + themeName;
      }
    }
  }

  function dismiss() {
    const splash = doc.getElementById('welcome-splash');
    if (!splash || isDismissed) return;
    isDismissed = true;
    global.clearTimeout(autoTimer);
    global.clearTimeout(hideTimer);

    splash.classList.add('is-leaving');
    splash.setAttribute('aria-hidden', 'true');

    const reduced = (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      doc.documentElement.getAttribute('data-perf') === 'turbo';

    hideTimer = global.setTimeout(() => {
      splash.classList.remove('is-animating', 'is-leaving');
      splash.hidden = true;
    }, reduced ? 60 : 430);
  }

  function show(durationMs) {
    const splash = doc.getElementById('welcome-splash');
    if (!splash) return;

    global.clearTimeout(autoTimer);
    global.clearTimeout(hideTimer);
    isDismissed = false;

    populateDynamicInfo();

    splash.hidden = false;
    splash.removeAttribute('aria-hidden');
    splash.classList.remove('is-leaving', 'is-animating');
    // Примусове перезапускання композитної scaleX-анімації прогрес-бару
    void splash.offsetWidth;
    splash.classList.add('is-animating');

    const reduced = (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      doc.documentElement.getAttribute('data-perf') === 'turbo';
    const wait = reduced ? 700 : (durationMs || 2200);

    autoTimer = global.setTimeout(dismiss, wait);
  }

  function init(options) {
    deps = options || {};
    const splash = doc.getElementById('welcome-splash');
    if (!splash) return;

    splash.addEventListener('click', dismiss);

    global.addEventListener('keydown', (e) => {
      if (!isDismissed && !splash.hidden) {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          dismiss();
        }
      }
    });

    show(2200);
  }

  function replay() {
    show(2350);
  }

  SP.WelcomeSplash = {
    init: init,
    show: show,
    replay: replay,
    dismiss: dismiss
  };
})(window);

