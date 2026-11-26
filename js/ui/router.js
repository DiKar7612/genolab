/**
 * ГеноЛаб — hash-роутер (js/ui/router.js).
 *
 * Переключение шести экранов без перезагрузки: маршрут = location.hash
 * (#/enclosure, #/breed, #/creature, #/predictor, #/orders, #/codex).
 *
 * Двойной режим загрузки (модуль по http:// / классический скрипт
 * для file:// — браузеры блокируют ES-модули по протоколу file):
 * экспорты — window.GenoLab.router.
 */
(function (global) {
  'use strict';

  /** Имя маршрута -> hash */
  const ROUTES = {
    enclosure: '#/enclosure', // Вольер
    breed: '#/breed',         // Скрещивание
    creature: '#/creature',   // Карточка существа
    predictor: '#/predictor', // Предсказатель (фаза 5)
    orders: '#/orders',       // Заказы
    codex: '#/codex',         // Кодекс
  };

  const DEFAULT_ROUTE = 'enclosure';
  const SCREENS_CONTAINER_ID = 'screens';

  class Router {
    constructor() {
      /** @type {Map<string, (container: HTMLElement) => void>} */
      this.handlers = new Map();

      /** Имя активного экрана (для подписок экранов на store). */
      this.active = DEFAULT_ROUTE;

      global.addEventListener('hashchange', () => this.resolve());

      // Привязка ссылок навигации после полной загрузки DOM
      // (скрипт может стартовать до конца разбора документа).
      // Привязка ссылок навигации. Скрипт может стартовать до конца
      // разбора DOM (обычный случай) или после него (фолбэк file://
      // догнал скрипты после DOMContentLoaded) — оба случая закрываем.
      const bindNav = () => {
        document.querySelectorAll('.nav__link[data-route]').forEach((link) => {
          link.addEventListener('click', () => {
            const target = ROUTES[link.dataset.route];
            if (target && global.location.hash !== target) {
              global.location.hash = target;
            }
          });
        });
      };
      if (global.document.readyState === 'loading') {
        global.addEventListener('DOMContentLoaded', bindNav);
      } else {
        bindNav();
      }
    }

    /** Зарегистрировать рендер экрана (вызывается из модулей js/ui/screens/*.js). */
    register(name, handler) {
      if (ROUTES[name] && typeof handler === 'function') {
        this.handlers.set(name, handler);
      }
      return this;
    }

    /** Текущий маршрут по hash (неизвестный -> по умолчанию). */
    currentRoute() {
      const match = global.location.hash.match(/^#\/([a-z]+)\/?$/i);
      if (match && ROUTES[match[1]]) {
        return match[1];
      }
      return DEFAULT_ROUTE;
    }

    /** Показать активный экран: вызвать его рендер в контейнере. */
    resolve() {
      const name = this.currentRoute();
      this.active = name;

      const container = document.getElementById(SCREENS_CONTAINER_ID);
      if (container) {
        container.innerHTML = '';
        const handler = this.handlers.get(name) || this.handlers.get(DEFAULT_ROUTE);
        if (typeof handler === 'function') {
          handler(container);
        }
      }

      document.querySelectorAll('.nav__link[data-route]').forEach((link) => {
        const active = link.dataset.route === name;
        link.classList.toggle('is-active', active);
        if (active) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    /** Программный переход к маршруту. */
    go(name) {
      const target = ROUTES[name] || ROUTES[DEFAULT_ROUTE];
      if (global.location.hash !== target) {
        global.location.hash = target;
      } else {
        this.resolve();
      }
      return this;
    }

    /** Старт: гарантировать hash и показать начальный экран. */
    start() {
      if (!global.location.hash) {
        global.location.hash = ROUTES[DEFAULT_ROUTE];
      }
      this.resolve();
      return this;
    }
  }

  global.GenoLab = global.GenoLab || {};
  /* ===== Экспорты: window.GenoLab.router ===== */
  global.GenoLab.router = new Router();
})(typeof window !== 'undefined' ? window : globalThis);
