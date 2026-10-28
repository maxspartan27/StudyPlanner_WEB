/**
 * modules/themeEngine.js — [UI Subsystem] рушій 16 фото- та кольорових тем, 30 локальних HD-шпалер, GPU-плавності та «Хамелеон».
 * Версія 2.1.7 (build 217) Redstone 5 — Автор: Максим Ковалишин.
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});
  const doc = global.document;

  const THEME_GALLERY = Object.freeze([
    {
      id: 'light',
      name: 'Класична лазур',
      title: '☀️ Класична лазур',
      type: 'light',
      photo: 'img/web/wall-light.jpg',
      svg: 'img/theme-light.svg',
      desc: 'Світла академічна тема з чистим небесно-блакитним акцентом і гірським озером на шпалерах.',
      colors: ['#f1f5f9', '#ffffff', '#2563eb', '#16a34a']
    },
    {
      id: 'dark',
      name: 'Глибокий космос',
      title: '🌙 Глибокий космос',
      type: 'dark',
      photo: 'img/web/wall-dark.jpg',
      svg: 'img/theme-dark.svg',
      desc: 'Контрастна нічна тема з фотографією зоряного Чумацького Шляху над вершинами гір.',
      colors: ['#0b1120', '#1e293b', '#3b82f6', '#22c55e']
    },
    {
      id: 'ocean',
      name: 'Океанський бриз',
      title: '🌊 Океанський бриз',
      type: 'light',
      photo: 'img/web/wall-ocean.jpg',
      svg: 'img/theme-ocean.svg',
      desc: 'Освіжаюча бірюзово-лазурова палітра з оптимізованим HD-знімком прозорих океанських хвиль.',
      colors: ['#e0f2fe', '#ffffff', '#0284c7', '#0d9488']
    },
    {
      id: 'emerald',
      name: 'Смарагд & Природа',
      title: '🌿 Смарагд & Природа',
      type: 'dark',
      photo: 'img/web/wall-emerald.jpg',
      svg: 'img/theme-emerald.svg',
      desc: 'Глибока лісова палітра смарагдових і м’ятних тонів із туманним хвойним лісом.',
      colors: ['#04241b', '#0a3d2e', '#10b981', '#34d399']
    },
    {
      id: 'matcha',
      name: 'Японська матча',
      title: '🍵 Японська матча',
      type: 'light',
      photo: 'img/web/wall-matcha.jpg',
      svg: 'img/theme-matcha.svg',
      desc: 'Спокійна денна фісташково-зелена кольорова тема з природною гармонією листя.',
      colors: ['#ecfdf5', '#ffffff', '#15803d', '#16a34a']
    },
    {
      id: 'lavender',
      name: 'Лавандовий аметист',
      title: '💜 Лавандовий аметист',
      type: 'light',
      photo: 'img/web/wall-lavender.jpg',
      svg: 'img/theme-lavender.svg',
      desc: 'Елегантна фіолетово-лавандова тема для творчого натхнення з полями Провансу.',
      colors: ['#f5f3ff', '#ffffff', '#7c3aed', '#059669']
    },
    {
      id: 'sakura',
      name: 'Квітуча сакура',
      title: '🌸 Квітуча сакура',
      type: 'light',
      photo: 'img/web/wall-sakura.jpg',
      svg: 'img/theme-sakura.svg',
      desc: 'Ніжно-рожева весняна палітра зі справжньою фотографією квітучої японської сакури.',
      colors: ['#fdf2f8', '#ffffff', '#db2777', '#16a34a']
    },
    {
      id: 'aurora',
      name: 'Арктичне сяйво',
      title: '❄️ Арктичне сяйво',
      type: 'dark',
      photo: 'img/web/wall-aurora.jpg',
      svg: 'img/theme-aurora.svg',
      desc: 'Кришталево-бірюзова тема з реальним знімком північного полярного сяйва Aurora Borealis.',
      colors: ['#041e2b', '#092c3e', '#0d9488', '#34d399']
    },
    {
      id: 'crimson',
      name: 'Рубінове полум’я',
      title: '🍷 Рубінове полум’я',
      type: 'dark',
      photo: 'img/web/wall-crimson.jpg',
      svg: 'img/theme-crimson.svg',
      desc: 'Енергійна рубіново-коралова тема з теплим заходом сонця над морським узбережжям.',
      colors: ['#1a050a', '#2b0b14', '#e11d48', '#34d399']
    },
    {
      id: 'amber',
      name: 'Золотий бурштин',
      title: '🌅 Золотий бурштин',
      type: 'dark',
      photo: 'img/web/wall-amber.jpg',
      svg: 'img/theme-amber.svg',
      desc: 'Затишна медово-бурштинова тема із золотистими піщаними дюнами у променях сонця.',
      colors: ['#1c1103', '#2b1b07', '#d97706', '#34d399']
    },
    {
      id: 'neon',
      name: 'Кіберпанк Неон',
      title: '🌌 Кіберпанк Неон',
      type: 'dark',
      photo: 'img/web/wall-neon.jpg',
      svg: 'img/theme-neon.svg',
      desc: 'Футуристична неонова тема з вогнями нічного мегаполіса, ціановим і пурпуровим сяйвом.',
      colors: ['#090414', '#150d28', '#0891b2', '#10b981']
    },
    {
      id: 'cosmos',
      name: 'Ультрафіолет Космос',
      title: '🚀 Ультрафіолет Космос',
      type: 'dark',
      photo: 'img/web/wall-cosmos.jpg',
      svg: 'img/theme-cosmos.svg',
      desc: 'Космічна тема з ультрафіолетовою туманністю глибокого всесвіту та індиго-акцентами.',
      colors: ['#0c0724', '#18123b', '#7c3aed', '#34d399']
    },
    {
      id: 'nordic',
      name: 'Скандинавський фйорд',
      title: '🏔️ Скандинавський фйорд',
      type: 'light',
      isNew: true,
      photo: 'img/web/wall-nordic.jpg',
      svg: 'img/theme-nordic.svg',
      desc: 'Новинка v2.1.7 RS5! Кришталево-світла північна палітра крижаної води та гірських фйордів Норвегії.',
      colors: ['#eef6fa', '#ffffff', '#0369a1', '#0f766e']
    },
    {
      id: 'peach',
      name: 'Персиковий світанок',
      title: '🍑 Персиковий світанок',
      type: 'light',
      isNew: true,
      photo: 'img/web/wall-peach.jpg',
      svg: 'img/theme-peach.svg',
      desc: 'Новинка v2.1.7 RS5! Тепла ранкова пастельно-коралова тема з м’яким сонячним узбережжям.',
      colors: ['#fff7ed', '#ffffff', '#ea580c', '#15803d']
    },
    {
      id: 'obsidian',
      name: 'Обсидіан & Золото',
      title: '🖤 Обсидіан & Золото',
      type: 'dark',
      isNew: true,
      photo: 'img/web/wall-obsidian.jpg',
      svg: 'img/theme-obsidian.svg',
      desc: 'Преміальна новинка v2.1.7 RS5! Глибокий матовий обсидіан із благородними золотими акцентами.',
      colors: ['#09090b', '#18181b', '#ca8a04', '#22c55e']
    },
    {
      id: 'forest',
      name: 'Осінній каньйон',
      title: '🍁 Осінній каньйон',
      type: 'dark',
      isNew: true,
      photo: 'img/web/wall-forest.jpg',
      svg: 'img/theme-forest.svg',
      desc: 'Новинка v2.1.7 RS5! Затишна еспресо-мідна тема з туманними осінніми горами та золотим кленом.',
      colors: ['#170e0a', '#261710', '#ea580c', '#22c55e']
    }
  ]);

  const THEMES = {};
  THEME_GALLERY.forEach((t) => { THEMES[t.id] = t.name; });

  const INTERNET_WALLPAPERS = Object.freeze([
    { label: '🏔️ Фйорди Норвегії (NEW)', url: 'img/web/wall-nordic.jpg' },
    { label: '🍑 Персикове небо (NEW)', url: 'img/web/wall-peach.jpg' },
    { label: '🖤 Обсидіан Люкс (NEW)', url: 'img/web/wall-obsidian.jpg' },
    { label: '🍁 Осінній каньйон (NEW)', url: 'img/web/wall-forest.jpg' },
    { label: '🏛️ Академ. бібліотека (NEW)', url: 'img/web/wall-library.jpg' },
    { label: '🌧️ Вечірній дощ (NEW)', url: 'img/web/wall-raincity.jpg' },
    { label: '🏔️ Вершини Альп (NEW)', url: 'img/web/wall-alps.jpg' },
    { label: '🌐 Квантова сітка (NEW)', url: 'img/web/wall-cybergrid.jpg' },
    { label: '☀️ Гірське озеро', url: 'img/web/wall-light.jpg' },
    { label: '🌌 Зоряні гори', url: 'img/web/wall-dark.jpg' },
    { label: '🌊 Блакитний океан', url: 'img/web/wall-ocean.jpg' },
    { label: '🌲 Смарагдовий ліс', url: 'img/web/wall-emerald.jpg' },
    { label: '🍃 Зелена матча', url: 'img/web/wall-matcha.jpg' },
    { label: '💜 Поля лаванди', url: 'img/web/wall-lavender.jpg' },
    { label: '🌸 Японська сакура', url: 'img/web/wall-sakura.jpg' },
    { label: '❄️ Полярне сяйво', url: 'img/web/wall-aurora.jpg' },
    { label: '🌅 Рубіновий берег', url: 'img/web/wall-crimson.jpg' },
    { label: '🏜️ Золоті дюни', url: 'img/web/wall-amber.jpg' },
    { label: '🌃 Неонове місто', url: 'img/web/wall-neon.jpg' },
    { label: '🚀 Туманність космосу', url: 'img/web/wall-cosmos.jpg' },
    { label: '📚 Студентський стіл', url: 'img/web/hero-rs3.jpg' },
    { label: '🔭 Астрономія HD', url: 'img/web/photo-astronomy.jpg' },
    { label: '🌍 Карта мандрів', url: 'img/web/photo-geography.jpg' },
    { label: '🎨 Арт-майстерня', url: 'img/web/photo-art.jpg' },
    { label: '🌐 Онлайн: Фуджі', url: 'https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?w=1400&q=80&fit=crop' },
    { label: '🌐 Онлайн: Лагуна', url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1400&q=80&fit=crop' }
  ]);

  const VISUAL_MODES = Object.freeze({
    photo: { id: 'photo', label: '🖼️ Фото-шпалери + Скло', icon: '🖼️' },
    color: { id: 'color', label: '🎨 Чиста кольорова тема', icon: '🎨' },
    mesh: { id: 'mesh', label: '✨ Градієнтне сяйво', icon: '✨' }
  });

  const preloadedUrls = new Set();

  function preloadImage(url) {
    if (!url || preloadedUrls.has(url) || url.indexOf('data:') === 0) return;
    preloadedUrls.add(url);
    const img = new global.Image();
    img.decoding = 'async';
    img.src = url;
  }

  function hexToRgb(hex) {
    const clean = String(hex || '').replace('#', '');
    if (clean.length !== 6) return { r: 37, g: 99, b: 235 };
    const num = parseInt(clean, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function rgbToHex(r, g, b) {
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + [clamp(r), clamp(g), clamp(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  /** Алгоритм «Хамелеон»: аналізує пікселі зображення на Canvas і формує палітру */
  function extractChameleonColorsFromImage(imgUrl, preferLight) {
    return new Promise((resolve, reject) => {
      const img = new global.Image();
      if (/^https?:\/\//i.test(imgUrl)) img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const cv = doc.createElement('canvas');
          const size = 48;
          cv.width = size;
          cv.height = size;
          const ctx = cv.getContext('2d');
          ctx.drawImage(img, 0, 0, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;

          let bestSat = -1;
          let accent = { r: 59, g: 130, b: 246 };
          let sumR = 0, sumG = 0, sumB = 0, count = 0;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            if (a < 128) continue;
            sumR += r; sumG += g; sumB += b; count++;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const lum = (max + min) / 2;
            const sat = max === min ? 0 : (max - min) / (255 - Math.abs(2 * lum - 255) + 1);
            if (lum > 45 && lum < 215 && sat > bestSat) {
              bestSat = sat;
              accent = { r, g, b };
            }
          }

          const avgR = count ? sumR / count : 30;
          const avgG = count ? sumG / count : 41;
          const avgB = count ? sumB / count : 59;
          const primaryHex = rgbToHex(accent.r, accent.g, accent.b);

          if (preferLight) {
            resolve({
              primary: primaryHex,
              bg: rgbToHex(236 + avgR * 0.07, 240 + avgG * 0.06, 245 + avgB * 0.04),
              surface: '#ffffff',
              text: '#0f172a'
            });
          } else {
            resolve({
              primary: primaryHex,
              bg: rgbToHex(avgR * 0.22, avgG * 0.22, avgB * 0.26),
              surface: rgbToHex(avgR * 0.34 + 10, avgG * 0.34 + 12, avgB * 0.38 + 16),
              text: '#f8fafc'
            });
          }
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Не вдалося завантажити зображення для аналізу кольорів.'));
      img.src = imgUrl;
    });
  }

  let storage = null;
  let themeConfig = null;
  let onRouteRefresh = null;

  function getCurrentThemeId() {
    const attr = doc.documentElement.getAttribute('data-theme') || 'light';
    return THEMES[attr] ? attr : 'light';
  }

  function getActiveWallpaperUrl(themeId) {
    if (themeConfig && themeConfig.customWallpaper) return themeConfig.customWallpaper;
    const found = THEME_GALLERY.find((t) => t.id === themeId) || THEME_GALLERY[0];
    return found.photo;
  }

  function saveConfig() {
    if (storage && themeConfig) storage.setThemeConfig(themeConfig);
  }

  function applyThemeAndConfig(themeId) {
    const validTheme = THEMES[themeId] ? themeId : 'light';
    const root = doc.documentElement;
    root.setAttribute('data-theme', validTheme);
    root.setAttribute('data-visual-mode', themeConfig.visualMode || 'photo');
    root.setAttribute('data-perf', themeConfig.perfMode === 'turbo' ? 'turbo' : 'smooth');

    const wallUrl = getActiveWallpaperUrl(validTheme);
    preloadImage(wallUrl);
    const layer = doc.getElementById('site-wallpaper-layer');
    if (layer) {
      const nextBg = wallUrl ? 'url("' + wallUrl.replace(/"/g, '\\"') + '")' : '';
      if (layer.style.backgroundImage !== nextBg) {
        layer.style.backgroundImage = nextBg;
      }
    }

    root.style.setProperty('--wallpaper-dim', String((Number(themeConfig.wallpaperDim) || 58) / 100));
    root.style.setProperty('--wallpaper-blur', (Number(themeConfig.wallpaperBlur) || 0) + 'px');

    const customProps = [
      '--primary', '--primary-accent', '--primary-dark', '--primary-light', '--primary-ring', '--accent-glow',
      '--bg', '--surface', '--surface-glass', '--surface-card', '--surface-alt',
      '--text', '--text-secondary', '--muted', '--border'
    ];
    if (themeConfig.customColors && themeConfig.customColors.enabled) {
      const cc = themeConfig.customColors;
      const pr = hexToRgb(cc.primary);
      const sf = hexToRgb(cc.surface);
      const tx = hexToRgb(cc.text);
      const alpha = Math.max(0.6, Math.min(1, (Number(themeConfig.glassAlpha) || 88) / 100));

      root.style.setProperty('--primary', cc.primary);
      root.style.setProperty('--primary-accent', cc.primary);
      root.style.setProperty('--primary-dark', cc.primary);
      root.style.setProperty('--primary-light', 'rgba(' + pr.r + ',' + pr.g + ',' + pr.b + ',0.18)');
      root.style.setProperty('--primary-ring', 'rgba(' + pr.r + ',' + pr.g + ',' + pr.b + ',0.38)');
      root.style.setProperty('--accent-glow', 'rgba(' + pr.r + ',' + pr.g + ',' + pr.b + ',0.52)');
      root.style.setProperty('--bg', cc.bg);
      root.style.setProperty('--surface', cc.surface);
      root.style.setProperty('--surface-glass', 'rgba(' + sf.r + ',' + sf.g + ',' + sf.b + ',' + alpha + ')');
      root.style.setProperty('--surface-card', 'rgba(' + sf.r + ',' + sf.g + ',' + sf.b + ',0.88)');
      root.style.setProperty('--surface-alt', cc.surface);
      root.style.setProperty('--text', cc.text);
      root.style.setProperty('--text-secondary', 'rgba(' + tx.r + ',' + tx.g + ',' + tx.b + ',0.84)');
      root.style.setProperty('--muted', 'rgba(' + tx.r + ',' + tx.g + ',' + tx.b + ',0.64)');
      root.style.setProperty('--border', 'rgba(' + pr.r + ',' + pr.g + ',' + pr.b + ',0.34)');
    } else {
      customProps.forEach((p) => root.style.removeProperty(p));
    }

    const label = doc.getElementById('current-theme-label');
    if (label) {
      label.textContent = (themeConfig.customColors && themeConfig.customColors.enabled)
        ? 'Власна палітра (' + THEMES[validTheme] + ')'
        : THEMES[validTheme];
    }

    doc.querySelectorAll('.theme-option-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-theme-val') === validTheme);
    });

    doc.querySelectorAll('.theme-mini-thumb').forEach((img) => {
      const targetSrc = themeConfig.thumbStyle === 'svg'
        ? img.getAttribute('data-svg')
        : img.getAttribute('data-photo');
      if (targetSrc && img.getAttribute('src') !== targetSrc) {
        img.setAttribute('src', targetSrc);
      }
    });

    doc.querySelectorAll('.popover-mode-chip').forEach((chip) => {
      chip.classList.toggle('active', chip.getAttribute('data-vmode') === themeConfig.visualMode);
    });

    const vBtn = doc.getElementById('visual-mode-btn');
    if (vBtn && VISUAL_MODES[themeConfig.visualMode]) {
      vBtn.textContent = VISUAL_MODES[themeConfig.visualMode].icon;
      vBtn.title = 'Режим фону: ' + VISUAL_MODES[themeConfig.visualMode].label + ' (клавіша W)';
    }
  }

  function refreshActiveThemeBanner() {
    const banner = doc.getElementById('active-theme-banner-box');
    if (banner && banner.parentNode) {
      banner.parentNode.replaceChild(buildActiveThemeBanner(), banner);
    }
  }

  function selectTheme(themeId, resetCustom) {
    if (!THEMES[themeId]) return;
    if (resetCustom !== false) {
      themeConfig.customColors.enabled = false;
      themeConfig.customWallpaper = '';
      saveConfig();
    }
    storage.setTheme(themeId);
    applyThemeAndConfig(themeId);
    SP.DOM.toast('Активовано тему: ' + THEMES[themeId] + ' 🎨', false);
    doc.querySelectorAll('.theme-card').forEach((c) => {
      c.classList.toggle('active-theme', c.getAttribute('data-theme-card') === themeId);
    });
    refreshActiveThemeBanner();
    if ((global.location.hash || '').indexOf('#/themes') === 0 && onRouteRefresh) {
      onRouteRefresh();
    }
  }

  function cycleNextTheme() {
    const current = getCurrentThemeId();
    const idx = THEME_GALLERY.findIndex((t) => t.id === current);
    const nextItem = THEME_GALLERY[(idx + 1) % THEME_GALLERY.length];
    selectTheme(nextItem.id, true);
    SP.DOM.fireConfetti(1000);
  }

  function cycleVisualMode() {
    const order = ['photo', 'color', 'mesh'];
    const curIdx = order.indexOf(themeConfig.visualMode);
    const next = order[(curIdx + 1) % order.length];
    themeConfig.visualMode = next;
    saveConfig();
    applyThemeAndConfig(getCurrentThemeId());
    refreshActiveThemeBanner();
    SP.DOM.toast('Перемкнено режим фону: ' + VISUAL_MODES[next].label, false);
  }

  function togglePerfMode() {
    themeConfig.perfMode = themeConfig.perfMode === 'turbo' ? 'smooth' : 'turbo';
    saveConfig();
    applyThemeAndConfig(getCurrentThemeId());
    SP.DOM.toast(
      themeConfig.perfMode === 'turbo'
        ? '⚡ Увімкнено Турбо-режим (миттєві переходи без розмиття)'
        : '✨ Увімкнено Плавний 60+ FPS GPU-режим анімацій',
      false
    );
    if ((global.location.hash || '').indexOf('#/themes') === 0 && onRouteRefresh) {
      onRouteRefresh();
    }
  }

  function setCustomWallpaper(url, message) {
    themeConfig.customWallpaper = url || '';
    if (url) themeConfig.visualMode = 'photo';
    saveConfig();
    applyThemeAndConfig(getCurrentThemeId());
    refreshActiveThemeBanner();
    if (message) SP.DOM.toast(message, false);
  }

  function init(opts) {
    storage = opts.storage;
    onRouteRefresh = opts.onRouteRefresh || null;
    themeConfig = storage.getThemeConfig();

    const saved = storage.getTheme();
    const current = THEMES[saved] ? saved : 'light';
    applyThemeAndConfig(current);

    // Фоновий прелоад нових та сусідніх тем у режимі простою браузера
    const scheduleIdle = global.requestIdleCallback || function (cb) { global.setTimeout(cb, 900); };
    scheduleIdle(() => {
      THEME_GALLERY.slice(12, 16).concat(THEME_GALLERY.slice(0, 3)).forEach((t) => preloadImage(t.photo));
    });

    const themeMenuBtn = doc.getElementById('theme-menu-btn');
    const visualModeBtn = doc.getElementById('visual-mode-btn');
    const popover = doc.getElementById('theme-picker-popover');
    const footerThemeBtn = doc.getElementById('footer-btn-theme');
    const openCustLink = doc.getElementById('popover-open-customizer');

    function togglePopover(e) {
      if (e) e.stopPropagation();
      if (!popover) return;
      popover.classList.toggle('open');
      if (popover.classList.contains('open')) {
        THEME_GALLERY.forEach((t) => preloadImage(t.photo));
      }
    }

    if (themeMenuBtn) themeMenuBtn.addEventListener('click', togglePopover);
    if (footerThemeBtn) footerThemeBtn.addEventListener('click', togglePopover);
    if (openCustLink) {
      openCustLink.addEventListener('click', () => {
        if (popover) popover.classList.remove('open');
      });
    }
    if (visualModeBtn) visualModeBtn.addEventListener('click', cycleVisualMode);

    doc.querySelectorAll('.popover-mode-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = chip.getAttribute('data-vmode');
        if (VISUAL_MODES[mode]) {
          themeConfig.visualMode = mode;
          saveConfig();
          applyThemeAndConfig(getCurrentThemeId());
          refreshActiveThemeBanner();
          SP.DOM.toast('Режим оформлення: ' + VISUAL_MODES[mode].label, false);
        }
      });
    });

    doc.addEventListener('click', (e) => {
      if (popover && !popover.contains(e.target) && e.target !== themeMenuBtn && e.target !== footerThemeBtn) {
        popover.classList.remove('open');
      }
    });

    doc.querySelectorAll('.theme-option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-theme-val');
        if (val && THEMES[val]) {
          selectTheme(val, true);
          if (popover) popover.classList.remove('open');
        }
      });
    });
  }

  function buildActiveThemeBanner() {
    const h = SP.DOM.h;
    const badge = SP.DOM.badge;
    const currentId = getCurrentThemeId();
    const currentObj = THEME_GALLERY.find((t) => t.id === currentId) || THEME_GALLERY[0];
    const previewImg = themeConfig.customWallpaper ||
      (themeConfig.thumbStyle === 'svg' ? currentObj.svg : currentObj.photo);

    const activeColors = (themeConfig.customColors && themeConfig.customColors.enabled)
      ? [themeConfig.customColors.bg, themeConfig.customColors.surface, themeConfig.customColors.primary, themeConfig.customColors.text]
      : currentObj.colors;

    const dots = h('div', { class: 'theme-palette-dots' }, activeColors.map((hex) =>
      h('span', { class: 'palette-dot', style: 'background:' + hex + ';', title: hex })
    ));

    const vModeObj = VISUAL_MODES[themeConfig.visualMode] || VISUAL_MODES.photo;

    return h('section', { id: 'active-theme-banner-box', class: 'active-theme-banner', 'aria-label': 'Активна тема та шпалери' }, [
      h('img', {
        src: previewImg,
        alt: currentObj.title,
        class: 'active-theme-banner-img',
        title: 'Натисніть для перегляду шпалер теми на весь екран',
        onclick: () => SP.DOM.showLightbox(previewImg, currentObj.title)
      }),
      h('div', { class: 'active-theme-banner-info' }, [
        h('div', { style: 'display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;' }, [
          badge('badge-IN_PROGRESS', vModeObj.label),
          h('strong', { style: 'font-size:1.05rem;', text: currentObj.title }),
          currentObj.isNew ? badge('badge-DONE', '✨ Новинка v2.1.7 RS5') : null,
          (themeConfig.customColors && themeConfig.customColors.enabled) ? badge('badge-DONE', '🎛️ Кастомні кольори') : null,
          dots
        ]),
        h('p', { text: currentObj.desc })
      ]),
      h('div', { style: 'display:flex; gap:8px; flex-wrap:wrap;' }, [
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          title: 'Перемкнути між Фото-шпалерами, Чистим кольором та Градієнтом',
          text: '🖼️ Фото / Колір',
          onclick: cycleVisualMode
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-small btn-primary',
          text: '⏭️ Наступна тема',
          onclick: cycleNextTheme
        }),
        h('a', {
          class: 'btn btn-small',
          href: '#/themes',
          text: '🎛️ Студія 16 тем'
        })
      ])
    ]);
  }

  function buildThemeStudioPanel() {
    const h = SP.DOM.h;
    const badge = SP.DOM.badge;
    const toast = SP.DOM.toast;
    const currentThemeId = getCurrentThemeId();
    const activeWall = getActiveWallpaperUrl(currentThemeId);
    const cc = themeConfig.customColors;
    const refresh = () => { if (onRouteRefresh) onRouteRefresh(); };
    const throttledApply = SP.DOM.rafThrottle(() => applyThemeAndConfig(currentThemeId));

    const modeButtons = Object.keys(VISUAL_MODES).map((k) =>
      h('button', {
        type: 'button',
        class: 'btn btn-small' + (themeConfig.visualMode === k ? ' btn-primary' : ''),
        text: VISUAL_MODES[k].label,
        onclick: () => {
          themeConfig.visualMode = k;
          saveConfig();
          applyThemeAndConfig(currentThemeId);
          refresh();
        }
      })
    );
    modeButtons.push(h('button', {
      type: 'button',
      class: 'btn btn-small',
      title: 'Перемкнути прев’ю тем між реальними HD фотографіями та векторними схемами',
      text: themeConfig.thumbStyle === 'svg' ? '📸 Показати HD Фото на картках' : '📐 Показати SVG схеми на картках',
      onclick: () => {
        themeConfig.thumbStyle = themeConfig.thumbStyle === 'svg' ? 'photo' : 'svg';
        saveConfig();
        applyThemeAndConfig(currentThemeId);
        refresh();
      }
    }));

    const modeRow = h('div', { style: 'display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;' }, modeButtons);

    const dimValLabel = h('strong', { text: themeConfig.wallpaperDim + '%' });
    const dimRange = h('input', { type: 'range', min: '15', max: '92', value: String(themeConfig.wallpaperDim) });
    dimRange.addEventListener('input', () => {
      themeConfig.wallpaperDim = Number(dimRange.value);
      dimValLabel.textContent = themeConfig.wallpaperDim + '%';
      saveConfig();
      throttledApply();
    });

    const blurValLabel = h('strong', { text: themeConfig.wallpaperBlur + ' px' });
    const blurRange = h('input', { type: 'range', min: '0', max: '24', value: String(themeConfig.wallpaperBlur) });
    blurRange.addEventListener('input', () => {
      themeConfig.wallpaperBlur = Number(blurRange.value);
      blurValLabel.textContent = themeConfig.wallpaperBlur + ' px';
      saveConfig();
      throttledApply();
    });

    const glassValLabel = h('strong', { text: themeConfig.glassAlpha + '%' });
    const glassRange = h('input', { type: 'range', min: '65', max: '100', value: String(themeConfig.glassAlpha) });
    glassRange.addEventListener('input', () => {
      themeConfig.glassAlpha = Number(glassRange.value);
      glassValLabel.textContent = themeConfig.glassAlpha + '%';
      saveConfig();
      throttledApply();
    });

    const customUrlInput = h('input', {
      type: 'url',
      placeholder: 'Вставте URL будь-якого зображення з Інтернету (https://...)...',
      value: themeConfig.customWallpaper && themeConfig.customWallpaper.indexOf('data:') !== 0 ? themeConfig.customWallpaper : ''
    });

    const wallFileInput = h('input', { type: 'file', accept: 'image/*', style: 'display:none;' });
    wallFileInput.addEventListener('change', () => {
      const f = wallFileInput.files && wallFileInput.files[0];
      if (!f) return;
      if (f.size > 2.5 * 1024 * 1024) {
        toast('Оберіть зображення до 2.5 МБ', true);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCustomWallpaper(ev.target.result, 'Власні шпалери встановлено на фон сайту! 🖼️');
        refresh();
      };
      reader.readAsDataURL(f);
    });

    const wallpaperStrip = h('div', { class: 'internet-wallpapers-strip' }, INTERNET_WALLPAPERS.map((w) =>
      h('button', {
        type: 'button',
        class: 'wall-thumb-btn' + (activeWall === w.url ? ' active' : ''),
        title: 'Встановити шпалери: ' + w.label,
        onclick: () => {
          setCustomWallpaper(w.url, 'Встановлено шпалери: ' + w.label);
          refresh();
        }
      }, [
        h('img', { src: w.url, alt: w.label, decoding: 'sync' }),
        h('span', { class: 'wall-thumb-caption', text: w.label })
      ])
    ));

    const isTurbo = themeConfig.perfMode === 'turbo';
    const perfBar = h('div', { class: 'perf-mode-box' }, [
      h('div', {}, [
        h('strong', { style: 'display:block; font-size:0.84rem;', text: isTurbo ? '⚡ Режим: Турбо-прискорення (Миттєвий)' : '✨ Режим: Плавна GPU-анімація 60+ FPS' }),
        h('span', { style: 'font-size:0.76rem; color:var(--muted);', text: 'Керуйте апаратними ефектами скла та плавністю переходів' })
      ]),
      h('button', {
        type: 'button',
        class: 'btn btn-small' + (isTurbo ? ' btn-primary' : ''),
        text: isTurbo ? '✨ Увімкнути плавні анімації' : '⚡ Увімкнути Турбо-режим',
        onclick: togglePerfMode
      })
    ]);

    const leftCard = h('div', { class: 'studio-card' }, [
      h('h3', { style: 'margin:0 0 8px;', text: '🖼️ Колекція HD-шпалер та режим фону v2.1.7 RS5' }),
      h('p', { style: 'margin:0 0 12px; font-size:0.86rem; color:var(--text-secondary);', text: 'Оберіть будь-які з 26+ оптимізованих шпалер (включно з 8 новими пейзажами Redstone 5), випадкове фото з Інтернету або своє посилання.' }),
      modeRow,
      h('div', { style: 'display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;' }, [
        h('div', { style: 'flex:1; min-width:200px;' }, [customUrlInput]),
        h('button', {
          type: 'button',
          class: 'btn btn-small btn-primary',
          text: '🌐 Застосувати URL',
          onclick: () => {
            const u = customUrlInput.value.trim();
            if (!u) { toast('Введіть URL зображення', true); return; }
            setCustomWallpaper(u, 'Зображення з Інтернету встановлено на фон!');
            refresh();
          }
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          text: '🎲 Випадкове з Інтернету',
          onclick: () => {
            const seed = Math.floor(Math.random() * 9000) + 1000;
            setCustomWallpaper('https://picsum.photos/seed/sp' + seed + '/1600/900', 'Підтягнуто нові випадкові HD-шпалери з Інтернету! 🌐');
            refresh();
          }
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          text: '📁 З файлу',
          onclick: () => wallFileInput.click()
        }),
        wallFileInput,
        themeConfig.customWallpaper ? h('button', {
          type: 'button',
          class: 'btn btn-small',
          text: '↩️ Штатне фото теми',
          onclick: () => {
            setCustomWallpaper('', 'Повернуто штатні шпалери теми');
            refresh();
          }
        }) : null
      ]),
      wallpaperStrip,
      h('div', { style: 'margin-top:14px; display:grid; grid-template-columns:repeat(auto-fit, minmax(160px,1fr)); gap:12px;' }, [
        h('div', { class: 'slider-row' }, [
          h('div', { style: 'display:flex; justify-content:space-between; font-size:0.8rem;' }, [h('span', { text: 'Тонування шпалер:' }), dimValLabel]),
          dimRange
        ]),
        h('div', { class: 'slider-row' }, [
          h('div', { style: 'display:flex; justify-content:space-between; font-size:0.8rem;' }, [h('span', { text: 'Розмиття (Blur):' }), blurValLabel]),
          blurRange
        ]),
        h('div', { class: 'slider-row' }, [
          h('div', { style: 'display:flex; justify-content:space-between; font-size:0.8rem;' }, [h('span', { text: 'Щільність скла:' }), glassValLabel]),
          glassRange
        ])
      ]),
      perfBar
    ]);

    const pInput = h('input', { type: 'color', value: cc.primary });
    const bgInput = h('input', { type: 'color', value: cc.bg });
    const sfInput = h('input', { type: 'color', value: cc.surface });
    const txInput = h('input', { type: 'color', value: cc.text });

    const applyColorInputs = SP.DOM.rafThrottle(() => {
      themeConfig.customColors.enabled = true;
      themeConfig.customColors.primary = pInput.value;
      themeConfig.customColors.bg = bgInput.value;
      themeConfig.customColors.surface = sfInput.value;
      themeConfig.customColors.text = txInput.value;
      saveConfig();
      applyThemeAndConfig(currentThemeId);
      refreshActiveThemeBanner();
    });
    [pInput, bgInput, sfInput, txInput].forEach((inp) => inp.addEventListener('input', applyColorInputs));

    const quickColorPalettes = [
      { label: '🌊 Морський кобальт', primary: '#0284c7', bg: '#f0f9ff', surface: '#ffffff', text: '#082f49' },
      { label: '🌺 Кораловий світанок', primary: '#e11d48', bg: '#fff1f2', surface: '#ffffff', text: '#4c0519' },
      { label: '🌲 Смарагдова ніч', primary: '#10b981', bg: '#041f18', surface: '#0b382b', text: '#ecfdf5' },
      { label: '🔮 Кібер-аметист', primary: '#a855f7', bg: '#0f0722', surface: '#1d103d', text: '#faf5ff' },
      { label: '🖤 Обсидіан Люкс', primary: '#ca8a04', bg: '#09090b', surface: '#18181b', text: '#fafafa' },
      { label: '⚡ Електрик індиго', primary: '#6366f1', bg: '#090d1f', surface: '#151c38', text: '#eef2ff' }
    ];

    const presetNameInput = h('input', {
      type: 'text',
      placeholder: 'Назва вашої теми (напр. «Мій скандинавський фйорд»)...',
      style: 'flex:1; min-width:170px;'
    });

    const savedPresetsList = (themeConfig.savedPresets && themeConfig.savedPresets.length > 0)
      ? h('div', { style: 'display:flex; gap:6px; flex-wrap:wrap; margin-top:10px;' }, themeConfig.savedPresets.map((pr) =>
          h('div', { style: 'display:inline-flex; align-items:center; gap:4px; background:var(--surface-card); border:1px solid var(--border); padding:3px 9px; border-radius:999px; font-size:0.8rem;' }, [
            h('button', {
              type: 'button',
              style: 'background:none; border:none; color:var(--primary); font-weight:800; cursor:pointer; padding:0;',
              text: '🎨 ' + pr.name,
              onclick: () => {
                storage.setTheme(pr.baseTheme || 'light');
                themeConfig.visualMode = pr.visualMode || 'photo';
                themeConfig.customWallpaper = pr.customWallpaper || '';
                themeConfig.customColors = Object.assign({}, pr.customColors);
                saveConfig();
                applyThemeAndConfig(pr.baseTheme || 'light');
                SP.DOM.fireConfetti(1000);
                toast('Застосовано вашу тему «' + pr.name + '»!', false);
                refresh();
              }
            }),
            h('button', {
              type: 'button',
              title: 'Видалити збережену тему',
              style: 'background:none; border:none; color:var(--danger); cursor:pointer; font-weight:800; padding:0 2px;',
              text: '✕',
              onclick: () => {
                themeConfig.savedPresets = themeConfig.savedPresets.filter((x) => x.id !== pr.id);
                saveConfig();
                refresh();
              }
            })
          ])
        ))
      : null;

    const rightCard = h('div', { class: 'studio-card' }, [
      h('div', { style: 'display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;' }, [
        h('h3', { style: 'margin:0;', text: '🎨 Конструктор кольорових тем & «Хамелеон»' }),
        cc.enabled ? badge('badge-DONE', 'Активна власна палітра') : badge('badge-PLANNED', 'Штатна палітра теми')
      ]),
      h('p', { style: 'margin:0 0 10px; font-size:0.86rem; color:var(--text-secondary);', text: 'Налаштуйте будь-які кольори інтерфейсу вручну або згенеруйте кольорову тему автоматично під поточне зображення!' }),

      h('div', { style: 'display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;' }, [
        h('button', {
          type: 'button',
          class: 'btn btn-small btn-primary',
          text: '🪄 Авто-кольори під фото (Темна)',
          onclick: async () => {
            try {
              const cols = await extractChameleonColorsFromImage(getActiveWallpaperUrl(currentThemeId), false);
              themeConfig.customColors = Object.assign({ enabled: true }, cols);
              saveConfig();
              applyThemeAndConfig(currentThemeId);
              SP.DOM.fireConfetti(1100);
              toast('🪄 Хамелеон створив темну кольорову палітру під поточні шпалери!', false);
              refresh();
            } catch (err) {
              toast(err.message || 'Не вдалося зчитати кольори цього зображення', true);
            }
          }
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          text: '☀️ Авто-кольори під фото (Світла)',
          onclick: async () => {
            try {
              const cols = await extractChameleonColorsFromImage(getActiveWallpaperUrl(currentThemeId), true);
              themeConfig.customColors = Object.assign({ enabled: true }, cols);
              saveConfig();
              applyThemeAndConfig(currentThemeId);
              SP.DOM.fireConfetti(1100);
              toast('☀️ Хамелеон створив світлу кольорову палітру під поточні шпалери!', false);
              refresh();
            } catch (err) {
              toast(err.message || 'Не вдалося зчитати кольори цього зображення', true);
            }
          }
        }),
        cc.enabled ? h('button', {
          type: 'button',
          class: 'btn btn-small',
          text: '↩️ Скинути кольори',
          onclick: () => {
            themeConfig.customColors.enabled = false;
            saveConfig();
            applyThemeAndConfig(currentThemeId);
            toast('Повернуто стандартні кольори теми', false);
            refresh();
          }
        }) : null
      ]),

      h('div', { class: 'color-pickers-grid' }, [
        h('label', { class: 'color-swatch-input' }, [pInput, h('div', {}, [h('strong', { style: 'display:block; font-size:0.8rem;', text: 'Акцент' }), h('span', { style: 'font-size:0.72rem; color:var(--muted);', text: cc.primary })])]),
        h('label', { class: 'color-swatch-input' }, [bgInput, h('div', {}, [h('strong', { style: 'display:block; font-size:0.8rem;', text: 'Фон сайту' }), h('span', { style: 'font-size:0.72rem; color:var(--muted);', text: cc.bg })])]),
        h('label', { class: 'color-swatch-input' }, [sfInput, h('div', {}, [h('strong', { style: 'display:block; font-size:0.8rem;', text: 'Панелі' }), h('span', { style: 'font-size:0.72rem; color:var(--muted);', text: cc.surface })])]),
        h('label', { class: 'color-swatch-input' }, [txInput, h('div', {}, [h('strong', { style: 'display:block; font-size:0.8rem;', text: 'Текст' }), h('span', { style: 'font-size:0.72rem; color:var(--muted);', text: cc.text })])])
      ]),

      h('div', { style: 'margin:10px 0;' }, [
        h('span', { style: 'font-size:0.8rem; font-weight:800; color:var(--muted); display:block; margin-bottom:6px;', text: 'Швидкі кольорові палітри (1 клік):' }),
        h('div', { style: 'display:flex; gap:6px; flex-wrap:wrap;' }, quickColorPalettes.map((qp) =>
          h('button', {
            type: 'button',
            class: 'sample-img-pill',
            text: qp.label,
            onclick: () => {
              themeConfig.customColors = {
                enabled: true,
                primary: qp.primary,
                bg: qp.bg,
                surface: qp.surface,
                text: qp.text
              };
              saveConfig();
              applyThemeAndConfig(currentThemeId);
              toast('Застосовано кольорову тему: ' + qp.label, false);
              refresh();
            }
          })
        ))
      ]),

      h('div', { style: 'margin-top:14px; padding-top:12px; border-top:1px dashed var(--border);' }, [
        h('strong', { style: 'display:block; font-size:0.84rem; margin-bottom:6px;', text: '💾 Зберегти комбінацію (Шпалери + Кольори) у власні теми:' }),
        h('div', { style: 'display:flex; gap:8px; flex-wrap:wrap;' }, [
          presetNameInput,
          h('button', {
            type: 'button',
            class: 'btn btn-small btn-primary',
            text: '💾 Зберегти тему',
            onclick: () => {
              const name = presetNameInput.value.trim();
              if (!name) { toast('Введіть назву вашої теми', true); return; }
              themeConfig.savedPresets.push({
                id: 'pr-' + Date.now().toString(36),
                name: name.slice(0, 40),
                baseTheme: currentThemeId,
                visualMode: themeConfig.visualMode,
                customWallpaper: themeConfig.customWallpaper,
                customColors: Object.assign({}, themeConfig.customColors)
              });
              saveConfig();
              toast('Вашу тему «' + name + '» збережено!', false);
              refresh();
            }
          })
        ]),
        savedPresetsList
      ])
    ]);

    return h('section', { class: 'theme-studio-grid', 'aria-label': 'Студія кастомізації шпалер та кольорів' }, [
      leftCard,
      rightCard
    ]);
  }

  function buildThemesShowcase(isStandalonePage) {
    const h = SP.DOM.h;
    const badge = SP.DOM.badge;
    const activeTheme = getCurrentThemeId();

    const grid = h('div', { class: 'themes-showcase-grid' }, THEME_GALLERY.map((item, idx) => {
      const isCurrent = item.id === activeTheme && !(themeConfig.customColors && themeConfig.customColors.enabled);
      const imgSrc = themeConfig.thumbStyle === 'svg' ? item.svg : item.photo;
      const dots = h('div', { class: 'theme-palette-dots' }, item.colors.map((hex) =>
        h('span', { class: 'palette-dot', style: 'background:' + hex + ';', title: hex })
      ));

      return h('article', {
        class: 'theme-card' + (isCurrent ? ' active-theme' : ''),
        style: '--stagger:' + Math.min(idx, 10) + ';',
        'data-theme-card': item.id,
        onmouseenter: () => preloadImage(item.photo),
        onclick: () => {
          selectTheme(item.id, true);
          SP.DOM.fireConfetti(1000);
        }
      }, [
        h('div', { class: 'theme-card-img-wrap' }, [
          h('img', { src: imgSrc, alt: item.title, class: 'theme-card-img', loading: isStandalonePage ? 'eager' : 'lazy' }),
          item.isNew ? h('span', { class: 'theme-card-ribbon', text: '✨ RS5' }) : null
        ]),
        h('div', { class: 'theme-card-body' }, [
          h('div', { class: 'theme-card-header' }, [
            h('h3', { class: 'theme-card-title', text: item.title }),
            isCurrent
              ? badge('badge-DONE', 'Активна')
              : (item.isNew ? badge('badge-IN_PROGRESS', 'Нова') : badge('badge-PLANNED', item.type === 'light' ? 'Світла' : 'Темна'))
          ]),
          h('p', { class: 'theme-card-desc', text: item.desc }),
          h('div', { style: 'display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap; margin-top:6px;' }, [
            dots,
            h('div', { style: 'display:flex; gap:5px; flex-wrap:wrap;' }, [
              h('button', {
                type: 'button',
                class: 'btn btn-small',
                title: 'Встановити лише фото-шпалери цієї теми, зберігши поточні кольори',
                text: '🖼️ Фото',
                onclick: (e) => {
                  e.stopPropagation();
                  setCustomWallpaper(item.photo, 'Встановлено шпалери теми «' + item.name + '» 🖼️');
                }
              }),
              h('button', {
                type: 'button',
                class: 'btn btn-small',
                title: 'Застосувати лише кольорову палітру цієї теми без зміни поточних шпалер',
                text: '🎨 Колір',
                onclick: (e) => {
                  e.stopPropagation();
                  const keepWall = getActiveWallpaperUrl(activeTheme);
                  if (themeConfig.visualMode === 'photo') themeConfig.customWallpaper = keepWall;
                  themeConfig.customColors.enabled = false;
                  saveConfig();
                  selectTheme(item.id, false);
                }
              }),
              h('button', {
                type: 'button',
                class: 'btn btn-small btn-primary',
                text: '✨ Все разом',
                onclick: (e) => {
                  e.stopPropagation();
                  selectTheme(item.id, true);
                  SP.DOM.fireConfetti(1000);
                }
              })
            ])
          ])
        ])
      ]);
    }));

    return h('section', { class: 'themes-showcase-section', 'aria-label': 'Галерея 16 фото та кольорових тем оформлення' }, [
      h('div', { style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;' }, [
        h('div', {}, [
          h('h2', { style: 'margin:0;', text: '🎨 Вітрина 16 Фото- та Кольорових тем StudyPlanner v2.1.7 RS5' }),
          h('p', { style: 'margin:4px 0 0; color:var(--text-secondary); font-size:0.9rem;', text: 'Оновлена колекція Redstone 5 (12 класичних + 4 нові теми): комбінуйте HD-шпалери, кольорові палітри та плавні GPU-ефекти без лагів!' })
        ]),
        !isStandalonePage
          ? h('a', { class: 'btn btn-small btn-primary', href: '#/themes', text: '🎛️ Відкрити Студію 16 тем →' })
          : h('a', { class: 'btn btn-small', href: '#/', text: '← До списку завдань' })
      ]),
      grid
    ]);
  }

  SP.THEME_GALLERY = THEME_GALLERY;
  SP.THEMES = THEMES;
  SP.VISUAL_MODES = VISUAL_MODES;
  SP.ThemeEngine = {
    init: init,
    getThemeId: getCurrentThemeId,
    getConfig: () => themeConfig,
    selectTheme: selectTheme,
    cycleNextTheme: cycleNextTheme,
    cycleVisualMode: cycleVisualMode,
    togglePerfMode: togglePerfMode,
    setCustomWallpaper: setCustomWallpaper,
    buildActiveThemeBanner: buildActiveThemeBanner,
    buildThemeStudioPanel: buildThemeStudioPanel,
    buildThemesShowcase: buildThemesShowcase
  };
})(window);
