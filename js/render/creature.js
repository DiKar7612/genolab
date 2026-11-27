/* ГеноЛаб — js/render/creature.js — процедурный SVG-рендер существа (фаза 2, палитра фазы 0.5).
 *
 * Двойной режим загрузки: экспорты — window.GenoLab.render.creature.
 *
 * Сборка: хвост → уши → корпус → узор → животик/морда, всё внутри одной
 * группы; размер (крупный/мелкий) — масштаб группы. Стадии (baby/adult/old)
 * — параметры ART_STYLE.md §6 поверх тех же SVG-модулей (конфиг — поле
 * golo.lifeStages в species.json / вшитой копии genome.js).
 * Палитра — ART_STYLE.md §5 (тёплый ряд; тёмный #1a1a1a отменён).
 * Цвет глаз в §5 прямо не задан — предложен ближайший тёмный тёплый тон
 * палитры §5: #5f3a22 (ряд узоров).
 * Модули (части) канонически лежат в assets/parts/*.svg; по file://
 * внешние SVG-файлы браузер не читает (fetch — CORS), поэтому ниже вшита
 * копия той же разметки, а заливки подставляются по фенотипу и стадии
 * (решение фазы 0, см. LOG.md и assets/parts/README.md).
 * Разметка собирается только из внутренних констант (SECURITY.md §4).
 */
