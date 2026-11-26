/* ГеноЛаб — js/ui/toast.js — всплывающие уведомления (фаза 5, TZ §8.6).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.ui.toast.
 *
 * Короткие подтверждения (продажа, экспорт, завершение заказа) —
 * вместо alert (критерий фазы 5: в js/ нет ни alert, ни console.log).
 * Реестр .toast-region живёт в body, aria-live="polite" —
 * доступные для screen reader, не блокируют ввод.
 *
 * Разметка — только из внутренних констант (SECURITY.md §4),
 * сообщения — через textContent (никто не может внедрить HTML).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  g.ui = g.ui || {};

  var TTL_MS = 3000;   /* время жизни тоста */
  var OUT_MS = 250;    /* длительность анимации ухода */

  var region = null;

  function ensureRegion() {
    if (!region || !global.document.contains(region)) {
      region = global.document.createElement('div');
      region.className = 'toast-region';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      global.document.body.appendChild(region);
    }
    return region;
  }

  /**
   * Показать тост.
   * @param {string} msg — текст (textContent — без HTML)
   * @param {string} [type] — '' | 'ok' | 'err' (цвет левой кромки)
   */
  function show(msg, type) {
    var box = ensureRegion();
    var el = global.document.createElement('div');
    el.className = 'toast' + (type ? ' toast--' + type : '');
    el.textContent = String(msg);
    box.appendChild(el);
    global.setTimeout(function () {
      el.classList.add('toast--out');
      global.setTimeout(function () { el.remove(); }, OUT_MS);
    }, TTL_MS);
  }

  g.ui.toast = { show: show, TTL_MS: TTL_MS, OUT_MS: OUT_MS };
})(typeof window !== 'undefined' ? window : globalThis);
