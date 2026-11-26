/* ГеноЛаб — js/ui/screens/enclosure.js — экран «Вольер» (фаза 3).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.ui.screens.enclosure.
 * Сетка карточек существ из state/store.js; на каждой карточке кнопки
 * «Оставить» (подтверждение — существо остаётся в вольере) и
 * «Продать» (базовая цена из js/data/config.json через state.store).
 * Кнопки экспорта/импорта сейва (state/save.js).
 * Разметка — только из внутренних констант и данных конфига
 * (SECURITY.md §4); ошибки сейва — через textContent.
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  g.ui = g.ui || {};
  g.ui.screens = g.ui.screens || {};

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function phLabel(phen, sp) {
    var parts = [];
    sp.traits.forEach(function (t) {
      parts.push(t.name + ': ' + phen[t.id]);
    });
    return parts.join(', ');
  }

  /* Фаза 5: тосты (ui/toast.js грузится раньше экранов). */
  function toast(msg, type) {
    if (g.ui && g.ui.toast && typeof g.ui.toast.show === 'function') {
      g.ui.toast.show(msg, type);
    }
  }

  function cardHTML(c, price) {
    var core = g.core;
    var phen = core.genome.genomeToPhenotype(c);
    var sp = core.genome.getSpecies(c.species);
    var svg = g.render.creature.renderCreature(phen, 96);
    return '<article class="enclosure__card">' +
      '<div class="enclosure__card-svg">' + svg + '</div>' +
      '<h2 class="enclosure__card-id">#' + esc(c.id) + ' — ' + esc(sp.name) + '</h2>' +
      '<p class="enclosure__card-pheno">' + esc(phLabel(phen, sp)) + '</p>' +
      '<div class="enclosure__card-actions">' +
      '<button class="btn enclosure__keep" type="button">Оставить</button>' +
      '<button class="btn enclosure__sell" type="button">Продать (' + price + ' мон.)</button>' +
      '</div>' +
      '</article>';
  }

  /* Фаза 6: звук (ui/sfx.js) — только error при неудачных действиях. */
  function sfxError() {
    if (g.ui && g.ui.sfx && typeof g.ui.sfx.play === 'function') {
      g.ui.sfx.play('error');
    }
  }

  var currentContainer = null;

  function renderScreen(container) {
    var store = g.state.store;
    var save = g.state.save;
    var econ = g.core.economy;
    var st = store.getState();
    var price = (econ.getPrice('sellCreature')) || 0;
    /* Фаза 6: кнопка «Купить слот» — store.buySlot() (цена/предел из
     * конфига; ТЗ §3.2.4 — «12 слотов на старте», расширение до max). */
    var slotPrice = (econ.getPrice('buySlot')) || 0;
    var maxSlots = (econ.getConfig && econ.getConfig() &&
      econ.getConfig().slots && econ.getConfig().slots.max) || 24;
    var atMax = st.slotLimit >= maxSlots;

    var html = '<section class="screen" aria-labelledby="screen-title">' +
      '<h1 class="screen__title" id="screen-title">Вольер</h1>' +
      '<div class="enclosure__slots">Занято: ' + st.enclosure.length + ' / ' + st.slotLimit + '</div>';

    if (save.errorMessage()) {
      html += '<div class="enclosure__error" role="alert"></div>';
    }

    html += '<div class="enclosure__actions">' +
      '<button class="btn enclosure__buy-slot" type="button"' + (atMax ? ' disabled' : '') +
      (atMax ? ' title="Максимум слотов (' + maxSlots + ')' : '') +
      '>Купить слот (' + slotPrice + ' мон.)</button>' +
      '<button class="btn enclosure__export" type="button">Экспорт сейва</button>' +
      '<label class="btn enclosure__import">Импорт сейва' +
      '<input class="enclosure__import-input" type="file" accept=".json,application/json" hidden></label>' +
      '</div>';

    html += '<div class="enclosure__grid">';
    if (st.enclosure.length === 0) {
      html += '<span class="screen__hint">Вольер пуст. Существа появятся после скрещивания.</span>';
    } else {
      st.enclosure.forEach(function (c) { html += cardHTML(c, price); });
    }
    html += '</div></section>';

    container.innerHTML = html;

    var errBox = container.querySelector('.enclosure__error');
    if (errBox) errBox.textContent = save.errorMessage();

    container.querySelectorAll('.enclosure__card').forEach(function (cardEl) {
      /* Заголовок карточки: «#c1 — Голо» — id до « — ». */
      var id = cardEl.querySelector('.enclosure__card-id').textContent.slice(1).split(' — ')[0];
      var keep = cardEl.querySelector('.enclosure__keep');
      var sell = cardEl.querySelector('.enclosure__sell');
      keep.addEventListener('click', function () {
        /* Подтверждение: существо остаётся в вольере.
         * Заменяем только кнопку «Оставить», «Продать» остаётся. */
        var note = global.document.createElement('span');
        note.className = 'enclosure__card-kept';
        note.textContent = 'Оставлено в вольере';
        keep.replaceWith(note);
      });
      sell.addEventListener('click', function () {
        var r = store.sellCreature(id);
        if (r.ok) {
          toast('Продано #' + id + ' (+' + price + ' монет)', 'ok');
          screenRender(container);
        }
        else {
          var box = cardEl.querySelector('.enclosure__card-actions');
          box.textContent = r.reason;
          sfxError();
        }
      });
    });

    /* Фаза 6: покупка доп. слота — store.buySlot(), цена из конфига. */
    var buyBtn = container.querySelector('.enclosure__buy-slot');
    if (buyBtn) {
      buyBtn.addEventListener('click', function () {
        var r = store.buySlot();
        if (r.ok) {
          toast('Слот куплен: ' + r.slotLimit + '/' + maxSlots, 'ok');
        } else {
          toast(r.reason, 'err');
          sfxError();
        }
        /* При успехе store.emit() — подписчик ниже перерисует экран; */
        /* при неудаче состояние не меняется — перерисовка не нужна.  */
      });
    }

    container.querySelector('.enclosure__export').addEventListener('click', function () {
      var r = save.exportFile();
      var actions = container.querySelector('.enclosure__actions');
      var msg = global.document.createElement('span');
      msg.className = 'enclosure__msg';
      msg.textContent = r.ok ? ('Скачан файл ' + r.filename) : r.reason;
      actions.appendChild(msg);
      setTimeout(function () { msg.remove(); }, 4000);
      toast(r.ok ? ('Скачан файл ' + r.filename) : r.reason, r.ok ? 'ok' : 'err');
    });

    container.querySelector('.enclosure__import-input').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      save.importFile(file).then(function (r) {
        renderScreen(container);
        var actions = container.querySelector('.enclosure__actions');
        var msg = global.document.createElement('span');
        msg.className = 'enclosure__msg';
        msg.textContent = r.ok ? 'Сейв импортирован.' : r.reason;
        actions.appendChild(msg);
        setTimeout(function () { msg.remove(); }, 4000);
        toast(r.ok ? 'Сейв импортирован.' : r.reason, r.ok ? 'ok' : 'err');
        if (!r.ok) sfxError();
      });
    });
  }

  function screenRender(container) {
    currentContainer = container;
    renderScreen(container);
  }

  /* Экран живёт на своём маршруте — перерисовываемся при каждом
   * изменении состояния (добавление/продажа/импорт сейва). */
  if (g.state && g.state.store && typeof g.state.store.subscribe === 'function') {
    g.state.store.subscribe(function () {
      if (currentContainer && global.document.contains(currentContainer) &&
          (!g.router || g.router.active === 'enclosure')) {
        renderScreen(currentContainer);
      }
    });
  }

  var screen = {
    name: 'enclosure',
    render: screenRender
  };

  g.ui.screens.enclosure = screen;

  /* Экран сам регистрируется в роутере (роутер грузится раньше). */
  if (g.router && typeof g.router.register === 'function') {
    g.router.register('enclosure', screen.render);
  }
})(typeof window !== 'undefined' ? window : globalThis);
