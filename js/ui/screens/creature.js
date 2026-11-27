/* ГеноЛаб — js/ui/screens/creature.js — экран «Карточка существа» (фаза 4c).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.ui.screens.creature.
 *
 * Выбор существа из вольера (state/store.js), крупный SVG-рендер
 * (render.creature), платное «Секвенировать»: генотип скрыт, а после
 * действия показывается (стоимость — prices.sequence из config.json
 * через js/core/economy.js; монеты списывает state.store). Событие
 * уходит в js/quests/questEngine.js (onSequenced). Открытие генотипа
 * не сохраняется в сейве: после перезагрузки снова скрыт (схема
 * genolab_save_v1 без изменений).
 *
 * Разметка — только из внутренних констант и данных вида
 * (SECURITY.md §4); строки состояния — через textContent/esc().
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  var screens = (g.ui = g.ui || {}).screens = g.ui.screens || {};

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function getStore() { return g.state.store; }

  var currentContainer = null;
  var selectedId = null;   /* id выбранного существа */
  var known = {};          /* id -> true: генотип открыт в этой сессии */
  var message = '';

  function optionsHTML() {
    var st = getStore().getState();
    var html = '<option value="">— выберите существо —</option>';
    st.enclosure.forEach(function (c) {
      var phen = g.core.genome.genomeToPhenotype(c);
      /* Фаза 7d: признаки по виду существа + имя вида в подписи. */
      var sp = g.core.genome.getSpecies(c.species);
      var parts = [];
      sp.traits.forEach(function (t) { parts.push(phen[t.id]); });
      html += '<option value="' + esc(c.id) + '" name="' + esc(c.id) + '">№ ' +
        esc(c.id) + ' — ' + esc(sp.name + ': ' + parts.join(', ')) + '</option>';
    });
    return html;
  }

  /* «Aa» — доминантный аллель первым, как в genome.genotypeString. */
  function pairLabel(pair) {
    var a = pair[0], b = pair[1];
    if (a.toLowerCase() === a && b.toLowerCase() === b && a !== b) return b + a;
    return a + b;
  }

  function genotypeHTML(c) {
    if (!known[c.id]) return null;
    var sp = g.core.genome.getSpecies(c.species);
    var rows = '';
    sp.traits.forEach(function (t, i) {
      rows += '<tr><td class="creature__trait-name">' + esc(t.name) + '</td>' +
        '<td class="creature__trait-alleles">' + esc(pairLabel(c.pairs[i])) + '</td></tr>';
    });
    return '<table class="creature__genotype">' + rows + '</table>' +
      '<p class="creature__genotype-string">Генотип: ' +
      esc(g.core.genome.genotypeString(c)) + '</p>';
  }

  function renderScreen(container) {
    var store = getStore();
    var st = store.getState();
    var genome = g.core.genome;
    var price = g.core.economy.getPrice('sequence');

    var c = null;
    if (selectedId) {
      for (var i = 0; i < st.enclosure.length; i++) {
        if (st.enclosure[i].id === selectedId) { c = st.enclosure[i]; break; }
      }
    }
    if (!c && st.enclosure.length > 0) {
      selectedId = st.enclosure[0].id;
      c = st.enclosure[0];
    }

    var body;
    if (!c) {
      body = '<p class="creature__empty">Вольер пуст — загляните на экран «Скрещивание».</p>';
    } else {
      var phen = genome.genomeToPhenotype(c);
      /* Фаза 7d: рендер по виду существа (4-й аргумент). */
      var svg = g.render.creature.renderCreature(phen, 240, undefined, c.species);
      var canSeq = !known[c.id] && st.resources.coins >= price;
      var seqBlock = known[c.id]
        ? genotypeHTML(c)
        : '<p class="creature__genotype-hidden">Генотип скрыт.</p>';
      body =
        '<div class="creature__body">' +
        '  <div class="creature__sprite">' + svg + '</div>' +
        '  <div class="creature__info">' +
        '    <button class="btn btn--primary creature__seq" type="button"' +
        (known[c.id] || !canSeq ? ' disabled' : '') + '>Секвенировать (' + price + ' мон.)</button>' +
        '    ' + seqBlock +
        '    <p class="creature__hint">' + (known[c.id]
          ? 'Генотип открыт. Секвенирование — одно действие на существо (в этой сессии).'
          : 'Секвенирование откроет генотип (стоимость: ' + price + ' мон.).') + '</p>' +
        '  </div>' +
        '</div>';
    }

    container.innerHTML =
      '<style>' +
      '.creature__select{margin:12px 0;}' +
      '.creature__select select{padding:6px 10px;background:var(--surface);color:var(--ink);' +
      'border:1px solid var(--line);border-radius:var(--radius);min-width:280px;max-width:100%;}' +
      '.creature__empty{color:var(--ink-soft);}' +
      '.creature__genotype{border-collapse:collapse;margin:8px 0;font-size:var(--font-size-sm);}' +
      '.creature__genotype td{border:1px solid var(--line);padding:4px 12px;}' +
      '.creature__genotype-string{font-size:var(--font-size-sm);color:var(--accent);}' +
      '.creature__genotype-hidden{color:var(--ink-soft);font-style:italic;}' +
      '.creature__msg{margin:12px 0 0;font-size:var(--font-size-sm);color:var(--accent);min-height:1.2em;}' +
      '</style>' +
      '<section class="screen" aria-labelledby="screen-title">' +
      '<h1 class="screen__title" id="screen-title">Карточка существа</h1>' +
      '<div class="creature__select"><label for="creature-select">Существо: </label>' +
      '<select id="creature-select" name="creature-select">' + optionsHTML() + '</select></div>' +
      body +
      '<p class="creature__msg" role="status"></p>' +
      '</section>';

    var msgEl = container.querySelector('.creature__msg');
    if (msgEl) msgEl.textContent = message;

    var select = container.querySelector('#creature-select');
    select.value = selectedId || '';
    select.addEventListener('change', function () {
      selectedId = select.value || null;
      message = '';
      renderScreen(container);
    });

    var btn = container.querySelector('.creature__seq');
    if (btn) {
      btn.addEventListener('click', function () {
        var st2 = getStore().getState();
        if (!c || known[c.id]) return;
        if (st2.resources.coins < price) {
          message = 'Не хватает монет: нужно ' + price + '.';
          renderScreen(container);
          return;
        }
        store.addCoins(-price);
        known[c.id] = true;
        var phen2 = g.core.genome.genomeToPhenotype(c);
        var r = g.quests.questEngine.onSequenced(phen2);
        message = 'Генотип #' + c.id + ': ' + g.core.genome.genotypeString(c) +
          (r.completed ? ' Квест «' + r.completed.title + '» выполнен: +' +
            r.completed.reward.coins + ' мон., +' + r.completed.reward.reputation + ' реп.' : '');
        renderScreen(container);
      });
    }
  }

  var screen = {
    name: 'creature',
    render: function (container) {
      currentContainer = container;
      renderScreen(container);
    }
  };

  g.ui.screens.creature = screen;

  if (g.router && typeof g.router.register === 'function') {
    g.router.register('creature', screen.render);
  }

  if (g.state && g.state.store && typeof g.state.store.subscribe === 'function') {
    g.state.store.subscribe(function () {
      if (currentContainer && document.contains(currentContainer) &&
          (!g.router || g.router.active === 'creature')) {
        renderScreen(currentContainer);
      }
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
