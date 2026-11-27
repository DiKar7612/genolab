/* ГеноЛаб — js/state/store.js — центральное состояние игры (фаза 3).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.state.store.
 *
 * Состояние: вольер (массив геномов, лимит слотов из js/data/config.json),
 * ресурсы (монеты, репутация), прогресс квестов.
 * Подписки на изменения — простой pub/sub (subscribe -> unsubscribe).
 *
 * Ограничения фазы 3: модуль не знает о DOM — только данные и подписки;
 * все обращения к localStorage — только через js/state/save.js.
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  var state = g.state = g.state || {};
  var core = g.core = g.core || {};

  /* Конфиг: лимиты слотов и цены (js/core/economy.js загружается первым). */
  function cfg() {
    return (core.economy && core.economy.getConfig && core.economy.getConfig()) ||
      { slots: { base: 12, max: 24 }, prices: { sellCreature: 20, buySlot: 100 } };
  }

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  /* Стартовые существа (фаза 4c): без них новый игрок не может начать
   * цикл «скрестил → продал → выполнил заказ». Детерминированные пары
   * (порядок признаков вида golo: color, pattern, size, ears):
   *  c1, c2 — гетерозиготы Aa Bb Cc Dd (классическое расщепление 3:1);
   *  c3 — чистый рецессив aa bb cc dd (белый, однотонный, мелкий, круглые).
   * Фаза 7d: Нокт (признак glow: E/e) — c4, c5 — гетерозиготы Ee × Ee
   * (расщепление светящихся 3:1) — для заказов нового вида. */
  function starterCreatures() {
    return [
      { id: 'c1', species: 'golo', pairs: [['A', 'a'], ['B', 'b'], ['C', 'c'], ['D', 'd']] },
      { id: 'c2', species: 'golo', pairs: [['A', 'a'], ['B', 'b'], ['C', 'c'], ['D', 'd']] },
      { id: 'c3', species: 'golo', pairs: [['a', 'a'], ['b', 'b'], ['c', 'c'], ['d', 'd']] },
      { id: 'c4', species: 'noct', pairs: [['E', 'e']] },
      { id: 'c5', species: 'noct', pairs: [['E', 'e']] }
    ];
  }

  /* Фаза 7c: ключ фенотипа для коллекции кодекса —
   * «вид|значения фенотипов по признакам» (совпадает с форматом
   * phenotype в cells решётки + префикс вида). */
  function seenKey(genome) {
    if (!core.genome || typeof core.genome.genomeToPhenotype !== 'function') {
      return null;
    }
    try {
      var sp = core.genome.getSpecies(genome.species);
      if (!sp) return null;
      var ph = core.genome.genomeToPhenotype(genome);
      return genome.species + '|' + sp.traits.map(function (t) { return ph[t.id]; }).join('|');
    } catch (e) {
      return null;
    }
  }

  /** Отметить фенотип существа как встреченный (коллекция кодекса). */
  function recordSeen(state, genome) {
    if (!state) return;
    var k = seenKey(genome);
    if (k) state.codexSeen[k] = true;
  }

  function initialState() {
    var st = {
      version: 1,
      enclosure: starterCreatures(),                   // геномы, лимит slotLimit
      resources: { coins: 0, reputation: 0 },
      quests: {},                                       // {completed:[], progress:{}, ordersDone:[]} — фаза 4c
      slotLimit: cfg().slots.base,
      /* Фаза 5: счётчик прогнозов экрана «Предсказатель»
       * (TZ §3.4 — мини-тренажёр: всего проверок / попаданий). */
      predictions: { total: 0, hits: 0 },
      /* Фаза 6: звук (ui/sfx.js). true = mute. Мягкая деградация:
       * в старых сейвах поля нет — звук включён (false), версия
       * схемы genolab_save_v1 не меняется. */
      muted: false,
      /* Фаза 7a: счётчик мутаций (js/core/mutation.js) — всего
       * мутировавших потомков. Мягкая деградация: в сейвах до
       * фазы 7a поля нет — дефолт {total: 0}, версия схемы не
       * меняется (save.js). */
      mutations: { total: 0 },
      /* Фаза 7c: коллекция кодекса — ключи встреченных фенотипов
       * (ключ -> true). Мягкая деградация: в сейвах до фазы 7c поля
       * нет — {} (save.js доподнимает). Версия схемы genolab_save_v1
       * не меняется. */
      codexSeen: {}
    };
    /* Стартеры вольера — встречены с первого запуска. */
    st.enclosure.forEach(function (c) { recordSeen(st, c); });
    return st;
  }

  var current = initialState();
  var listeners = [];

  function emit() {
    var ls = listeners.slice();
    for (var i = 0; i < ls.length; i++) ls[i]();
  }

  /* ===== Pub/Sub ===== */

  /** Подписка на изменения состояния. @returns {function} отписка. */
  function subscribe(fn) {
    if (typeof fn !== 'function') throw new Error('store: подписчик — не функция');
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    };
  }

  /** Снимок состояния (копия — внешние изменения не попадут в store). */
  function getState() {
    return deepCopy(current);
  }

  /* ===== Мутации ===== */

  function addCoins(n) {
    if (typeof n !== 'number' || !isFinite(n)) throw new Error('store: addCoins — не число');
    current.resources.coins += n;
    emit();
    return current.resources.coins;
  }

  function addReputation(n) {
    if (typeof n !== 'number' || !isFinite(n)) throw new Error('store: addReputation — не число');
    current.resources.reputation += n;
    emit();
    return current.resources.reputation;
  }

  /**
   * Добавить существо в вольер.
   * @param {Object} genome — геном {id, species, pairs}
   * @returns {{ok: boolean, id?: string, reason?: string}}
   */
  function addCreature(genome) {
    if (current.enclosure.length >= current.slotLimit) {
      return { ok: false, reason: 'вольер полон (' + current.enclosure.length + '/' + current.slotLimit + ')' };
    }
    if (core.genome && typeof core.genome.validateGenome === 'function') {
      var v = core.genome.validateGenome(genome);
      if (!v.ok) return { ok: false, reason: 'геном невалиден: ' + v.errors.join('; ') };
    } else if (!genome || typeof genome !== 'object' || !Array.isArray(genome.pairs)) {
      return { ok: false, reason: 'геном невалиден' };
    }
    /* genome.js (заморожен) присваивает id счётчиком, который сбрасывается
     * при перезагрузке — конфликтующий/пустой id заменяем следующим свободным cN. */
    if (typeof genome.id !== 'string' || genome.id === '' ||
        current.enclosure.some(function (x) { return x.id === genome.id; })) {
      var maxN = 0;
      current.enclosure.forEach(function (x) {
        var m = /^c(\d+)$/.exec(String(x.id));
        if (m && Number(m[1]) > maxN) maxN = Number(m[1]);
      });
      genome.id = 'c' + (maxN + 1);
    }
    current.enclosure.push(genome);
    /* Фаза 7c: каждый новый существо попадает в коллекцию кодекса. */
    recordSeen(current, genome);
    emit();
    return { ok: true, id: genome.id };
  }

  /**
   * Убрать существо из вольера.
   * @returns {{ok: boolean, reason?: string}}
   */
  function removeCreature(id) {
    var i = current.enclosure.findIndex(function (x) { return x.id === id; });
    if (i === -1) return { ok: false, reason: 'существо ' + String(id) + ' не в вольере' };
    current.enclosure.splice(i, 1);
    emit();
    return { ok: true };
  }

  /**
   * Продать существо: убрать из вольера + базовая цена из конфига.
   * @returns {{ok: boolean, coins?: number, reason?: string}}
   */
  function sellCreature(id) {
    var found = current.enclosure.some(function (x) { return x.id === id; });
    if (!found) return { ok: false, reason: 'существо ' + String(id) + ' не в вольере' };
    var price = cfg().prices.sellCreature;
    current.enclosure = current.enclosure.filter(function (x) { return x.id !== id; });
    current.resources.coins += price;
    emit();
    return { ok: true, coins: price };
  }

  /**
   * Купить доп. слот вольера (цена и предел — из конфига).
   * @returns {{ok: boolean, slotLimit?: number, reason?: string}}
   */
  function buySlot() {
    var c = cfg();
    if (current.slotLimit >= c.slots.max) {
      return { ok: false, reason: 'максимум слотов достигнут (' + c.slots.max + ')' };
    }
    var price = c.prices.buySlot;
    if (current.resources.coins < price) {
      return { ok: false, reason: 'не хватает монет: нужно ' + price };
    }
    current.resources.coins -= price;
    current.slotLimit += 1;
    emit();
    return { ok: true, slotLimit: current.slotLimit };
  }

  /**
   * Заменить прогресс квестов целиком (js/quests/questEngine.js).
   * Форма: {completed: [id], progress: {id: number}, ordersDone: [id]}
   * (лишние поля сохраняются — схема сейва требует только объект).
   * @param {Object} quests — новый объект прогресса квестов
   */
  function setQuests(quests) {
    if (!quests || typeof quests !== 'object' || Array.isArray(quests)) {
      throw new Error('store: setQuests — не объект');
    }
    current.quests = deepCopy(quests);
    emit();
  }

  /**
   * Заменить состояние целиком (использует save.js после валидации).
   * @param {Object} saved — валидный объект сейва
   */
  function applyState(saved) {
    current = {
      version: 1,
      enclosure: deepCopy(saved.enclosure),
      resources: deepCopy(saved.resources),
      quests: saved.quests ? deepCopy(saved.quests) : {},
      slotLimit: saved.slotLimit,
      /* Мягкая деградация сейвов до фазы 5: отсутствия поля нет —
       * save.js доподнимает {total:0, hits:0} (схема v1 без изменений). */
      predictions: (saved.predictions && typeof saved.predictions === 'object' &&
        !Array.isArray(saved.predictions))
        ? deepCopy(saved.predictions)
        : { total: 0, hits: 0 },
      /* Фаза 6: mute — только boolean true мутит, отсутствие поля
       * или мусор = звук включён (мягкая деградация). */
      muted: saved.muted === true,
      /* Фаза 7a: счётчик мутаций — save.js доподнимает {total: 0}
       * для сейвов до фазы 7a; мусорная форма = дефолт. */
      mutations: (saved.mutations && typeof saved.mutations === 'object' &&
        !Array.isArray(saved.mutations) &&
        typeof saved.mutations.total === 'number' &&
        isFinite(saved.mutations.total) && saved.mutations.total >= 0 &&
        Math.floor(saved.mutations.total) === saved.mutations.total)
        ? { total: saved.mutations.total }
        : { total: 0 },
      /* Фаза 7c: коллекция кодекса — save.js доподнимает {} для сейвов
       * до фазы 7c; здесь — двойная страховка по форме (только строковые
       * ключи со значением true). */
      codexSeen: (function () {
        if (!saved.codexSeen || typeof saved.codexSeen !== 'object' ||
            Array.isArray(saved.codexSeen)) {
          return {};
        }
        var out = {};
        Object.keys(saved.codexSeen).forEach(function (k) {
          if (saved.codexSeen[k] === true) out[k] = true;
        });
        return out;
      })()
    };
    /* Фаза 7c: мягкая деградация сейвов до 7c — коллекцию
     * восстанавливаем из существ, которые уже в вольере
     * (старые сейвы поля codexSeen не имеют; версия схемы не меняется). */
    saved.enclosure.forEach(function (c) { recordSeen(current, c); });
    emit();
  }

  function reset() {
    current = initialState();
    emit();
    return getState();
  }

  /**
   * Записать проверку прогноза (экран «Предсказатель», фаза 5, TZ §3.4).
   * total +1; при hit === true также hits +1.
   * @param {boolean} hit — прогноз точен (в пределах допустимого отклонения)
   * @returns {{total: number, hits: number}} — обновлённый счётчик (копия)
   */
  /**
   * Фаза 6: переключить mute (ui/sfx.js, тумблер в шапке).
   * @param {boolean} b — true = звук выключен
   * @returns {boolean} — новое состояние mute
   */
  function setMuted(b) {
    if (typeof b !== 'boolean') {
      throw new Error('store: setMuted — не boolean');
    }
    current.muted = b;
    emit();
    return current.muted;
  }

  function recordPrediction(hit) {
    if (typeof hit !== 'boolean') {
      throw new Error('store: recordPrediction — hit не boolean');
    }
    current.predictions.total += 1;
    if (hit) current.predictions.hits += 1;
    emit();
    return { total: current.predictions.total, hits: current.predictions.hits };
  }

  /**
   * Фаза 7a: учсть мутации (экран «Скрещивание» после flipGenome).
   * @param {number} n — число мутировавших потомков (целое >= 0)
   * @returns {{total: number}} — обновлённый счётчик (копия)
   */
  function recordMutations(n) {
    if (typeof n !== 'number' || !isFinite(n) || n < 0 || Math.floor(n) !== n) {
      throw new Error('store: recordMutations — ожидается целое >= 0');
    }
    current.mutations.total += n;
    emit();
    return { total: current.mutations.total };
  }

  state.store = {
    /* ===== Экспорты: window.GenoLab.state.store ===== */
    getState: getState,
    subscribe: subscribe,
    addCreature: addCreature,
    removeCreature: removeCreature,
    sellCreature: sellCreature,
    setQuests: setQuests,
    buySlot: buySlot,
    setMuted: setMuted,
    addCoins: addCoins,
    addReputation: addReputation,
    applyState: applyState,
    recordPrediction: recordPrediction,
    recordMutations: recordMutations,
    reset: reset,
  };
})(typeof window !== 'undefined' ? window : globalThis);
