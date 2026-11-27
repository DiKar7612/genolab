/* ГеноЛаб — js/quests/questEngine.js — движок квестов и заказов (фаза 4c).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.quests.questEngine.
 *
 * Данные: источник — js/data/quests.json (5 обучающих квестов, 5 заказов).
 * По file:// браузер не читает локальный JSON без сервера (CORS),
 * поэтому здесь есть вшитая точная копия QUESTS_DATA (паттерн
 * js/core/economy.js). loadQuests(url) по http:// подменяет вшитую
 * копию файлом после валидации формы; совпадение проверяет
 * tests/quests_test.html (T1, только по http://).
 *
 * Линейная разблокировка: активен первый квест, которого нет в
 * state.quests.completed; награда начисляется при выполнении цели
 * (store.addCoins / addReputation).
 *
 * Прогресс хранится в state.quests (см. docs/api.md, схема
 * genolab_save_v1): {completed: [id], progress: {id: n}, ordersDone: [id]}.
 * Модуль не знает о DOM — только данные и store (js/state/store.js).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  var quests = g.quests = g.quests || {};

  /* Точная копия js/data/quests.json.
   * Править данные только вместе с файлом; рассинхрон ловит
   * T1 tests/quests_test.html (запускать по http://). */
  var QUESTS_DATA = {
    version: 1,
    quests: [
      {
        id: 'q1', title: 'Доминантный окрас', concept: 'полное доминирование',
        text: 'Коричневый окрас доминантный: он проявляется, если хотя бы один из родителей передал аллель A. Получите 2 потомков с коричневым окрасом.',
        goal: { kind: 'offspring', need: 2, phen: { color: 'коричневый' } },
        reward: { coins: 40, reputation: 1 }
      },
      {
        id: 'q2', title: 'Скрытый аллель', concept: 'гетерозигота',
        text: 'Гетерозигота (Aa) выглядит как доминантный гомозиготный (AA): белый аллель скрыт в коричневом окрасе. Секвенируйте 1 коричневого потомка и откройте его генотип.',
        goal: { kind: 'sequence', need: 1, phen: { color: 'коричневый' } },
        reward: { coins: 40, reputation: 1 }
      },
      {
        id: 'q3', title: 'Рецессивный признак', concept: 'рецессивный признак',
        text: 'Белый окрас рецессивный: он проявляется, только если обе копии аллеля — a. Выведите 1 потомка с белым окрасом.',
        goal: { kind: 'offspring', need: 1, phen: { color: 'белый' } },
        reward: { coins: 40, reputation: 1 }
      },
      {
        id: 'q4', title: 'Фиксация признака', concept: 'фиксация признака',
        text: 'Чтобы зафиксировать признак, у родителя должны быть две копии аллеля (dd): тогда он передаётся всем потомкам. Получите 3 потомков с круглыми ушами.',
        goal: { kind: 'offspring', need: 3, phen: { ears: 'круглые' } },
        reward: { coins: 60, reputation: 2 }
      },
      {
        id: 'q5', title: 'Предсказание расщепления', concept: 'предсказание расщепления',
        text: 'При скрещивании двух гетерозигот (Aa × Aa) потомство расщепляется в соотношении 3:1. Предскажите результат скрещивания, сверьте с фактом и выполните 1 заказ.',
        goal: { kind: 'order', need: 1 },
        reward: { coins: 50, reputation: 2 }
      }
    ],
    orders: [
      { id: 'o1', title: 'Нужен детёныш с коричневым окрасом',
        phen: { color: 'коричневый' }, reward: { coins: 40, reputation: 1 } },
      { id: 'o2', title: 'Нужен детёныш с полосатым узором',
        phen: { pattern: 'полосатый' }, reward: { coins: 60, reputation: 1 } },
      { id: 'o4', title: 'Нужен крупный с острыми ушами',
        phen: { size: 'крупный', ears: 'острые' }, reward: { coins: 100, reputation: 2 } },
      { id: 'o3', title: 'Нужен мелкий с белым окрасом',
        phen: { size: 'мелкий', color: 'белый' }, reward: { coins: 120, reputation: 2 } },
      { id: 'o5', title: 'Нужен мелкий белый с круглыми ушами',
        phen: { size: 'мелкий', color: 'белый', ears: 'круглые' },
        reward: { coins: 200, reputation: 3 } },
      /* Фаза 7d: заказы нового вида (поле species: вид, для которого
       * нужен фенотип; match — только существа этого вида). */
      { id: 'o6', title: 'Нужен светящийся Нокт', species: 'noct',
        phen: { glow: 'светящееся' }, reward: { coins: 80, reputation: 2 } },
      { id: 'o7', title: 'Нужен Нокт без свечения', species: 'noct',
        phen: { glow: 'не светящееся' }, reward: { coins: 120, reputation: 2 } }
    ]
  };

  /* Актуальные данные (loadQuests может заменить их файлом). */
  var data = QUESTS_DATA;

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }

  function isRewardShape(r) {
    return !!r && typeof r === 'object' &&
      isInt(r.coins) && r.coins >= 0 &&
      isInt(r.reputation) && r.reputation >= 0;
  }

  function isPhenShape(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
    var keys = Object.keys(p);
    if (keys.length === 0) return false;
    for (var i = 0; i < keys.length; i++) {
      if (typeof p[keys[i]] !== 'string' || p[keys[i]] === '') return false;
    }
    return true;
  }

  function isGoalShape(goal) {
    if (!goal || typeof goal !== 'object' || !isInt(goal.need) || goal.need < 1) return false;
    if (goal.kind === 'offspring' || goal.kind === 'sequence') {
      return isPhenShape(goal.phen);
    }
    if (goal.kind === 'order') { return true; }
    return false;
  }

  /* Проверка формы файла квестов (безопасность: файл не исполняется,
   * только валидируется и копируется). */
  function isQuestsShape(v) {
    if (!v || typeof v !== 'object' || v.version !== 1) return false;
    if (!Array.isArray(v.quests) || v.quests.length === 0) return false;
    var ids = {};
    for (var i = 0; i < v.quests.length; i++) {
      var q = v.quests[i];
      if (!q || typeof q !== 'object' || typeof q.id !== 'string' || q.id === '' || ids[q.id]) return false;
      ids[q.id] = true;
      if (typeof q.title !== 'string' || typeof q.concept !== 'string' || typeof q.text !== 'string') return false;
      if (!isGoalShape(q.goal)) return false;
      if (!isRewardShape(q.reward)) return false;
    }
    if (!Array.isArray(v.orders) || v.orders.length === 0) return false;
    for (var j = 0; j < v.orders.length; j++) {
      var o = v.orders[j];
      if (!o || typeof o !== 'object' || typeof o.id !== 'string' || o.id === '' || ids[o.id]) return false;
      ids[o.id] = true;
      if (typeof o.title !== 'string' || !isPhenShape(o.phen) || !isRewardShape(o.reward)) return false;
    }
    return true;
  }

  /**
   * Загрузить данные квестов из JSON-файла (работает по http://;
   * по file:// fetch блокируется CORS → {ok:false}, остаётся вшитая копия).
   * @param {string} url — путь к quests.json
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  function loadQuests(url) {
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
          if (!isQuestsShape(obj)) {
            resolve({ ok: false, reason: 'файл не подходит по форме данных квестов' });
            return;
          }
          data = deepCopy(obj);
          resolve({ ok: true });
        })
        .catch(function (err) {
          resolve({ ok: false, reason: 'не удалось загрузить: ' + err.message });
        });
    });
  }

  /** Глубокая копия актуальных данных ({quests, orders}). */
  function getQuests() {
    return deepCopy(data);
  }

  function store() {
    var s = g.state && g.state.store;
    if (!s) throw new Error('questEngine: state.store не загружен (нарушен порядок манифеста)');
    return s;
  }

  function questById(id) {
    for (var i = 0; i < data.quests.length; i++) {
      if (data.quests[i].id === id) return data.quests[i];
    }
    return null;
  }

  function orderById(id) {
    for (var i = 0; i < data.orders.length; i++) {
      if (data.orders[i].id === id) return data.orders[i];
    }
    return null;
  }

  /* ===== Чистые проверки (экспортированы для тестов и экранов) ===== */

  /**
   * Совпадает ли фенотип со спецификацией (все пары ключ-значение
   * должны быть равны; лишние признаки фенотипа не мешают).
   * @param {Object} phen — {color: 'белый', ...}
   * @param {Object} spec — частичная спецификация
   * @returns {boolean}
   */
  function matchPhenotype(phen, spec) {
    if (!phen || !spec) return false;
    var keys = Object.keys(spec);
    for (var i = 0; i < keys.length; i++) {
      if (phen[keys[i]] !== spec[keys[i]]) return false;
    }
    return true;
  }

  /**
   * Идентификатор активного квеста (линейная разблокировка:
   * первый, которого нет в qs.completed), либо null — все выполнены.
   * @param {Object} qs — state.quests
   * @returns {string|null}
   */
  function activeQuestId(qs) {
    var completed = (qs && Array.isArray(qs.completed)) ? qs.completed : [];
    for (var i = 0; i < data.quests.length; i++) {
      if (completed.indexOf(data.quests[i].id) === -1) return data.quests[i].id;
    }
    return null;
  }

  /**
   * Прогресс квеста: {have, need, done} (have не превышает need).
   * @param {Object} qs — state.quests
   * @param {string} questId
   * @returns {{have: number, need: number, done: boolean}}
   */
  function getProgress(qs, questId) {
    var q = questById(questId);
    if (!q) throw new Error('questEngine: неизвестный квест "' + String(questId) + '"');
    var have = (qs && qs.progress && typeof qs.progress[questId] === 'number')
      ? qs.progress[questId] : 0;
    if (have < 0) have = 0;
    if (have > q.goal.need) have = q.goal.need;
    return { have: have, need: q.goal.need, done: have >= q.goal.need };
  }

  /** Выполнен ли заказ. @param {Object} qs  @param {string} orderId */
  function isOrderDone(qs, orderId) {
    return !!(qs && Array.isArray(qs.ordersDone) && qs.ordersDone.indexOf(orderId) !== -1);
  }

  /* ===== События (мутабельные: обращаются к store) ===== */

  /**
   * Записать счётчик цели в qs и применить награду, если цель достигнута.
   * Общий хелпер для onOffspring / onSequenced.
   */
  function bumpGoal(qs, quest, kind, phen) {
    if (quest.goal.kind !== kind) return { changed: false, completed: null };
    var progress = getProgress(qs, quest.id);
    if (progress.done) return { changed: false, completed: null };
    if (!matchPhenotype(phen, quest.goal.phen)) return { changed: false, completed: null };
    qs.progress = qs.progress || {};
    qs.progress[quest.id] = progress.have + 1;
    var completed = null;
    if (qs.progress[quest.id] >= quest.goal.need) {
      qs.completed = (qs.completed || []).concat(quest.id);
      completed = quest;
      store().addCoins(quest.reward.coins);
      store().addReputation(quest.reward.reputation);
    }
    return { changed: true, completed: completed };
  }

  /**
   * Событие: получен потомок (после каждого скрещивания, независимо
   * от того, оставлен он в вольере или нет).
   * @param {Object} phen — фенотип потомка {color, pattern, size, ears}
   * @returns {{changed: boolean, completed: Object|null, reason?: string}}
   */
  function onOffspring(phen) {
    var qs = store().getState().quests;
    var id = activeQuestId(qs);
    if (!id) return { changed: false, completed: null, reason: 'квесты выполнены' };
    var quest = questById(id);
    if (quest.goal.kind !== 'offspring') {
      return { changed: false, completed: null, reason: 'цель квеста: ' + quest.goal.kind };
    }
    var r = bumpGoal(qs, quest, 'offspring', phen);
    if (r.changed) store().setQuests(qs);
    return r;
  }

  /**
   * Событие: существо секвенировано (генотип открыт платным действием).
   * @param {Object} phen — фенотип существа
   * @returns {{changed: boolean, completed: Object|null, reason?: string}}
   */
  function onSequenced(phen) {
    var qs = store().getState().quests;
    var id = activeQuestId(qs);
    if (!id) return { changed: false, completed: null, reason: 'квесты выполнены' };
    var quest = questById(id);
    if (quest.goal.kind !== 'sequence') {
      return { changed: false, completed: null, reason: 'цель квеста: ' + quest.goal.kind };
    }
    var r = bumpGoal(qs, quest, 'sequence', phen);
    if (r.changed) store().setQuests(qs);
    return r;
  }

  /**
   * Выполнить заказ: награда заказу + отметка в qs.ordersDone;
   * если активный квест имеет цель 'order' — завершить его (его награда
   * тоже начисляется). Саму передачу существа из вольера выполняет
   * вызывающий экран (store.removeCreature).
   * @param {string} orderId
   * @returns {{ok: boolean, reward?: object, questCompleted?: Object|null, reason?: string}}
   */
  function completeOrder(orderId) {
    var order = orderById(orderId);
    if (!order) return { ok: false, reason: 'неизвестный заказ "' + String(orderId) + '"' };
    var qs = store().getState().quests;
    if (isOrderDone(qs, orderId)) return { ok: false, reason: 'заказ уже выполнен' };
    qs.ordersDone = (qs.ordersDone || []).concat(orderId);
    store().addCoins(order.reward.coins);
    store().addReputation(order.reward.reputation);

    var questCompleted = null;
    var id = activeQuestId(qs);
    if (id) {
      var quest = questById(id);
      if (quest.goal.kind === 'order') {
        qs.completed = (qs.completed || []).concat(quest.id);
        store().addCoins(quest.reward.coins);
        store().addReputation(quest.reward.reputation);
        questCompleted = quest;
      }
    }
    store().setQuests(qs);
    return { ok: true, reward: order.reward, questCompleted: questCompleted };
  }

  /**
   * Активный квест с прогрессом (для панелей экранов).
   * @returns {{quest: Object|null, progress: {have, need, done}|null}}
   */
  function getActive() {
    var qs = store().getState().quests;
    var id = activeQuestId(qs);
    if (!id) return { quest: null, progress: null };
    return { quest: questById(id), progress: getProgress(qs, id) };
  }

  /**
   * Список заказов со статусом для экрана «Заказы»:
   * {id, title, species, phen, reward, done, match: string|null}
   * (match — id первого подходящего существа в вольере или null).
   * Фаза 7d: поле species у заказа (вид, для которого нужен фенотип);
   * при отсутствии поля — любой вид (старые данные).
   * @returns {Array<Object>}
   */
  function listOrders() {
    var st = store().getState();
    var qs = st.quests;
    var genome = g.core.genome;
    return data.orders.map(function (o) {
      var match = null;
      for (var i = 0; i < st.enclosure.length; i++) {
        var c = st.enclosure[i];
        /* Фаза 7d: чужой вид не подходит под заказ. */
        if (o.species && c.species !== o.species) continue;
        if (matchPhenotype(genome.genomeToPhenotype(c), o.phen)) { match = c.id; break; }
      }
      return {
        id: o.id, title: o.title, species: o.species || null,
        phen: deepCopy(o.phen),
        reward: deepCopy(o.reward), done: isOrderDone(qs, o.id), match: match
      };
    });
  }

  quests.questEngine = {
    /* ===== Экспорты: window.GenoLab.quests.questEngine ===== */
    QUESTS_DATA: QUESTS_DATA,   /* вшитая исходная копия (только чтение) */
    getQuests: getQuests,
    loadQuests: loadQuests,
    isQuestsShape: isQuestsShape,
    matchPhenotype: matchPhenotype,
    activeQuestId: activeQuestId,
    getProgress: getProgress,
    isOrderDone: isOrderDone,
    getActive: getActive,
    listOrders: listOrders,
    onOffspring: onOffspring,
    onSequenced: onSequenced,
    completeOrder: completeOrder,
  };
})(typeof window !== 'undefined' ? window : globalThis);
