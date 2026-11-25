/* ГеноЛаб — js/core/rng.js — источники случайности (фаза 1).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.core.rng
 * (ESM-экспорты не используются — решение фазы 0, LOG.md).
 *
 * mulberry32 — детерминированный ГСЧ с задаваемым seed
 * (тесты фазы 1 воспроизводимы: одинаковый seed → одинаковая
 * последовательность).
 */
(function (global) {
  'use strict';

  /**
   * mulberry32: быстрый детерминированный ГСЧ.
   * @param {number} seed — целое
   * @returns {() => number} функция, возвращающая число из [0, 1)
   */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Создать генератор случайности.
   * @param {number} [seed] — при заданном seed последовательность
   *   детерминирована; без seed — Math.random.
   * @returns {{next: () => number,
   *            randomInt: (min, max) => number,
   *            pick: (arr) => *,
   *            chance: (p) => boolean}}
   */
  function createRng(seed) {
    var next = (typeof seed === 'undefined') ? Math.random : mulberry32(seed);
    return {
      next: next,
      /** Случайное целое в [min, max] (включительно). */
      randomInt: function (min, max) {
        min = Math.floor(min);
        max = Math.floor(max);
        return min + Math.floor(next() * (max - min + 1));
      },
      /** Случайный элемент массива (равновероятно). */
      pick: function (arr) { return arr[this.randomInt(0, arr.length - 1)]; },
      /** true с вероятностью p (0..1). */
      chance: function (p) { return next() < p; },
    };
  }

  var def = createRng(); // по умолчанию — недетерминированный

  global.GenoLab = global.GenoLab || {};
  global.GenoLab.core = global.GenoLab.core || {};
  global.GenoLab.core.rng = {
    /* ===== Экспорты: window.GenoLab.core.rng ===== */
    mulberry32: mulberry32,
    createRng: createRng,
    /* Совместимость с фазой 0: недетерминированные обёртки. */
    randomInt: def.randomInt,
    pick: def.pick,
    chance: def.chance,
  };
})(typeof window !== 'undefined' ? window : globalThis);
