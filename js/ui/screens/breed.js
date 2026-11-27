/* ГеноЛаб — js/ui/screens/breed.js — экран «Скрещивание» (фаза 4б).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.ui.screens.breed.
 * Два слота родителей (выбор из вольера через <select>), кнопка
 * «Случайно», анимация скрещивания 1–2 с (только CSS keyframes,
 * <style> — константа внутри экрана; css-файлы фаза 4б не трогает),
 * лента потомков (render.creature). Потомки добавляются в вольер
 * через state.store с учётом лимита слотов; при переполнении —
 * диалог выбора, кого оставить.
 * Математика — только core.breeder.cross (docs/api.md), breeder.js
 * и genome.js не меняются. Разметка — только из внутренних констант
 * и данных store (SECURITY.md §4).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  g.ui = g.ui || {};
  g.ui.screens = g.ui.screens || {};

  /* Длительность анимации, мс (промпт: 1–2 с). */
  var BUSY_MS = 1600;

  /* CSS анимации экрана (ключи breed-* — локальны, конфликтов нет). */
  var STYLE_CSS =
    '.breed-slot__select{width:100%;padding:4px;font:inherit;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:var(--radius)}' +
    '@keyframes breed-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}' +
    '@keyframes breed-pop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
    '.breed-slot.is-busy .breed-slot__sprite{animation:breed-pulse .8s ease-in-out infinite}' +
    '.breed__ribbon{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}' +
    '.breed__ribbon-item{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);padding:10px;display:flex;flex-direction:column;align-items:center;gap:6px;animation:breed-pop .4s ease both}' +
    '.breed__ribbon-item svg{max-width:100%;height:auto}' +
    '.breed__ribbon-pheno{font-size:var(--font-size-sm);color:var(--ink-soft);text-align:center}' +
    '.breed__ribbon-status{font-size:var(--font-size-sm);color:var(--accent);text-align:center}' +
    /* Фаза 7a: бейдж «мутация» и строка статистики (chance + счётчик). */
    '.breed__mut-badge{display:inline-block;font-size:var(--font-size-sm);color:var(--accent);border:1px solid var(--accent);border-radius:4px;padding:1px 6px}' +
    '.breed__mut-info{display:flex;gap:16px;flex-wrap:wrap;color:var(--ink-soft);font-size:var(--font-size-sm);margin-top:6px}' +
    '.breed__msg{min-height:1.2em;margin-top:8px;color:var(--ink-soft)}' +
    /* Фаза 5: диалог — модальный оверлей (фон/Escape/свайп вниз закрывают). */
    '.breed__dialog-overlay{position:fixed;inset:0;background:rgba(61,50,41,.5);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px}' +
    '.breed__dialog{border:2px solid var(--accent);border-radius:var(--radius);padding:16px;background:var(--surface);display:flex;flex-direction:column;gap:8px;max-width:440px;width:100%;max-height:80vh;overflow:auto;animation:breed-pop .25s ease both;box-shadow:var(--shadow-m)}' +
    '.breed__dialog-item{display:flex;align-items:center;gap:8px;min-height:44px;cursor:pointer}' +
    '.breed__dialog-close{align-self:flex-end;min-height:44px;padding:8px 14px}' +
    '.breed__dialog-actions{display:flex;gap:8px;flex-wrap:wrap}';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  function phLabel(phen, sp) {
    var parts = [];
    sp.traits.forEach(function (t) { parts.push(t.name + ': ' + phen[t.id]); });
    return parts.join(', ');
  }

  function getStore() { return g.state.store; }
  function enclosureList() { return getStore().getState().enclosure; }
  function byId(id) {
    var found = null;
    enclosureList().forEach(function (c) { if (c.id === id) found = c; });
    return found;
  }

  /* Фаза 7a: параметры мутаций из конфига (economy.getMutation). */
  function mutCfg() {
    var e = g.core && g.core.economy;
    return (e && typeof e.getMutation === 'function') ? e.getMutation() : { enabled: false, chance: 0 };
  }

  /* Локальное состояние экрана (переживает перерисовки). */
  var currentContainer = null;
  var selA = null;
  var selB = null;
  var busy = false;
  var busyClassA = false;
  var busyClassB = false;
  var message = '';
  var lastResults = [];  // {genome, status: 'in' | 'out' | 'pending', idIn}
  var dialog = null;     // {rejected: [{genome, checked, index}], free: number, addedIds: [id]}

  function slotOptions(selectedId, filterId) {
    var genome = g.core.genome;
    var list = enclosureList();
    /* Фаза 7d: межвидовое скрещивание запрещено — второго родителя
     * выбираем только из существ того же вида, что и другой. */
    var other = filterId ? byId(filterId) : null;
    if (other) {
      list = list.filter(function (c) { return c.species === other.species; });
    }
    var html = '<option value="">— выберите —</option>';
    list.forEach(function (c) {
      var phen = genome.genomeToPhenotype(c);
      var sp = genome.getSpecies(c.species);
      html += '<option value="' + esc(c.id) + '"' + (c.id === selectedId ? ' selected' : '') + '>' +
        esc(c.id + ' — ' + sp.name + ': ' + phLabel(phen, sp)) + '</option>';
    });
    return html;
  }

  function slotHTML(which, selectedId, isBusy, otherId) {
    var genome = g.core.genome;
    var creature = g.render.creature;
    var c = byId(selectedId);
    var sprite;
    var label;
    if (c) {
      var phen = genome.genomeToPhenotype(c);
      /* Фаза 7d: рендер по виду + имя вида в подписи. */
      sprite = creature.renderCreature(phen, 96, undefined, c.species);
      var spSel = genome.getSpecies(c.species);
      label = c.id + ' — ' + spSel.name + ': ' + phLabel(phen, spSel);
    } else {
      sprite = '<span class="breed-slot__empty">пусто</span>';
      label = 'родитель не выбран';
    }
    return '<div class="breed-slot' + (isBusy ? ' is-busy' : '') + '" data-breed-slot="' + which + '">' +
      '<select class="breed-slot__select" id="breed-select-' + which + '" name="breed-select-' + which + '" data-breed-select="' + which + '" aria-label="Родитель ' + which + '">' +
      slotOptions(selectedId, otherId) +
      '</select>' +
      '<div class="breed-slot__sprite">' + sprite + '</div>' +
      '<div class="breed-slot__label">' + esc(label) + '</div>' +
      '</div>';
  }

  function ribbonHTML() {
    var genome = g.core.genome;
    var creature = g.render.creature;
    var html = '<div class="breed__result"><h2>Потомки</h2>';
    if (lastResults.length === 0) {
      html += '<span class="screen__hint">Пока пусто — выберите родителей и нажмите «Скрестить».</span>';
    }
    lastResults.forEach(function (r) {
      var phen = genome.genomeToPhenotype(r.genome);
      var sp = genome.getSpecies(r.genome.species);
      var status = r.status === 'in' ? 'В вольере: #' + esc(r.idIn) :
        r.status === 'pending' ? 'ожидает выбора' : 'выпущен';
      /* Фаза 7a: бейдж «мутация» — потомок с ≥1 флипом аллеля. */
      var badge = r.mutated ? '<span class="breed__mut-badge">мутация</span> ' : '';
      html += '<div class="breed__ribbon-item">' +
        /* Фаза 7d: рендер по виду потомка. */
        '<div>' + creature.renderCreature(phen, 96, undefined, r.genome.species) + '</div>' +
        '<div class="breed__ribbon-pheno">' + badge + esc(phLabel(phen, sp)) + '</div>' +
        '<div class="breed__ribbon-status">' + status + '</div>' +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  function dialogHTML() {
    if (!dialog) return '';
    var st = getStore().getState();
    var liveFree = st.slotLimit - st.enclosure.length;
    var canKeep = dialog.free > 0 || dialog.addedIds.length > 0;
    var html = '<div class="breed__dialog-overlay">' +
      '<div class="breed__dialog" role="dialog" aria-modal="true" aria-label="Вольер полон">' +
      '<h3>Вольер полон (' + st.enclosure.length + '/' + st.slotLimit + ')</h3>' +
      '<button class="btn breed__dialog-close" type="button" data-breed-dlg-cancel ' +
      'aria-label="Закрыть диалог">\u2715</button>' +
      '<p class="breed__msg">Свободных слотов: ' + liveFree +
      (canKeep
        ? ' — отметьте, кого оставить (до ' + dialog.free +
          (dialog.addedIds.length > 0 ? '; при нехватке слота — обмен на последнего добавленного потомка' : '') +
          ' — остальные будут выпущены).'
        : ' — освободите слоты на экране «Вольер» (продажа) и повторите скрещивание.') +
      '</p>';
    if (canKeep) {
      dialog.rejected.forEach(function (r, i) {
        var genome = g.core.genome;
        var phen = genome.genomeToPhenotype(r.genome);
        var sp = genome.getSpecies(r.genome.species);
        html += '<label class="breed__dialog-item">' +
          '<input type="checkbox" data-breed-dlg="' + i + '"' + (r.checked ? ' checked' : '') + '>' +
          '<span class="breed__ribbon-pheno">' + esc(phLabel(phen, sp)) + '</span>' +
          '</label>';
      });
      html += '<div class="breed__dialog-actions">' +
        '<button class="btn" type="button" data-breed-dlg-keep>Оставить выбранных</button>' +
        '<button class="btn" type="button" data-breed-dlg-cancel>Отмена</button>' +
        '</div>';
    } else {
      html += '<div class="breed__dialog-actions">' +
        '<button class="btn" type="button" data-breed-dlg-cancel>Понятно</button>' +
        '</div>';
    }
    return html + '</div></div>';
  }

  /* Фаза 5: единый выход из диалога (кнопки «Отмена/Понятно», крестик,
   * клик по фону, Escape, свайп вниз по диалогу). */
  function cancelDialog() {
    if (!dialog) return;
    lastResults.forEach(function (lr) {
      if (lr.status === 'pending') lr.status = 'out';
    });
    dialog = null;
    if (dlgEscapeHandler) {
      global.document.removeEventListener('keydown', dlgEscapeHandler);
      dlgEscapeHandler = null;
    }
    message = 'Потомки, не попавшие в вольер, выпущены.';
    if (currentContainer && global.document.contains(currentContainer)) {
      renderScreen(currentContainer);
    }
  }

  var dlgEscapeHandler = null;

  function renderScreen(container) {
    var st = getStore().getState();
    /* Просроченные выборы (существо продали) сбрасываем. */
    if (selA && !byId(selA)) selA = null;
    if (selB && !byId(selB)) selB = null;

    /* Фаза 7a: строка статистики мутаций (chance из конфига + счётчик). */
    var mc = mutCfg();
    var mutInfo = '<div class="breed__mut-info">' +
      '<span>Шанс мутации: ' + (mc.chance * 100).toFixed(0) + '%</span>' +
      '<span>Мутаций: ' + (st.mutations ? st.mutations.total : 0) + '</span>' +
      '</div>';

    var html = '<section class="screen" aria-labelledby="screen-title">' +
      '<h1 class="screen__title" id="screen-title">Скрещивание</h1>' +
      '<style>' + STYLE_CSS + '</style>' +
      mutInfo +
      '<div class="breed__parents">' +
      slotHTML('A', selA, busyClassA, selB) +
      '<div class="breed__plus">×</div>' +
      slotHTML('B', selB, busyClassB, selA) +
      '</div>' +
      '<div class="breed__actions" style="margin-top:10px">' +
      '<button class="btn" type="button" data-breed-random>Случайно</button>' +
      '<button class="btn" type="button" data-breed-start' + (busy ? ' disabled' : '') + '>Скрестить</button>' +
      '</div>' +
      '<div class="breed__msg" role="status"></div>' +
      ribbonHTML() +
      dialogHTML() +
      '</section>';

    container.innerHTML = html;
    var msg = container.querySelector('.breed__msg');
    if (message) msg.textContent = message;
    message = '';

    if (st.enclosure.length < 2) {
      msg.textContent = 'В вольере меньше двух существ — скрещивание пока недоступно.';
    }

    var startBtn = container.querySelector('[data-breed-start]');
    var randomBtn = container.querySelector('[data-breed-random]');

    container.querySelectorAll('[data-breed-select]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        if (sel.dataset.breedSelect === 'A') selA = sel.value || null;
        else selB = sel.value || null;
        renderScreen(container);
      });
    });

    randomBtn.addEventListener('click', function () {
      /* Фаза 7d: случайная пара — только одного вида. */
      var bySpecies = {};
      enclosureList().forEach(function (c) {
        (bySpecies[c.species] = bySpecies[c.species] || []).push(c.id);
      });
      var pools = Object.keys(bySpecies)
        .map(function (k) { return bySpecies[k]; })
        .filter(function (ids) { return ids.length >= 2; });
      if (pools.length === 0) {
        message = 'Для случайного выбора нужно минимум два существа одного вида в вольере.';
        renderScreen(container);
        return;
      }
      var pool = pools[g.core.rng.randomInt(0, pools.length - 1)];
      var i = g.core.rng.randomInt(0, pool.length - 1);
      var j = g.core.rng.randomInt(0, pool.length - 2);
      if (j >= i) j += 1;
      selA = pool[i];
      selB = pool[j];
      renderScreen(container);
    });

    startBtn.addEventListener('click', function () {
      startCross(container);
    });

    if (dialog) bindDialog(container);
  }

  function bindDialog(container) {
    /* Лимит отметок — свободные слоты на момент скрещивания: при
     * нехватке слота «Оставить» делает обмен на добавленного потомка. */
    var free = dialog.free;
    container.querySelectorAll('[data-breed-dlg]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        if (cb.checked) {
          var checkedCount = container.querySelectorAll('[data-breed-dlg]:checked').length;
          if (checkedCount > free) {
            cb.checked = false;
            return;
          }
        }
        dialog.rejected[Number(cb.dataset.breedDlg)].checked = cb.checked;
      });
    });

    var keep = container.querySelector('[data-breed-dlg-keep]');
    if (keep) {
      keep.addEventListener('click', function () {
        var store = getStore();
        var kept = 0;
        dialog.rejected.forEach(function (r) {
          if (!r.checked) return;
          var res = store.addCreature(deepCopy(r.genome));
          if (!res.ok && dialog.addedIds.length > 0) {
            /* Обмен: освобождаем последнего добавленного потомка. */
            var swapped = dialog.addedIds.pop();
            store.removeCreature(swapped);
            lastResults.forEach(function (lr) {
              if (lr.idIn === swapped) { lr.status = 'out'; lr.idIn = null; }
            });
            res = store.addCreature(deepCopy(r.genome));
          }
          if (res.ok) {
            kept += 1;
            lastResults[r.index].status = 'in';
            lastResults[r.index].idIn = res.id;
          }
        });
        var leftPending = lastResults.filter(function (lr) { return lr.status === 'pending'; });
        lastResults.forEach(function (lr) {
          if (lr.status === 'pending') lr.status = 'out';
        });
        if (kept === 0 && leftPending.length > 0) {
          message = 'Не хватило слотов — освободите место в вольере.';
          return; // диалог остаётся открытым
        }
        message = kept > 0 ? 'В вольер добавлено: ' + kept : 'Выбора не было — потомки выпущены.';
        dialog = null;
        if (dlgEscapeHandler) {
          global.document.removeEventListener('keydown', dlgEscapeHandler);
          dlgEscapeHandler = null;
        }
        renderScreen(container);
      });
    }

    /* Все кнопки с data-breed-dlg-cancel (кнопки + крестик) — один выход. */
    container.querySelectorAll('[data-breed-dlg-cancel]').forEach(function (btn) {
      btn.addEventListener('click', function () { cancelDialog(); });
    });

    /* Клик по фону закрывает (сам диалог — нет). */
    var overlay = container.querySelector('.breed__dialog-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) cancelDialog();
      });
    }

    /* Escape закрывает (слушатель на document — один, предыдущий снят). */
    if (dlgEscapeHandler) {
      global.document.removeEventListener('keydown', dlgEscapeHandler);
    }
    dlgEscapeHandler = function (e) {
      if (e.key === 'Escape' && dialog) cancelDialog();
    };
    global.document.addEventListener('keydown', dlgEscapeHandler);

    /* Свайп вниз по диалогу закрывает (мобильный жест, TZ §8.6). */
    var dlgEl = container.querySelector('.breed__dialog');
    if (dlgEl) {
      var touchY = null;
      dlgEl.addEventListener('touchstart', function (e) {
        touchY = e.touches[0].clientY;
      }, { passive: true });
      dlgEl.addEventListener('touchend', function (e) {
        if (touchY === null) return;
        var dy = e.changedTouches[0].clientY - touchY;
        if (dy < -40) cancelDialog();
        touchY = null;
      }, { passive: true });
    }
  }

  function startCross(container) {
    if (busy) return;
    if (!selA || !selB) {
      message = 'Выберите обоих родителей.';
      renderScreen(container);
      return;
    }
    if (selA === selB) {
      message = 'Родители должны быть разные.';
      renderScreen(container);
      return;
    }
    var pa = byId(selA);
    var pb = byId(selB);
    if (!pa || !pb) {
      message = 'Родители не найдены в вольере.';
      renderScreen(container);
      return;
    }
    /* Фаза 7d: guard межвидового скрещивания на уровне UI (в core
     * checkBoth тоже бросит, но здесь понятнее для игрока). */
    if (pa.species !== pb.species) {
      var spA = g.core.genome.getSpecies(pa.species);
      var spB = g.core.genome.getSpecies(pb.species);
      message = 'Скрещивание между видами невозможно: ' +
        spA.name + ' × ' + spB.name + '.';
      renderScreen(container);
      return;
    }

    busy = true;
    busyClassA = true;
    busyClassB = true;
    message = 'Скрещивание…';
    renderScreen(container);

    global.setTimeout(function () {
      var offspring = g.core.breeder.cross(pa, pb);
      var store = getStore();
      /* Фаза 7a: мутации ВНЕ cross — flipGenome на каждого потомка.
       * Отдельный ГСЧ для мутаций: последовательность ГСЧ скрещивания
       * не расходуется (тест T5). Результат flipGenome — новый геном, вход
       * из cross() не мутируется. */
      var mc = mutCfg();
      var mutRng = g.core.rng.createRng(Date.now());
      var mutationMod = g.core.mutation;
      lastResults = offspring.map(function (off) {
        var entry = { genome: off, status: 'pending', idIn: null, mutated: false };
        if (mutationMod && typeof mutationMod.flipGenome === 'function' &&
            mc.enabled && mc.chance > 0) {
          var res = mutationMod.flipGenome(off, mutRng, mc);
          entry.genome = res.genome;
          entry.mutated = res.flipped > 0;
        }
        return entry;
      });
      /* Фаза 7a: счётчик мутаций в сейве (+1 за каждого мутировавшего). */
      if (mutationMod && typeof store.recordMutations === 'function') {
        var mutatedCount = lastResults.filter(function (r) { return r.mutated; }).length;
        if (mutatedCount > 0) store.recordMutations(mutatedCount);
      }
      /* Квесты (фаза 4c): каждый полученный потомок засчитывается в цель,
       * независимо от того, остался ли он в вольере.
       * Фаза 7a: фенотип — ПОСЛЕ флипа (questEngine получает мутант). */
      var quest = g.quests && g.quests.questEngine;
      lastResults.forEach(function (r) {
        if (quest) quest.onOffspring(g.core.genome.genomeToPhenotype(r.genome));
      });
      dialog = null;
      var freeBefore = store.getState().slotLimit - store.getState().enclosure.length;
      var rejected = [];
      var addedIds = [];
      lastResults.forEach(function (r, i) {
        var res = store.addCreature(deepCopy(r.genome));
        if (res.ok) {
          r.status = 'in';
          r.idIn = res.id;
          addedIds.push(res.id);
        } else {
          rejected.push({ genome: deepCopy(r.genome), checked: false, index: i });
        }
      });
      busy = false;
      busyClassA = false;
      busyClassB = false;
      /* Фаза 6: звук (ui/sfx.js) — успех или «вольер полон». */
      if (g.ui && g.ui.sfx && typeof g.ui.sfx.play === 'function') {
        g.ui.sfx.play(rejected.length > 0 ? 'error' : 'success');
      }
      if (rejected.length > 0) {
        dialog = { rejected: rejected, free: freeBefore, addedIds: addedIds };
        message = rejected.length + ' потомков не поместилось — выберите, кого оставить.';
      } else {
        message = 'Готово: ' + offspring.length + ' потомков в вольере.';
      }
      renderScreen(container);
    }, BUSY_MS);
  }

  function screenRender(container) {
    currentContainer = container;
    renderScreen(container);
  }

  var screen = {
    name: 'breed',
    render: screenRender
  };

  g.ui.screens.breed = screen;

  /* Экран живёт на своём маршруте — перерисовываемся при каждом
   * изменении состояния (добавление/продажа в вольере). */
  if (g.state && g.state.store && typeof g.state.store.subscribe === 'function') {
    g.state.store.subscribe(function () {
      if (!busy && currentContainer && global.document.contains(currentContainer) &&
          (!g.router || g.router.active === 'breed')) {
        renderScreen(currentContainer);
      }
    });
  }

  /* Экран сам регистрируется в роутере (роутер грузится раньше). */
  if (g.router && typeof g.router.register === 'function') {
    g.router.register('breed', screen.render);
  }
})(typeof window !== 'undefined' ? window : globalThis);
