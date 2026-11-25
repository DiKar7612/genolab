/* ГеноЛаб — js/core/genome.js — модель генома (фаза 1).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.core.genome
 * (ESM-экспорты не используются — решение фазы 0, LOG.md).
 *
 * Конфиг вида: источник — js/data/species.json (один вид, 4 признака,
 * полное доминирование). По file:// браузер не читает локальный JSON
 * без сервера (CORS), поэтому в этом файле есть вшитая точная копия
 * SPECIES — она используется по умолчанию. loadSpecies(url) (по
 * http://) подменяет вшитый конфиг файлом после валидации формы.
 * Совпадение двух копий проверяет tests/genome.test.html.
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  var core = g.core = g.core || {};

  /* Точная копия js/data/species.json. */
  var SPECIES = {
    version: 1,
    species: [
      {
        id: 'golo',
        name: 'Голо',
        traits: [
          { id: 'color',   name: 'Окрас',       model: 'complete-dominance',
            dominant: 'A', recessive: 'a', values: { A: 'коричневый', a: 'белый' } },
          { id: 'pattern', name: 'Узор',        model: 'complete-dominance',
            dominant: 'B', recessive: 'b', values: { B: 'полосатый', b: 'однотонный' } },
          { id: 'size',    name: 'Размер',      model: 'complete-dominance',
            dominant: 'C', recessive: 'c', values: { C: 'крупный', c: 'мелкий' } },
          { id: 'ears',    name: 'Форма ушей',  model: 'complete-dominance',
            dominant: 'D', recessive: 'd', values: { D: 'острые', d: 'круглые' } }
        ]
      }
    ]
  };

  /* Актуальный конфиг (loadSpecies может заменить его файлом). */
  var config = SPECIES;

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  /* Проверка формы конфига вида (безопасность: файл не исполняется,
   * только валидируется и копируется). */
  function isSpeciesConfig(v) {
    if (!v || typeof v !== 'object' || !Array.isArray(v.species) || v.species.length === 0) return false;
    return v.species.every(function (s) {
      if (!s || typeof s.id !== 'string' || !Array.isArray(s.traits) || s.traits.length === 0) return false;
      return s.traits.every(function (t) {
        return t && typeof t.id === 'string' &&
          t.model === 'complete-dominance' &&
          typeof t.dominant === 'string' && t.dominant.length === 1 &&
          typeof t.recessive === 'string' && t.recessive.length === 1 &&
          t.values && typeof t.values[t.dominant] === 'string' &&
          typeof t.values[t.recessive] === 'string';
      });
    });
  }

  /**
   * Загрузить конфиг вида из JSON-файла (работает по http://;
   * по file:// fetch блокируется CORS — Promise с ok:false,
   * остаётся вшитый конфиг). Форму файла обязательно валидируем.
   * @param {string} url — путь к species.json
   * @returns {Promise<{ok: boolean, reason?: string, speciesCount?: number}>}
   */
  function loadSpecies(url) {
    return new Promise(function (resolve) {
      if (typeof fetch !== 'function') {
        resolve({ ok: false, reason: 'fetch недоступен' });
        return;
      }
      fetch(url).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (data) {
        if (!isSpeciesConfig(data)) {
          throw new Error('species.json: форма конфигураций невалидна');
        }
        config = data;
        resolve({ ok: true, speciesCount: data.species.length });
      }).catch(function (err) {
        resolve({ ok: false, reason: String((err && err.message) || err) });
      });
    });
  }

  /** Найти вид по id в актуальном конфиге (или null). */
  function getSpecies(speciesId) {
    for (var i = 0; i < config.species.length; i++) {
      if (config.species[i].id === speciesId) return config.species[i];
    }
    return null;
  }

  /** Глубокая копия актуального конфига видов (для тестов и инспекции). */
  function getSpeciesConfig() { return deepCopy(config); }

  /**
   * Создать геном: пары аллелей в порядке признаков вида.
   * @param {string} speciesId
   * @param {Array<Array<string>>} pairs — пары ['A','a'] по числу признаков
   * @returns объект генома { id, species, pairs }
   * @throws Error при неверном виде, числе пар или аллелях
   */
  function createGenome(speciesId, pairs) {
    var sp = getSpecies(speciesId);
    if (!sp) throw new Error('genome: неизвестный вид "' + String(speciesId) + '"');
    if (!Array.isArray(pairs) || pairs.length !== sp.traits.length) {
      throw new Error('genome: пар аллелей ' + (Array.isArray(pairs) ? pairs.length : 0) +
        ', а признаков у вида ' + sp.traits.length);
    }
    pairs.forEach(function (p, i) {
      var t = sp.traits[i];
      if (!Array.isArray(p) || p.length !== 2 ||
          (p[0] !== t.dominant && p[0] !== t.recessive) ||
          (p[1] !== t.dominant && p[1] !== t.recessive)) {
        throw new Error('genome: неверная пара для признака "' + t.id + '"');
      }
    });
    return {
      id: 'c' + (g._idSeq = (g._idSeq || 0) + 1),
      species: speciesId,
      pairs: deepCopy(pairs)
    };
  }

  /**
   * Валидация генома.
   * @returns {{ok: boolean, errors: string[]}}
   */
  function validateGenome(genome) {
    if (!genome || typeof genome !== 'object') {
      return { ok: false, errors: ['геном не является объектом'] };
    }
    var sp = getSpecies(genome.species);
    if (!sp) {
      return { ok: false, errors: ['неизвестный вид "' + String(genome.species) + '"'] };
    }
    if (!Array.isArray(genome.pairs)) {
      return { ok: false, errors: ['pairs отсутствует или не массив'] };
    }
    var errors = [];
    if (genome.pairs.length !== sp.traits.length) {
      errors.push('пар аллелей ' + genome.pairs.length + ', а у вида ' + sp.traits.length);
    }
    genome.pairs.forEach(function (p, i) {
      var t = sp.traits[i];
      if (!t) return;
      if (!Array.isArray(p) || p.length !== 2) {
        errors.push('признак "' + t.id + '": пара не массив из 2 аллелей');
        return;
      }
      if (p[0] !== t.dominant && p[0] !== t.recessive) {
        errors.push('признак "' + t.id + '": неизвестный аллель "' + String(p[0]) + '"');
      }
      if (p[1] !== t.dominant && p[1] !== t.recessive) {
        errors.push('признак "' + t.id + '": неизвестный аллель "' + String(p[1]) + '"');
      }
    });
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * Фенотип по правилам species.json (полное доминирование:
   * доминантный аллель хотя бы один — фенотип доминантный).
   * @returns {Object.<string, string>} признак → значение фенотипа
   * @throws Error при невалидном геноме
   */
  function genomeToPhenotype(genome) {
    var v = validateGenome(genome);
    if (!v.ok) throw new Error('genomeToPhenotype: геном невалиден: ' + v.errors.join('; '));
    var sp = getSpecies(genome.species);
    var ph = {};
    sp.traits.forEach(function (t, i) {
      var p = genome.pairs[i];
      ph[t.id] = (p[0] === t.dominant || p[1] === t.dominant)
        ? t.values[t.dominant]
        : t.values[t.recessive];
    });
    return ph;
  }

  /**
   * Строка генотипа вида "AaBbCcDd" (в паре доминантный аллель первым).
   * @throws Error при невалидном геноме
   */
  function genotypeString(genome) {
    var v = validateGenome(genome);
    if (!v.ok) throw new Error('genotypeString: геном невалиден: ' + v.errors.join('; '));
    var sp = getSpecies(genome.species);
    return sp.traits.map(function (t, i) {
      var p = genome.pairs[i].slice().sort(function (x, y) {
        return (x === t.dominant ? 0 : 1) - (y === t.dominant ? 0 : 1);
      });
      return p[0] + p[1];
    }).join('');
  }

  core.genome = {
    /* ===== Экспорты: window.GenoLab.core.genome ===== */
    loadSpecies: loadSpecies,
    getSpecies: getSpecies,
    getSpeciesConfig: getSpeciesConfig,
    createGenome: createGenome,
    validateGenome: validateGenome,
    genomeToPhenotype: genomeToPhenotype,
    genotypeString: genotypeString,
  };
})(typeof window !== 'undefined' ? window : globalThis);
