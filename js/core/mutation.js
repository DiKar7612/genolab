/* ГеноЛаб — js/core/mutation.js — мутации (фаза 7a).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.core.mutation
 * (ESM-экспорты не используются — решение фазы 0, LOG.md).
 *
 * Мутация — ВНЕ cross(): js/core/breeder.js и js/core/genome.js не
 * меняются (cross остаётся чистым менделизмом, ТЗ §9 7a). flipGenome
 * получает готовый геном потомка и независимо переворачивает каждый
 * аллель (A↔a, B↔b, C↔c, D↔d) с вероятностью chance, используя ТОЛЬКО
 * переданный ГСЧ (js/core/rng.js) — для детерминированной проверки
 * в тестах. Вход не мутируется: всегда возвращается новый геном.
 *
 * Параметры — js/core/economy.js → getMutation() (источник правил:
 * js/data/config.json + вшитая CONFIG; рассинхрон ловит T1
 * tests/config_test.html).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  var core = g.core = g.core || {};

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  function alleleError(msg) {
    throw new Error('mutation: ' + msg);
  }

  /* Переворот одного аллеля вида golo: доминантный/рецессивный —
   * большой/малый регистр буквы (A↔a и т.д.). */
  function flipAllele(a) {
    if (typeof a !== 'string' || a.length !== 1) {
      alleleError('аллель — не строка из одного символа: ' + JSON.stringify(a));
    }
    if (a.toUpperCase() === a.toLowerCase()) {
      alleleError('аллель "' + a + '" не имеет пары');
    }
    return a === a.toUpperCase() ? a.toLowerCase() : a.toUpperCase();
  }

  /**
   * Применить мутации к геному: каждый аллель (8 штук у golo)
   * независимо переворачивается с вероятностью options.chance.
   * @param {Object} genome — геном {id, species, pairs} (вход НЕ мутируется)
   * @param {Object} rng — генератор {next(): number [0,1)} из js/core/rng.js
   * @param {Object} [options] — {enabled: boolean, chance: number 0..1}
   * @returns {{genome: Object, flipped: number}} — новый геном (id
   *   сохранён, species не меняется) и число перевернутых аллелей
   */
  function flipGenome(genome, rng, options) {
    if (!genome || typeof genome !== 'object' || Array.isArray(genome)) {
      alleleError('genome: ожидается объект генома');
    }
    if (!Array.isArray(genome.pairs)) {
      alleleError('genome.pairs: ожидается массив пар аллелей');
    }
    if (!rng || typeof rng.next !== 'function') {
      alleleError('rng: нужен генератор с next() из js/core/rng.js');
    }
    var enabled = !!(options && options.enabled);
    var chance = (options && typeof options.chance === 'number') ? options.chance : 0;
    if (!isFinite(chance) || chance < 0 || chance > 1) {
      alleleError('chance: ожидается число 0..1, получено ' + chance);
    }

    var out = deepCopy(genome);
    var flipped = 0;
    if (enabled && chance > 0) {
      for (var t = 0; t < out.pairs.length; t++) {
        var pair = out.pairs[t];
        if (!Array.isArray(pair) || pair.length !== 2) {
          alleleError('пары аллелей: ожидается массив из 2 аллелей');
        }
        for (var i = 0; i < 2; i++) {
          if (rng.next() < chance) {
            out.pairs[t][i] = flipAllele(pair[i]);
            flipped += 1;
          }
        }
      }
    }
    return { genome: out, flipped: flipped };
  }

  core.mutation = {
    /* ===== Экспорты: window.GenoLab.core.mutation ===== */
    flipGenome: flipGenome,
  };
})(typeof window !== 'undefined' ? window : globalThis);
