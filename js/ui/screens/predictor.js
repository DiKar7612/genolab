/* ГеноЛаб — js/ui/screens/predictor.js — экран «Предсказатель» (фаза 5).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.ui.screens.predictor.
 *
 * TZ §3.4: игрок строит прогноз ДО скрещивания — вероятность
 * целевого фенотипа по известным геномам родителей. Игра сверяет
 * с решёткой Пеннета (чистая функция core.breeder.pennettGrid)
 * и при ошибке показывает разбор: решётка по каждому признаку
 * с выделенными целевыми клетками и формулой произведения.
 * Отдельный счётчик точности (state.store.recordPrediction) —
 * мини-тренажёр для задач ЕГЭ по генетике.
 *
 * Допустимое отклонение прогноза: ±5 процентных пунктов (TZ §3.4
 * точность не конкретизирует — допущение фазы 5, зафиксировано
 * в LOG.md).
 *
 * Разметка — только из внутренних констант и данных вида
 * (SECURITY.md §4); строки состояния — через textContent/esc().
 * Подписка на store: экран перерисовывается при изменении
 * состояния (счётчик точности, изменение вольера).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  g.ui = g.ui || {};
  g.ui.screens = g.ui.screens || {};

  var TOL_PP = 5;  /* допустимое отклонение прогноза, процентных пунктов */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* Доля 0.25 -> "25%", 0.125 -> "12,5%" (2 знака, запятая). */
  function fmtPct(p) {
    var x = Math.round(p * 10000) / 100;
    return String(x).replace('.', ',') + '%';
  }

  function getStore() { return g.state.store; }
  function species() { return g.core.genome.getSpecies('golo'); }

  var currentContainer = null;
  var selA = '';
  var selB = '';
  var target = {};    /* traitId -> фенотиповое значение (строка из t.values) */
  var predText = '';  /* сырой ввод игрока, "%" без знака */
  var result = null;  /* {pred, actualPct, hit, errPP, traits:[...]} */

  /* ===== Разбор по признакам (чистая решётка Пеннета) ===== */

  /**
   * Вероятность целевого фенотипа по одному признаку:
   * решётка 2x2 (каждый родитель отдаёт один аллель пары),
   * доля клеток с целевым фенотипом.
   */
  function traitChance(parentA, parentB, t, label) {
    var grid = g.core.breeder.pennettGrid(parentA, parentB, [t.id]);
    var matches = 0;
    grid.cells.forEach(function (cell) {
      if (cell.phenotype === label) matches += 1;
    });
    return {
      grid: grid,
      matches: matches,
      total: grid.cells.length,
      p: matches / grid.cells.length,
      html: g.render.pennett.renderGrid(parentA, parentB, {
        traitIds: [t.id],
        sizePx: 64
      }).html
    };
  }

  /**
   * Сверить прогноз: вероятность полного целевого фенотипа —
   * произведение вероятностей по признакам (независимые пары).
   * @returns {Object|null} result или null при некорректном вводе
   */
  function checkPrediction() {
    var st = getStore().getState();
    var pa = null, pb = null;
    st.enclosure.forEach(function (c) {
      if (c.id === selA) pa = c;
      if (c.id === selB) pb = c;
    });
    if (!pa || !pb || pa === pb) return null;

    var num = parseFloat(String(predText).replace(',', '.'));
    if (!isFinite(num) || num < 0 || num > 100) return null;

    var sp = species();
    var traits = [];
    var totalP = 1;
    sp.traits.forEach(function (t) {
      var label = target[t.id] || t.values[t.dominant];
      var tc = traitChance(pa, pb, t, label);
      totalP *= tc.p;
      traits.push({
        id: t.id,
        name: t.name,
        label: label,
        matches: tc.matches,
        total: tc.total,
        p: tc.p,
        gridHtml: tc.html
      });
    });

    var actualPct = totalP * 100;
    var pred = num;
    var hit = Math.abs(pred - actualPct) <= TOL_PP + 1e-9;
    getStore().recordPrediction(hit);

    return {
      pred: pred,
      actualPct: actualPct,
      hit: hit,
      errPP: Math.abs(pred - actualPct),
      traits: traits
    };
  }

  /* ===== Разметка ===== */

  function optionsHTML() {
    var st = getStore().getState();
    var sp = species();
    var html = '<option value="">— выберите —</option>';
    st.enclosure.forEach(function (c) {
      var phen = g.core.genome.genomeToPhenotype(c);
      var parts = [];
      sp.traits.forEach(function (t) { parts.push(phen[t.id]); });
      html += '<option value="' + esc(c.id) + '">' + esc(c.id) +
        ' — ' + esc(parts.join(', ')) + '</option>';
    });
    return html;
  }

  function targetSelectsHTML() {
    var sp = species();
    var html = '';
    sp.traits.forEach(function (t) {
      html += '<label class="pred__target-item">' + esc(t.name) + ': ' +
        '<select class="pred__target" data-trait="' + esc(t.id) + '">' +
        '<option value="' + esc(t.values[t.dominant]) + '">' + esc(t.values[t.dominant]) + '</option>' +
        /* Фаза 7b: incomplete — промежуточный фенотип гетерозиготы. */
        (t.model === 'incomplete'
          ? '<option value="' + esc(t.values[t.dominant + t.recessive]) + '">' +
            esc(t.values[t.dominant + t.recessive]) + '</option>'
          : '') +
        '<option value="' + esc(t.values[t.recessive]) + '">' + esc(t.values[t.recessive]) + '</option>' +
        '</select></label>';
    });
    return html;
  }

  function accuracyHTML() {
    var pr = getStore().getState().predictions;
    if (pr.total === 0) return 'Точность прогнозов: пока пусто.';
    var pct = Math.round((pr.hits / pr.total) * 100);
    return 'Точность прогнозов: ' + pr.hits + ' из ' + pr.total + ' (' + pct + '%)';
  }

  function resultHTML(r) {
    if (!r) return '';
    var formula = r.traits.map(function (t) { return fmtPct(t.p); }).join(' \u00D7 ');
    var cls = r.hit ? 'pred__result--ok' : 'pred__result--err';
    var head = r.hit
      ? ('Ваш прогноз: ' + fmtPct(r.pred / 100) + ' \u00B7 факт: ' + fmtPct(r.actualPct / 100) +
         ' \u2014 \u041F\u043E\u041F\u0410\u0414\u0410\u041D\u0418\u0415!')
      : ('Ваш прогноз: ' + fmtPct(r.pred / 100) + ' \u00B7 факт: ' + fmtPct(r.actualPct / 100) +
         ' \u2014 \u043D\u0435 \u043F\u043E\u043F\u0430\u0434\u0430\u043D\u043E (\u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435 ' +
         fmtPct(r.errPP / 100) + ' \u043E\u0442 \u0444\u0430\u043A\u0442\u0430)');
    var note = r.hit
      ? '\u041F\u0440\u043E\u0432\u0435\u0440\u043D\u043E \u043F\u043E \u0440\u0435\u0448\u0451\u0442\u043A\u0435 \u041F\u0435\u043D\u043D\u0435\u0442\u0430: ' + formula + ' = ' +
        fmtPct(r.actualPct / 100) + '.'
      : '\u0412\u044B \u043E\u0448\u0438\u0431\u0430\u0435\u0442\u0435\u0441\u044C \u043D\u0430 ' + fmtPct(r.errPP / 100) +
        ' \u043F\u0440\u043E\u0446\u0435\u043D\u0442\u043D\u044B\u0445 \u043F\u0443\u043D\u043A\u0442\u043E\u0432 \u043E\u0442 \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u0438. ' +
        '\u0421\u043C\u043E\u0442\u0440\u0438\u0442\u0435 \u0440\u0430\u0437\u0431\u043E\u0440: \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u044B\u0435 \u043A\u043B\u0435\u0442\u043A\u0438 \u2014 \u0446\u0435\u043B\u0435\u0432\u043E\u0439 \u0444\u0435\u043D\u043E\u0442\u0438\u043F; ' +
        '\u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044C \u043F\u043E \u043F\u0440\u0438\u0437\u043D\u0430\u043A\u0443 \u2014 \u0434\u043E\u043B\u044F \u0442\u0430\u043A\u0438\u0445 \u043A\u043B\u0435\u0442\u043E\u043A, \u043F\u043E\u043B\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E \u2014 \u0438\u0445 \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0435.';
    return '<div class="pred__result ' + cls + '" role="status">' +
      '<p class="pred__result-head">' + esc(head) + '</p>' +
      '<p class="pred__result-formula">' + esc(formula + ' = ' + fmtPct(r.actualPct / 100)) + '</p>' +
      '<p class="pred__result-note">' + esc(note) + '</p>' +
      '</div>';
  }

  function breakdownHTML(r) {
    if (!r) return '';
    var html = '<div class="pred__breakdown">' +
      '<h2 class="pred__bd-title">\u0420\u0430\u0437\u0431\u043E\u0440: \u0440\u0435\u0448\u0451\u0442\u043A\u0430 \u041F\u0435\u043D\u043D\u0435\u0442\u0430 \u043F\u043E \u043F\u0440\u0438\u0437\u043D\u0430\u043A\u0430\u043C</h2>';
    r.traits.forEach(function (t) {
      html += '<div class="pred__trait" data-pred-trait="' + esc(t.id) + '">' +
        '<h3 class="pred__trait-title">' + esc(t.name) + ': ' + esc(t.label) +
        ' \u2014 ' + t.matches + '/' + t.total + ' = ' + fmtPct(t.p) + '</h3>' +
        t.gridHtml +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  var STYLE_CSS =
    '.pred__accuracy{font-size:var(--font-size-sm);color:var(--ink-soft);' +
    'background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);' +
    'padding:8px 12px;margin:12px 0;}' +
    '.pred__parents{display:flex;gap:16px;flex-wrap:wrap;margin:8px 0;}' +
    '.pred__parent{display:flex;flex-direction:column;gap:4px;font-size:var(--font-size-sm);' +
    'color:var(--ink-soft);min-width:260px;}' +
    '.pred__parent select{padding:8px 10px;background:var(--surface);color:var(--ink);' +
    'border:1px solid var(--line);border-radius:var(--radius);min-height:44px;max-width:100%;}' +
    '.pred__target-row{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0;}' +
    '.pred__target-item{display:flex;align-items:center;gap:6px;font-size:var(--font-size-sm);' +
    'color:var(--ink-soft);background:var(--surface);border:1px solid var(--line);' +
    'border-radius:var(--radius);padding:4px 10px;}' +
    '.pred__target-item select{padding:6px 8px;min-height:44px;background:var(--surface-warm);' +
    'color:var(--ink);border:1px solid var(--line);border-radius:var(--radius);font-size:var(--font-size-sm);max-width:100%;}' +
    '.pred__check{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0;}' +
    '.pred__pred-input{width:120px;padding:8px 10px;background:var(--surface);color:var(--ink);' +
    'border:1px solid var(--line);border-radius:var(--radius);min-height:44px;font:inherit;}' +
    '.pred__result{border-radius:var(--radius);padding:12px 16px;margin:12px 0;' +
    'border:1px solid var(--line);}' +
    '.pred__result--ok{background:rgba(74,124,89,.12);border-color:var(--ok);}' +
    '.pred__result--err{background:rgba(178,68,68,.08);border-color:var(--danger);}' +
    '.pred__result-head{margin:0 0 4px;font-weight:600;}' +
    '.pred__result-formula{margin:0 0 4px;font-size:var(--font-size-sm);color:var(--accent);}' +
    '.pred__result-note{margin:0;font-size:var(--font-size-sm);color:var(--ink-soft);}' +
    '.pred__breakdown{margin:16px 0;}' +
    '.pred__bd-title{font-size:var(--font-size-base);margin:0 0 8px;}' +
    '.pred__trait{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);' +
    'padding:12px;margin:0 0 12px;}' +
    '.pred__trait-title{font-size:var(--font-size-sm);margin:0 0 8px;color:var(--ink);}' +
    '.pennett__cell.is-target{border-color:var(--ok);background:rgba(74,124,89,.14);}'
  ;

  function canCheck() {
    var st = getStore().getState();
    if (st.enclosure.length < 2 || !selA || !selB || selA === selB) return false;
    var num = parseFloat(String(predText).replace(',', '.'));
    return isFinite(num) && num >= 0 && num <= 100;
  }

  function renderScreen(container) {
    currentContainer = container;
    var st = getStore().getState();

    if (Object.keys(target).length === 0) {
      var sp0 = species();
      sp0.traits.forEach(function (t) { target[t.id] = t.values[t.dominant]; });
    }

    var html =
      '<style>' + STYLE_CSS + '</style>' +
      '<section class="screen" aria-labelledby="screen-title">' +
      '<h1 class="screen__title" id="screen-title">\u041F\u0440\u0435\u0434\u0441\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C</h1>' +
      '<p class="screen__hint">Спрогнозируйте вероятность целевого фенотипа потомка ' +
      '\u2014 игра сверит с решёткой Пеннета. Допустимое отклонение: \u00B1' + TOL_PP +
      ' процентных пунктов. Мини-тренажёр для задач ЕГЭ по генетике.</p>' +
      '<div class="pred__accuracy" role="status">' + esc(accuracyHTML()) + '</div>' +
      '<div class="pred__parents">' +
      '<div class="pred__parent"><span>\u0420\u043E\u0434\u0438\u0442\u0435\u043B\u044C A</span>' +
      '<select class="pred__sel" data-who="a" aria-label="\u0420\u043E\u0434\u0438\u0442\u0435\u043B\u044C A">' +
      optionsHTML() + '</select></div>' +
      '<div class="pred__parent"><span>\u0420\u043E\u0434\u0438\u0442\u0435\u043B\u044C B</span>' +
      '<select class="pred__sel" data-who="b" aria-label="\u0420\u043E\u0434\u0438\u0442\u0435\u043B\u044C B">' +
      optionsHTML() + '</select></div>' +
      '</div>' +
      '<p class="screen__hint">\u0426\u0435\u043B\u0435\u0432\u043E\u0439 \u0444\u0435\u043D\u043E\u0442\u0438\u043F:</p>' +
      '<div class="pred__target-row">' + targetSelectsHTML() + '</div>' +
      '<div class="pred__check">' +
      '<label for="pred-input">\u0412\u0430\u0448 \u043F\u0440\u043E\u0433\u043D\u043E\u0437, %:</label>' +
      '<input class="pred__pred-input" id="pred-input" type="number" inputmode="decimal" ' +
      'min="0" max="100" step="0.5" value="' + esc(predText) + '" ' +
      'aria-label="\u0412\u0430\u0448 \u043F\u0440\u043E\u0433\u043D\u043E\u0437 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u0438, \u043F\u0440\u043E\u0446\u0435\u043D\u0442\u044B">' +
      '<button class="btn btn--primary pred__check-btn" type="button"' +
      (canCheck() ? '' : ' disabled') + '>\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C</button>' +
      '</div>' +
      resultHTML(result) +
      breakdownHTML(result) +
      '</section>';

    container.innerHTML = html;

    var selAEl = container.querySelector('.pred__sel[data-who="a"]');
    var selBEl = container.querySelector('.pred__sel[data-who="b"]');
    selAEl.value = selA;
    selBEl.value = selB;
    selAEl.addEventListener('change', function () { selA = selAEl.value; result = null; renderScreen(container); });
    selBEl.addEventListener('change', function () { selB = selBEl.value; result = null; renderScreen(container); });

    container.querySelectorAll('.pred__target').forEach(function (sel) {
      sel.value = target[sel.dataset.trait] || sel.options[0].value;
      sel.addEventListener('change', function () {
        target[sel.dataset.trait] = sel.value;
        result = null;
        renderScreen(container);
      });
    });

    var input = container.querySelector('#pred-input');
    input.addEventListener('input', function () {
      predText = input.value;
      var btn = container.querySelector('.pred__check-btn');
      if (btn) btn.disabled = !canCheck();
    });

    var btn = container.querySelector('.pred__check-btn');
    btn.addEventListener('click', function () {
      predText = input.value;
      result = checkPrediction();
      renderScreen(container);
    });

    /* Подсветка целевых клеток в решётках разбора. */
    if (result) {
      result.traits.forEach(function (t) {
        var wrap = container.querySelector('[data-pred-trait="' + t.id + '"]');
        if (!wrap) return;
        wrap.querySelectorAll('.pennett__cell').forEach(function (cellEl) {
          if (cellEl.getAttribute('data-pheno') === t.label) {
            cellEl.classList.add('is-target');
          }
        });
      });
    }
  }

  var screen = {
    name: 'predictor',
    render: renderScreen
  };

  g.ui.screens.predictor = screen;

  if (g.router && typeof g.router.register === 'function') {
    g.router.register('predictor', screen.render);
  }

  if (g.state && g.state.store && typeof g.state.store.subscribe === 'function') {
    g.state.store.subscribe(function () {
      if (currentContainer && global.document.contains(currentContainer) &&
          (!g.router || g.router.active === 'predictor')) {
        renderScreen(currentContainer);
      }
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
