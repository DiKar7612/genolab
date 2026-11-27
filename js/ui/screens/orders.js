/* ГеноЛаб — js/ui/screens/orders.js — экран «Заказы» (фаза 4c).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.ui.screens.orders.
 *
 * Панель активного квеста (линейная разблокировка, прогресс) + список
 * 5 заказов из js/data/quests.json через js/quests/questEngine.js.
 * Фильтр по признакам: показать заказы, содержащие выбранный признак.
 * Кнопка «Выполнить» активна, только если в вольере есть потомок,
 * фенотип которого совпадает со спецификацией заказа: существо
 * передаётся (store.removeCreature), награда — из данных заказа
 * (store.addCoins / addReputation).
 *
 * Разметка — только из внутренних констант и данных квестов
 * (SECURITY.md §4); пользовательские строки — через textContent/esc().
 * Подписка на store: экран перерисовывается при изменении состояния.
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  g.ui = g.ui || {};
  g.ui.screens = g.ui.screens = g.ui.screens || {};

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function getStore() { return g.state.store; }
  function getEngine() { return g.quests.questEngine; }

  var currentContainer = null;
  var filterKey = '';   /* '' — без фильтра; иначе 'color'/'pattern'/... */
  var filterVal = '';   /* значение признака */
  var message = '';

  /* Фаза 7d: список всех видов (заказы бывают разных видов). */
  function allSpecies() {
    var cfg = g.core.genome.getSpeciesConfig();
    return (cfg && Array.isArray(cfg.species)) ? cfg.species : [];
  }

  /* Вид заказа: поле species (фаза 7d) или golo (старые данные). */
  function speciesFor(order) {
    var id = (order && order.species) ? order.species : 'golo';
    var sp = g.core.genome.getSpecies(id);
    return sp || g.core.genome.getSpecies('golo');
  }

  function phenLabel(phen, order) {
    var sp = speciesFor(order);
    var parts = [];
    sp.traits.forEach(function (t) {
      if (phen[t.id]) parts.push(t.name + ': ' + phen[t.id]);
    });
    return parts.join(', ');
  }

  function filterOptionsHTML() {
    var html = '<option value="">Без фильтра</option>';
    allSpecies().forEach(function (sp) {
      sp.traits.forEach(function (t) {
        Object.keys(t.values).forEach(function (allele) {
          var v = t.values[allele];
          html += '<option value="' + esc(t.id) + ':' + esc(v) + '">' +
            esc(t.name + ': ' + v + ' — ' + sp.name) + '</option>';
        });
      });
    });
    return html;
  }

  function questPanelHTML() {
    var engine = getEngine();
    var st = getStore().getState();
    var qs = st.quests;
    var all = engine.getQuests().quests;
    var completed = (qs && Array.isArray(qs.completed)) ? qs.completed : [];
    var activeId = engine.activeQuestId(qs);

    var html = '<div class="orders__quests" aria-label="Квесты">';
    all.forEach(function (q) {
      var cls = 'orders__quest';
      var status;
      if (q.id === activeId) {
        cls += ' orders__quest--active';
        var p = engine.getProgress(qs, q.id);
        status = 'идёт: ' + p.have + '/' + p.need;
      } else if (completed.indexOf(q.id) !== -1) {
        cls += ' orders__quest--done';
        status = 'выполнен';
      } else {
        cls += ' orders__quest--locked';
        status = 'ждёт очереди';
      }
      html += '<div class="' + cls + '">' +
        '<span class="orders__quest-status">' + esc(status) + '</span> ' +
        '<span class="orders__quest-title">' + esc(q.title) + '</span>' +
        '<span class="orders__quest-concept">(' + esc(q.concept) + ')</span>' +
        '</div>';
    });
    var active = engine.getActive();
    if (active.quest) {
      html += '<p class="orders__quest-text">' + esc(active.quest.text) + '</p>';
    } else {
      html += '<p class="orders__quest-text">Все квесты выполнены. Осталось — заказы.</p>';
    }
    html += '</div>';
    return html;
  }

  function ordersHTML() {
    var engine = getEngine();
    var st = getStore().getState();
    var priceNote = 'Заказ выполняется существом из вольера: оно передаётся заказчику.';

    var filtered = engine.listOrders().filter(function (o) {
      if (!filterKey) return true;
      return o.phen[filterKey] === filterVal;
    });

    var html = '<p class="orders__hint">' + esc(priceNote) + '</p>';
    if (filtered.length === 0) {
      html += '<p class="orders__empty">Нет заказов с таким признаком.</p>';
    }
    filtered.forEach(function (o) {
      var cls = 'orders__item';
      if (o.done) cls += ' orders__item--done';
      else if (!o.match) cls += ' orders__item--waiting';
      html += '<article class="' + cls + '">' +
        '<h2 class="orders__item-title">' + esc(o.title) + '</h2>' +
        '<p class="orders__item-phen">Вид: ' + esc(speciesFor(o).name) +
        ' — признаки: ' + esc(phenLabel(o.phen, o)) + '</p>' +
        '<p class="orders__item-reward">Награда: ' + o.reward.coins + ' мон., ' +
        o.reward.reputation + ' реп.</p>';
      if (o.done) {
        html += '<p class="orders__item-status">Выполнен ✓</p>';
      } else {
        var disabled = o.match ? '' : ' disabled';
        html += '<button class="btn btn--primary orders__item-btn" type="button" data-order="' +
          esc(o.id) + '"' + disabled + '>Выполнить</button>';
        if (!o.match) {
          html += '<p class="orders__item-hint">Нет подходящего потомка в вольере ' +
            '(' + st.enclosure.length + '/' + st.slotLimit + ').</p>';
        }
      }
      html += '</article>';
    });
    return html;
  }

  /* Фаза 6: звук (ui/sfx.js) — вызовы безопасны, если sfx не загружен. */
  function sfxPlay(name) {
    if (g.ui && g.ui.sfx && typeof g.ui.sfx.play === 'function') {
      g.ui.sfx.play(name);
    }
  }
  function sfxError() { sfxPlay('error'); }

  function bindOrders(container) {
    var engine = getEngine();
    var store = getStore();

    var filter = container.querySelector('#orders-filter');
    filter.addEventListener('change', function () {
      if (!filter.value) { filterKey = ''; filterVal = ''; }
      else {
        var parts = filter.value.split(':');
        filterKey = parts[0];
        filterVal = parts.slice(1).join(':');
      }
      renderScreen(container);
    });

    container.querySelectorAll('.orders__item-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var orderId = btn.getAttribute('data-order');
        var o = engine.listOrders().filter(function (x) { return x.id === orderId; })[0];
        if (!o || o.done) return;
        if (!o.match) {
          message = 'Нет подходящего потомка.';
          sfxError();
          renderScreen(container);
          return;
        }
        var creatureId = o.match;
        var res = store.removeCreature(creatureId);
        if (!res.ok) {
          message = 'Не удалось передать #' + creatureId + ': ' + res.reason;
          sfxError();
          renderScreen(container);
          return;
        }
        var r = engine.completeOrder(orderId);
        if (r.ok) {
          var extra = r.questCompleted
            ? ' Квест «' + r.questCompleted.title + '» выполнен: +' +
              r.questCompleted.reward.coins + ' мон., +' +
              r.questCompleted.reward.reputation + ' реп.'
            : '';
          message = 'Заказ выполнен: #' + creatureId + ' передан. +' +
            r.reward.coins + ' мон., +' + r.reward.reputation + ' реп.' + extra;
          /* Фаза 5: короткое подтверждение тостом (TZ §8.6). */
          if (g.ui && g.ui.toast && typeof g.ui.toast.show === 'function') {
            g.ui.toast.show('Заказ выполнен: +' + r.reward.coins + ' мон., +' +
              r.reward.reputation + ' реп.', 'ok');
          }
          /* Фаза 6: звук (ui/sfx.js) — аккорд выполненного заказа. */
          sfxPlay('order');
        } else {
          message = 'Ошибка: ' + r.reason;
          sfxError();
        }
        renderScreen(container);
      });
    });
  }

  function renderScreen(container) {
    container.innerHTML =
      '<style>' +
      '.orders__quests{display:flex;flex-direction:column;gap:4px;margin:12px 0;padding:12px;' +
      'background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);}' +
      '.orders__quest{font-size:var(--font-size-sm);color:var(--ink-soft);}' +
      '.orders__quest--active{color:var(--accent);font-weight:600;}' +
      '.orders__quest--done{color:var(--ink-soft);text-decoration:line-through;}' +
      '.orders__quest-text{margin:8px 0 0;font-size:var(--font-size-sm);}' +
      '.orders__filter{margin:12px 0;}' +
      '.orders__filter select{padding:6px 10px;background:var(--surface);color:var(--ink);' +
      'border:1px solid var(--line);border-radius:var(--radius);}' +
      '.orders__list{display:flex;flex-direction:column;gap:12px;}' +
      '.orders__item{background:var(--surface);border:1px solid var(--line);' +
      'border-radius:var(--radius);padding:12px 16px;}' +
      '.orders__item--done{opacity:.55;}' +
      '.orders__item--waiting{border-style:dashed;}' +
      '.orders__item-title{margin:0 0 4px;font-size:var(--font-size-sm);}' +
      '.orders__item-phen,.orders__item-reward{margin:0 0 4px;font-size:var(--font-size-sm);color:var(--ink-soft);}' +
      '.orders__item-hint{margin:6px 0 0;font-size:var(--font-size-sm);color:var(--ink-soft);}' +
      '.orders__msg{margin:12px 0 0;font-size:var(--font-size-sm);color:var(--accent);min-height:1.2em;}' +
      '.orders__empty{color:var(--ink-soft);font-size:var(--font-size-sm);}' +
      '</style>' +
      '<section class="screen" aria-labelledby="screen-title">' +
      '<h1 class="screen__title" id="screen-title">Заказы</h1>' +
      questPanelHTML() +
      '<div class="orders__filter"><label for="orders-filter">Фильтр по признакам: </label>' +
      '<select id="orders-filter">' + filterOptionsHTML() + '</select></div>' +
      '<div class="orders__list">' + ordersHTML() + '</div>' +
      '<p class="orders__msg" role="status"></p>' +
      '</section>';

    /* Восстановить состояние select и сообщение после innerHTML. */
    var filter = container.querySelector('#orders-filter');
    if (filterKey) filter.value = filterKey + ':' + filterVal;
    var msgEl = container.querySelector('.orders__msg');
    if (msgEl) msgEl.textContent = message;
    bindOrders(container);
  }

  var screen = {
    name: 'orders',
    render: function (container) {
      currentContainer = container;
      renderScreen(container);
    }
  };

  g.ui.screens.orders = screen;

  if (g.router && typeof g.router.register === 'function') {
    g.router.register('orders', screen.render);
  }

  /* Перерисовка при изменении состояния (переход к другим экранам — нет). */
  if (g.state && g.state.store && typeof g.state.store.subscribe === 'function') {
    g.state.store.subscribe(function () {
      if (currentContainer && document.contains(currentContainer) &&
          (!g.router || g.router.active === 'orders')) {
        renderScreen(currentContainer);
      }
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
