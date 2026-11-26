/* ГеноЛаб — js/core/economy.js — цены и лимиты (фаза 3).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.core.economy
 * (ESM-экспорты не используются — решение фазы 0, LOG.md).
 *
 * Конфиг: источник — js/data/config.json (цены, лимиты слотов,
 * шансы мутаций на будущее). По file:// браузер не читает локальный
 * JSON без сервера (CORS), поэтому в этом файле есть вшитая точная
 * копия CONFIG — она используется по умолчанию. loadConfig(url)
 * (по http://) подменяет вшитый конфиг файлом после валидации формы.
 * Совпадение двух копий проверяет tests/config_test.html (паттерн
 * из genome.js / tests/genome.test.html).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  var core = g.core = g.core || {};

  /* Точная копия js/data/config.json. */
  var CONFIG = {
    version: 1,
    slots: { base: 12, max: 24 },
    prices: { sellCreature: 20, buySlot: 100, sequence: 30 },
    mutation: { enabled: false, chance: 0.03 }
  };

  /* Актуальный конфиг (loadConfig может заменить его файлом). */
  var config = CONFIG;

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }

  /* Проверка формы конфига (безопасность: файл не исполняется,
   * только валидируется и копируется). */
  function isConfigShape(v) {
    if (!v || typeof v !== 'object' || v.version !== 1) return false;
    if (!v.slots || !isInt(v.slots.base) || v.slots.base < 1 ||
        !isInt(v.slots.max) || v.slots.max < v.slots.base) return false;
    if (!v.prices || typeof v.prices !== 'object') return false;
    var priceKeys = ['sellCreature', 'buySlot', 'sequence'];
    for (var i = 0; i < priceKeys.length; i++) {
      var p = v.prices[priceKeys[i]];
      if (typeof p !== 'number' || !isFinite(p) || p < 0) return false;
    }
    if (!v.mutation || typeof v.mutation.enabled !== 'boolean') return false;
    if (typeof v.mutation.chance !== 'number' ||
        !isFinite(v.mutation.chance) || v.mutation.chance < 0 || v.mutation.chance > 1) return false;
    return true;
  }

  /**
   * Загрузить конфиг из JSON-файла (работает по http://;
   * по file:// fetch блокируется CORS — Promise с ok:false,
   * остаётся вшитый конфиг). Форму файла обязательно валидируем.
   * @param {string} url — путь к config.json
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  function loadConfig(url) {
    return new Promise(function (resolve) {
      if (typeof fetch !== 'function') {
        resolve({ ok: false, reason: 'fetch недоступен' });
        return;
      }
      fetch(url, { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (obj) {
          if (!isConfigShape(obj)) {
            resolve({ ok: false, reason: 'файл не подходит по форме конфига' });
            return;
          }
          config = deepCopy(obj);
          resolve({ ok: true });
        })
        .catch(function (err) {
          resolve({ ok: false, reason: 'не удалось загрузить: ' + err.message });
        });
    });
  }

  /** Цена действия из конфига. @param {string} name — ключ в prices. */
  function getPrice(name) {
    var p = config.prices && config.prices[name];
    if (typeof p !== 'number') throw new Error('economy: нет цены "' + name + '" в конфиге');
    return p;
  }

  core.economy = {
    /* ===== Экспорты: window.GenoLab.core.economy ===== */
    CONFIG: CONFIG,                 /* вшитая исходная копия (только чтение) */
    getConfig: function () { return deepCopy(config); },
    loadConfig: loadConfig,
    isConfigShape: isConfigShape,
    getPrice: getPrice,
  };
})(typeof window !== 'undefined' ? window : globalThis);
