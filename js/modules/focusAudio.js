/**
 * modules/focusAudio.js — [UI Subsystem] Фокус-таймер Pomodoro з прив’язкою завдання (Focus Target) та Web Audio синтезатор звуків.
 * Версія 2.1.7 (build 217) Redstone 5 — Автор: Максим Ковалишин.
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});
  const doc = global.document;
  const baseTitle = 'StudyPlanner v2.1.7 (build 217) Redstone 5 — планувальник навчальних завдань | Автор: Максим Ковалишин';

  let storage = null;
  let manager = null;
  let onSessionComplete = null;
  let onTaskMutate = null;

  const pomo = {
    totalSeconds: 25 * 60,
    remaining: 25 * 60,
    running: false,
    modeLabel: '25 хв Навчання',
    timerId: null,
    focusTaskId: null
  };

  const ambient = {
    ctx: null,
    activeType: null, // 'rain' | 'ocean' | 'brown' | null
    gainNode: null,
    sourceNode: null,
    lfoNode: null,
    volume: 0.35
  };

  function ensureAudioCtx() {
    if (!ambient.ctx) {
      const AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (AudioCtx) ambient.ctx = new AudioCtx();
    }
    if (ambient.ctx && ambient.ctx.state === 'suspended') {
      ambient.ctx.resume();
    }
    return ambient.ctx;
  }

  function stopAmbientSound() {
    if (ambient.sourceNode) {
      try { ambient.sourceNode.stop(); } catch (e) {}
      try { ambient.sourceNode.disconnect(); } catch (e) {}
      ambient.sourceNode = null;
    }
    if (ambient.lfoNode) {
      try { ambient.lfoNode.stop(); } catch (e) {}
      try { ambient.lfoNode.disconnect(); } catch (e) {}
      ambient.lfoNode = null;
    }
    ambient.activeType = null;
    updateAmbientDOM();
  }

  function toggleAmbientSound(type) {
    if (ambient.activeType === type) {
      stopAmbientSound();
      SP.DOM.toast('Фоновий звук вимкнено 🔇', false);
      return;
    }
    stopAmbientSound();
    const ctx = ensureAudioCtx();
    if (!ctx) {
      SP.DOM.toast('Ваш браузер не підтримує Web Audio API', true);
      return;
    }

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.2;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filterNode = ctx.createBiquadFilter();
    if (type === 'rain') {
      filterNode.type = 'bandpass';
      filterNode.frequency.value = 950;
      filterNode.Q.value = 0.55;
    } else if (type === 'ocean') {
      filterNode.type = 'lowpass';
      filterNode.frequency.value = 480;
    } else {
      filterNode.type = 'lowpass';
      filterNode.frequency.value = 280;
    }

    const masterGain = ctx.createGain();
    masterGain.gain.value = ambient.volume;

    if (type === 'ocean') {
      const waveGain = ctx.createGain();
      waveGain.gain.value = 0.55;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.14;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 0.4;
      lfo.connect(lfoDepth);
      lfoDepth.connect(waveGain.gain);
      noise.connect(filterNode);
      filterNode.connect(waveGain);
      waveGain.connect(masterGain);
      masterGain.connect(ctx.destination);
      lfo.start();
      ambient.lfoNode = lfo;
    } else {
      noise.connect(filterNode);
      filterNode.connect(masterGain);
      masterGain.connect(ctx.destination);
    }

    noise.start();
    ambient.sourceNode = noise;
    ambient.gainNode = masterGain;
    ambient.activeType = type;
    updateAmbientDOM();

    const names = { rain: '🌧️ М’який дощ', ocean: '🌊 Морський прибій', brown: '☕ Теплий фокус-шум' };
    SP.DOM.toast('Увімкнено фокус-аудіо: ' + (names[type] || type), false);
  }

  function playVictoryChime() {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = ctx.currentTime + idx * 0.12;
      g.gain.setValueAtTime(0.001, start);
      g.gain.exponentialRampToValueAtTime(0.18, start + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.6);
    });
  }

  function updateAmbientDOM() {
    doc.querySelectorAll('.ambient-chip[data-sound]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-sound') === ambient.activeType);
    });
    const eq = doc.getElementById('ambient-eq-indicator');
    if (eq) eq.style.display = ambient.activeType ? 'inline-flex' : 'none';
  }

  function formatPomoTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function renderFocusTaskBanner() {
    const h = SP.DOM.h;
    const host = doc.getElementById('pomo-focus-slot');
    if (!host) return;
    host.textContent = '';
    if (!pomo.focusTaskId || !manager) return;
    const t = manager.getTask(pomo.focusTaskId);
    if (!t) {
      pomo.focusTaskId = null;
      return;
    }

    host.appendChild(h('div', { class: 'pomo-focus-banner' }, [
      h('div', { style: 'display:flex; align-items:center; gap:8px; flex-wrap:wrap;' }, [
        SP.DOM.badge('badge-IN_PROGRESS', '🎯 У фокусі'),
        h('a', { href: '#/task/' + t.id, style: 'font-weight:800; color:var(--text); text-decoration:none;', text: t.title }),
        h('span', { style: 'font-size:0.8rem; color:var(--muted);', text: '(' + t.subject + ')' })
      ]),
      h('div', { style: 'display:flex; gap:6px; flex-wrap:wrap;' }, [
        t.status !== 'DONE' ? h('button', {
          type: 'button',
          class: 'btn btn-small btn-celebrate',
          text: '✅ Завершити завдання',
          onclick: () => {
            const res = manager.changeStatus(t.id, 'DONE');
            pomo.focusTaskId = null;
            if (res.ok) {
              playVictoryChime();
              SP.DOM.fireConfetti(2000);
            }
            renderFocusTaskBanner();
            if (onTaskMutate) onTaskMutate(res, 'Фокус-завдання виконано! 🎉');
          }
        }) : null,
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          text: '✕ Зняти фокус',
          onclick: () => {
            pomo.focusTaskId = null;
            renderFocusTaskBanner();
          }
        })
      ])
    ]));
  }

  function setFocusTask(task) {
    if (!task) return;
    pomo.focusTaskId = task.id;
    if (manager && task.status === 'PLANNED') {
      manager.changeStatus(task.id, 'IN_PROGRESS');
      if (onTaskMutate) onTaskMutate({ ok: true }, 'Завдання взято у Фокус Pomodoro 🎯', false);
    } else {
      SP.DOM.toast('🎯 У фокусі таймера: «' + task.title + '»', false);
    }
    renderFocusTaskBanner();
    if (!pomo.running) togglePomo();
    const widget = doc.getElementById('pomo-widget');
    if (widget) widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function updatePomoDOM() {
    const formatted = formatPomoTime(pomo.remaining);
    const timeEl = doc.getElementById('pomo-time-display');
    const widgetEl = doc.getElementById('pomo-widget');
    const toggleBtn = doc.getElementById('pomo-toggle-btn');
    const labelEl = doc.getElementById('pomo-mode-label');
    const headerPill = doc.getElementById('header-pomo-pill');

    if (timeEl) timeEl.textContent = formatted;
    if (labelEl) {
      const stats = storage ? storage.getPomoStats() : { sessions: 0 };
      labelEl.textContent = pomo.modeLabel + (stats.sessions > 0 ? ' • Сесій: ' + stats.sessions : '');
    }
    if (widgetEl) widgetEl.classList.toggle('is-running', pomo.running);
    if (toggleBtn) toggleBtn.textContent = pomo.running ? '⏸️ Пауза' : '▶️ Старт';

    if (headerPill) {
      headerPill.classList.toggle('is-active', pomo.running);
      headerPill.textContent = '⏱️ ' + formatted;
    }

    if (pomo.running) {
      doc.title = '⏱️ ' + formatted + ' • StudyPlanner v2.1.7 RS5';
    } else if (doc.title.indexOf('⏱️') === 0) {
      doc.title = baseTitle;
    }
  }

  function togglePomo() {
    if (pomo.running) {
      pomo.running = false;
      global.clearInterval(pomo.timerId);
      pomo.timerId = null;
      updatePomoDOM();
    } else {
      pomo.running = true;
      updatePomoDOM();
      pomo.timerId = global.setInterval(() => {
        if (pomo.remaining > 0) {
          pomo.remaining--;
          updatePomoDOM();
        } else {
          pomo.running = false;
          global.clearInterval(pomo.timerId);
          pomo.timerId = null;
          const mins = Math.max(1, Math.round(pomo.totalSeconds / 60));
          if (storage) storage.addPomoSession(mins);
          playVictoryChime();
          SP.DOM.fireConfetti(3000);
          SP.DOM.toast('Фокус-сесію завершено! Нараховано +25 XP 🎉', false);
          pomo.remaining = pomo.totalSeconds;
          updatePomoDOM();
          if (onSessionComplete) onSessionComplete();
        }
      }, 1000);
    }
  }

  function setPreset(minutes, label) {
    pomo.running = false;
    if (pomo.timerId) global.clearInterval(pomo.timerId);
    pomo.timerId = null;
    pomo.totalSeconds = minutes * 60;
    pomo.remaining = minutes * 60;
    pomo.modeLabel = label;
    updatePomoDOM();
  }

  function init(opts) {
    storage = opts.storage;
    manager = opts.manager || null;
    onSessionComplete = opts.onSessionComplete || null;
    onTaskMutate = opts.onTaskMutate || null;

    const headerPill = doc.getElementById('header-pomo-pill');
    if (headerPill) {
      headerPill.addEventListener('click', () => {
        const widget = doc.getElementById('pomo-widget');
        if (widget) widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
        else global.location.hash = '#/';
      });
    }
  }

  function buildWidget() {
    const h = SP.DOM.h;
    const pomoStats = storage ? storage.getPomoStats() : { sessions: 0 };
    const volSlider = h('input', {
      type: 'range',
      min: '5',
      max: '100',
      value: String(Math.round(ambient.volume * 100)),
      title: 'Гучність фонового аудіо для концентрації',
      style: 'width:90px; accent-color:var(--primary); cursor:pointer;'
    });
    volSlider.addEventListener('input', () => {
      ambient.volume = Number(volSlider.value) / 100;
      if (ambient.gainNode) ambient.gainNode.gain.value = ambient.volume;
    });

    const eqBars = h('span', {
      id: 'ambient-eq-indicator',
      class: 'eq-bars',
      style: ambient.activeType ? 'display:inline-flex;' : 'display:none;'
    }, [h('span'), h('span'), h('span')]);

    const focusSlot = h('div', { id: 'pomo-focus-slot' });

    const section = h('section', { id: 'pomo-widget', class: 'pomodoro-widget' + (pomo.running ? ' is-running' : ''), 'aria-label': 'Фокус-таймер Pomodoro та студія звуків' }, [
      h('div', { class: 'pomodoro-top-row' }, [
        h('div', { class: 'pomo-info' }, [
          h('span', { style: 'font-size:1.5rem;', text: '⏱️' }),
          h('div', {}, [
            h('strong', { style: 'display:block; font-size:0.95rem;', text: 'Фокус-таймер Pomodoro v2.1.7 RS5' }),
            h('span', { id: 'pomo-mode-label', style: 'font-size:0.81rem; color:var(--muted);', text: pomo.modeLabel + (pomoStats.sessions > 0 ? ' • Сесій: ' + pomoStats.sessions : '') })
          ]),
          h('div', { id: 'pomo-time-display', class: 'pomo-time', text: formatPomoTime(pomo.remaining) })
        ]),
        h('div', { class: 'pomo-controls' }, [
          h('button', { type: 'button', id: 'pomo-toggle-btn', class: 'btn btn-small btn-primary', text: pomo.running ? '⏸️ Пауза' : '▶️ Старт', onclick: togglePomo }),
          h('button', { type: 'button', class: 'btn btn-small', text: '🔄 Скинути', onclick: () => setPreset(Math.round(pomo.totalSeconds / 60), pomo.modeLabel) }),
          h('button', { type: 'button', class: 'btn btn-small', text: '📚 25 хв', onclick: () => setPreset(25, '25 хв Навчання') }),
          h('button', { type: 'button', class: 'btn btn-small', text: '🚀 45 хв', onclick: () => setPreset(45, '45 хв Глибокий фокус') }),
          h('button', { type: 'button', class: 'btn btn-small', text: '☕ 5 хв', onclick: () => setPreset(5, '5 хв Перерва') }),
          h('button', { type: 'button', class: 'btn btn-small', text: '🌿 15 хв', onclick: () => setPreset(15, '15 хв Відпочинок') })
        ])
      ]),
      focusSlot,
      h('div', { class: 'ambient-sound-bar' }, [
        h('div', { class: 'ambient-btns' }, [
          h('strong', { style: 'color:var(--text-secondary); margin-right:4px;', text: '🎧 Фокус-аудіо:' }),
          eqBars,
          h('button', {
            type: 'button',
            class: 'ambient-chip' + (ambient.activeType === 'rain' ? ' active' : ''),
            'data-sound': 'rain',
            text: '🌧️ Дощ',
            onclick: () => toggleAmbientSound('rain')
          }),
          h('button', {
            type: 'button',
            class: 'ambient-chip' + (ambient.activeType === 'ocean' ? ' active' : ''),
            'data-sound': 'ocean',
            text: '🌊 Прибій океану',
            onclick: () => toggleAmbientSound('ocean')
          }),
          h('button', {
            type: 'button',
            class: 'ambient-chip' + (ambient.activeType === 'brown' ? ' active' : ''),
            'data-sound': 'brown',
            text: '☕ Теплий шум',
            onclick: () => toggleAmbientSound('brown')
          }),
          h('button', {
            type: 'button',
            class: 'ambient-chip',
            text: '🔇 Стоп',
            onclick: stopAmbientSound
          })
        ]),
        h('div', { style: 'display:flex; align-items:center; gap:8px;' }, [
          h('span', { style: 'color:var(--muted); font-size:0.78rem;', text: '🔊 Гучність' }),
          volSlider
        ])
      ])
    ]);

    global.requestAnimationFrame(renderFocusTaskBanner);
    return section;
  }

  SP.FocusHub = {
    init: init,
    togglePomo: togglePomo,
    setPreset: setPreset,
    setFocusTask: setFocusTask,
    isRunning: () => pomo.running,
    toggleAmbientSound: toggleAmbientSound,
    stopAmbientSound: stopAmbientSound,
    playVictoryChime: playVictoryChime,
    buildWidget: buildWidget
  };
})(window);
