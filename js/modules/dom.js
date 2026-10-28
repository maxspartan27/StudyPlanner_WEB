/**
 * modules/dom.js — [UI Layer] високопродуктивні утиліти DOM, DocumentFragment, SVG, Debounce, rAF-Throttle, Clipboard, Toast з Undo та Confetti.
 * Версія 2.1.7 (build 217) Redstone 5 — Автор: Максим Ковалишин.
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});
  const doc = global.document;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /** Створення HTML-елемента з автоматичним декодуванням зображень async */
  function h(tag, attrs, children) {
    const el = doc.createElement(tag);
    if (tag === 'img' && (!attrs || attrs.decoding === undefined)) {
      el.decoding = 'async';
    }
    const keys = attrs ? Object.keys(attrs) : [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = attrs[k];
      if (v === false || v === null || v === undefined) continue;
      if (k === 'text') el.textContent = v;
      else if (k === 'class') el.className = v;
      else if (k === 'checked' && tag === 'input') el.checked = Boolean(v);
      else if (k === 'selected' && tag === 'option') el.selected = Boolean(v);
      else if (k === 'disabled') el.disabled = Boolean(v);
      else if (k === 'value' && (tag === 'input' || tag === 'textarea' || tag === 'select')) el.value = String(v);
      else if (k.charCodeAt(0) === 111 && k.charCodeAt(1) === 110 && typeof v === 'function') {
        el.addEventListener(k.slice(2), v);
      } else {
        el.setAttribute(k, v === true ? '' : v);
      }
    }
    appendChildren(el, children);
    return el;
  }

  /** Створення векторного SVG-елемента (для діаграм аналітики v2.1.7 RS5) */
  function svgEl(tag, attrs, children) {
    const el = doc.createElementNS(SVG_NS, tag);
    const keys = attrs ? Object.keys(attrs) : [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = attrs[k];
      if (v === false || v === null || v === undefined) continue;
      el.setAttribute(k, String(v));
    }
    appendChildren(el, children);
    return el;
  }

  function appendChildren(parent, children) {
    if (!children) return;
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) appendChildren(parent, c);
      else parent.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
    }
  }

  /** Пакетне вставлення вузлів через DocumentFragment без зайвих перерахунків макета (Reflow) */
  function fragment(nodes) {
    const frag = doc.createDocumentFragment();
    appendChildren(frag, nodes);
    return frag;
  }

  /** Усунення брязкоту подій вводу (пошук, автозбереження нотаток) */
  function debounce(fn, delayMs) {
    let timer = null;
    return function () {
      const ctx = this;
      const args = arguments;
      global.clearTimeout(timer);
      timer = global.setTimeout(function () {
        fn.apply(ctx, args);
      }, delayMs);
    };
  }

  /** Синхронізація частих візуальних оновлень із частотою кадрів екрана 60/120 Гц */
  function rafThrottle(fn) {
    let queued = false;
    let lastArgs = null;
    let lastCtx = null;
    return function () {
      lastCtx = this;
      lastArgs = arguments;
      if (queued) return;
      queued = true;
      global.requestAnimationFrame(function () {
        queued = false;
        fn.apply(lastCtx, lastArgs);
      });
    };
  }

  function badge(cls, text) {
    return h('span', { class: 'badge ' + cls, text: text });
  }

  function dueRelativeBadge(task, today) {
    if (task.status === 'DONE') return badge('badge-DONE', 'Виконано');
    const diff = task.daysUntilDue(today);
    if (diff < 0) return badge('badge-overdue', 'Прострочено (' + Math.abs(diff) + ' дн.)');
    if (diff === 0) return badge('badge-today', '🔥 Сьогодні!');
    if (diff === 1) return badge('badge-soon', '⏳ Завтра');
    if (diff <= 3) return badge('badge-soon', 'Ще ' + diff + ' дн.');
    return null;
  }

  function subtaskBadge(task) {
    const sp = task.subtaskProgress();
    if (sp.total === 0) return null;
    const cls = sp.done === sp.total ? 'badge-DONE' : 'badge-IN_PROGRESS';
    return badge(cls, '☑️ ' + sp.done + '/' + sp.total);
  }

  function optionList(map, selected) {
    return Object.keys(map).map((k) =>
      h('option', { value: k, text: map[k].label, selected: k === selected })
    );
  }

  /** Спливаюче повідомлення з опціональною кнопкою миттєвої дії (наприклад «↩️ Скасувати») */
  let toastTimer = null;
  function toast(message, isError, opts) {
    const el = doc.getElementById('toast');
    if (!el) return;
    el.textContent = '';
    el.appendChild(h('span', { text: (isError ? '⚠️ ' : '✅ ') + message }));

    if (opts && typeof opts.onAction === 'function') {
      el.appendChild(h('button', {
        type: 'button',
        class: 'toast-undo-btn',
        text: opts.actionLabel || '↩️ Скасувати',
        onclick: () => {
          global.clearTimeout(toastTimer);
          el.className = 'toast';
          opts.onAction();
        }
      }));
    }

    el.className = 'toast show ' + (isError ? 'error' : 'success');
    global.clearTimeout(toastTimer);
    const duration = (opts && opts.duration) ? opts.duration : (opts && opts.onAction ? 5200 : 3400);
    toastTimer = global.setTimeout(() => {
      el.className = 'toast';
    }, duration);
  }

  function confirmDelete(taskOrTitle, customMessage) {
    return new Promise((resolve) => {
      const dlg = doc.getElementById('confirm-dialog');
      if (!dlg) { resolve(true); return; }
      if (dlg.open) dlg.close('cancel');

      const titleEl = doc.getElementById('confirm-title');
      const txt = doc.getElementById('confirm-text');
      const isObj = taskOrTitle && typeof taskOrTitle === 'object';

      if (titleEl) {
        titleEl.textContent = isObj ? 'Видалити завдання?' : String(taskOrTitle || 'Підтвердження видалення');
      }
      if (txt) {
        txt.textContent = customMessage || (isObj
          ? 'Завдання «' + taskOrTitle.title + '» буде видалено (ви завжди зможете миттєво повернути його через Undo Ctrl+Z).'
          : 'Ви впевнені, що бажаєте виконати цю дію?');
      }

      const onBackdropClick = (e) => {
        if (e.target === dlg) dlg.close('cancel');
      };
      const onClose = () => {
        dlg.removeEventListener('close', onClose);
        dlg.removeEventListener('click', onBackdropClick);
        resolve(dlg.returnValue === 'ok');
      };

      dlg.returnValue = 'cancel';
      dlg.addEventListener('close', onClose);
      dlg.addEventListener('click', onBackdropClick);
      dlg.showModal();
      const cancelBtn = doc.getElementById('confirm-cancel');
      if (cancelBtn) cancelBtn.focus();
    });
  }

  function showLightbox(imageUrl, title) {
    const dlg = doc.getElementById('lightbox-dialog');
    const img = doc.getElementById('lightbox-img');
    const headerTitle = doc.getElementById('lightbox-title');
    if (!dlg || !img) return;
    img.src = imageUrl;
    if (headerTitle) headerTitle.textContent = title ? '🖼️ ' + title : 'Прикріплене зображення';
    if (!dlg.open) dlg.showModal();
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = url;
    a.download = filename;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** Надійне копіювання тексту у буфер обміну (працює навіть при відкритті через file://) */
  function copyText(text) {
    if (global.navigator && global.navigator.clipboard && typeof global.navigator.clipboard.writeText === 'function') {
      return global.navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      const ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.left = '-9999px';
      doc.body.appendChild(ta);
      ta.select();
      const ok = doc.execCommand('copy');
      doc.body.removeChild(ta);
      return Boolean(ok);
    } catch (e) {
      return false;
    }
  }

  /** Оптимізована анімація конфеті з підтримкою prefers-reduced-motion та скасуванням попереднього циклу */
  let confettiRafId = null;
  function fireConfetti(durationMs) {
    if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const canvas = doc.getElementById('confetti-canvas');
    if (!canvas) return;
    if (confettiRafId) {
      global.cancelAnimationFrame(confettiRafId);
      confettiRafId = null;
    }

    const ctx = canvas.getContext('2d');
    const width = (canvas.width = global.innerWidth);
    const height = (canvas.height = global.innerHeight);

    const colors = [
      '#10b981', '#34d399', '#ef4444', '#f43f5e',
      '#3b82f6', '#06b6d4', '#0284c7', '#f59e0b',
      '#fbbf24', '#8b5cf6', '#a855f7', '#ec4899'
    ];

    const particles = [];
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.38 - height * 0.08,
        w: Math.random() * 9 + 4,
        h: Math.random() * 9 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 6.2,
        vy: Math.random() * 4.4 + 2.8,
        rot: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
        shape: i % 3 === 0 ? 'circle' : 'rect'
      });
    }

    const startTime = Date.now();
    const duration = durationMs || 2300;

    function render() {
      ctx.clearRect(0, 0, width, height);
      const progress = (Date.now() - startTime) / duration;
      if (progress >= 1) {
        confettiRafId = null;
        return;
      }
      const alpha = Math.max(0, 1 - progress * 1.18);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vRot;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      confettiRafId = global.requestAnimationFrame(render);
    }

    confettiRafId = global.requestAnimationFrame(render);
  }

  SP.DOM = {
    h: h,
    svgEl: svgEl,
    fragment: fragment,
    debounce: debounce,
    rafThrottle: rafThrottle,
    badge: badge,
    dueRelativeBadge: dueRelativeBadge,
    subtaskBadge: subtaskBadge,
    optionList: optionList,
    toast: toast,
    confirmDelete: confirmDelete,
    showLightbox: showLightbox,
    downloadFile: downloadFile,
    copyText: copyText,
    fireConfetti: fireConfetti
  };
})(window);
