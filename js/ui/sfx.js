/* ГеноЛаб — js/ui/sfx.js — звук (WebAudio-синтез, без файлов).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.ui.sfx.
 * Звук по ТЗ §8 опционален; реализован по решению пользователя
 * (докончение фазы 6 до коммита) — 4 сигнала, синтез осцилляторами:
 *   'click'   — клик любой кнопки (делегированный слушатель)
 *   'success' — успешное скрещивание (все потомки в вольере)
 *   'order'   — выполненный заказ
 *   'error'   — ошибка действия (вольер полон, не хватило монет и т.п.)
 * Ограничения: длительность каждого сигнала < 0.3 s, gain <= 0.2;
 * AudioContext создаётся/резюмируется только после первого действия
 * пользователя (pointerdown/keydown) — автозапуск звука браузеры
 * блокируют. Mute-тумблер в шапке; состояние мьюта — в сейве
 * (state.muted, мягкая деградация: отсутствие поля = звук включён,
 * версия схемы genolab_save_v1 не меняется).
 * Разметки модуль не создаёт — только иконку/aria-атрибуты
 * существующей кнопки #sfx-toggle в шапке (SECURITY.md §4).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  g.ui = g.ui || {};

  var MASTER_GAIN = 0.15;      /* <= 0.2 по заданию */
  var TOGGLE_ID = 'sfx-toggle';

  var ctx = null;              /* AudioContext — лениво, после жеста */
  var userGesture = false;     /* первый pointerdown/keydown получен */

  function store() {
    return g.state && g.state.store;
  }

  /** Звук включён? Состояние — в store (сейв); нет store — звук выключен
   * (вызов play() до инициализации store не ломает игру). */
  function muted() {
    var s = store();
    return !!(s && s.getState && s.getState().muted);
  }

  /** Один тон: осциллятор + огибающая (линейный спад до тишины). */
  function tone(freq, startAt, dur, type, peakGain) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(peakGain, startAt);
    gain.gain.linearRampToValueAtTime(0.0001, startAt + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + dur);
  }

  /**
   * Сыграть сигнал. Молча игнорируется, если: mute включён,
   * AudioContext недоступен или ещё не было действия пользователя.
   * Никогда не бросает исключений (UI не может «сломаться» от звука).
   * @param {'click'|'success'|'order'|'error'} name
   */
  function play(name) {
    if (muted()) return;
    if (!userGesture) return;
    try {
      if (!ctx) {
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') {
        /* resume() без await — не блокируем UI; если не успел
         * переключиться, звук просто пропустится (не критично). */
        ctx.resume();
      }
      if (ctx.state !== 'running') return;
      var t = ctx.currentTime + 0.01;
      if (name === 'click') {
        tone(700, t, 0.05, 'square', MASTER_GAIN * 0.6);
      } else if (name === 'success') {
        tone(523.25, t, 0.10, 'sine', MASTER_GAIN);        /* C5 */
        tone(783.99, t + 0.10, 0.15, 'sine', MASTER_GAIN); /* G5; всего 0.25 s */
      } else if (name === 'order') {
        tone(523.25, t, 0.08, 'sine', MASTER_GAIN);        /* C5 */
        tone(659.25, t + 0.08, 0.08, 'sine', MASTER_GAIN); /* E5 */
        tone(783.99, t + 0.16, 0.08, 'sine', MASTER_GAIN); /* G5; всего 0.24 s */
      } else if (name === 'error') {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.22);
        gain.gain.setValueAtTime(MASTER_GAIN * 0.7, t);
        gain.gain.linearRampToValueAtTime(0.0001, t + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);                                 /* 0.25 s */
      }
    } catch (e) {
      /* WebAudio недоступен (например, headless без audio) — игнорируем. */
    }
  }

  /** Иконка/aria тумблера по текущему состоянию. */
  function updateToggle() {
    var btn = global.document && global.document.getElementById(TOGGLE_ID);
    if (!btn) return;
    var off = muted();
    btn.textContent = off ? '🔇' : '🔊';
    btn.setAttribute('aria-pressed', off ? 'true' : 'false');
    btn.setAttribute('aria-label', off ? 'Звук: выключен' : 'Звук: включён');
  }

  /**
   * Инициализация: слушатели первого жеста, тумблер в шапке,
   * делегированный 'click' по кнопкам. Вызывается один раз из main.js.
   */
  function init() {
    if (g.ui.sfx.__inited) return;
    g.ui.sfx.__inited = true;

    var onGesture = function () {
      userGesture = true;
      /* Контекст не создаём заранее — только флаг: первый звук
       * воспроизведётся, все следующие — без задержки. */
    };
    global.document.addEventListener('pointerdown', onGesture, { once: true, passive: true });
    global.document.addEventListener('keydown', onGesture, { once: true });

    /* Клик любой кнопки — короткий щелчок (включая сам тумблер). */
    global.document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('button') : null;
      if (el) play('click');
    }, { passive: true });

    var btn = global.document.getElementById(TOGGLE_ID);
    if (btn) {
      btn.addEventListener('click', function () {
        var s = store();
        if (s && typeof s.setMuted === 'function') {
          s.setMuted(!muted());
          updateToggle();
        }
      });
    }

    /* Иконка следует за состоянием (тумблер, импорт сейва, сброс). */
    var s = store();
    updateToggle();
    if (s && typeof s.subscribe === 'function') {
      s.subscribe(updateToggle);
    }
  }

  g.ui.sfx = {
    init: init,
    play: play,
    muted: muted,
    MASTER_GAIN: MASTER_GAIN
  };
})(typeof window !== 'undefined' ? window : globalThis);
