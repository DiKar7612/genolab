/* ГеноЛаб — js/ui/screens/codex.js — экран «Кодекс» (фаза 7c, ТЗ §9 7c).
 *
 * Справочник по видам (признаки, аллели, модель доминирования, все
 * достижимые фенотипы с мини-рендером), формулы наследования (3:1,
 * 1:1, 1:2:1, 9:3:3:1 — генерируются решёткой Пеннета), история
 * мутаций (store.mutations.total) и коллекция встреченных фенотипов
 * (store.codexSeen, запись — в store.addCreature).
 *
 * Данные — ТОЛЬКО генерация из конфига вида (core.genome.getSpeciesConfig,
 * вшитая копия species.json; по http:// — та же копия, fetch не нужен).
 * «Обучающие» подписи — UI-обвязка или генерация из аллелей/значений
 * признаков (без вшитых копий данных).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.ui.screens.codex.
 * Разметка — только из внутренних констант (SECURITY.md §4);
 * строковые данные — через esc().
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

  /* UI-обвязка: подписи моделей доминирования (ключи — из species.json). */
  var MODEL_LABELS = {
    'complete-dominance': 'полное доминирование',
    'incomplete': 'неполное доминирование'
  };

  function getStore() { return g.state.store; }
  function genomeApi() { return g.core.genome; }
  function breederApi() { return g.core.breeder; }

  /** Ключ фенотипа (совпадает со store.seenKey / phenotype решётки). */
  function phenKey(sp, ph) {
    return sp.id + '|' + sp.traits.map(function (t) { return ph[t.id]; }).join('|');
  }

  /**
   * Все достижимые фенотипы вида: декартов продукт генотипов
   * DD/Dd/dd по всем признакам → genomeToPhenotype → дедупликация.
   * @returns {Array<{key: string, phen: Object}>}
   */
  function allPhenotypes(sp) {
    var genoSets = sp.traits.map(function (t) {
      return [
        [t.dominant, t.dominant],
        [t.dominant, t.recessive],
        [t.recessive, t.recessive]
      ];
    });
    var combos = [[]];
    genoSets.forEach(function (set) {
      var next = [];
      combos.forEach(function (c) {
        set.forEach(function (pair) { next.push(c.concat([pair])); });
      });
      combos = next;
    });
    var seen = {};
    var list = [];
    combos.forEach(function (pairs) {
      var synth = { species: sp.id, pairs: pairs };
      var ph;
      try { ph = genomeApi().genomeToPhenotype(synth); } catch (e) { return; }
      var k = phenKey(sp, ph);
      if (!seen[k]) {
        seen[k] = true;
        list.push({ key: k, phen: ph });
      }
    });
    return list;
  }

  /* ===== Таблица признаков вида ===== */

  function traitRow(t) {
    var dd = t.dominant + t.dominant;
    var hd = t.dominant + t.recessive;
    var rr = t.recessive + t.recessive;
    var pheno;
    if (t.model === 'incomplete') {
      pheno = esc(t.values[t.dominant] + ' (' + dd + ')') + ' · ' +
        esc(t.values[hd] + ' (' + hd + ')') + ' · ' +
        esc(t.values[t.recessive] + ' (' + rr + ')');
    } else {
      pheno = esc(t.values[t.dominant] + ' (' + dd + '/' + hd + ')') + ' · ' +
        esc(t.values[t.recessive] + ' (' + rr + ')');
    }
    return '<tr>' +
      '<td>' + esc(t.name) + '</td>' +
      '<td>' + esc(t.dominant + ' (дом.) / ' + t.recessive + ' (рец.)') + '</td>' +
      '<td>' + esc(MODEL_LABELS[t.model] || t.model) + '</td>' +
      '<td>' + pheno + '</td>' +
      '</tr>';
  }

  /* ===== Карточки фенотипов с мини-рендером ===== */

  function phenotypeCards(sp, phenos, codexSeen) {
    var html = '';
    phenos.forEach(function (p) {
      var seen = !!codexSeen[p.key];
      var label = sp.traits.map(function (t) { return p.phen[t.id]; }).join(', ');
      var svg = '';
      try {
        svg = g.render.creature.renderCreature(p.phen, 64, 'adult', sp.id);
      } catch (e) { svg = ''; }
      html += '<div class="codex__pheno' + (seen ? ' codex__pheno--seen' : '') + '">' +
        svg +
        '<p class="codex__pheno-label">' + esc(label) + '</p>' +
        '<p class="codex__pheno-mark">' + (seen ? '✓ встречен' : 'ещё не встречен') + '</p>' +
        '</div>';
    });
    return html;
  }

  /* ===== Формулы наследования (генерация через pennettGrid) ===== */

  function gcd(a, b) { return b ? gcd(b, a % b) : (a || 1); }

  /** Пара для нужного признака, остальные — рецессивные (не влияют). */
  function pairsFor(spId, overrides) {
    var sp = genomeApi().getSpecies(spId);
    return sp.traits.map(function (t) {
      return (overrides && overrides[t.id]) || [t.recessive, t.recessive];
    });
  }

  /** Расщепление: целые доли + строка «9:3:3:1».
   * Порядок ключей — порядок появления в решётке (классический:
   * 3:1, 1:1, 1:2:1, 9:3:3:1 — доминантный первым, рецессивный последним). */
  function splitInfo(byPhenotype, denom) {
    var keys = Object.keys(byPhenotype);
    var ints = keys.map(function (k) { return Math.round(byPhenotype[k] * denom); });
    var g = ints.reduce(function (a, b) { return b ? gcd(a, b) : a; }, 0) || 1;
    var parts = ints.map(function (x) { return x / g; });
    return { keys: keys, parts: parts, str: parts.join(':') };
  }

  /** Мини-решётка: строки/колонки — гаметы, клетки — фенотипы.
   * pennettGrid: rows/cols — числа; гаметы — в cells (gameteA/gameteB). */
  function gridTable(grid) {
    var n = grid.cols;
    var html = '<table class="codex-table codex-grid">';
    html += '<tr><th></th>';
    for (var c = 0; c < n; c++) {
      html += '<th>' + esc(grid.cells[c].gameteB.join('')) + '</th>';
    }
    html += '</tr>';
    for (var r = 0; r < grid.rows; r++) {
      html += '<tr><th>' + esc(grid.cells[r * n].gameteA.join('')) + '</th>';
      for (var i = r * n; i < (r + 1) * n; i++) {
        html += '<td>' + esc(grid.cells[i].phenotype.replace(/\|/g, ', ')) + '</td>';
      }
      html += '</tr>';
    }
    html += '</table>';
    /* Фаза 7e: на узких экранах (360px) 8+ колонок не влезают —
     * таблица скроллится внутри контейнера, документ не расширяется. */
    return '<div class="codex-scroll">' + html + '</div>';
  }

  /**
   * Блок одной формулы: заголовок (аллели — из конфига), скрещивание,
   * решётка, расщепление по фенотипу (числа — из byPhenotype).
   */
  function formulaBlock(def) {
    var sp = genomeApi().getSpecies(def.spId);
    var traits = def.traitIds.map(function (id) {
      var i = -1;
      sp.traits.forEach(function (t, j) { if (t.id === id) i = j; });
      return sp.traits[i];
    });
    var parentA = { species: def.spId, pairs: pairsFor(def.spId, def.a) };
    var parentB = { species: def.spId, pairs: pairsFor(def.spId, def.b) };
    var grid = breederApi().pennettGrid(parentA, parentB, def.traitIds);
    var denom = grid.rows * grid.cols;
    var split = splitInfo(grid.byPhenotype, denom);

    var crossLabel = def.kind === 'dihybrid'
      ? traits.map(function (t) {
          return t.dominant + t.recessive;
        }).join('') + ' × ' + traits.map(function (t) { return t.dominant + t.recessive; }).join('')
      : def.kind === 'testcross'
        ? traits[0].dominant + traits[0].recessive + ' × ' + traits[0].recessive + traits[0].recessive
        : traits[0].dominant + traits[0].recessive + ' × ' + traits[0].dominant + traits[0].recessive;

    var titles = {
      mono: 'Моногибридное скрещивание гетерозигот',
      testcross: 'Анализующее (тест-кросс) скрещивание',
      incomplete: 'Неполное доминирование, гетерозиготы',
      dihybrid: 'Дигибридное скрещивание'
    };

    var partsText = split.keys.map(function (k, i) {
      return esc(k.replace(/\|/g, ', ')) + ' — ' + Math.round(split.parts[i] / split.parts.reduce(function (s, x) { return s + x; }, 0) * 100) + '%';
    }).join(' · ');

    return '<div class="codex__formula">' +
      '<h3>' + esc(titles[def.kind] || 'Формула') + ' — ' + esc(crossLabel) + '</h3>' +
      '<p class="codex__formula-cross">' +
        esc(traits.map(function (t) { return t.name; }).join(' + ')) +
        ' (вид ' + esc(sp.name) + '): родители ' + esc(crossLabel) +
      '</p>' +
      gridTable(grid) +
      '<p class="codex__progress">Расщепление по фенотипу ' + esc(split.str) + ': ' + partsText + '</p>' +
      '</div>';
  }

  /* Примеры формул — только ссылки на признаки вида; все цифры и
   * расщепления считаются решёткой Пеннета на лету. */
  var FORMULA_DEFS = [
    { kind: 'mono', spId: 'golo', traitIds: ['pattern'],
      a: { pattern: ['B', 'b'] }, b: { pattern: ['B', 'b'] } },
    { kind: 'testcross', spId: 'golo', traitIds: ['pattern'],
      a: { pattern: ['B', 'b'] }, b: { pattern: ['b', 'b'] } },
    { kind: 'incomplete', spId: 'golo', traitIds: ['color'],
      a: { color: ['A', 'a'] }, b: { color: ['A', 'a'] } },
    { kind: 'dihybrid', spId: 'golo', traitIds: ['pattern', 'size'],
      a: { pattern: ['B', 'b'], size: ['C', 'c'] },
      b: { pattern: ['B', 'b'], size: ['C', 'c'] } }
  ];

  /* ===== Сборка экрана ===== */

  function render(container) {
    var st = getStore().getState();
    var speciesList = genomeApi().getSpeciesConfig().species;
    var codexSeen = st.codexSeen || {};

    var html = '<section class="screen" aria-labelledby="screen-title">';
    html += '<h1 class="screen__title" id="screen-title">Кодекс</h1>';

    /* Раздел по каждому виду: признаки + фенотипы + коллекция. */
    var totalAll = 0;
    var totalSeen = 0;
    speciesList.forEach(function (sp) {
      var phenos = allPhenotypes(sp);
      var seenCount = phenos.filter(function (p) { return !!codexSeen[p.key]; }).length;
      totalAll += phenos.length;
      totalSeen += seenCount;

      html += '<section class="codex__species" aria-label="' + esc(sp.name) + '">';
      html += '<h2>' + esc(sp.name) + '</h2>';
      html += '<h3>Признаки</h3>';
      html += '<table class="codex-table"><thead><tr>' +
        '<th>Признак</th><th>Аллели</th><th>Модель</th><th>Фенотипы</th>' +
        '</tr></thead><tbody>';
      sp.traits.forEach(function (t) { html += traitRow(t); });
      html += '</tbody></table>';

      html += '<h3>Достижимые фенотипы</h3>';
      html += '<div class="codex__pheno-grid">' + phenotypeCards(sp, phenos, codexSeen) + '</div>';
      html += '<p class="codex__progress">Коллекция: ' + seenCount + ' из ' + phenos.length +
        ' фенотипов встречено</p>';
      html += '</section>';
    });

    /* Формулы наследования. */
    html += '<section class="codex__formulas" aria-label="Формулы наследования">';
    html += '<h2>Формулы наследования</h2>';
    FORMULA_DEFS.forEach(function (def) { html += formulaBlock(def); });
    html += '</section>';

    /* История мутаций. */
    html += '<section class="codex__mutations" aria-label="История мутаций">';
    html += '<h2>История мутаций</h2>';
    html += '<p class="codex__progress">Всего мутировавших потомков: ' +
      esc(st.mutations && st.mutations.total || 0) + '</p>';
    html += '<p class="screen__hint">Мутации появляются при скрещивании ' +
      '(вероятность — config.json); здесь накоплен всего за сейв.</p>';
    html += '</section>';

    /* Сводка коллекции. */
    html += '<p class="codex__progress codex__total">Общая коллекция: ' +
      totalSeen + ' из ' + totalAll + ' фенотипов всех видов</p>';

    html += '</section>';
    container.innerHTML = html;
  }

  var screen = {
    name: 'codex',
    render: render
  };

  g.ui.screens.codex = screen;

  /* Экран сам регистрируется в роутере (роутер грузится раньше). */
  if (g.router && typeof g.router.register === 'function') {
    g.router.register('codex', render);
  }
})(typeof window !== 'undefined' ? window : globalThis);
