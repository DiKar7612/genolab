/* ГеноЛаб — js/core/breeder.js — скрещивание (фаза 1).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.core.breeder
 * (ESM-экспорты не используются — решение фазы 0, LOG.md).
 *
 * Математика скрещивания зафиксирована фазой 1 (RULES.md §6):
 * у каждого потомка — по одному аллелю от каждого родителя,
 * выбор равновероятный (честная решётка Пеннета).
 *
 * РАЗМОРОЗКА (фаза 7b, 2026-11-27): в pennettGrid ключ фенотипа клетки
 * считался с хардкодом полного доминирования; теперь — с учётом model
 * признака (incomplete → гетерозига → t.values[dom+rec]). cross() и
 * gametes() не тронуты. Запись в LOG_1.1.md.
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  var core = g.core = g.core || {};
  var genome = core.genome;

  /** Проверить обоих родителей; бросить Error при невалидном геноме. */
  function checkBoth(parentA, parentB) {
    var va = genome.validateGenome(parentA);
    if (!va.ok) throw new Error('breeder: геном родителя A невалиден: ' + va.errors.join('; '));
    var vb = genome.validateGenome(parentB);
    if (!vb.ok) throw new Error('breeder: геном родителя B невалиден: ' + vb.errors.join('; '));
    if (parentA.species !== parentB.species) {
      throw new Error('breeder: родители должны быть одного вида');
    }
  }

  /**
   * Скрестить двух родителей.
   * @param {Object} parentA — геном
   * @param {Object} parentB — геном
   * @param {Object} [rng] — генератор { randomInt, pick, chance }
   *   (по умолчанию — window.GenoLab.core.rng)
   * @returns {Object[]} 1–4 потомка (геномы). Количество — случайно
   *   равновероятно из {1, 2, 3, 4}. У каждого потомка — по одному
   *   равновероятному аллелю от каждого родителя на каждый признак.
   */
  function cross(parentA, parentB, rng) {
    rng = rng || g.core.rng;
    checkBoth(parentA, parentB);
    var sp = genome.getSpecies(parentA.species);
    var n = rng.randomInt(1, 4);
    var out = [];
    for (var k = 0; k < n; k++) {
      var pairs = sp.traits.map(function (t, i) {
        return [rng.pick(parentA.pairs[i]), rng.pick(parentB.pairs[i])];
      });
      out.push(genome.createGenome(parentA.species, pairs));
    }
    return out;
  }

  /**
   * Все гаметы генома по списку индексов признаков
   * (полное перемножение вариантов: 2^n комбинаторикой).
   */
  function gametes(genomeObj, traitIdxs) {
    var combos = [[]];
    traitIdxs.forEach(function (ti) {
      var p = genomeObj.pairs[ti];
      var next = [];
      combos.forEach(function (c) {
        next.push(c.concat([p[0]]));
        next.push(c.concat([p[1]]));
      });
      combos = next;
    });
    return combos;
  }

  /**
   * Чистая функция: решётка Пеннета с долями генотипов и фенотипов
   * (без RNG — детерминирована по входным геномам).
   * @param {Object} parentA — геном
   * @param {Object} parentB — геном
   * @param {string[]} [traitIds] — 1 признак (решётка 2×2) или 2
   *   признака (решётка 4×4); по умолчанию — первый признак вида
   * @returns {{traitIds, rows, cols, cells, byGenotype, byPhenotype}}
   *   cells — клетки {gameteA, gameteB, genotype, phenotype, fraction};
   *   byGenotype / byPhenotype — карты «ключ → доля» (ключ — через "|").
   */
  function pennettGrid(parentA, parentB, traitIds) {
    checkBoth(parentA, parentB);
    var sp = genome.getSpecies(parentA.species);
    var ids = traitIds || [sp.traits[0].id];
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 2) {
      throw new Error('pennettGrid: поддерживается 1 или 2 признака');
    }
    var idxs = ids.map(function (id) {
      var i = -1;
      sp.traits.forEach(function (t, j) { if (t.id === id) i = j; });
      if (i < 0) throw new Error('pennettGrid: неизвестный признак "' + id + '"');
      return i;
    });
    var rows = gametes(parentA, idxs);
    var cols = gametes(parentB, idxs);
    var frac = 1 / (rows.length * cols.length);
    var cells = [];
    var byGenotype = {};
    var byPhenotype = {};
    rows.forEach(function (ra) {
      cols.forEach(function (cb) {
        var genoKeys = [];
        var phenoKeys = [];
        idxs.forEach(function (ti, j) {
          var t = sp.traits[ti];
          var a = ra[j];
          var b = cb[j];
          var sorted = [a, b].sort(function (x, y) {
            return (x === t.dominant ? 0 : 1) - (y === t.dominant ? 0 : 1);
          });
          genoKeys.push(sorted.join(''));
          /* Фаза 7b: incomplete — гетерозига даёт промежуточный
           * фенотип; полное доминирование — как было. */
          phenoKeys.push(
            (t.model === 'incomplete' && a !== b)
              ? t.values[t.dominant + t.recessive]
              : (a === t.dominant || b === t.dominant)
                ? t.values[t.dominant]
                : t.values[t.recessive]);
        });
        var gk = genoKeys.join('|');
        var pk = phenoKeys.join('|');
        byGenotype[gk] = (byGenotype[gk] || 0) + frac;
        byPhenotype[pk] = (byPhenotype[pk] || 0) + frac;
        cells.push({
          gameteA: ra.slice(),
          gameteB: cb.slice(),
          genotype: gk,
          phenotype: pk,
          fraction: frac,
        });
      });
    });
    return {
      traitIds: ids.slice(),
      rows: rows.length,
      cols: cols.length,
      cells: cells,
      byGenotype: byGenotype,
      byPhenotype: byPhenotype,
    };
  }

  core.breeder = {
    /* ===== Экспорты: window.GenoLab.core.breeder ===== */
    cross: cross,
    pennettGrid: pennettGrid,
  };
})(typeof window !== 'undefined' ? window : globalThis);
