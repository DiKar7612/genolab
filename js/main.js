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

  /* В модульном режиме (http://) подгружаем ядро в порядке манифеста.
   * В классическом (file://) манифест фолбэка index.html уже всё
   * загрузил — повторное исполнение ломало бы store/подписки. */
  if (!window.__genolabClassic) {
    const coreModules = [
      './core/rng.js',
      './core/genome.js',
      './core/breeder.js',
      './core/economy.js',
      './state/store.js',
      './state/save.js',
      './render/creature.js',
      './render/pennett.js',
      './quests/questEngine.js',
      './quests/tutorial.js',
    ];
    for (const m of coreModules) {
      try {
        await import(m);
      } catch (err) {
        console.warn('[ГеноЛаб] не удалось загрузить модуль:', m, err);
      }
    }
  }

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

  // Фаза 5: тосты — UI-утилита, экраны используют g.ui.toast.show().
  // Фаза 6: звук — WebAudio-синтез (ui/sfx.js), mute в шапке.
  if (!window.__genolabClassic) {
    for (const m of ['./ui/toast.js', './ui/sfx.js']) {
      try {
        await import(m);
      } catch (err) {
        console.warn('[ГеноЛаб] не удалось загрузить ' + m + ':', err);
      }
    }
  }

  // Модули экранов. В классическом режиме (file://) они уже
  // загружены манифестом фолбэка — подгружать повторно не нужно.
  if (!window.__genolabClassic) {
    const screenModules = [
      './ui/screens/enclosure.js',
      './ui/screens/breed.js',
      './ui/screens/creature.js',
      './ui/screens/predictor.js',
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

  /* Фаза 3: загрузить сейв и подключить автосохранение.
   * Ошибка повреждённого сейва отображается на экране «Вольер»
   * (enclosure.js читает save.errorMessage()); краша нет. */
  if (g.state && g.state.save && typeof g.state.save.init === 'function') {
    g.state.save.init();
    /* Экран мог отрендериться до загрузки сейва — перерисовываем. */
    if (typeof router.resolve === 'function') router.resolve();
  }

  /* Фаза 6: звук — инициализация ПОСЛЕ save.init(): иконка тумблера
   * должна сразу отражать mute из загруженного сейва. */
  if (g.ui && g.ui.sfx && typeof g.ui.sfx.init === 'function') {
    g.ui.sfx.init();
  }

  /* Фаза 6: конфиг — из файла (http://); по file:// fetch блокируется
   * CORS, остаётся вшитая CONFIG в economy.js (паттерн loadQuests 4c). */
  if (!window.__genolabClassic && g.core && g.core.economy &&
      typeof g.core.economy.loadConfig === 'function') {
    g.core.economy.loadConfig('js/data/config.json').then(function (r) {
      if (!r.ok) console.warn('[ГеноЛаб] вшитый конфиг: ' + r.reason);
    });
  }

  /* Фаза 4c: данные квестов — из файла (http://); по file:// fetch
   * блокируется CORS, остаётся вшитая копия в questEngine.js. */
  if (g.quests && g.quests.questEngine && typeof g.quests.questEngine.loadQuests === 'function') {
    g.quests.questEngine.loadQuests('js/data/quests.json').then(function (r) {
      if (!r.ok) console.warn('[ГеноЛаб] вшитые данные квестов: ' + r.reason);
    });
  }

  /* Панель ресурсов в шапке — обновляется при изменении состояния. */
  var coinsEl = document.querySelector('.topbar__resources .resource--coins');
  var repEl = document.querySelector('.topbar__resources .resource--rep');
  function updateTopbar() {
    var st = (g.state && g.state.store && g.state.store.getState()) ||
      { resources: { coins: 0, reputation: 0 } };
    if (coinsEl) coinsEl.textContent = 'Монеты: ' + st.resources.coins;
    if (repEl) repEl.textContent = 'Репутация: ' + st.resources.reputation;
  }
  if (g.state && g.state.store && typeof g.state.store.subscribe === 'function') {
    updateTopbar();
    g.state.store.subscribe(updateTopbar);
  }
})();
