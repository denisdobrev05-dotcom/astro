/*
 * astro.js — самостоятелен астрономически/астрологичен двигател (без външни зависимости).
 *
 * Изчислява тропически (зодиакални) еклиптични дължини на Слънце, Луна и планетите,
 * Асцендент, Среден небосвод (MC), домове по системата Placidus и основните аспекти.
 *
 * Точност: позициите на планетите се базират на приближените кеплерови елементи на JPL
 * (Standish, валидни 1800–2050) с точност до няколко дъгови минути — повече от достатъчно
 * за правилно поставяне по знаци и домове. Слънцето и Луната — по алгоритмите на Meeus
 * (Astronomical Algorithms).
 */

const Astro = (function () {
  "use strict";

  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;

  const norm360 = (x) => ((x % 360) + 360) % 360;
  const sind = (x) => Math.sin(x * DEG);
  const cosd = (x) => Math.cos(x * DEG);
  const tand = (x) => Math.tan(x * DEG);
  const asind = (x) => Math.asin(Math.max(-1, Math.min(1, x))) * RAD;
  const atan2d = (y, x) => Math.atan2(y, x) * RAD;

  // ---- Имена ----
  const SIGNS = [
    "Овен", "Телец", "Близнаци", "Рак", "Лъв", "Дева",
    "Везни", "Скорпион", "Стрелец", "Козирог", "Водолей", "Риби",
  ];
  const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
  const PLANET_GLYPHS = {
    Слънце: "☉", Луна: "☽", Меркурий: "☿", Венера: "♀", Марс: "♂",
    Юпитер: "♃", Сатурн: "♄", Уран: "♅", Нептун: "♆", Плутон: "♇",
  };

  // ---- Юлиански ден от UTC ----
  function julianDay(y, m, d, hour, min, sec) {
    const dayFrac = d + (hour + min / 60 + sec / 3600) / 24;
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + dayFrac + B - 1524.5;
  }

  // ---- Нутация (опростена) и наклон на еклиптиката ----
  function nutationAndObliquity(T) {
    const omega = 125.04452 - 1934.136261 * T;
    const L = 280.4665 + 36000.7698 * T;       // ср. дължина на Слънцето
    const Lp = 218.3165 + 481267.8813 * T;     // ср. дължина на Луната
    // Нутация в дължина (в градуси)
    const dPsi = (-17.20 * sind(omega) - 1.32 * sind(2 * L) -
      0.23 * sind(2 * Lp) + 0.21 * sind(2 * omega)) / 3600;
    const dEps = (9.20 * cosd(omega) + 0.57 * cosd(2 * L) +
      0.10 * cosd(2 * Lp) - 0.09 * cosd(2 * omega)) / 3600;
    const eps0 = 23.439291 - 0.0130042 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T;
    return { dPsi, eps: eps0 + dEps, omega };
  }

  // ---- Слънце (Meeus, видима дължина на датата) ----
  function sunLongitude(T) {
    const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
    const M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sind(M) +
      (0.019993 - 0.000101 * T) * sind(2 * M) +
      0.000289 * sind(3 * M);
    const trueLong = L0 + C;
    const omega = 125.04 - 1934.136 * T;
    return norm360(trueLong - 0.00569 - 0.00478 * sind(omega)); // видима, на датата
  }

  // ---- Луна (Meeus, гл. 47, съкратена) ----
  function moonLongitude(T, dPsi) {
    const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T +
      T * T * T / 538841 - T * T * T * T / 65194000;
    const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T +
      T * T * T / 545868 - T * T * T * T / 113065000;
    const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T * T * T / 24490000;
    const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T +
      T * T * T / 69699 - T * T * T * T / 14712000;
    const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T -
      T * T * T / 3526000 + T * T * T * T / 863310000;
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;

    // [coeff(1e-6 deg), D, M, Mp, F, степен на E]
    const terms = [
      [6288774, 0, 0, 1, 0, 0], [1274027, 2, 0, -1, 0, 0], [658314, 2, 0, 0, 0, 0],
      [213618, 0, 0, 2, 0, 0], [-185116, 0, 1, 0, 0, 1], [-114332, 0, 0, 0, 2, 0],
      [58793, 2, 0, -2, 0, 0], [57066, 2, -1, -1, 0, 1], [53322, 2, 0, 1, 0, 0],
      [45758, 2, -1, 0, 0, 1], [-40923, 0, 1, -1, 0, 1], [-34720, 1, 0, 0, 0, 0],
      [-30383, 0, 1, 1, 0, 1], [15327, 2, 0, 0, -2, 0], [-12528, 0, 0, 1, 2, 0],
      [10980, 0, 0, 1, -2, 0], [10675, 4, 0, -1, 0, 0], [10034, 0, 0, 3, 0, 0],
      [8548, 4, 0, -2, 0, 0], [-7888, 2, 1, -1, 0, 1], [-6766, 2, 1, 0, 0, 1],
      [-5163, 1, 0, -1, 0, 0], [4987, 1, 1, 0, 0, 1], [4036, 2, -1, 1, 0, 1],
      [3994, 2, 0, 2, 0, 0], [3861, 4, 0, 0, 0, 0], [3665, 2, 0, -3, 0, 0],
      [-2689, 0, 1, -2, 0, 1], [-2602, 2, 0, -1, 2, 0], [2390, 2, -1, -2, 0, 1],
      [-2348, 1, 0, 1, 0, 0], [2236, 2, -2, 0, 0, 2], [-2120, 0, 1, 2, 0, 1],
      [-2069, 0, 2, 0, 0, 2], [2048, 2, -2, -1, 0, 2], [-1773, 2, 0, 1, -2, 0],
      [-1595, 2, 0, 0, 2, 0], [1215, 4, -1, -1, 0, 1], [-1110, 0, 0, 2, 2, 0],
    ];
    let sum = 0;
    for (const t of terms) {
      const arg = t[1] * D + t[2] * M + t[3] * Mp + t[4] * F;
      let coeff = t[0];
      if (t[5] === 1) coeff *= E;
      else if (t[5] === 2) coeff *= E * E;
      sum += coeff * sind(arg);
    }
    return norm360(Lp + sum / 1e6 + dPsi);
  }

  // ---- Планети: приближени кеплерови елементи (JPL/Standish, 1800–2050) ----
  // [a, e, I, L, longPeri(ϖ), longNode(Ω)] и техните производни за век.
  const ELEM = {
    Меркурий: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593,
      0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
    Венера: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255,
      0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
    Земя: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0,
      0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
    Марс: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
      0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
    Юпитер: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
      -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
    Сатурн: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448,
      -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
    Уран: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503,
      -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
    Нептун: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574,
      0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
    Плутон: [39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684,
      -0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482],
  };

  function solveKepler(Mdeg, e) {
    Mdeg = ((Mdeg + 180) % 360 + 360) % 360 - 180; // в [-180,180]
    const estar = RAD * e;
    let E = Mdeg + estar * sind(Mdeg);
    for (let i = 0; i < 10; i++) {
      const dM = Mdeg - (E - estar * sind(E));
      const dE = dM / (1 - e * cosd(E));
      E += dE;
      if (Math.abs(dE) < 1e-9) break;
    }
    return E;
  }

  // Хелиоцентрични правоъгълни координати (J2000 еклиптика, AU)
  function heliocentric(el, T) {
    const a = el[0] + el[6] * T;
    const e = el[1] + el[7] * T;
    const I = el[2] + el[8] * T;
    const L = el[3] + el[9] * T;
    const wbar = el[4] + el[10] * T;
    const Om = el[5] + el[11] * T;
    const w = wbar - Om;            // аргумент на перихелия
    const M = L - wbar;            // средна аномалия
    const E = solveKepler(M, e);
    const xp = a * (cosd(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * sind(E);
    const cw = cosd(w), sw = sind(w), cO = cosd(Om), sO = sind(Om), cI = cosd(I), sI = sind(I);
    const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
    const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
    const z = (sw * sI) * xp + (cw * sI) * yp;
    return [x, y, z];
  }

  function planetLongitude(name, T, precession, dPsi) {
    const p = heliocentric(ELEM[name], T);
    const earth = heliocentric(ELEM["Земя"], T);
    const gx = p[0] - earth[0], gy = p[1] - earth[1];
    const lonJ2000 = atan2d(gy, gx);          // геоцентрична еклиптична дължина (J2000)
    return norm360(lonJ2000 + precession + dPsi); // на датата + нутация
  }

  // ---- Звездно време, Асцендент, MC ----
  function gmst(JD, T) {
    return norm360(280.46061837 + 360.98564736629 * (JD - 2451545.0) +
      0.000387933 * T * T - T * T * T / 38710000);
  }

  function eclLonFromRA(ra, eps) {
    let lon = atan2d(sind(ra), cosd(ra) * cosd(eps));
    return norm360(lon);
  }

  function placidusCusps(ramc, eps, lat) {
    // Десет = MC, Едно = Асцендент; останалите чрез метода на полудъгите.
    const cusps = new Array(13).fill(0);
    const mc = eclLonFromRA(ramc, eps);
    const asc = norm360(atan2d(cosd(ramc), -(sind(ramc) * cosd(eps) + tand(lat) * sind(eps))));
    cusps[10] = mc;
    cusps[1] = asc;
    cusps[4] = norm360(mc + 180);
    cusps[7] = norm360(asc + 180);

    // Итеративно за междинните куспиди.
    function intermediate(raStart, f, below) {
      let ra = raStart;
      for (let i = 0; i < 12; i++) {
        const lon = eclLonFromRA(ra, eps);
        const decl = asind(sind(eps) * sind(lon));
        let ad = tand(lat) * tand(decl);
        ad = asind(Math.max(-1, Math.min(1, ad)));
        if (!below) {
          ra = ramc + f * (90 + ad);            // полудневна дъга
        } else {
          ra = ramc + 180 - f * (90 - ad);      // полунощна дъга
        }
      }
      return eclLonFromRA(ra, eps);
    }
    cusps[11] = intermediate(ramc + 30, 1 / 3, false);
    cusps[12] = intermediate(ramc + 60, 2 / 3, false);
    cusps[2] = intermediate(ramc + 120, 2 / 3, true);
    cusps[3] = intermediate(ramc + 150, 1 / 3, true);
    cusps[5] = norm360(cusps[11] + 180);
    cusps[6] = norm360(cusps[12] + 180);
    cusps[8] = norm360(cusps[2] + 180);
    cusps[9] = norm360(cusps[3] + 180);
    return cusps.slice(1); // индекси 0..11 = домове 1..12
  }

  function houseOf(lon, cusps) {
    for (let i = 0; i < 12; i++) {
      const a = cusps[i];
      const b = cusps[(i + 1) % 12];
      let span = norm360(b - a);
      let rel = norm360(lon - a);
      if (rel < span) return i + 1;
    }
    return 1;
  }

  // ---- Аспекти ----
  const ASPECTS = [
    { name: "съединение", angle: 0, orb: 8, glyph: "☌" },
    { name: "секстил", angle: 60, orb: 5, glyph: "✶" },
    { name: "квадрат", angle: 90, orb: 6, glyph: "□" },
    { name: "тригон", angle: 120, orb: 7, glyph: "△" },
    { name: "опозиция", angle: 180, orb: 8, glyph: "☍" },
  ];

  function computeAspects(planets) {
    const out = [];
    const names = Object.keys(planets);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        let diff = Math.abs(planets[names[i]].lon - planets[names[j]].lon);
        if (diff > 180) diff = 360 - diff;
        for (const asp of ASPECTS) {
          const orb = Math.abs(diff - asp.angle);
          if (orb <= asp.orb) {
            out.push({ a: names[i], b: names[j], aspect: asp.name, glyph: asp.glyph, orb: orb });
            break;
          }
        }
      }
    }
    out.sort((x, y) => x.orb - y.orb);
    return out;
  }

  // ---- Главна функция ----
  // input: { year, month, day, hour, minute, lat, lon }  — час/мин в UTC, lon изток+
  function computeChart(input) {
    const JD = julianDay(input.year, input.month, input.day, input.hour, input.minute, 0);
    const T = (JD - 2451545.0) / 36525;
    const { dPsi, eps } = nutationAndObliquity(T);
    // обща прецесия в дължина (J2000 -> на датата), градуси
    const precession = (5028.796195 * T + 1.1054348 * T * T) / 3600;

    const planets = {};
    planets["Слънце"] = { lon: sunLongitude(T) };
    planets["Луна"] = { lon: moonLongitude(T, dPsi) };
    for (const name of ["Меркурий", "Венера", "Марс", "Юпитер", "Сатурн", "Уран", "Нептун", "Плутон"]) {
      planets[name] = { lon: planetLongitude(name, T, precession, dPsi) };
    }

    const st = gmst(JD, T) + dPsi * cosd(eps); // видимо звездно време по Гринуич
    const ramc = norm360(st + input.lon);      // местно звездно време = RAMC
    const cusps = placidusCusps(ramc, eps, input.lat);
    const asc = cusps[0];
    const mc = cusps[9];

    // обогатяване на всяка планета със знак/градус/дом
    for (const name of Object.keys(planets)) {
      const lon = planets[name].lon;
      const sign = Math.floor(lon / 30);
      planets[name].sign = sign;
      planets[name].signName = SIGNS[sign];
      planets[name].degInSign = lon - sign * 30;
      planets[name].house = houseOf(lon, cusps);
      planets[name].glyph = PLANET_GLYPHS[name];
      planets[name].retro = false; // приближение — ретроградността не се означава
    }

    const ascSign = Math.floor(asc / 30);
    const mcSign = Math.floor(mc / 30);

    return {
      julianDay: JD,
      planets,
      cusps,
      asc: { lon: asc, sign: ascSign, signName: SIGNS[ascSign], degInSign: asc - ascSign * 30 },
      mc: { lon: mc, sign: mcSign, signName: SIGNS[mcSign], degInSign: mc - mcSign * 30 },
      aspects: computeAspects(planets),
    };
  }

  // ---- Транзити (текущи позиции спрямо наталната карта) ----
  function jdFromDate(d) {
    return julianDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
      d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
  }
  function jdToDate(jd) { return new Date((jd - 2440587.5) * 86400000); }

  function allLongitudes(JD) {
    const T = (JD - 2451545.0) / 36525;
    const { dPsi } = nutationAndObliquity(T);
    const precession = (5028.796195 * T + 1.1054348 * T * T) / 3600;
    const lon = {};
    lon["Слънце"] = sunLongitude(T);
    lon["Луна"] = moonLongitude(T, dPsi);
    for (const name of ["Меркурий", "Венера", "Марс", "Юпитер", "Сатурн", "Уран", "Нептун", "Плутон"]) {
      lon[name] = planetLongitude(name, T, precession, dPsi);
    }
    return lon;
  }

  // Позиции на планетите за даден момент (без домове) — геоцентрични, не зависят от място
  function transitPositions(date) {
    const lon = allLongitudes(jdFromDate(date));
    const planets = {};
    for (const name of Object.keys(lon)) {
      const l = lon[name];
      const sign = Math.floor(l / 30);
      planets[name] = { lon: l, sign, signName: SIGNS[sign], degInSign: l - sign * 30, glyph: PLANET_GLYPHS[name] };
    }
    return planets;
  }

  // Аспекти на транзитните планети към наталните (по-тесни орбиси)
  function transitAspects(natalPlanets, transitPlanets) {
    const orbs = { "съединение": 3, "опозиция": 3, "тригон": 2.5, "квадрат": 2.5, "секстил": 2 };
    const out = [];
    for (const tName of Object.keys(transitPlanets)) {
      for (const nName of Object.keys(natalPlanets)) {
        let diff = Math.abs(transitPlanets[tName].lon - natalPlanets[nName].lon);
        if (diff > 180) diff = 360 - diff;
        for (const asp of ASPECTS) {
          const orb = Math.abs(diff - asp.angle);
          if (orb <= (orbs[asp.name] || 2)) {
            out.push({ transit: tName, natal: nName, aspect: asp.name, glyph: asp.glyph, orb });
            break;
          }
        }
      }
    }
    out.sort((a, b) => a.orb - b.orb);
    return out;
  }

  // ---- Лунни фази ----
  function phaseAngleJD(JD) {
    const T = (JD - 2451545.0) / 36525;
    const { dPsi } = nutationAndObliquity(T);
    return norm360(moonLongitude(T, dPsi) - sunLongitude(T));
  }
  function moonPhase(date) {
    const angle = phaseAngleJD(jdFromDate(date));
    const illum = (1 - cosd(angle)) / 2;
    return { angle, illumination: illum, ageDays: (angle / 360) * 29.530588853, waxing: angle < 180 };
  }
  function nextPhase(fromJD, target) {
    const rate = 12.190749; // средно градуси/ден за разликата Луна–Слънце
    let delta = norm360(target - phaseAngleJD(fromJD));
    if (delta < 1) delta += 360;
    let jd = fromJD + delta / rate;
    for (let i = 0; i < 12; i++) {
      let g = phaseAngleJD(jd) - target;
      g = ((g + 180) % 360 + 360) % 360 - 180;
      jd -= g / rate;
    }
    return jd;
  }
  function upcomingPhases(date) {
    const fromJD = jdFromDate(date);
    const targets = [
      { name: "Новолуние", emoji: "🌑", t: 0 },
      { name: "Първа четвърт", emoji: "🌓", t: 90 },
      { name: "Пълнолуние", emoji: "🌕", t: 180 },
      { name: "Последна четвърт", emoji: "🌗", t: 270 },
    ];
    const list = targets.map((o) => ({ name: o.name, emoji: o.emoji, date: jdToDate(nextPhase(fromJD, o.t)) }));
    list.sort((a, b) => a.date - b.date);
    return list;
  }

  return {
    computeChart,
    julianDay,
    SIGNS, SIGN_GLYPHS, PLANET_GLYPHS,
    norm360,
    transitPositions, transitAspects,
    moonPhase, upcomingPhases,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Astro;
