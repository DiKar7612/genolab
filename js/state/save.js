/* ГеноЛаб — js/state/save.js — сохранение/загрузка (фаза 3).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.state.save.
 *
 * localStorage: только ключ genolab_save_v1 (SECURITY.md §5).
 * Автосохранение при каждом изменении состояния, debounce 500 мс.
 * Экспорт в JSON-файл (скачивание) и импорт из файла:
 * валидация структуры, лимит 1 МБ, только JSON.parse + проверка полей,
 * никакого eval (SECURITY.md §6).
 * Повреждённый сейв — понятное сообщение (errorMessage()), не краш.
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  var state = g.state = g.state || {};
  var core = g.core = g.core || {};

  var SAVE_KEY = 'genolab_save_v1';
  var MAX_IMPORT_BYTES = 1024 * 1024;  /* 1 МБ — SECURITY.md §6 */
  var DEBOUNCE_MS = 500;               /* автосохранение, фаза 3 */
  var FILE_NAME = 'genolab_save_v1.json';

  var lastError = null;
  var timer = null;

  function store() {
    var s = state.store;
    if (!s) throw new Error('save: js/state/store.js не загружен');
    return s;
  }

  function maxSlots() {
    var e = core.economy;
    return (e && e.CONFIG && e.CONFIG.slots && e.CONFIG.slots.max) || 24;
  }

  /* ===== Валидация структуры сейва (схема genolab_save_v1) ===== */

  /**
   * Проверить объект сейва по схеме.
   * @returns {{ok: boolean, errors: string[]}}
   */
  function validate(obj) {
    var errors = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ok: false, errors: ['сейв не является объектом'] };
    }
    if (obj.version !== 1) {
      errors.push('version: ожидается 1, получено ' + JSON.stringify(obj.version));
    }
    if (!Array.isArray(obj.enclosure)) {
      errors.push('enclosure: ожидается массив геномов');
    } else {
      obj.enclosure.forEach(function (c, i) {
        var cv = (core.genome && core.genome.validateGenome)
          ? core.genome.validateGenome(c)
          : { ok: !!(c && c.species && Array.isArray(c.pairs)), errors: ['невалидный геном'] };
        if (!cv.ok) errors.push('enclosure[' + i + ']: ' + cv.errors.join('; '));
        if (!c || typeof c.id !== 'string' || c.id === '') {
          errors.push('enclosure[' + i + ']: нет строкового id');
        }
      });
    }
    var r = obj.resources;
    if (!r || typeof r !== 'object') {
      errors.push('resources: ожидается объект');
    } else if (typeof r.coins !== 'number' || !isFinite(r.coins) || r.coins < 0 ||
               typeof r.reputation !== 'number' || !isFinite(r.reputation) || r.reputation < 0) {
      errors.push('resources: coins/reputation — некорректные числа');
    }
    if (!obj.quests || typeof obj.quests !== 'object' || Array.isArray(obj.quests)) {
      errors.push('quests: ожидается объект');
    }
    if (typeof obj.slotLimit !== 'number' || !isFinite(obj.slotLimit) ||
        Math.floor(obj.slotLimit) !== obj.slotLimit || obj.slotLimit < 1 ||
        obj.slotLimit > maxSlots()) {
      errors.push('slotLimit: ожидается целое 1..' + maxSlots());
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /* ===== localStorage ===== */

  /**
   * Сохранить текущее состояние в localStorage.
   * @returns {boolean} — удалось ли записать
   */
  function save() {
    try {
      global.localStorage.setItem(SAVE_KEY, JSON.stringify(store().getState()));
      lastError = null;
      return true;
    } catch (e) {
      lastError = 'Не удалось сохранить игру в localStorage: ' + e.message;
      return false;
    }
  }

  /**
   * Загрузить состояние из localStorage (вызывает init()).
   * Повреждённые/невалидные данные не крашат: состояние остаётся
   * чистым, причина — в errorMessage().
   * @returns {Object|null} — загруженный объект сейва или null
   */
  function load() {
    var raw = null;
    try {
      raw = global.localStorage.getItem(SAVE_KEY);
    } catch (e) {
      lastError = 'Нет доступа к localStorage: ' + e.message;
      return null;
    }
    if (raw === null || raw === '') {
      lastError = null;
      return null;
    }
    var obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      lastError = 'Сейв повреждён: строка в localStorage не является валидным JSON (' +
        e.message + '). Игровая сессия начата с чистого состояния.';
      return null;
    }
    var v = validate(obj);
    if (!v.ok) {
      lastError = 'Сейв повреждён: не подходит по схеме genolab_save_v1 — ' +
        v.errors.join('; ') + '. Игровая сессия начата с чистого состояния.';
      return null;
    }
    store().applyState(obj);
    lastError = null;
    return obj;
  }

  /**
   * Инициализация фазы 3: загрузить сейв и подключить автосохранение
   * (debounce 500 мс) на каждое изменение состояния.
   */
  function init() {
    load();
    store().subscribe(function () {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        save();
      }, DEBOUNCE_MS);
    });
  }

  /** Понятное сообщение об ошибке сейва, либо null. */
  function errorMessage() { return lastError; }

  /* ===== Экспорт / импорт файла ===== */

  /**
   * Экспорт текущего состояния в JSON-файл (скачивание).
   * @returns {{ok: boolean, filename?: string, bytes?: number, reason?: string}}
   */
  function exportFile() {
    try {
      var text = JSON.stringify(store().getState(), null, 2);
      var blob = new Blob([text], { type: 'application/json' });
      var url = global.URL.createObjectURL(blob);
      var a = global.document.createElement('a');
      a.href = url;
      a.download = FILE_NAME;
      global.document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { global.URL.revokeObjectURL(url); }, 1000);
      lastError = null;
      return { ok: true, filename: FILE_NAME, bytes: text.length };
    } catch (e) {
      lastError = 'Экспорт сейва не удался: ' + e.message;
      return { ok: false, reason: lastError };
    }
  }

  /**
   * Импорт состояния из JSON-файла.
   * Лимит 1 МБ, только JSON.parse + валидация по схеме, без eval.
   * @param {File} file — файл из <input type="file">
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  function importFile(file) {
    return new Promise(function (resolve) {
      if (!file || typeof file.size !== 'number') {
        lastError = 'Импорт: передан не файл.';
        resolve({ ok: false, reason: lastError });
        return;
      }
      if (file.size > MAX_IMPORT_BYTES) {
        lastError = 'Импорт: файл больше 1 МБ (' + file.size + ' байт) — отклонён по SECURITY.md §6.';
        resolve({ ok: false, reason: lastError });
        return;
      }
      var reader = new global.FileReader();
      reader.onload = function () {
        var text = String(reader.result);
        var obj;
        try {
          obj = JSON.parse(text);
        } catch (e) {
          lastError = 'Импорт: файл не является валидным JSON (' + e.message + ').';
          resolve({ ok: false, reason: lastError });
          return;
        }
        var v = validate(obj);
        if (!v.ok) {
          lastError = 'Импорт: файл не подходит по схеме genolab_save_v1 — ' + v.errors.join('; ') + '.';
          resolve({ ok: false, reason: lastError });
          return;
        }
        store().applyState(obj);
        save();
        lastError = null;
        resolve({ ok: true });
      };
      reader.onerror = function () {
        lastError = 'Импорт: не удалось прочитать файл.';
        resolve({ ok: false, reason: lastError });
      };
      reader.readAsText(file);
    });
  }

  state.save = {
    /* ===== Экспорты: window.GenoLab.state.save ===== */
    SAVE_KEY: SAVE_KEY,
    FILE_NAME: FILE_NAME,
    MAX_IMPORT_BYTES: MAX_IMPORT_BYTES,
    DEBOUNCE_MS: DEBOUNCE_MS,
    validate: validate,
    save: save,
    load: load,
    init: init,
    errorMessage: errorMessage,
    exportFile: exportFile,
    importFile: importFile,
  };
})(typeof window !== 'undefined' ? window : globalThis);
