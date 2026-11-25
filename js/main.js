/**
 * ГеноЛаб — точка входа (js/main.js).
 *
 * Инициализация роутера. Экраны регистрируют сами себя в роутер
 * (модули js/ui/screens/*.js), main.js гарантирует их загрузку
 * и запускает роутер.
 *
 * Двойной режим загрузки: по http:// файл работает как ES-модуль
 * (<script type="module"> в index.html) и сам подгружает модули
 * экранов; при открытии с file:// браузер блокирует ES-модули (CORS),
 * и index.html загружает файлы из манифеста как классические скрипты
 * (флаг window.__genolabClassic). Статических import/export нет —
 * экспорты в namespace window.GenoLab.
 */
(async function () {
  'use strict';

  // Дождаться полной загрузки DOM: в классическом режиме file://
  // скрипт может стартовать до конца разбора index.html.
  await new Promise((resolve) => {
    if (document.readyState !== 'loading') {
      resolve();
    } else {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    }
  });

  const g = (window.GenoLab = window.GenoLab || {});

  // В модульном режиме подгружаем роутер; в классическом он уже
  // загружен ранее (манифест фолбэка в index.html).
  if (!g.router) {
    try {
      await import('./ui/router.js');
    } catch (err) {
      console.warn('[ГеноЛаб] не удалось загрузить router.js как модуль:', err);
    }
  }

  const router = g.router;
  if (!router) {
    console.error('[ГеноЛаб] роутер недоступен — проверьте наличие js/ui/router.js.');
    return;
  }

  // Модули экранов. В классическом режиме (file://) они уже
  // загружены манифестом фолбэка — подгружать повторно не нужно.
  if (!window.__genolabClassic) {
    const screenModules = [
      './ui/screens/enclosure.js',
      './ui/screens/breed.js',
      './ui/screens/creature.js',
      './ui/screens/orders.js',
      './ui/screens/codex.js',
    ];
    for (const m of screenModules) {
      try {
        await import(m);
      } catch (err) {
        console.warn('[ГеноЛаб] не удалось загрузить модуль экрана:', m, err);
      }
    }
  }

  router.start();
})();