(function (global) {
  'use strict';

  var g = global.GenoLab = global.GenoLab || {};
  var render = g.render = g.render || {};

  var MIN_PX = 64;
  var MAX_PX = 320;
  var DEFAULT_PX = 160;

  /* Значения фенотипа по умолчанию — доминантные (species.json, вид golo). */
  var DEFAULT_PHENOTYPE = {
    color: 'коричневый',
    pattern: 'полосатый',
    size: 'крупный',
    ears: 'острые'
  };

  /* Цвет глаз: в §5 прямого цвета глаз нет — предложен ближайший тёмный
   * тёплый тон палитры §5 (#5f3a22, ряд узоров). Блик — белый. */
  var EYE_COLOR = '#5f3a22';
  var EYE_HIGHLIGHT = '#ffffff';

  /* Старость: смешение с серо-бежевым #cfc6b8 (ART_STYLE.md §5, mixToGrey). */
  var AGE_GREY = '#cfc6b8';

  /* Палитры по окрасу: ключ — значение признака color из species.json.
   * Цвета только из тёплого ряда и ряда узоров ART_STYLE.md §5. */
  var PALETTES = {
    'коричневый': {
      body: '#b06a3f', belly: '#e0b184', outline: '#5f3a22',
      pattern: '#5f3a22', tail: '#8f5a3c'
    },
    'белый': {
      body: '#d9c2a3', belly: '#e8cfae', outline: '#8f5a3c',
      pattern: '#7a4a2b', tail: '#b06a3f'
    },
    /* Фаза 7b: палевый (неполное доминирование, Aa). Тело — тёплый
     * золотистый hex тёплого ряда §5, между коричневым и белым. */
    'палевый': {
      body: '#c98a5b', belly: '#e0b184', outline: '#8f5a3c',
      pattern: '#7a4a2b', tail: '#b06a3f'
    }
  };

  /* Масштаб группы по размеру. */
  var SCALES = { 'крупный': 1.0, 'мелкий': 0.66 };

  /* Параметры стадий по ART_STYLE.md §6. Значения по умолчанию; если в
   * актуальном конфиге вида golo есть поле lifeStages (species.json /
   * вшитая копия genome.js) — используются они. */
  var DEFAULT_STAGES = {
    baby:  { scale: 0.72, headScale: 1.25, earTilt: 0,  patternOpacity: 0.45,
             coatMix: 0.25, tailDrop: 0, eyeState: 'open-big' },
    adult: { scale: 1.0,  headScale: 1.0,  earTilt: 0,  patternOpacity: 1.0,
             coatMix: 0.0,  tailDrop: 0, eyeState: 'open' },
    old:   { scale: 0.95, headScale: 1.0,  earTilt: 28, patternOpacity: 0.45,
             coatMix: 0.65, tailDrop: 6, eyeState: 'squint' }
  };

  var clipSeq = 0;

  function paletteFor(colorValue) {
    return PALETTES[colorValue] || PALETTES[DEFAULT_PHENOTYPE.color];
  }

  /** Фенотип с подменой отсутствующих/пустых значений на доминантные. */
  function normalizePhenotype(phenotype) {
    var src = (phenotype && typeof phenotype === 'object') ? phenotype : {};
    var ph = {};
    Object.keys(DEFAULT_PHENOTYPE).forEach(function (key) {
      var v = src[key];
      ph[key] = (typeof v === 'string' && v) ? v : DEFAULT_PHENOTYPE[key];
    });
    return ph;
  }

  /** Имя стадии: baby / adult / old, иначе adult. */
  function stageNameOf(stage) {
    return (typeof stage === 'string' && DEFAULT_STAGES[stage]) ? stage : 'adult';
  }

  /** Параметры стадии (из конфига вида golo, если есть, иначе §6 по умолчанию). */
  function stageFor(name) {
    try {
      var gm = g.core && g.core.genome;
      var sp = (gm && typeof gm.getSpecies === 'function') ? gm.getSpecies('golo') : null;
      if (sp && sp.lifeStages && sp.lifeStages[name]) return sp.lifeStages[name];
    } catch (e) { /* конфига нет — значения по умолчанию */ }
    return DEFAULT_STAGES[name];
  }

  /* ===== mixToGrey: смешение цвета с #cfc6b8 в доле t (0..1), §5 ===== */

  function parseHex(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(hex));
    if (!m) return [0, 0, 0];
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function toHex(r, gr, b) {
    function c(v) { return ('0' + v.toString(16)).slice(-2); }
    return '#' + c(r) + c(gr) + c(b);
  }

  function mixToGrey(hex, t) {
    var n = Number(t);
    if (!isFinite(n)) n = 0;
    n = Math.min(1, Math.max(0, n));
    if (n === 0) return String(hex);
    var a = parseHex(hex);
    var b = parseHex(AGE_GREY);
    function lerp(i) { return Math.round(a[i] + (b[i] - a[i]) * n); }
    return toHex(lerp(0), lerp(1), lerp(2));
  }

  /* ===== Части (копия assets/parts/*.svg, заливки — из палитры) ===== */

  function partTail(p) {
    return '<path d="M74 58 Q94 52 90 34" fill="none" stroke="' + p.tail +
      '" stroke-width="6" stroke-linecap="round"/>';
  }

  function partEarsSharp(p) {
    return '<polygon points="33,36 38,12 47,30" fill="' + p.body + '" stroke="' +
      p.outline + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<polygon points="67,36 62,12 53,30" fill="' + p.body + '" stroke="' +
      p.outline + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<polygon points="37,32 40,20 45,29" fill="' + p.belly + '"/>' +
      '<polygon points="63,32 60,20 55,29" fill="' + p.belly + '"/>';
  }

  function partEarsRound(p) {
    return '<circle cx="34" cy="30" r="10" fill="' + p.body + '" stroke="' + p.outline + '" stroke-width="2"/>' +
      '<circle cx="66" cy="30" r="10" fill="' + p.body + '" stroke="' + p.outline + '" stroke-width="2"/>' +
      '<circle cx="34" cy="30" r="5" fill="' + p.belly + '"/>' +
      '<circle cx="66" cy="30" r="5" fill="' + p.belly + '"/>';
  }

  function partBodyBase(p) {
    return '<ellipse cx="38" cy="79" rx="8" ry="5" fill="' + p.body + '" stroke="' +
      p.outline + '" stroke-width="2"/>' +
      '<ellipse cx="62" cy="79" rx="8" ry="5" fill="' + p.body + '" stroke="' +
      p.outline + '" stroke-width="2"/>' +
      '<ellipse cx="50" cy="55" rx="26" ry="24" fill="' + p.body + '" stroke="' +
      p.outline + '" stroke-width="2.5"/>';
  }

  /* Морда: животик + глаза (состояние по стадии §6) + рот. */
  function partBodyFace(p, eyeState) {
    var s = '<ellipse cx="50" cy="63" rx="14" ry="11" fill="' + p.belly + '"/>';
    if (eyeState === 'open-big') {
      s += '<circle cx="41" cy="48" r="5" fill="' + p.eye + '"/>' +
        '<circle cx="59" cy="48" r="5" fill="' + p.eye + '"/>' +
        '<circle cx="42.6" cy="46.2" r="1.6" fill="' + p.eyeHighlight + '"/>' +
        '<circle cx="60.6" cy="46.2" r="1.6" fill="' + p.eyeHighlight + '"/>';
    } else if (eyeState === 'squint') {
      s += '<ellipse cx="41" cy="48.5" rx="4" ry="1.8" fill="' + p.eye + '"/>' +
        '<ellipse cx="59" cy="48.5" rx="4" ry="1.8" fill="' + p.eye + '"/>';
    } else { /* open (adult) */
      s += '<circle cx="41" cy="48" r="4" fill="' + p.eye + '"/>' +
        '<circle cx="59" cy="48" r="4" fill="' + p.eye + '"/>' +
        '<circle cx="42.5" cy="46.5" r="1.3" fill="' + p.eyeHighlight + '"/>' +
        '<circle cx="60.5" cy="46.5" r="1.3" fill="' + p.eyeHighlight + '"/>';
    }
    s += '<path d="M46 58 Q50 61 54 58" fill="none" stroke="' + p.eye +
      '" stroke-width="1.5" stroke-linecap="round"/>';
    return s;
  }

  function partStripes(p, opacity) {
    clipSeq += 1;
    var id = 'gl-body-clip-' + clipSeq;
    var op = (typeof opacity === 'number' && opacity < 1) ? ' opacity="' + opacity + '"' : '';
    return '<clipPath id="' + id + '">' +
      '<ellipse cx="50" cy="55" rx="24.5" ry="22.5"/>' +
      '</clipPath>' +
      '<g clip-path="url(#' + id + ')" fill="' + p.pattern + '"' + op + '>' +
      '<rect x="27" y="28" width="9" height="54"/>' +
      '<rect x="45.5" y="28" width="9" height="54"/>' +
      '<rect x="64" y="28" width="9" height="54"/>' +
      '</g>';
  }

  /** Список применённых частей (id + разметка) для фенотипа и стадии. */
  function buildParts(phen, st) {
    var p = paletteFor(phen.color);
    p = { body: p.body, belly: p.belly, outline: p.outline,
          pattern: p.pattern, tail: p.tail };
    var coat = (isFinite(Number(st.coatMix)) && Number(st.coatMix) > 0)
      ? Number(st.coatMix) : 0;
    if (coat > 0) {
      p.body = mixToGrey(p.body, coat);
      p.belly = mixToGrey(p.belly, coat);
      p.tail = mixToGrey(p.tail, coat);
    }
    p.eye = EYE_COLOR;
    p.eyeHighlight = EYE_HIGHLIGHT;

    var parts = [];

    var tail = partTail(p);
    if (st.tailDrop > 0) {
      tail = '<g transform="translate(0 ' + st.tailDrop + ')">' + tail + '</g>';
    }
    parts.push({ id: 'tail', svg: tail });

    var earSvg = (phen.ears === 'круглые') ? partEarsRound(p) : partEarsSharp(p);
    if (st.earTilt > 0) {
      earSvg = '<g transform="rotate(' + st.earTilt + ' 50 40)">' + earSvg + '</g>';
    }
    parts.push({ id: (phen.ears === 'круглые') ? 'ears-round' : 'ears-sharp', svg: earSvg });

    parts.push({ id: 'body-base', svg: partBodyBase(p) });

    if (phen.pattern === 'полосатый') {
      parts.push({ id: 'pattern-stripes', svg: partStripes(p, st.patternOpacity) });
    }

    var face = partBodyFace(p, st.eyeState);
    if (st.headScale !== 1) {
      face = '<g transform="translate(50 48) scale(' + st.headScale +
        ') translate(-50 -48)">' + face + '</g>';
    }
    parts.push({ id: 'body-face', svg: face });

    return { palette: p, parts: parts };
  }

  function clampSize(sizePx) {
    var n = Math.round(Number(sizePx));
    if (!isFinite(n) || n <= 0) { n = DEFAULT_PX; }
    return Math.min(MAX_PX, Math.max(MIN_PX, n));
  }

  /**
   * Строка SVG-существа из фенотипа.
   * @param {object} [phenotype] — { color, pattern, size, ears }
   *   (значения из species.json; пропуски — доминантные)
   * @param {number} [sizePx] — сторона в px, диапазон 64..320
   * @param {string} [stage] — стадия жизни: 'baby' | 'adult' | 'old'
   *   (умолчание 'adult'; параметры — ART_STYLE.md §6)
   * @returns {string} — готовый <svg viewBox="0 0 100 100" ...>
   */
  function renderCreature(phenotype, sizePx, stage) {
    var phen = normalizePhenotype(phenotype);
    var stName = stageNameOf(stage);
    var st = stageFor(stName);
    var built = buildParts(phen, st);
    var px = clampSize(sizePx);
    var baseScale = (typeof SCALES[phen.size] === 'number')
      ? SCALES[phen.size] : SCALES[DEFAULT_PHENOTYPE.size];
    var scale = baseScale * (isFinite(Number(st.scale)) && Number(st.scale) ? Number(st.scale) : 1);
    var label = 'существо: ' + phen.color + ', ' + phen.pattern +
      ', ' + phen.size + ', уши ' + phen.ears + ', стадия: ' + stName;
    return '<svg viewBox="0 0 100 100" width="' + px + '" height="' + px +
      '" role="img" aria-label="' + label + '">' +
      '<g transform="translate(50 52) scale(' + scale + ') translate(-50 -52)">' +
      built.parts.map(function (part) { return part.svg; }).join('') +
      '</g></svg>';
  }

  /**
   * Описатель рендера (для DOM-проверяемых тестов): какие модули
   * применены, какие цвета залиты, какой масштаб группы, стадия.
   * @param {object} [phenotype]
   * @param {string} [stage] — 'baby' | 'adult' | 'old' (умолчание 'adult')
   * @returns {{phenotype: object, stage: string, eyeState: string,
   *   modules: string[], colors: object, scale: number}}
   */
  function describePhenotypeRender(phenotype, stage) {
    var phen = normalizePhenotype(phenotype);
    var stName = stageNameOf(stage);
    var st = stageFor(stName);
    var built = buildParts(phen, st);
    var baseScale = (typeof SCALES[phen.size] === 'number')
      ? SCALES[phen.size] : SCALES[DEFAULT_PHENOTYPE.size];
    return {
      phenotype: phen,
      stage: stName,
      eyeState: st.eyeState,
      modules: built.parts.map(function (part) { return part.id; }),
      colors: {
        body: built.palette.body,
        belly: built.palette.belly,
        outline: built.palette.outline,
        pattern: built.palette.pattern,
        tail: built.palette.tail,
        eye: built.palette.eye
      },
      scale: baseScale * (isFinite(Number(st.scale)) && Number(st.scale) ? Number(st.scale) : 1)
    };
  }

  render.creature = {
    /* ===== Экспорты: window.GenoLab.render.creature ===== */
    renderCreature: renderCreature,
    describePhenotypeRender: describePhenotypeRender,
    mixToGrey: mixToGrey,
    LIMITS: { minPx: MIN_PX, maxPx: MAX_PX, defaultPx: DEFAULT_PX },
    SCALES: { 'крупный': SCALES['крупный'], 'мелкий': SCALES['мелкий'] },
    STAGES: JSON.parse(JSON.stringify(DEFAULT_STAGES)),
    EYE: { color: EYE_COLOR, highlight: EYE_HIGHLIGHT, proposed: true },
    AGE_GREY: AGE_GREY
  };
})(typeof window !== 'undefined' ? window : globalThis);
