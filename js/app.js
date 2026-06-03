/* app.js — потребителски интерфейс, навигация, локално съхранение и визуализация. */
(function () {
  "use strict";

  const STORE_KEY = "astro.birth.v1";
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let chart = null;     // текущата изчислена карта
  let profile = null;   // запазените рождени данни
  let showTransitOverlay = false; // наслагване на днешните транзити върху колелото

  function openPlanet(name) {
    const d = document.getElementById("pl-" + name);
    if (!d) return;
    d.open = true;
    d.classList.add("flash");
    d.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => d.classList.remove("flash"), 1500);
  }

  // ---------- Съхранение ----------
  function loadProfile() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; }
  }
  function saveProfile(p) { localStorage.setItem(STORE_KEY, JSON.stringify(p)); }
  function clearProfile() { localStorage.removeItem(STORE_KEY); }

  // ---------- Изчисление от профил ----------
  function computeFromProfile(p) {
    const [y, m, d] = p.date.split("-").map(Number);
    const [hh, mm] = (p.time || "12:00").split(":").map(Number);
    const utc = BgTime.toUTC(y, m, d, hh, mm, p.tz || "auto");
    return Astro.computeChart({
      year: utc.year, month: utc.month, day: utc.day,
      hour: utc.hour, minute: utc.minute, lat: p.lat, lon: p.lon,
    });
  }

  // ---------- Форма ----------
  function fillCities() {
    const sel = $("#f-city");
    CITIES.forEach((c, i) => {
      const o = document.createElement("option");
      o.value = String(i); o.textContent = c.name;
      sel.appendChild(o);
    });
    const manual = document.createElement("option");
    manual.value = "manual"; manual.textContent = "Друго място (ръчно въвеждане)";
    sel.appendChild(manual);
  }

  function onCityChange() {
    const v = $("#f-city").value;
    $("#manual-coords").classList.toggle("hidden", v !== "manual");
  }

  function onUnknownTime() {
    const unknown = $("#f-time-unknown").checked;
    $("#f-time").disabled = unknown;
    $("#time-warn").classList.toggle("hidden", !unknown);
  }

  function prefillForm(p) {
    if (!p) return;
    if (p.name) $("#f-name").value = p.name;
    if (p.date) $("#f-date").value = p.date;
    if (p.time) $("#f-time").value = p.time;
    if (p.tz) $("#f-tz").value = p.tz;
    if (p.cityIndex != null && p.cityIndex !== "manual") {
      $("#f-city").value = String(p.cityIndex);
    } else if (p.lat != null) {
      $("#f-city").value = "manual";
      $("#f-lat").value = p.lat; $("#f-lon").value = p.lon;
    }
    onCityChange();
  }

  function readForm() {
    const date = $("#f-date").value;
    if (!date) { alert("Моля, въведете дата на раждане."); return null; }
    const unknown = $("#f-time-unknown").checked;
    const time = unknown ? "12:00" : ($("#f-time").value || "12:00");
    const cityVal = $("#f-city").value;
    let lat, lon, placeName, cityIndex = null;
    if (cityVal === "manual") {
      lat = parseFloat($("#f-lat").value);
      lon = parseFloat($("#f-lon").value);
      if (isNaN(lat) || isNaN(lon)) { alert("Моля, въведете валидни географски координати."); return null; }
      placeName = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
    } else {
      const c = CITIES[Number(cityVal)];
      lat = c.lat; lon = c.lon; placeName = c.name; cityIndex = Number(cityVal);
    }
    return {
      name: $("#f-name").value.trim(),
      date, time, timeUnknown: unknown,
      tz: $("#f-tz").value,
      lat, lon, placeName, cityIndex,
    };
  }

  function onSubmit(e) {
    e.preventDefault();
    const p = readForm();
    if (!p) return;
    profile = p;
    saveProfile(p);
    chart = computeFromProfile(p);
    renderAll();
    showScreen("today");
  }

  // ---------- Навигация ----------
  function showScreen(name) {
    $$(".screen").forEach((s) => s.classList.toggle("active", s.dataset.screen === name));
    $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.go === name));
    document.scrollingElement.scrollTop = 0;
  }

  // ---------- Рендиране ----------
  function renderAll() {
    if (!chart) return;
    renderToday();
    renderMoon();
    renderChart();
    $(".bottom-nav").classList.remove("hidden");
  }

  function fmtDate(d) {
    return d.toLocaleDateString("bg-BG", { weekday: "long", day: "numeric", month: "long" }) +
      ", " + d.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
  }

  function greeting(p) {
    const h = new Date().getHours();
    const part = h < 5 ? "Добра нощ" : h < 12 ? "Добро утро" : h < 18 ? "Добър ден" : "Добър вечер";
    return p && p.name ? `${part}, ${esc(p.name)}` : part;
  }

  function renderToday() {
    const dom = Interp.dominance(chart);
    const msg = Daily.messageFor(new Date(), chart, dom);
    const sun = chart.planets["Слънце"];
    const moon = chart.planets["Луна"];
    const dateStr = new Date().toLocaleDateString("bg-BG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    $("#today").innerHTML = `
      <div class="today-greet">${greeting(profile)}</div>
      <div class="today-date">${dateStr}</div>
      <div class="today-card">
        <div class="today-msg">${esc(msg.main)}</div>
        <div class="today-note">${esc(msg.note)}</div>
      </div>
      <div class="today-mini">
        <div class="mini"><span class="mini-glyph">☉</span><span>Слънце в ${sun.signName}</span></div>
        <div class="mini"><span class="mini-glyph">☽</span><span>Луна в ${moon.signName}</span></div>
        <div class="mini"><span class="mini-glyph">↑</span><span>Асцендент ${chart.asc.signName}</span></div>
      </div>
      <div id="transit-today"></div>
      <button class="link-btn" id="go-chart">Виж пълната си натална карта →</button>
    `;
    $("#go-chart").addEventListener("click", () => showScreen("chart"));
    renderTransitToday($("#transit-today"));
  }

  function renderTransitToday(host) {
    const tp = Astro.transitPositions(new Date());
    const aspects = Astro.transitAspects(chart.planets, tp).slice(0, 5);
    const headline = Interp.transitHeadline(aspects);
    let rows = "";
    for (const a of aspects) {
      const tone = (a.aspect === "квадрат" || a.aspect === "опозиция") ? "tense"
        : (a.aspect === "съединение" ? "neutral" : "harmon");
      rows += `<details class="transit-item ${tone}">
        <summary>
          <span class="t-glyph">${chart.planets[a.transit].glyph}</span>
          <span class="t-line">${a.transit} ${a.glyph} ${a.natal}</span>
          <span class="t-asp">${a.aspect}</span>
        </summary>
        <div class="t-body">${esc(Interp.transitText(a.transit, a.natal, a.aspect))}</div>
      </details>`;
    }
    host.innerHTML = `
      <h2 class="section-title">Какво се случва за теб днес</h2>
      <p class="section-sub">Къде са планетите днес спрямо твоята натална карта.</p>
      <div class="transit-headline">${esc(headline)}</div>
      <div class="transit-list">${rows || '<p class="muted small">Днес няма тесни транзитни аспекти.</p>'}</div>`;
  }

  // ---------- Лунен календар ----------
  function renderMoon() {
    const now = new Date();
    const ph = Astro.moonPhase(now);
    const info = Interp.moonPhaseInfo(ph.angle);
    const up = Astro.upcomingPhases(now);
    const pct = Math.round(ph.illumination * 100);
    const frac = ph.angle / 360;             // дял от лунния цикъл
    const R = 86, C = 2 * Math.PI * R;
    const dash = (frac * C).toFixed(1);

    const phaseRows = up.map((p) => {
      const days = Math.max(0, Math.round((p.date - now) / 86400000));
      const when = days === 0 ? "днес" : days === 1 ? "утре" : `след ${days} дни`;
      return `<div class="phase-row">
        <span class="ph-emoji">${p.emoji}</span>
        <span class="ph-name">${p.name}</span>
        <span class="ph-date">${fmtDate(p.date)} · <em>${when}</em></span>
      </div>`;
    }).join("");

    $("#moon-view").innerHTML = `
      <h1 class="moon-h1">Лунен календар</h1>
      <div class="moon-hero">
        <svg class="moon-ring" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="${R}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3"/>
          <circle cx="100" cy="100" r="${R}" fill="none" stroke="url(#mg)" stroke-width="3"
            stroke-linecap="round" stroke-dasharray="${dash} ${(C - dash).toFixed(1)}"
            transform="rotate(-90 100 100)"/>
          <defs><linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#e8cf86"/><stop offset="1" stop-color="#8a6cff"/>
          </linearGradient></defs>
        </svg>
        <div class="moon-emoji">${info.emoji}</div>
      </div>
      <div class="moon-name">${info.name}</div>
      <div class="moon-illum">${pct}% осветеност · ${ph.ageDays.toFixed(0)} дни от новолунието</div>
      <div class="moon-meaning">${esc(info.meaning)}</div>
      <h2 class="section-title">Следващи фази</h2>
      <div class="phase-list">${phaseRows}</div>
    `;
  }

  // --- SVG колело ---
  const ELEMENT_COLORS = {
    "Огън": "#e0533d", "Земя": "#5b8c5a", "Въздух": "#d8b13c", "Вода": "#3f7bbf",
  };

  function polar(cx, cy, r, angleDeg) {
    const a = angleDeg * Math.PI / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  }
  // зодиакална дължина -> екранен ъгъл (Асцендент вляво, обратно на часовниковата стрелка)
  function lonToAngle(lon) { return 180 + (lon - chart.asc.lon); }

  function renderWheel(showTransits) {
    const size = 380, cx = size / 2, cy = size / 2;
    const rTransit = 174, rOuter = 152, rZodiac = 130, rHouse = 130, rInner = 84, rPlanet = 108;
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("class", "wheel");

    function arcPath(r1, r2, a0, a1) {
      const [x0, y0] = polar(cx, cy, r2, a0);
      const [x1, y1] = polar(cx, cy, r2, a1);
      const [x2, y2] = polar(cx, cy, r1, a1);
      const [x3, y3] = polar(cx, cy, r1, a0);
      const large = ((a1 - a0) % 360 + 360) % 360 > 180 ? 1 : 0;
      return `M ${x0} ${y0} A ${r2} ${r2} 0 ${large} 0 ${x1} ${y1} L ${x2} ${y2} A ${r1} ${r1} 0 ${large} 1 ${x3} ${y3} Z`;
    }
    function el(tag, attrs, parent) {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      (parent || svg).appendChild(n);
      return n;
    }

    // зодиакален пръстен — 12 сегмента
    for (let i = 0; i < 12; i++) {
      const a0 = lonToAngle(i * 30), a1 = lonToAngle(i * 30 + 30);
      const color = ELEMENT_COLORS[Interp.SIGN[i].el];
      el("path", { d: arcPath(rZodiac, rOuter, a0, a1), fill: color, "fill-opacity": "0.22", stroke: "rgba(255,255,255,0.12)", "stroke-width": "1" });
      const [gx, gy] = polar(cx, cy, (rZodiac + rOuter) / 2, lonToAngle(i * 30 + 15));
      const t = el("text", { x: gx, y: gy, fill: color, "font-size": "15", "text-anchor": "middle", "dominant-baseline": "central", "font-weight": "bold" });
      t.textContent = Astro.SIGN_GLYPHS[i];
    }

    // вътрешен кръг
    el("circle", { cx, cy, r: rInner, fill: "rgba(10,8,30,0.5)", stroke: "rgba(255,255,255,0.10)", "stroke-width": "1" });
    el("circle", { cx, cy, r: rZodiac, fill: "none", stroke: "rgba(255,255,255,0.12)", "stroke-width": "1" });

    // куспиди на домовете
    for (let i = 0; i < 12; i++) {
      const a = lonToAngle(chart.cusps[i]);
      const [x1, y1] = polar(cx, cy, rInner, a);
      const [x2, y2] = polar(cx, cy, rHouse, a);
      const major = (i % 3 === 0); // ASC/IC/DSC/MC
      el("line", { x1, y1, x2, y2, stroke: major ? "rgba(212,177,60,0.7)" : "rgba(255,255,255,0.18)", "stroke-width": major ? "1.6" : "0.8" });
      // номер на дома
      const mid = chart.cusps[i] + Astro.norm360(chart.cusps[(i + 1) % 12] - chart.cusps[i]) / 2;
      const [nx, ny] = polar(cx, cy, rInner - 12, lonToAngle(mid));
      const tn = el("text", { x: nx, y: ny, fill: "rgba(255,255,255,0.45)", "font-size": "9", "text-anchor": "middle", "dominant-baseline": "central" });
      tn.textContent = String(i + 1);
    }

    // ASC / MC етикети
    function axisLabel(lon, label) {
      const [x, y] = polar(cx, cy, rOuter + 9, lonToAngle(lon));
      const t = el("text", { x, y, fill: "#d4b13c", "font-size": "10", "text-anchor": "middle", "dominant-baseline": "central", "font-weight": "bold" });
      t.textContent = label;
    }
    axisLabel(chart.asc.lon, "ASC");
    axisLabel(chart.mc.lon, "MC");

    // аспектни линии
    const names = Object.keys(chart.planets);
    const aspColor = { "тригон": "#3f7bbf", "секстил": "#3f7bbf", "съединение": "#d4b13c", "квадрат": "#e0533d", "опозиция": "#e0533d" };
    for (const a of chart.aspects) {
      const [x1, y1] = polar(cx, cy, rInner - 2, lonToAngle(chart.planets[a.a].lon));
      const [x2, y2] = polar(cx, cy, rInner - 2, lonToAngle(chart.planets[a.b].lon));
      el("line", { x1, y1, x2, y2, stroke: aspColor[a.aspect] || "#888", "stroke-width": "0.8", "stroke-opacity": "0.5" });
    }

    // планети — с леко разреждане при припокриване
    const items = names.map((n) => ({ name: n, lon: chart.planets[n].lon, glyph: chart.planets[n].glyph }));
    items.sort((p, q) => lonToAngle(p.lon) - lonToAngle(q.lon));
    let lastA = -999, ringToggle = 0;
    for (const it of items) {
      let a = lonToAngle(it.lon);
      let r = rPlanet;
      if (Math.abs(a - lastA) < 9) { ringToggle++; r = rPlanet - (ringToggle % 2 ? 18 : 0); }
      else { ringToggle = 0; }
      lastA = a;
      const [px, py] = polar(cx, cy, r, a);
      // тире от пръстена към планетата
      const [lx, ly] = polar(cx, cy, rZodiac, a);
      el("line", { x1: lx, y1: ly, x2: px, y2: py, stroke: "rgba(255,255,255,0.15)", "stroke-width": "0.7" });
      const t = el("text", { x: px, y: py, fill: "#f4f1ff", "font-size": "15", "text-anchor": "middle", "dominant-baseline": "central" });
      t.textContent = it.glyph;
      t.style.cursor = "pointer";
      t.addEventListener("click", () => openPlanet(it.name));
      const deg = Math.floor(chart.planets[it.name].degInSign);
      const [dx, dy] = polar(cx, cy, r - 13, a);
      const td = el("text", { x: dx, y: dy, fill: "rgba(255,255,255,0.5)", "font-size": "8", "text-anchor": "middle", "dominant-baseline": "central" });
      td.textContent = deg + "°";
    }

    // транзитен пръстен — днешните планети около наталната карта
    if (showTransits) {
      el("circle", { cx, cy, r: rTransit, fill: "none", stroke: "rgba(111,211,224,0.25)", "stroke-width": "1", "stroke-dasharray": "2 3" });
      const tp = Astro.transitPositions(new Date());
      const titems = Object.keys(tp).map((n) => ({ name: n, lon: tp[n].lon, glyph: tp[n].glyph, deg: tp[n].degInSign }));
      titems.sort((p, q) => lonToAngle(p.lon) - lonToAngle(q.lon));
      let lastT = -999, tog = 0;
      for (const it of titems) {
        const a = lonToAngle(it.lon);
        let r = rTransit;
        if (Math.abs(a - lastT) < 9) { tog++; r = rTransit - (tog % 2 ? 15 : 0); } else { tog = 0; }
        lastT = a;
        const [mx, my] = polar(cx, cy, rOuter, a);
        const [px, py] = polar(cx, cy, r, a);
        el("line", { x1: mx, y1: my, x2: px, y2: py, stroke: "rgba(111,211,224,0.25)", "stroke-width": "0.7" });
        const t = el("text", { x: px, y: py, fill: "#6fd3e0", "font-size": "13", "text-anchor": "middle", "dominant-baseline": "central" });
        t.textContent = it.glyph;
      }
    }
    return svg;
  }

  function renderChart() {
    const c = chart;
    const host = $("#chart-view");
    host.innerHTML = "";

    // заглавна тройка
    const head = document.createElement("div");
    head.className = "chart-head";
    head.innerHTML = `
      <div class="trip">
        <div class="trip-item"><div class="trip-glyph">☉</div><div class="trip-label">Слънце</div><div class="trip-sign">${c.planets["Слънце"].signName}</div></div>
        <div class="trip-item"><div class="trip-glyph">☽</div><div class="trip-label">Луна</div><div class="trip-sign">${c.planets["Луна"].signName}</div></div>
        <div class="trip-item"><div class="trip-glyph">↑</div><div class="trip-label">Асцендент</div><div class="trip-sign">${c.asc.signName}</div></div>
      </div>`;
    host.appendChild(head);

    // колело + превключвател за транзити
    const wheelBox = document.createElement("div");
    wheelBox.className = "wheel-box";
    wheelBox.appendChild(renderWheel(showTransitOverlay));
    host.appendChild(wheelBox);

    const toggle = document.createElement("button");
    toggle.className = "toggle-btn" + (showTransitOverlay ? " on" : "");
    toggle.innerHTML = showTransitOverlay
      ? "● Транзитите днес са показани (синьо отвън)"
      : "○ Покажи транзитите днес върху картата";
    toggle.addEventListener("click", () => { showTransitOverlay = !showTransitOverlay; renderChart(); showScreen("chart"); });
    host.appendChild(toggle);

    // обяснения
    const sun = c.planets["Слънце"], moon = c.planets["Луна"];
    const sec = document.createElement("div");
    sec.className = "explain";
    sec.innerHTML = `
      ${block("☉ Слънце в " + sun.signName, Interp.sunText(sun.sign),
        "Слънцето показва вашата същност — кой сте в сърцевината си.")}
      ${block("☽ Луна в " + moon.signName, Interp.moonText(moon.sign),
        "Луната показва емоционалния ви свят и от какво имате нужда, за да се чувствате сигурни.")}
      ${block("↑ Асцендент в " + c.asc.signName, Interp.ascText(c.asc.sign),
        "Асцендентът е „маската“, която светът вижда първо — как изглеждате на околните.")}
    `;
    host.appendChild(sec);

    // планети по знаци и домове
    const order = ["Меркурий", "Венера", "Марс", "Юпитер", "Сатурн", "Уран", "Нептун", "Плутон"];
    const plWrap = document.createElement("div");
    plWrap.className = "planets-section";
    plWrap.innerHTML = `<h2 class="section-title">Планетите ви по знаци и домове</h2>`;
    // включваме и Слънце/Луна за дома
    const fullOrder = ["Слънце", "Луна"].concat(order);
    for (const name of fullOrder) {
      const pl = c.planets[name];
      const item = document.createElement("details");
      item.className = "planet-item";
      item.id = "pl-" + name;
      item.innerHTML = `
        <summary>
          <span class="p-glyph">${pl.glyph}</span>
          <span class="p-name">${name}</span>
          <span class="p-pos">${pl.signName} · ${Math.floor(pl.degInSign)}° · ${pl.house}-ти дом</span>
        </summary>
        <div class="p-body">
          <p>${esc(Interp.planetInSign(name, pl.sign))}</p>
          <p>${esc(Interp.planetInHouse(name, pl.house))}</p>
        </div>`;
      plWrap.appendChild(item);
    }
    host.appendChild(plWrap);

    // аспекти
    const aWrap = document.createElement("div");
    aWrap.className = "aspects-section";
    aWrap.innerHTML = `<h2 class="section-title">Основни аспекти</h2>
      <p class="section-sub">Аспектите показват как различните части от вас си взаимодействат.</p>`;
    const list = document.createElement("div");
    list.className = "aspect-list";
    const top = c.aspects.slice(0, 10);
    for (const a of top) {
      const row = document.createElement("div");
      row.className = "aspect-row";
      row.innerHTML = `
        <div class="aspect-title">${a.glyph} ${chart.planets[a.a].glyph} ${a.a} — ${a.aspect} — ${a.b} ${chart.planets[a.b].glyph}</div>
        <div class="aspect-desc">Тук ${esc(Interp.aspectMeaning(a.aspect))}.</div>`;
      list.appendChild(row);
    }
    if (top.length === 0) list.innerHTML = `<p class="muted">Няма значими аспекти в зададените граници.</p>`;
    aWrap.appendChild(list);
    host.appendChild(aWrap);

    // данни и действия
    const foot = document.createElement("div");
    foot.className = "chart-foot";
    foot.innerHTML = `
      <div class="muted small">
        ${esc(profile.placeName)} · ${esc(profile.date)} ${profile.timeUnknown ? "(час неизвестен — 12:00)" : esc(profile.time)}<br>
        Домове по системата Placidus · тропически зодиак
      </div>
      <button class="ghost-btn" id="edit-data">Промени рождените данни</button>`;
    host.appendChild(foot);
    $("#edit-data").addEventListener("click", () => { prefillForm(profile); showScreen("form"); });

    if (profile.timeUnknown) {
      const w = document.createElement("div");
      w.className = "inline-warn";
      w.textContent = "Точният час на раждане не е въведен, затова Асцендентът и домовете са приблизителни.";
      host.insertBefore(w, wheelBox.nextSibling);
    }
  }

  function block(title, text, hint) {
    return `<div class="explain-block">
      <h3>${title}</h3>
      <p class="hint">${hint}</p>
      <p>${esc(text)}</p>
    </div>`;
  }

  // ---------- Старт ----------
  function init() {
    fillCities();
    $("#f-city").addEventListener("change", onCityChange);
    $("#f-time-unknown").addEventListener("change", onUnknownTime);
    $("#birth-form").addEventListener("submit", onSubmit);
    $$(".nav-btn").forEach((b) => b.addEventListener("click", () => showScreen(b.dataset.go)));

    profile = loadProfile();
    if (profile && profile.date) {
      try {
        chart = computeFromProfile(profile);
        renderAll();
        showScreen("today");
      } catch (e) {
        console.error(e);
        showScreen("form");
      }
    } else {
      $(".bottom-nav").classList.add("hidden");
      showScreen("form");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
