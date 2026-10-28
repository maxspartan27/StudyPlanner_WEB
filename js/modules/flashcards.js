/**
 * modules/flashcards.js — [UI Subsystem] інтерактивний 3D-тренажер флеш-карток самоперевірки (#/flashcards).
 * Версія 2.1.7 (build 217) Redstone 5 — Автор: Максим Ковалишин.
 */
(function (global) {
  'use strict';
  const SP = (global.StudyPlanner = global.StudyPlanner || {});

  const state = {
    index: 0,
    flipped: false,
    subjectFilter: ''
  };

  function getDeck(storage) {
    let deck = storage.getFlashcards();
    if (!deck || deck.length === 0) {
      deck = SP.DEFAULT_FLASHCARDS.map((c) => Object.assign({}, c));
      storage.setFlashcards(deck);
    }
    return deck;
  }

  function getMasteredCount(storage) {
    const deck = getDeck(storage);
    let count = 0;
    for (let i = 0; i < deck.length; i++) {
      if (deck[i].mastered) count++;
    }
    return count;
  }

  function render(container, opts) {
    const h = SP.DOM.h;
    const badge = SP.DOM.badge;
    const toast = SP.DOM.toast;
    const storage = opts.storage;
    const manager = opts.manager;
    const refresh = opts.onRouteRefresh;

    const allCards = getDeck(storage);
    const collator = SP.ukCollator || { compare: (a, b) => a.localeCompare(b, 'uk') };
    const subjects = Array.from(new Set(allCards.map((c) => c.subject))).sort(collator.compare);

    const filtered = state.subjectFilter
      ? allCards.filter((c) => c.subject === state.subjectFilter)
      : allCards;

    if (state.index >= filtered.length) state.index = 0;
    const currentCard = filtered[state.index] || null;
    const masteredCount = getMasteredCount(storage);

    container.appendChild(h('div', { style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;' }, [
      h('h1', { style: 'margin:0;', text: '🧠 3D Флеш-картки — Тренажер пам’яті v2.1.7 RS5' }),
      h('div', { style: 'display:flex; gap:8px; flex-wrap:wrap; align-items:center;' }, [
        badge('badge-DONE', 'Засвоєно: ' + masteredCount + ' / ' + allCards.length + ' (+XP)'),
        h('a', { class: 'btn btn-small', href: '#/', text: '← До завдань' })
      ])
    ]));

    const subjSelect = h('select', { style: 'max-width:240px;', 'aria-label': 'Фільтр предметів карток' }, [
      h('option', { value: '', text: 'Усі предмети (' + allCards.length + ')' })
    ].concat(subjects.map((s) => h('option', { value: s, text: s, selected: s === state.subjectFilter }))));

    subjSelect.addEventListener('change', () => {
      state.subjectFilter = subjSelect.value;
      state.index = 0;
      state.flipped = false;
      refresh();
    });

    let trainerBox;
    if (!currentCard) {
      trainerBox = h('div', { class: 'panel empty' }, [
        h('p', { text: 'Немає карток у вибраній категорії.' })
      ]);
    } else {
      const card3d = h('div', { class: 'flashcard-3d' + (state.flipped ? ' is-flipped' : '') }, [
        h('div', { class: 'flashcard-face front' }, [
          h('div', { style: 'display:flex; justify-content:space-between; align-items:center;' }, [
            badge('badge-IN_PROGRESS', '📘 ' + currentCard.subject),
            currentCard.mastered
              ? badge('badge-DONE', '✅ Засвоєно')
              : badge('badge-PLANNED', 'Питання ' + (state.index + 1) + '/' + filtered.length)
          ]),
          h('div', { class: 'flashcard-content-text', text: currentCard.front }),
          h('div', { style: 'text-align:center; font-size:0.8rem; color:var(--muted);', text: '👆 Натисніть на картку або Пробіл, щоб перевернути (← / → для навігації)' })
        ]),
        h('div', { class: 'flashcard-face back' }, [
          h('div', { style: 'display:flex; justify-content:space-between; align-items:center;' }, [
            badge('badge-DONE', '💡 Відповідь • ' + currentCard.subject),
            h('span', { style: 'font-size:0.8rem; color:var(--muted);', text: (state.index + 1) + ' із ' + filtered.length })
          ]),
          h('div', { class: 'flashcard-content-text', text: currentCard.back }),
          h('div', { style: 'text-align:center; font-size:0.8rem; color:var(--muted);', text: '👆 Натисніть ще раз, щоб повернутися до запитання' })
        ])
      ]);

      const scene = h('div', {
        class: 'flashcard-scene',
        tabindex: '0',
        role: 'button',
        'aria-label': 'Флеш-картка. Натисніть Пробіл для перевороту, стрілки вліво/вправо для переходу',
        onclick: () => {
          state.flipped = !state.flipped;
          card3d.classList.toggle('is-flipped', state.flipped);
        }
      }, [card3d]);

      scene.addEventListener('keydown', (ev) => {
        if (ev.key === ' ' || ev.key === 'Enter') {
          ev.preventDefault();
          state.flipped = !state.flipped;
          card3d.classList.toggle('is-flipped', state.flipped);
        } else if (ev.key === 'ArrowRight') {
          ev.preventDefault();
          state.index = (state.index + 1) % filtered.length;
          state.flipped = false;
          refresh();
        } else if (ev.key === 'ArrowLeft') {
          ev.preventDefault();
          state.index = (state.index - 1 + filtered.length) % filtered.length;
          state.flipped = false;
          refresh();
        }
      });

      trainerBox = h('div', { class: 'panel' }, [
        h('div', { style: 'display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px;' }, [
          subjSelect,
          h('div', { style: 'display:flex; gap:6px; flex-wrap:wrap;' }, [
            h('button', {
              type: 'button', class: 'btn btn-small', text: '🔀 Перемішати',
              onclick: () => {
                const shuffled = allCards.slice().sort(() => Math.random() - 0.5);
                storage.setFlashcards(shuffled);
                state.index = 0;
                state.flipped = false;
                toast('Колоду карток перемішано!', false);
                refresh();
              }
            }),
            h('button', {
              type: 'button', class: 'btn btn-small btn-danger', text: '🗑️ Видалити картку',
              onclick: () => {
                if (allCards.length <= 1) {
                  toast('У колоді має залишитися хоча б одна картка', true);
                  return;
                }
                const nextDeck = allCards.filter((c) => c.id !== currentCard.id);
                storage.setFlashcards(nextDeck);
                state.index = 0;
                state.flipped = false;
                toast('Флеш-картку видалено', false);
                refresh();
              }
            })
          ])
        ]),
        scene,
        h('div', { style: 'display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;' }, [
          h('div', { style: 'display:flex; gap:8px;' }, [
            h('button', {
              type: 'button', class: 'btn btn-small', text: '◀ Попередня',
              onclick: () => {
                state.index = (state.index - 1 + filtered.length) % filtered.length;
                state.flipped = false;
                refresh();
              }
            }),
            h('button', {
              type: 'button', class: 'btn btn-small', text: 'Наступна ▶',
              onclick: () => {
                state.index = (state.index + 1) % filtered.length;
                state.flipped = false;
                refresh();
              }
            })
          ]),
          h('div', { style: 'display:flex; gap:8px; flex-wrap:wrap;' }, [
            h('button', {
              type: 'button',
              class: 'btn btn-small',
              text: '🔄 Повторити ще',
              onclick: () => {
                currentCard.mastered = false;
                storage.setFlashcards(allCards);
                state.index = (state.index + 1) % filtered.length;
                state.flipped = false;
                refresh();
              }
            }),
            h('button', {
              type: 'button',
              class: 'btn btn-small btn-primary',
              text: '✅ Знаю відмінно! (+15 XP)',
              onclick: () => {
                if (!currentCard.mastered) {
                  currentCard.mastered = true;
                  storage.setFlashcards(allCards);
                  SP.DOM.fireConfetti(1300);
                  toast('Чудово! Картку засвоєно (+15 XP)! 🎉', false);
                }
                state.index = (state.index + 1) % filtered.length;
                state.flipped = false;
                refresh();
              }
            })
          ])
        ])
      ]);
    }

    const subjInp = h('input', { type: 'text', placeholder: 'Напр., Вища математика або Історія...' });
    const frontInp = h('textarea', { placeholder: 'Питання, термін або формула...', style: 'min-height:74px;' });
    const backInp = h('textarea', { placeholder: 'Правильна відповідь або визначення...', style: 'min-height:74px;' });

    const createPanel = h('div', { class: 'panel' }, [
      h('h3', { style: 'margin:0 0 10px;', text: '➕ Додати власну флеш-картку' }),
      h('div', { style: 'display:flex; flex-direction:column; gap:10px;' }, [
        h('div', { class: 'field' }, [h('label', { text: 'Предмет' }), subjInp]),
        h('div', { class: 'field' }, [h('label', { text: 'Лицьова сторона (Питання)' }), frontInp]),
        h('div', { class: 'field' }, [h('label', { text: 'Зворотна сторона (Відповідь)' }), backInp]),
        h('button', {
          type: 'button',
          class: 'btn btn-primary',
          text: '➕ Додати до колоди',
          onclick: () => {
            const s = subjInp.value.trim() || 'Загальне';
            const f = frontInp.value.trim();
            const b = backInp.value.trim();
            if (!f || !b) {
              toast('Заповніть питання та відповідь картки', true);
              return;
            }
            allCards.push({
              id: 'fc-' + Date.now().toString(36),
              subject: s.slice(0, 60),
              front: f.slice(0, 400),
              back: b.slice(0, 600),
              mastered: false
            });
            storage.setFlashcards(allCards);
            state.subjectFilter = '';
            state.index = allCards.length - 1;
            state.flipped = false;
            toast('Нову флеш-картку додано!', false);
            refresh();
          }
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          text: '⚡ Імпортувати картки з моїх завдань',
          onclick: () => {
            if (manager.tasks.length === 0) {
              toast('Спочатку додайте навчальні завдання', true);
              return;
            }
            let added = 0;
            manager.tasks.forEach((t) => {
              const exists = allCards.some((c) => c.front === t.title);
              if (!exists) {
                allCards.push({
                  id: 'fc-' + Date.now().toString(36) + '-' + added,
                  subject: t.subject,
                  front: t.title,
                  back: t.description || ('Дедлайн: ' + SP.Validator.formatDate(t.dueDate)),
                  mastered: t.status === 'DONE'
                });
                added++;
              }
            });
            storage.setFlashcards(allCards);
            toast(added > 0 ? 'Додано карток із завдань: ' + added : 'Усі завдання вже є у флеш-картках', false);
            refresh();
          }
        })
      ])
    ]);

    container.appendChild(h('div', { class: 'flashcards-layout' }, [trainerBox, createPanel]));
  }

  SP.FlashcardsView = {
    getDeck: getDeck,
    getMasteredCount: getMasteredCount,
    render: render
  };
})(window);

