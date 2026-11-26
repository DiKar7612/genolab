/* ГеноЛаб — js/render/pennett.js — интерактивная решётка Пеннета (фаза 2).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.render.pennett.
 * Считает доли через чистую функцию breeder.pennettGrid (фаза 1, не
 * меняется). Каждая ячейка — доля генотипа + мини-рендер существа
 * (render.creature). Подсветка случайно выпавшей клетки + клик по
 * ячейке переносит подсветку.
 *
 * Мини-рендер в ячейке: признаки решётки — по генотипу ячейки,
 * остальные признаки — по родителю A (решётка демонстрирует только
 * выбранные признаки, остальные в мини-рендере постоянны).
 * Разметка — только из внутренних констант (SECURITY.md §4).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  var render = g.render = g.render || {};

  /** Долю 0.0625 → «6,25%» (до 2 знаков, лишние нули не пишем). */
  function fracLabel(frac) {
    var pct = Math.round(frac * 10000) / 100;
    return String(pct).replace('.', ',') + '%';
  }

  /** Ключ фенотипа «коричневый|полосатый» → «коричневый, полосатый». */
  function phenotypeText(key) {
    return key.split('|').join(', ');
  }

  /** Полный фенотип для мини-рендера ячейки (см. заголовок файла). */
  function cellPhenotype(parentA, parentB, traitIds, cell) {
    var core = g.core;
    var sp = core.genome.getSpecies(parentA.species);
    var genoParts = cell.genotype.split('|');
    var pairs = sp.traits.map(function (t, i) {
      var k = traitIds.indexOf(t.id);
      if (k >= 0) {
        return [genoParts[k].charAt(0), genoParts[k].charAt(1)];
      }
      return parentA.pairs[i].slice();
    });
    var genomeObj = core.genome.createGenome(parentA.species, pairs);
    return core.genome.genomeToPhenotype(genomeObj);
  }

  /**
   * Разметка решётки Пеннета 2×2 (1 признак) или 4×4 (2 признака).
   * @param {Object} parentA — геном
   * @param {Object} parentB — геном
   * @param {Object} [opts]
   * @param {string[]} [opts.traitIds] — 1 или 2 признака (по умолчанию — первый)
   * @param {number} [opts.sizePx] — сторона мини-рендера, px (64..320)
   * @param {number} [opts.pickedIndex] — индекс случайно выпавшей клетки
   * @returns {{html: string, bind: function(container)}}
   *   bind(container) — подвязывает клик по ячейкам (подсветка).
   */
  function renderGrid(parentA, parentB, opts) {
    var core = g.core;
    var creature = render.creature;
    var sp = core.genome.getSpecies(parentA.species);
    opts = opts || {};
    var grid = core.breeder.pennettGrid(parentA, parentB, opts.traitIds);
    var traitIds = grid.traitIds;
    var traitNames = traitIds.map(function (id) {
      var t = null;
      sp.traits.forEach(function (x) { if (x.id === id) t = x; });
      return t ? t.name : id;
    }).join(' × ');
    var n = grid.rows;
    var sizePx = (typeof opts.sizePx === 'number') ? opts.sizePx : (n > 2 ? 72 : 96);
    var picked = (typeof opts.pickedIndex === 'number') ? opts.pickedIndex : -1;

    function gameteLabel(gamete) { return gamete.join(''); }

    var html =
      '<div class="pennett" data-pennett data-n="' + n + '">' +
      '<div class="pennett__title">Решётка Пеннета: ' + traitNames +
      ' — ' + n + '×' + n + ' (каждая клетка — ' + fracLabel(grid.cells[0].fraction) + ')</div>';

    html += '<div class="pennett__grid" style="grid-template-columns:max-content repeat(' + n + ', minmax(0, 1fr));">';
    html += '<div class="pennett__corner" title="строки — гаметы родителя A, столбцы — гаметы родителя B">A ↓ / B →</div>';
    /* Клетки идут по строкам (внутренний цикл — гаметы B): шапка — из первых n. */
    var cols = grid.cells.slice(0, n);
    cols.forEach(function (cell) {
      html += '<div class="pennett__head">' + gameteLabel(cell.gameteB) + '</div>';
    });

    for (var r = 0; r < n; r++) {
      html += '<div class="pennett__rowhead">' + gameteLabel(grid.cells[r * n].gameteA) + '</div>';
      for (var c = 0; c < n; c++) {
        var i = r * n + c;
        var cell = grid.cells[i];
        var ph = cellPhenotype(parentA, parentB, traitIds, cell);
        var cls = 'pennett__cell' + (i === picked ? ' is-picked' : '');
        html +=
          '<div class="' + cls + '" data-cell="' + i + '" data-geno="' + cell.genotype +
          '" data-pheno="' + phenotypeText(cell.phenotype) + '" title="' +
          gameteLabel(cell.gameteA) + ' × ' + gameteLabel(cell.gameteB) + ' = ' + cell.genotype + '">' +
          '<div class="pennett__cell-sprite">' + creature.renderCreature(ph, sizePx) + '</div>' +
          '<div class="pennett__cell-geno">' + cell.genotype + '</div>' +
          '<div class="pennett__cell-frac">' + fracLabel(cell.fraction) + '</div>' +
          '</div>';
      }
    }
    html += '</div>';

    /* Подпись к выпавшей/выбранной клетке. */
    if (picked >= 0 && picked < grid.cells.length) {
      var pc = grid.cells[picked];
      html += '<div class="pennett__info" data-pennett-info>Выпавшая клетка: ' +
        pc.genotype + ' — ' + phenotypeText(pc.phenotype) + ' (' + fracLabel(pc.fraction) + ')</div>';
    } else {
      html += '<div class="pennett__info" data-pennett-info>Кликните по клетке, чтобы подсветить её.</div>';
    }

    /* Легенда: доли по фенотипам. */
    html += '<div class="pennett__legend" aria-label="Доли фенотипов">';
    Object.keys(grid.byPhenotype).forEach(function (key) {
      html += '<span class="pennett__legend-item">' + phenotypeText(key) + ' — ' +
        fracLabel(grid.byPhenotype[key]) + '</span>';
    });
    html += '</div></div>';

    function bind(container) {
      function pick(target) {
        var cellEl = container.querySelector('.pennett__cell[data-cell="' + target + '"]');
        if (!cellEl) return;
        container.querySelectorAll('.pennett__cell.is-picked').forEach(function (el) {
          el.classList.remove('is-picked');
        });
        cellEl.classList.add('is-picked');
        var info = container.querySelector('[data-pennett-info]');
        if (info) {
          info.textContent = 'Клетка: ' + cellEl.dataset.geno + ' — ' +
            cellEl.dataset.pheno + ' (' + fracLabel(grid.cells[Number(target)].fraction) + ')';
        }
      }
      container.addEventListener('click', function (e) {
        var el = (e.target && e.target.closest) ? e.target.closest('.pennett__cell[data-cell]') : null;
        if (el) { pick(el.dataset.cell); }
      });
    }

    return { html: html, bind: bind };
  }

  render.pennett = {
    /* ===== Экспорты: window.GenoLab.render.pennett ===== */
    renderGrid: renderGrid
  };
})(typeof window !== 'undefined' ? window : globalThis);
