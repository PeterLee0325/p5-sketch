let mode = "ROOM";

function bi(zh, en) { return `${zh}\n${en}`; }
function biInline(zh, en) { return `${zh} / ${en}`; }

let game = {
  coins: 20,
  xp: 0,
  level: 1,
  firstAudio: false,
  msg: "",
  msgUntil: 0,
  selectedStar: null,

  dailyKey: "",
  daily: { fed: false, cleaned: false, memorized: false, completed: false },

  celebration: { active: false, t: 0 }
};

let stats = { hunger: 78, hygiene: 75, fun: 70, energy: 82 };

let profile = {
  theme: "PASTEL",
  owned: {
    BOW: false, HAT: false, AURA: false,
    THEME_SKY: false, THEME_CANDY: false,
    AUTO_FEEDER: false, VACUUM: false
  },
  equip: { bow: false, hat: false, aura: false },
  petStyle: {
    species: "CAT",
    palette: "CUSTOM",
    hue: 210,
    sat: 70,
    bri: 100
  }
};

let weather = {
  status: "loading",
  city: "Local",
  temp: null,
  wcode: null,
  tmax: null,
  tmin: null,
  updatedAt: 0
};

// arrays
let clouds = [];
let stickers = [];
let particles = [];
let foods = [];
let dirts = [];
let stars = [];
let soapBubbles = [];

// ui
let dockBtns = [];
let shopItems = [];
let feed = { type: "BASIC", pills: [] };
let clean = { soapBoostUntil: 0, pills: [] };

let inputBox, saveBtn;
let speciesSel, paletteSel, hueSlider, satSlider, briSlider;

// sound
let osc, env;

// layout
let ui = { pad: 16, dockH: 92, headerH: 108, cardR: 22 };

const promptBank = [
  { zh: "今天最想感谢的一件小事是？", en: "What small thing are you grateful for today?" },
  { zh: "写一句想对自己说的话。", en: "Write one sentence to your future self." },
  { zh: "此刻你最强烈的情绪是什么？", en: "What emotion is strongest right now?" },
  { zh: "今天有什么让你变轻松？", en: "What made you feel lighter today?" }
];
let currentPrompt = null;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  textFont("system-ui");
  textLeading(14);

  osc = new p5.Oscillator("triangle");
  env = new p5.Envelope();
  env.setADSR(0.001, 0.06, 0.0, 0.10);
  env.setRange(0.35, 0);
  osc.start();
  osc.amp(0);

  pet = new Pet();

  inputBox = createInput("");
  inputBox.attribute("placeholder", biInline("写一句话，让它变成星星…", "Write a sentence, turn it into a star…"));
  saveBtn = createButton(biInline("保存星星 ✨", "Save Star ✨"));
  saveBtn.mousePressed(() => {
    if (mode !== "MEMORY") return;
    saveMemory(inputBox.value());
  });

  // daily
  game.dailyKey = getTodayKey();
  game.daily = { fed: false, cleaned: false, memorized: false, completed: false };

  loadData();

  currentPrompt = random(promptBank);

  initBackground();
  buildDock();
  buildShop();
  buildActionPills();
  buildCustomizationUI();

  spawnDirt(10);

  initWeather();

  toast(bi("点击任意处开始（开启声音）", "Click anywhere to start (enable sound)"), 2200);
}

let pet;

function draw() {
  refreshDailyIfNeeded();

  drawCartoonBackground();

  decayNeeds();
  updatePetTarget();
  pet.update(stats);

  if (mode === "ROOM") drawROOM();
  if (mode === "FEED") drawFEED();
  if (mode === "CLEAN") drawCLEAN();
  if (mode === "MEMORY") drawMEMORY();
  if (mode === "SHOP") drawSHOP();

  drawCelebration();
  drawHeaderBar();
  drawDock();
  drawParticles();
  drawToast();

  layoutDOM();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initBackground();
  buildDock();
  buildShop();
  buildActionPills();
}

function getTodayKey() { return new Date().toLocaleDateString("en-CA"); }

function refreshDailyIfNeeded() {
  const k = getTodayKey();
  if (k !== game.dailyKey) {
    game.dailyKey = k;
    game.daily = { fed: false, cleaned: false, memorized: false, completed: false };
    game.selectedStar = null;
    toast(bi("新的一天：日常仪式进度已重置", "New day: ritual progress reset"), 1800);
    saveData();
    initWeather(true);
  }
}

function initWeather(force = false) {
  try {
    const cached = localStorage.getItem("moodPet_weather_" + game.dailyKey);
    if (!force && cached) {
      const w = JSON.parse(cached);
      if (w && (Date.now() - (w.updatedAt || 0) < 60 * 60 * 1000)) {
        weather = w;
        weather.status = "ok";
        return;
      }
    }
  } catch (e) {}

  weather.status = "loading";

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => fetchWeather(51.5072, -0.1276),
      { enableHighAccuracy: false, timeout: 5000 }
    );
  } else {
    fetchWeather(51.5072, -0.1276);
  }
}

async function fetchWeather(lat, lon) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code` +
      `&timezone=auto`;

    const res = await fetch(url);
    const json = await res.json();

    const temp = json?.current?.temperature_2m ?? null;
    const code = json?.current?.weather_code ?? null;

    const tmax = Array.isArray(json?.daily?.temperature_2m_max) ? json.daily.temperature_2m_max[0] : null;
    const tmin = Array.isArray(json?.daily?.temperature_2m_min) ? json.daily.temperature_2m_min[0] : null;

    weather = {
      status: "ok",
      city: "Local",
      temp,
      wcode: code,
      tmax,
      tmin,
      updatedAt: Date.now()
    };

    localStorage.setItem("moodPet_weather_" + game.dailyKey, JSON.stringify(weather));
  } catch (e) {
    weather.status = "error";
  }
}

function weatherLabel(code) {
  if (code == null) return { emoji: "❓", zh: "未知", en: "Unknown" };
  const c = Number(code);

  if (c === 0) return { emoji: "☀️", zh: "晴", en: "Clear" };
  if (c === 1 || c === 2) return { emoji: "🌤️", zh: "多云转晴", en: "Mostly Clear" };
  if (c === 3) return { emoji: "☁️", zh: "多云", en: "Cloudy" };
  if (c === 45 || c === 48) return { emoji: "🌫️", zh: "雾", en: "Fog" };
  if (c >= 51 && c <= 57) return { emoji: "🌦️", zh: "毛毛雨", en: "Drizzle" };
  if (c >= 61 && c <= 67) return { emoji: "🌧️", zh: "雨", en: "Rain" };
  if (c >= 71 && c <= 77) return { emoji: "❄️", zh: "雪", en: "Snow" };
  if (c >= 80 && c <= 82) return { emoji: "🌧️", zh: "阵雨", en: "Showers" };
  if (c >= 95) return { emoji: "⛈️", zh: "雷暴", en: "Storm" };

  return { emoji: "🌥️", zh: "天气", en: "Weather" };
}

function getWeatherCategory(code) {
  if (code == null) return "NEUTRAL";
  const c = Number(code);
  if (c === 0) return "CLEAR";
  if (c === 1 || c === 2) return "MOSTLY_CLEAR";
  if (c === 3) return "CLOUDY";
  if (c === 45 || c === 48) return "FOG";
  if ((c >= 51 && c <= 57) || (c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return "RAIN";
  if (c >= 71 && c <= 77) return "SNOW";
  if (c >= 95) return "STORM";
  return "NEUTRAL";
}

function weatherEffects() {
  if (weather.status !== "ok") {
    return { funMul: 1.0, energyMul: 1.0, hygieneMul: 1.0, dirtMul: 1.0, speedMul: 1.0, wanderMul: 1.0, homeBias: 1.0 };
  }
  const cat = getWeatherCategory(weather.wcode);
  let e = { funMul: 1.0, energyMul: 1.0, hygieneMul: 1.0, dirtMul: 1.0, speedMul: 1.0, wanderMul: 1.0, homeBias: 1.0 };

  if (cat === "CLEAR" || cat === "MOSTLY_CLEAR") {
    e.funMul = 0.90; e.energyMul = 0.90; e.dirtMul = 0.90; e.speedMul = 1.05; e.wanderMul = 1.15;
  } else if (cat === "FOG") {
    e.funMul = 1.05; e.speedMul = 0.95; e.wanderMul = 0.90;
  } else if (cat === "RAIN") {
    e.funMul = 1.15; e.energyMul = 1.10; e.hygieneMul = 1.10; e.dirtMul = 1.20;
    e.speedMul = 0.95; e.wanderMul = 0.85; e.homeBias = 0.90;
  } else if (cat === "SNOW") {
    e.energyMul = 1.12; e.funMul = 1.05; e.hygieneMul = 1.05; e.dirtMul = 1.10;
    e.speedMul = 0.90; e.wanderMul = 0.85; e.homeBias = 0.92;
  } else if (cat === "STORM") {
    e.funMul = 1.20; e.energyMul = 1.20; e.hygieneMul = 1.10; e.dirtMul = 1.35;
    e.speedMul = 0.88; e.wanderMul = 0.70; e.homeBias = 0.80;
  }
  return e;
}

function weatherEffectNoteObj() {
  if (weather.status !== "ok") return { zh: "", en: "" };
  const cat = getWeatherCategory(weather.wcode);
  if (cat === "CLEAR" || cat === "MOSTLY_CLEAR") return { zh: "晴：更活泼😺", en: "Clear: more playful 😺" };
  if (cat === "RAIN") return { zh: "雨：更宅+更易脏☔", en: "Rain: lazier + dirtier ☔" };
  if (cat === "STORM") return { zh: "暴风：想躲起来⛈️", en: "Storm: wants to hide ⛈️" };
  if (cat === "SNOW") return { zh: "雪：更耗能❄️", en: "Snow: more energy drain ❄️" };
  if (cat === "FOG") return { zh: "雾：更谨慎🌫️", en: "Fog: more cautious 🌫️" };
  return { zh: "", en: "" };
}

function layoutDOM() {
  const showMem = (mode === "MEMORY");
  inputBox.style("display", showMem ? "block" : "none");
  saveBtn.style("display", showMem ? "block" : "none");
  if (showMem) {
    const x = ui.pad + 18;
    const y = ui.headerH + ui.pad + 18;
    inputBox.position(x, y);
    inputBox.size(min(520, width - 40));
    saveBtn.position(x + min(520, width - 40) + 12, y);
    saveBtn.size(160, 40);
  }

  const showStyle = (mode === "SHOP");
  const setShow = (el, show) => el && el.style("display", show ? "block" : "none");
  [speciesSel, paletteSel, hueSlider, satSlider, briSlider].forEach(el => setShow(el, showStyle));

  if (showStyle) {
    const x = ui.pad + 18;
    const y = ui.headerH + ui.pad + 92;
    const w = 300;

    speciesSel.position(x, y); speciesSel.size(w, 32);
    paletteSel.position(x, y + 44); paletteSel.size(w, 32);

    hueSlider.position(x, y + 98); hueSlider.size(w, 18);
    satSlider.position(x, y + 128); satSlider.size(w, 18);
    briSlider.position(x, y + 158); briSlider.size(w, 18);
  }
}

function buildDock() {
  dockBtns = [];
  const labels = [
    { key: "ROOM",  label: bi("房间", "Room"),  icon: "home" },
    { key: "FEED",  label: bi("喂食", "Feed"),  icon: "food" },
    { key: "CLEAN", label: bi("清洁", "Clean"), icon: "clean" },
    { key: "MEMORY",label: bi("记忆", "Memory"),icon: "star" },
    { key: "SHOP",  label: bi("商店", "Shop"),  icon: "shop" }
  ];

  const totalW = min(760, width - ui.pad * 2);
  const x0 = (width - totalW) / 2;
  const y0 = height - ui.dockH + 16;
  const gap = 12;
  const btnW = (totalW - gap * (labels.length - 1)) / labels.length;
  const btnH = 56;

  for (let i = 0; i < labels.length; i++) {
    dockBtns.push(new UIButton(labels[i].key, labels[i].label, labels[i].icon,
      x0 + i * (btnW + gap), y0, btnW, btnH
    ));
  }
}

function buildShop() {
  shopItems = [];
  shopItems.push(new ShopItem("BOW",  bi("粉色蝴蝶结", "Pink Bow"), 28));
  shopItems.push(new ShopItem("HAT",  bi("小星星帽", "Star Hat"), 36));
  shopItems.push(new ShopItem("AURA", bi("泡泡光环", "Bubble Aura"), 32));
  shopItems.push(new ShopItem("THEME_SKY",   bi("主题：天空", "Theme: Sky"), 20));
  shopItems.push(new ShopItem("THEME_CANDY", bi("主题：糖果", "Theme: Candy"), 20));
  shopItems.push(new ShopItem("AUTO_FEEDER", bi("升级：自动喂食器", "Upgrade: Auto Feeder"), 80));
  shopItems.push(new ShopItem("VACUUM",      bi("升级：吸尘机器人", "Upgrade: Vacuum Bot"), 70));
}

function buildActionPills() {
  feed.pills = [];
  const baseX = ui.pad + 18;
  const baseY = ui.headerH + ui.pad + 18;
  const w = 170, h = 44, gap = 10;

  feed.pills.push(new Pill("BASIC",   bi("基础 0", "Basic 0"), baseX, baseY + 0 * (h + gap), w, h));
  feed.pills.push(new Pill("SNACK",   bi("零食 2", "Snack 2"), baseX, baseY + 1 * (h + gap), w, h));
  feed.pills.push(new Pill("GOURMET", bi("大餐 5", "Gourmet 5"), baseX, baseY + 2 * (h + gap), w, h));

  clean.pills = [];
  clean.pills.push(new Pill("SOAP", bi("泡泡肥皂（3）", "Bubble Soap (3)"), baseX, baseY, 240, 44));
}

function buildCustomizationUI() {
  speciesSel = createSelect();
  speciesSel.option(biInline("猫", "Cat"), "CAT");
  speciesSel.option(biInline("狗", "Dog"), "DOG");
  speciesSel.option(biInline("兔子", "Bunny"), "BUNNY");
  speciesSel.changed(() => {
    profile.petStyle.species = speciesSel.value();
    sfx("click");
    toast(bi("宠物种类已切换", "Species changed"), 900);
    saveData();
  });

  paletteSel = createSelect();
  paletteSel.option(biInline("自定义", "Custom"), "CUSTOM");
  paletteSel.option(biInline("粉彩粉", "Pastel Pink"), "PASTEL_PINK");
  paletteSel.option(biInline("天空蓝", "Sky Blue"), "SKY_BLUE");
  paletteSel.option(biInline("柠檬黄", "Lemon"), "LEMON");
  paletteSel.option(biInline("抹茶绿", "Matcha"), "MATCHA");
  paletteSel.changed(() => {
    profile.petStyle.palette = paletteSel.value();
    applyPaletteToSliders();
    sfx("click");
    toast(bi("配色已切换", "Palette changed"), 900);
    saveData();
  });

  hueSlider = createSlider(0, 360, profile.petStyle.hue, 1);
  satSlider = createSlider(0, 100, profile.petStyle.sat, 1);
  briSlider = createSlider(0, 100, profile.petStyle.bri, 1);

  const onSlider = () => {
    profile.petStyle.palette = "CUSTOM";
    paletteSel.value("CUSTOM");
    profile.petStyle.hue = hueSlider.value();
    profile.petStyle.sat = satSlider.value();
    profile.petStyle.bri = briSlider.value();
    saveData();
  };
  hueSlider.input(onSlider);
  satSlider.input(onSlider);
  briSlider.input(onSlider);

  speciesSel.value(profile.petStyle.species);
  paletteSel.value(profile.petStyle.palette);
  applyPaletteToSliders();
}

function applyPaletteToSliders() {
  const p = profile.petStyle.palette;
  const presets = {
    CUSTOM:      { h: profile.petStyle.hue, s: profile.petStyle.sat, b: profile.petStyle.bri },
    PASTEL_PINK: { h: 330, s: 55, b: 100 },
    SKY_BLUE:    { h: 205, s: 55, b: 100 },
    LEMON:       { h: 55,  s: 70, b: 100 },
    MATCHA:      { h: 140, s: 55, b: 98 }
  };
  const v = presets[p] || presets.CUSTOM;
  if (p !== "CUSTOM") {
    profile.petStyle.hue = v.h; profile.petStyle.sat = v.s; profile.petStyle.bri = v.b;
  }
  hueSlider.value(profile.petStyle.hue);
  satSlider.value(profile.petStyle.sat);
  briSlider.value(profile.petStyle.bri);
}

function initBackground() {
  clouds = [];
  for (let i = 0; i < 10; i++) {
    clouds.push({ x: random(width), y: random(18, height * 0.32), s: random(0.7, 1.5), sp: random(0.15, 0.55) });
  }
  stickers = [];
  for (let i = 0; i < 10; i++) {
    stickers.push({ x: random(width), y: random(height), w: random(120, 260), h: random(80, 180), hue: random([330, 280, 55, 160, 210]), a: random(6, 12) });
  }
}

function drawCartoonBackground() {
  const th = profile.theme;
  if (th === "PASTEL") skyGradient(205, 265);
  if (th === "SKY") skyGradient(190, 240);
  if (th === "CANDY") skyGradient(310, 260);

  noStroke();
  for (let s of stickers) { fill(s.hue, 35, 100, s.a); rect(s.x, s.y, s.w, s.h, 28); }

  drawHills();

  for (let c of clouds) {
    c.x += c.sp;
    if (c.x > width + 180) c.x = -180;
    drawCloud(c.x, c.y, c.s);
  }

  noStroke();
  for (let i = 0; i < 5; i++) { fill(0, 0, 0, 2.2); rect(0, 0, width, height); }
}

function skyGradient(h1, h2) {
  noStroke();
  for (let y = 0; y < height; y += 2) {
    const t = y / height;
    fill(lerp(h1, h2, t), 55, lerp(100, 88, t), 100);
    rect(0, y, width, 2);
  }
}

function drawHills() {
  noStroke();
  fill(150, 25, 100, 18);
  beginShape();
  vertex(0, height * 0.62);
  for (let x = 0; x <= width; x += 40) vertex(x, height * 0.62 + sin(x * 0.008 + frameCount * 0.002) * 18);
  vertex(width, height); vertex(0, height);
  endShape(CLOSE);

  fill(290, 20, 100, 12);
  beginShape();
  vertex(0, height * 0.70);
  for (let x = 0; x <= width; x += 50) vertex(x, height * 0.70 + sin(x * 0.006 + frameCount * 0.0015 + 2.0) * 22);
  vertex(width, height); vertex(0, height);
  endShape(CLOSE);
}

function drawCloud(x, y, s) {
  push();
  translate(x, y); scale(s);
  noStroke();
  fill(0, 0, 100, 60);
  ellipse(0, 0, 96, 56);
  ellipse(-36, 10, 64, 42);
  ellipse(36, 12, 64, 42);
  ellipse(0, 18, 118, 52);
  fill(0, 0, 100, 18);
  ellipse(-18, -12, 32, 18);
  pop();
}

function drawHeaderBar() {
  noStroke();
  fill(0, 0, 100, 10);
  rect(ui.pad, ui.pad, width - ui.pad * 2, ui.headerH - 14, ui.cardR);
  fill(0, 0, 0, 14);
  rect(ui.pad, ui.pad, width - ui.pad * 2, ui.headerH - 14, ui.cardR);

  const modeMap = {
    ROOM:  { zh: "房间", en: "Room" },
    FEED:  { zh: "喂食", en: "Feed" },
    CLEAN: { zh: "清洁", en: "Clean" },
    MEMORY:{ zh: "记忆", en: "Memory" },
    SHOP:  { zh: "商店", en: "Shop" }
  };
  const m = modeMap[mode] || { zh: mode, en: mode };
  const ritualIcons = `${game.daily.fed ? "🍚" : "▫️"}${game.daily.cleaned ? "🧼" : "▫️"}${game.daily.memorized ? "✨" : "▫️"}`;

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  let emoji = "❓", wZH = "天气获取中…", wEN = "Loading weather…";
  let t = "—", hi = "—", lo = "—";
  let eff = { zh: "", en: "" };

  if (weather.status === "ok") {
    const wl = weatherLabel(weather.wcode);
    emoji = wl.emoji; wZH = wl.zh; wEN = wl.en;
    eff = weatherEffectNoteObj();
    t  = (weather.temp != null) ? `${Math.round(weather.temp)}°` : "—";
    hi = (weather.tmax != null) ? `${Math.round(weather.tmax)}°` : "—";
    lo = (weather.tmin != null) ? `${Math.round(weather.tmin)}°` : "—";
  } else if (weather.status === "error") {
    wZH = "天气获取失败"; wEN = "Weather failed";
  }

  const leftX = ui.pad + 16;
  const topY = ui.pad + 16;

  fill(0, 0, 100, 92);
  textAlign(LEFT, TOP);
  textSize(12);
  text(`情绪宠物圣所 · 模式：${m.zh} · 仪式：${ritualIcons}\nMood Pet Sanctuary · Mode: ${m.en} · Ritual: ${ritualIcons}`, leftX, topY);

  const rightX = width - ui.pad - 16;
  const needXP = xpToNext(game.level);
  const right1 = `${dateStr} ${timeStr}   ${emoji} ${t} (H${hi}/L${lo})`;
  const right2 = `天气：${wZH}${eff.zh ? " · " + eff.zh : ""}   金币：${game.coins} · 等级：${game.level} (${game.xp}/${needXP})`;
  const right3 = `Weather: ${wEN}${eff.en ? " · " + eff.en : ""}   Coins: ${game.coins} · Lv: ${game.level} (${game.xp}/${needXP})`;

  textAlign(RIGHT, TOP);
  textSize(11);
  textLeading(14);
  text(`${right1}\n${right2}\n${right3}`, rightX, topY);
}

function drawDock() {
  const x = ui.pad;
  const y = height - ui.dockH + 10;
  const w = width - ui.pad * 2;
  const h = ui.dockH - 20;

  noStroke();
  fill(0, 0, 100, 10); rect(x, y, w, h, 28);
  fill(0, 0, 0, 16);   rect(x, y, w, h, 28);

  for (let b of dockBtns) b.draw(mode);
}

function drawNeedsMini() {
  const baseX = pet.pos.x;
  const baseY = pet.pos.y - 160;

  const items = [
    { label: bi("饿", "Hun"), v: stats.hunger, hue: 40 },
    { label: bi("洁", "Hyg"), v: stats.hygiene, hue: 160 },
    { label: bi("乐", "Fun"), v: stats.fun, hue: 290 },
    { label: bi("能", "Eng"), v: stats.energy, hue: 210 }
  ];

  for (let i = 0; i < items.length; i++) {
    const cx = baseX + (i - 1.5) * 72;
    const cy = baseY;

    noStroke();
    fill(0, 0, 100, 10); ellipse(cx, cy, 56);
    fill(0, 0, 0, 14);   ellipse(cx, cy, 56);

    noFill();
    stroke(0, 0, 100, 18); strokeWeight(5);
    arc(cx, cy, 44, 44, -HALF_PI, -HALF_PI + TWO_PI);

    stroke(items[i].hue, 80, 100, 85);
    arc(cx, cy, 44, 44, -HALF_PI, -HALF_PI + TWO_PI * (items[i].v / 100));

    noStroke();
    fill(0, 0, 100, 88);
    textAlign(CENTER, CENTER);
    textLeading(12);
    textSize(9.5);
    text(items[i].label, cx, cy + 1);
  }
}

function drawROOM() {
  drawRoomFloor();
  pet.draw(stats, profile.equip);
  drawNeedsMini();
  drawHint(bi("点击宠物摸摸它（快乐+能量）。完成 🍚🧼✨ 触发大奖励！", "Click pet to pat (Fun+Energy). Finish 🍚🧼✨ for big reward!"));
}

function drawFEED() {
  drawRoomFloor();

  for (let p of feed.pills) p.draw(feed.type);

  for (let i = foods.length - 1; i >= 0; i--) {
    foods[i].update();
    foods[i].draw();
    if (foods[i].dead()) foods.splice(i, 1);
  }

  for (let i = foods.length - 1; i >= 0; i--) {
    if (pet.hitFood(foods[i])) {
      const kind = foods[i].kind;
      foods.splice(i, 1);

      const reward = foodReward(kind);
      stats.hunger = constrain(stats.hunger + reward.hunger, 0, 100);
      stats.fun = constrain(stats.fun + reward.fun, 0, 100);

      game.coins += reward.coinBack;
      gainXP(reward.xp);
      game.daily.fed = true;

      burst(pet.pos.x, pet.pos.y + 40, 18);
      sfx("eat");

      toast(bi(`吃掉了！饱食+${reward.hunger} 快乐+${reward.fun}`, `Yum! Hunger+${reward.hunger} Fun+${reward.fun}`), 1100);
      saveData();
      checkSanctuaryComplete();
    }
  }

  pet.draw(stats, profile.equip);
  drawNeedsMini();
  drawHint(bi("点击地面投喂。食物越贵越好（金币更有意义）。", "Click ground to feed. Higher tier food = better (coins matter)."));
}

function drawCLEAN() {
  drawRoomFloor();

  for (let p of clean.pills) p.draw("SOAP");

  const boosted = millis() < clean.soapBoostUntil;
  if (boosted) {
    const left = Math.max(0, Math.ceil((clean.soapBoostUntil - millis()) / 1000));
    tinyBadge(ui.pad + 18, ui.headerH + ui.pad + 64, bi(`泡泡加成: ${left}s`, `Bubble boost: ${left}s`));
  }

  for (let d of dirts) d.draw();

  if (mouseIsPressed) {
    const p = mouseInWorld();
    if (p) {
      push();
      noStroke();
      fill(55, 30, 100, 80);
      rect(p.x - 26, p.y - 18, 52, 36, 12);
      fill(0, 0, 100, 20);
      rect(p.x - 20, p.y - 12, 40, 24, 10);
      pop();

      let cleanedNow = 0;
      const power = boosted ? 4.2 : 2.8;

      for (let d of dirts) {
        if (!d.cleaned && d.hit(p.x, p.y)) {
          d.cleanPower += power;
          if (d.cleanPower >= 100) {
            d.cleaned = true;
            cleanedNow++;
            burst(p.x, p.y, 14);
            const extra = boosted ? 18 : 10;
            for (let k = 0; k < extra; k++) soapBubbles.push(new SoapBubble(p.x, p.y));
          }
        }
      }

      if (cleanedNow > 0) {
        stats.hygiene = constrain(stats.hygiene + 6 * cleanedNow, 0, 100);
        stats.fun = constrain(stats.fun + 1 * cleanedNow, 0, 100);
        game.coins += 2 * cleanedNow;
        gainXP(3 * cleanedNow);
        sfx("pop");

        game.daily.cleaned = true;

        toast(bi(`清洁完成！清洁度+${6 * cleanedNow}`, `Cleaned! Hygiene+${6 * cleanedNow}`), 1100);
        saveData();
        checkSanctuaryComplete();
      }
    }
  }

  for (let i = soapBubbles.length - 1; i >= 0; i--) {
    soapBubbles[i].update();
    soapBubbles[i].draw();
    if (soapBubbles[i].dead()) soapBubbles.splice(i, 1);
  }

  dirts = dirts.filter(d => !d.gone());

  pet.draw(stats, profile.equip);
  drawNeedsMini();
  drawHint(bi("按住拖动海绵擦污渍。可花 3 金币开启泡泡加成。", "Hold & drag sponge. Spend 3 coins to enable bubble boost."));
}

function drawMEMORY() {
  drawRoomFloor();
  drawConstellationPanel();

  pet.draw(stats, profile.equip);
  drawNeedsMini();

  const x = ui.pad + 18;
  const y = ui.headerH + ui.pad + 72;
  const w = min(560, width - ui.pad * 2 - 36);
  const h = 110;

  glassCard(x, y, w, h);
  fill(0, 0, 100, 90);
  textAlign(LEFT, TOP);
  textSize(12);
  text(bi("提示", "Prompt"), x + 14, y + 12);
  textSize(13);
  text(bi(currentPrompt.zh, currentPrompt.en), x + 14, y + 36, w - 28, 72);

  if (game.selectedStar) {
    const msg = game.selectedStar.text;
    const bx = width - ui.pad - 360;
    const by = ui.headerH + ui.pad + 18;
    glassCard(bx, by, 360, 110);
    fill(0, 0, 100, 92);
    textAlign(LEFT, TOP);
    textSize(12);
    text(bi("星星内容", "Star Note"), bx + 14, by + 12);
    textSize(12);
    fill(0, 0, 100, 80);
    text(msg, bx + 14, by + 36, 332, 70);
  }

  drawHint(bi("写一句话并保存（✨）。保存 = 完成今日仪式的一部分。", "Write and save (✨). Saving is part of today's ritual."));
}

function drawSHOP() {
  drawRoomFloor();
  pet.draw(stats, profile.equip);
  drawNeedsMini();

  const x = ui.pad + 18;
  const y = ui.headerH + ui.pad + 18;
  const w = width - ui.pad * 2 - 36;
  const h = height - ui.headerH - ui.dockH - ui.pad * 2 - 36;

  glassCard(x, y, w, h);

  fill(0, 0, 100, 92);
  textAlign(LEFT, TOP);
  textSize(14);
  text(bi("商店：装扮 & 升级 & 个性化", "Shop: Cosmetics & Upgrades & Customization"), x + 16, y + 14);

  fill(0, 0, 100, 70);
  textSize(12);
  text(bi("装扮改变外观；升级改变系统；个性化让每个人拥有不同伙伴。", "Cosmetics change look; upgrades change system; customization makes it personal."),
    x + 16, y + 46
  );

  fill(0, 0, 100, 80);
  textSize(12);
  text(bi("个性化：种类 / 配色 / 色相饱和亮度", "Customization: Species / Palette / H-S-B"), x + 16, y + 86);

  const cols = (w > 900) ? 3 : 2;
  const gap = 14;
  const topOffset = 230;
  const cardW = (w - 16 * 2 - gap * (cols - 1)) / cols;
  const cardH = 112;

  for (let i = 0; i < shopItems.length; i++) {
    const col = i % cols;
    const row = floor(i / cols);
    const cx = x + 16 + col * (cardW + gap);
    const cy = y + topOffset + row * (cardH + gap);
    shopItems[i].setRect(cx, cy, cardW, cardH);
    shopItems[i].draw();
  }

  drawHint(bi("金币可买装扮，也能买升级（更有系统意义）。", "Use coins for cosmetics or upgrades (system meaning)."));
}

function drawRoomFloor() {
  const worldTop = ui.headerH + ui.pad;
  const worldBottom = height - ui.dockH - ui.pad;
  const worldH = worldBottom - worldTop;

  noStroke();
  fill(55, 18, 100, 18);
  rect(0, worldTop, width, worldH * 0.62);

  for (let i = 0; i < 120; i++) {
    const x = (i * 42) % width;
    const y = worldTop + 18 + (floor(i / 20) * 30);
    if (y > worldTop + worldH * 0.62 - 12) break;
    fill(330, 20, 100, 9);
    ellipse(x + 20, y, 6, 6);
  }

  fill(210, 18, 100, 18);
  rect(0, worldTop + worldH * 0.62, width, worldH * 0.38);

  const tile = 48;
  for (let x = 0; x < width; x += tile) {
    for (let y = worldTop + worldH * 0.62; y < worldBottom; y += tile) {
      const a = ((floor(x / tile) + floor((y - (worldTop + worldH * 0.62)) / tile)) % 2 === 0) ? 10 : 6;
      fill(200, 10, 100, a);
      rect(x, y, tile, tile);
    }
  }

  stroke(0, 0, 0, 10);
  strokeWeight(4);
  line(0, worldTop + worldH * 0.62, width, worldTop + worldH * 0.62);
}

function updatePetTarget() {
  const home = getHomePoint();

  if (mode === "FEED" && foods.length > 0) {
    const f = nearestFood(pet.pos.x, pet.pos.y, foods);
    pet.setTarget(createVector(f.x, f.y - 18), "ARRIVE_FAST");
  } else if (mode === "CLEAN") {
    pet.setTarget(home.copy().add(pet.wanderOffset()), "ARRIVE");
  } else if (mode === "MEMORY") {
    pet.setTarget(home.copy().add(0, -8), "ARRIVE");
  } else if (mode === "SHOP") {
    pet.setTarget(home.copy().add(0, 0), "ARRIVE");
  } else {
    const wfx = weatherEffects();
    const off = pet.wanderOffset().mult(wfx.homeBias);
    pet.setTarget(home.copy().add(off), "ARRIVE");
  }
}

function getHomePoint() {
  const worldTop = ui.headerH + ui.pad;
  const worldBottom = height - ui.dockH - ui.pad;
  const y = lerp(worldTop, worldBottom, 0.68);
  const x = width * 0.52;
  return createVector(x, y);
}

function xpToNext(level) { return 40 + (level - 1) * 25; }

function gainXP(v) {
  game.xp += v;
  while (game.xp >= xpToNext(game.level)) {
    game.xp -= xpToNext(game.level);
    game.level++;
    game.coins += 10;
    burst(pet.pos.x, pet.pos.y - 30, 46);
    sfx("win");
    toast(bi("升级啦！+10 金币", "Level up! +10 coins"), 1600);
  }
}

function decayNeeds() {
  const wfx = weatherEffects();
  const feederMul = profile.owned.AUTO_FEEDER ? 0.85 : 1.0;
  const vacuumMul = profile.owned.VACUUM ? 0.85 : 1.0;

  const k = 0.006;
  stats.hunger  = constrain(stats.hunger  - k * 1.4 * feederMul, 0, 100);
  stats.hygiene = constrain(stats.hygiene - k * 0.9 * vacuumMul * wfx.hygieneMul, 0, 100);
  stats.fun     = constrain(stats.fun     - k * 1.2 * wfx.funMul, 0, 100);
  stats.energy  = constrain(stats.energy  - k * 0.7 * wfx.energyMul, 0, 100);

  const baseInterval = profile.owned.VACUUM ? 420 : 260;
  const interval = Math.max(120, Math.floor(baseInterval / wfx.dirtMul));

  if (mode === "ROOM" && frameCount % interval === 0) {
    if (stats.hygiene < 40 && dirts.length < 18) spawnDirt(1);
  }
}

function checkSanctuaryComplete() {
  if (game.daily.completed) return;
  if (game.daily.fed && game.daily.cleaned && game.daily.memorized) {
    game.daily.completed = true;
    sanctuaryCompleteReward();
  }
}

function sanctuaryCompleteReward() {
  const coinReward = 60;
  const xpReward = 35;

  game.coins += coinReward;
  gainXP(xpReward);

  const pool = ["BOW", "HAT", "AURA", "THEME_SKY", "THEME_CANDY", "AUTO_FEEDER", "VACUUM"];
  const locked = pool.filter(k => !profile.owned[k]);
  let unlockMsg = "";
  if (locked.length > 0) {
    const pick = random(locked);
    profile.owned[pick] = true;

    if (pick === "THEME_SKY") unlockMsg = bi("解锁主题：天空", "Unlocked Theme: Sky");
    else if (pick === "THEME_CANDY") unlockMsg = bi("解锁主题：糖果", "Unlocked Theme: Candy");
    else if (pick === "AUTO_FEEDER") unlockMsg = bi("解锁升级：自动喂食器", "Unlocked: Auto Feeder");
    else if (pick === "VACUUM") unlockMsg = bi("解锁升级：吸尘机器人", "Unlocked: Vacuum Bot");
    else unlockMsg = bi("解锁装扮：", "Unlocked cosmetic: ") + pick;
  } else {
    game.coins += 25;
    unlockMsg = bi("全解锁完成：额外 +25 金币", "All unlocked: extra +25 coins");
  }

  game.celebration.active = true;
  game.celebration.t = 0;
  burst(width * 0.5, height * 0.35, 140);
  burst(pet.pos.x, pet.pos.y - 80, 100);
  sfx("win");
  toast(bi(`圣所完成！+${coinReward} 金币 +${xpReward} 经验`, `Sanctuary Complete! +${coinReward} coins +${xpReward} XP`) + "\n" + unlockMsg, 2600);

  saveData();
}

function drawConstellationPanel() {
  const x = width - ui.pad - min(520, width * 0.42);
  const y = ui.headerH + ui.pad + 18;
  const w = min(520, width * 0.42);
  const h = min(320, height * 0.34);

  glassCard(x, y, w, h);

  fill(0, 0, 100, 90);
  textAlign(LEFT, TOP);
  textSize(13);
  text(bi("记忆星座", "Memory Constellation"), x + 14, y + 12);

  let hoverStar = null;
  for (let s of stars) {
    s.draw(x, y, w, h);
    if (s.hit(mouseX, mouseY, x, y, w, h)) hoverStar = s;
  }

  fill(0, 0, 100, 55);
  textSize(11);
  const hint = hoverStar ? bi("点击查看这颗星", "Click to view this star") : bi(`已保存: ${stars.length}`, `Saved: ${stars.length}`);
  text(hint, x + 14, y + h - 30);
}

function saveMemory(text) {
  text = (text || "").trim();
  if (!text) { sfx("reject"); toast(bi("先写一句话再保存～", "Write something before saving~"), 1200); return; }

  const emo = classifyEmotion(text);
  const s = new Star(text, emo);

  stars.unshift(s);
  if (stars.length > 90) stars.pop();

  stats.energy = constrain(stats.energy + 6, 0, 100);
  stats.fun = constrain(stats.fun + 4, 0, 100);

  game.coins += 5;
  gainXP(8);

  game.daily.memorized = true;

  burst(pet.pos.x, pet.pos.y - 50, 36);
  sfx("win");

  inputBox.value("");
  currentPrompt = random(promptBank);
  game.selectedStar = s;

  toast(bi("保存成功！+5 金币", "Saved! +5 coins"), 1400);
  saveData();
  checkSanctuaryComplete();
}

function classifyEmotion(t) {
  const s = t.toLowerCase();
  const happy = ["happy", "开心", "高兴", "轻松", "满足", "喜欢", "love", "great", "nice", "thank", "哈哈"];
  const sad = ["sad", "难过", "伤心", "失落", "哭", "pain", "lonely", "depress", "tired", "emo"];
  const angry = ["angry", "生气", "烦", "崩溃", "讨厌", "hate", "mad", "stress", "气死"];
  const calm = ["calm", "平静", "放松", "安静", "稳定", "safe", "okay", "ok", "fine", "还行"];

  const score = { HAPPY: 0, SAD: 0, ANGRY: 0, CALM: 0 };
  for (let k of happy) if (s.includes(k)) score.HAPPY++;
  for (let k of sad) if (s.includes(k)) score.SAD++;
  for (let k of angry) if (s.includes(k)) score.ANGRY++;
  for (let k of calm) if (s.includes(k)) score.CALM++;

  let best = "CALM", m = -1;
  for (let key in score) if (score[key] > m) { m = score[key]; best = key; }

  if (m === 0) {
    if (t.includes("！") || t.includes("!")) best = "ANGRY";
    else if (t.includes("…") || t.includes("...")) best = "SAD";
    else best = "CALM";
  }
  return best;
}

function foodReward(kind) {
  if (kind === "SNACK")   return { cost: 2, hunger: 14, fun: 4, xp: 3, coinBack: 0 };
  if (kind === "GOURMET") return { cost: 5, hunger: 20, fun: 6, xp: 4, coinBack: 1 };
  return { cost: 0, hunger: 10, fun: 2, xp: 2, coinBack: 0 };
}

function spawnDirt(n) {
  const world = getWorldRect();
  for (let i = 0; i < n; i++) {
    dirts.push(new Dirt(
      random(world.x + 80, world.x + world.w - 80),
      random(world.y + world.h * 0.70, world.y + world.h - 40),
      random(24, 46)
    ));
  }
}

function burst(x, y, n) { for (let i = 0; i < n; i++) particles.push(new Particle(x, y, random(0, 360))); }

function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw();
    if (particles[i].dead()) particles.splice(i, 1);
  }
}

function drawCelebration() {
  if (!game.celebration.active) return;

  game.celebration.t += 1;
  const t = game.celebration.t;
  const a = map(t, 0, 120, 0, 35);
  const pulse = 1 + 0.02 * sin(t * 0.2);

  push();
  translate(width * 0.5, height * 0.33);
  scale(pulse);

  noStroke();
  fill(55, 70, 100, a);
  rectMode(CENTER);
  rect(0, 0, 620, 110, 28);
  fill(0, 0, 0, a * 0.55);
  rect(0, 0, 620, 110, 28);

  fill(0, 0, 100, a * 0.9);
  textAlign(CENTER, CENTER);
  textSize(18);
  text(bi("🎉 圣所完成！", "🎉 Sanctuary Complete!"), 0, -12);
  textSize(12);
  text(bi("今日三件事完成：获得大奖励", "All 3 daily rituals done: big reward"), 0, 22);
  pop();

  if (t > 150) game.celebration.active = false;
}

function drawHint(msg) {
  const x = ui.pad + 18;
  const y = height - ui.dockH - ui.pad - 76;
  const w = min(760, width - ui.pad * 2 - 36);
  const h = 62;

  glassCard(x, y, w, h);
  fill(0, 0, 100, 88);
  textAlign(LEFT, TOP);
  textSize(12);
  textLeading(14);
  text(msg, x + 14, y + 10);
}

function toast(message, ms) {
  game.msg = message;
  game.msgUntil = millis() + ms;
}

function drawToast() {
  if (millis() > game.msgUntil) return;
  const w = min(720, width - ui.pad * 2);
  const h = 64;
  const x = (width - w) / 2;
  const y = ui.headerH + ui.pad + 8;

  noStroke();
  fill(0, 0, 100, 10); rect(x, y, w, h, 18);
  fill(0, 0, 0, 16);   rect(x, y, w, h, 18);

  fill(0, 0, 100, 92);
  textLeading(14);
  textAlign(CENTER, TOP);
  textSize(12);
  text(game.msg, x + w / 2, y + 10);
}

function tinyBadge(x, y, textStr) {
  noStroke();
  fill(0, 0, 100, 10); rect(x, y, 260, 40, 999);
  fill(0, 0, 0, 14);   rect(x, y, 260, 40, 999);
  fill(0, 0, 100, 88);
  textAlign(LEFT, TOP);
  textSize(11);
  textLeading(13);
  text(textStr, x + 12, y + 7);
}

function mousePressed() {
  if (!game.firstAudio) {
    userStartAudio();
    game.firstAudio = true;
  }

  for (let b of dockBtns) {
    if (b.hit(mouseX, mouseY)) {
      mode = b.key;
      sfx("click");
      if (mode === "FEED") foods = [];
      if (mode === "CLEAN" && dirts.length < 6) spawnDirt(6);
      return;
    }
  }

  if (mode === "FEED") {
    for (let p of feed.pills) {
      if (p.hit(mouseX, mouseY)) {
        feed.type = p.key;
        sfx("click");
        toast(bi("已选择食物", "Selected food"), 900);
        return;
      }
    }
  }

  if (mode === "CLEAN") {
    for (let p of clean.pills) {
      if (p.hit(mouseX, mouseY)) {
        if (game.coins < 3) { sfx("reject"); toast(bi("金币不够（需要 3）", "Not enough coins (need 3)"), 1100); return; }
        game.coins -= 3;
        clean.soapBoostUntil = millis() + 8000;
        sfx("win");
        toast(bi("泡泡肥皂已开启（8秒）", "Bubble soap enabled (8s)"), 1100);
        saveData();
        return;
      }
    }
  }

  if (mode === "SHOP") {
    for (let it of shopItems) {
      if (it.hit(mouseX, mouseY)) {
        handleShopItem(it);
        return;
      }
    }
  }

  if (mode === "MEMORY") {
    const panel = constellationRect();
    for (let s of stars) {
      if (s.hit(mouseX, mouseY, panel.x, panel.y, panel.w, panel.h)) {
        game.selectedStar = s;
        sfx("click");
        toast(bi("已选中一颗星 ✨", "Selected a star ✨"), 900);
        return;
      }
    }
  }

  const p = mouseInWorld();
  if (!p) return;

  if (mode === "FEED") {
    const rew = foodReward(feed.type);
    if (game.coins < rew.cost) { sfx("reject"); toast(bi("金币不够买这个食物～", "Not enough coins for this food~"), 1100); return; }
    game.coins -= rew.cost;
    foods.push(new Food(p.x, p.y, feed.type));
    sfx("click");
    saveData();
  }

  if (mode === "ROOM") {
    if (dist(p.x, p.y, pet.pos.x, pet.pos.y) < 140) {
      stats.fun = constrain(stats.fun + 2.5, 0, 100);
      stats.energy = constrain(stats.energy + 1.2, 0, 100);
      burst(p.x, p.y, 12);
      sfx("pop");
      pet.petBoost();
      toast(bi("摸摸它～（快乐+能量）", "Pat! (Fun+Energy)"), 1000);
      saveData();
    }
  }
}

function handleShopItem(it) {
  if (it.key.startsWith("THEME_")) {
    if (!profile.owned[it.key]) {
      if (game.coins < it.cost) { sfx("reject"); toast(bi("金币不够～", "Not enough coins~"), 1000); return; }
      game.coins -= it.cost;
      profile.owned[it.key] = true;
      sfx("win");
      toast(bi("购买成功！", "Purchased!"), 1000);
    }
    if (it.key === "THEME_SKY") profile.theme = "SKY";
    if (it.key === "THEME_CANDY") profile.theme = "CANDY";
    saveData();
    return;
  }

  if (!profile.owned[it.key]) {
    if (game.coins < it.cost) { sfx("reject"); toast(bi("金币不够～", "Not enough coins~"), 1000); return; }
    game.coins -= it.cost;
    profile.owned[it.key] = true;
    sfx("win");
    toast(bi("购买成功！再次点击可装备/启用", "Purchased! Click again to equip/enable"), 1600);
    saveData();
    return;
  }

  if (it.key === "BOW") profile.equip.bow = !profile.equip.bow;
  if (it.key === "HAT") profile.equip.hat = !profile.equip.hat;
  if (it.key === "AURA") profile.equip.aura = !profile.equip.aura;

  sfx("click");
  toast(bi("已切换", "Toggled"), 900);
  saveData();
}

function glassCard(x, y, w, h) {
  noStroke();
  fill(0, 0, 100, 10); rect(x, y, w, h, ui.cardR);
  fill(0, 0, 0, 14);   rect(x, y, w, h, ui.cardR);
}

function getWorldRect() {
  const x = 0;
  const y = ui.headerH + ui.pad;
  const w = width;
  const h = height - ui.headerH - ui.dockH - ui.pad * 2;
  return { x, y, w, h };
}

function mouseInWorld() {
  const world = getWorldRect();
  if (mouseX < world.x || mouseX > world.x + world.w) return null;
  if (mouseY < world.y || mouseY > world.y + world.h) return null;
  return { x: mouseX, y: mouseY };
}

function nearestFood(px, py, arr) {
  let best = null, bd = Infinity;
  for (let f of arr) {
    const d = dist(px, py, f.x, f.y);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}

function constellationRect() {
  const x = width - ui.pad - min(520, width * 0.42);
  const y = ui.headerH + ui.pad + 18;
  const w = min(520, width * 0.42);
  const h = min(320, height * 0.34);
  return { x, y, w, h };
}

function saveData() {
  const payload = {
    "sys": { coins: game.coins, xp: game.xp, level: game.level, dailyKey: game.dailyKey, daily: game.daily },
    "needs": { ...stats },
    theme: profile.theme,
    owned: profile.owned,
    equip: profile.equip,
    petStyle: profile.petStyle,
    stars: stars.map(s => s.pack())
  };
  localStorage.setItem("moodPet_final_bi", JSON.stringify(payload));
}

function loadData() {
  try {
    const raw = localStorage.getItem("moodPet_final_bi");
    if (!raw) return;
    const p = JSON.parse(raw);

    if (p.sys) {
      game.coins = p.sys.coins ?? game.coins;
      game.xp = p.sys.xp ?? game.xp;
      game.level = p.sys.level ?? game.level;

      if (p.sys.dailyKey === game.dailyKey && p.sys.daily) game.daily = { ...game.daily, ...p.sys.daily };
    }
    if (p.needs) for (let k in stats) if (typeof p.needs[k] === "number") stats[k] = constrain(p.needs[k], 0, 100);
    if (p.theme) profile.theme = p.theme;
    if (p.owned) profile.owned = { ...profile.owned, ...p.owned };
    if (p.equip) profile.equip = { ...profile.equip, ...p.equip };
    if (p.petStyle) profile.petStyle = { ...profile.petStyle, ...p.petStyle };
    if (Array.isArray(p.stars)) stars = p.stars.map(Star.unpack).filter(Boolean);
  } catch (e) {}
}

function sfx(type) {
  if (!osc || !env) return;
  let f = 440;
  if (type === "eat") f = random([220, 260, 300]);
  if (type === "pop") f = random([520, 620, 720]);
  if (type === "win") f = random([660, 880, 990]);
  if (type === "reject") f = 140;
  if (type === "click") f = random([360, 420]);
  osc.freq(f);
  env.play(osc);
}

// Classes

class UIButton {
  constructor(key, label, icon, x, y, w, h) {
    this.key = key;
    this.label = label;
    this.icon = icon;
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.t = random(1000);
  }
  hit(mx, my) { return mx >= this.x && mx <= this.x + this.w && my >= this.y && my <= this.y + this.h; }
  draw(activeKey) {
    this.t += 0.03;
    const active = (this.key === activeKey);
    const hover = this.hit(mouseX, mouseY);

    const pulse = 1 + (hover ? 0.03 : 0.0) * (0.5 + 0.5 * sin(this.t * 3.2));
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;

    push();
    translate(cx, cy);
    scale(pulse);

    noStroke();
    fill(active ? 320 : 0, active ? 55 : 0, active ? 100 : 100, active ? 85 : 18);
    rectMode(CENTER);
    rect(0, 0, this.w, this.h, 20);

    fill(0, 0, 100, 12);
    rect(-this.w * 0.18, -this.h * 0.18, this.w * 0.55, this.h * 0.35, 18);

    fill(active ? 55 : 200, 40, 100, 18);
    ellipse(-this.w * 0.30, 0, 32);

    drawIcon(this.icon, -this.w * 0.30, 0);

    fill(0, 0, 100, active ? 96 : 84);
    textAlign(LEFT, TOP);
    textSize(10.5);
    textLeading(12);
    text(this.label, -this.w * 0.18, -14);

    pop();
  }
}

function drawIcon(name, x, y) {
  push();
  translate(x, y);
  noStroke();
  fill(0, 0, 100, 80);

  if (name === "home") {
    triangle(-6, 2, 0, -8, 6, 2);
    rect(-5, 2, 10, 8, 2);
  }
  if (name === "food") {
    ellipse(0, 0, 10);
    rect(-2, -8, 4, 6, 2);
  }
  if (name === "clean") {
    rect(-6, -2, 12, 8, 3);
    ellipse(0, -6, 10);
  }
  if (name === "star") {
    beginShape();
    for (let i = 0; i < 10; i++) {
      const a = -HALF_PI + i * TWO_PI / 10;
      const r = (i % 2 === 0) ? 7 : 3;
      vertex(cos(a) * r, sin(a) * r);
    }
    endShape(CLOSE);
  }
  if (name === "shop") {
    rect(-7, -2, 14, 10, 3);
    rect(-5, -10, 10, 8, 3);
  }
  pop();
}

class ShopItem {
  constructor(key, title, cost) {
    this.key = key;
    this.title = title;
    this.cost = cost;
    this.x = 0; this.y = 0; this.w = 0; this.h = 0;
  }
  setRect(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; }
  hit(mx, my) { return mx >= this.x && mx <= this.x + this.w && my >= this.y && my <= this.y + this.h; }

  draw() {
    const hover = this.hit(mouseX, mouseY);
    const owned = !!profile.owned[this.key];

    const active =
      (this.key === "BOW" && profile.equip.bow) ||
      (this.key === "HAT" && profile.equip.hat) ||
      (this.key === "AURA" && profile.equip.aura) ||
      (this.key === "THEME_SKY" && profile.theme === "SKY") ||
      (this.key === "THEME_CANDY" && profile.theme === "CANDY") ||
      (this.key === "AUTO_FEEDER" && profile.owned.AUTO_FEEDER) ||
      (this.key === "VACUUM" && profile.owned.VACUUM);

    noStroke();
    fill(0, 0, 100, hover ? 12 : 10);
    rect(this.x, this.y, this.w, this.h, 18);
    fill(0, 0, 0, hover ? 16 : 14);
    rect(this.x, this.y, this.w, this.h, 18);

    const bx = this.x + this.w - 118;
    const by = this.y + 14;
    fill(active ? 140 : 320, 55, 100, 22);
    rect(bx, by, 108, 34, 999);

    fill(0, 0, 100, 90);
    textAlign(CENTER, TOP);
    textSize(9.5);
    textLeading(11);

    const badgeText = active ? bi("启用", "ACTIVE") : (owned ? bi("已拥有", "OWNED") : bi("购买", "BUY"));
    text(badgeText, bx + 54, by + 6);

    fill(0, 0, 100, 92);
    textAlign(LEFT, TOP);
    textSize(12);
    textLeading(14);
    text(this.title, this.x + 14, this.y + 14, this.w - 140, 60);

    fill(0, 0, 100, 70);
    textSize(11);
    const line = owned ? bi("点击：切换/启用", "Click: toggle/enable") : bi(`价格: ${this.cost} 金币`, `Cost: ${this.cost} coins`);
    text(line, this.x + 14, this.y + 74);
  }
}

class Pill {
  constructor(key, label, x, y, w, h) {
    this.key = key;
    this.label = label;
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.t = random(1000);
  }
  hit(mx, my) { return mx >= this.x && mx <= this.x + this.w && my >= this.y && my <= this.y + this.h; }
  draw(activeKey) {
    this.t += 0.03;
    const active = (this.key === activeKey);
    const hover = this.hit(mouseX, mouseY);
    const pulse = 1 + (hover ? 0.02 : 0) * (0.5 + 0.5 * sin(this.t * 3));

    push();
    translate(this.x + this.w / 2, this.y + this.h / 2);
    scale(pulse);
    rectMode(CENTER);
    noStroke();
    fill(active ? 320 : 0, active ? 55 : 0, 100, active ? 70 : 14);
    rect(0, 0, this.w, this.h, 999);

    fill(0, 0, 100, active ? 92 : 80);
    textAlign(CENTER, TOP);
    textSize(10.5);
    textLeading(12);
    text(this.label, 0, -12);
    pop();
  }
}

class Pet {
  constructor() {
    this.pos = getHomePoint();
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);

    this.target = getHomePoint();
    this.mode = "ARRIVE";

    this.t = random(1000);
    this.blink = 0;
    this.petGlow = 0;

    this.step = 0;
    this.faceWink = 0;
  }

  setTarget(v, mode) { this.target = v.copy(); this.mode = mode; }

  petBoost() { this.petGlow = 24; this.faceWink = 12; }

  wanderOffset() {
    const wfx = weatherEffects();
    const a = this.t * 0.8;
    const ampX = 18 * wfx.wanderMul;
    const ampY = 14 * wfx.wanderMul;
    return createVector(sin(a) * ampX, cos(a * 0.9) * ampY);
  }

  update(stats) {
    this.t += 0.035;

    const low = min(stats.hunger, stats.hygiene, stats.fun, stats.energy);
    const anxious = map(100 - low, 0, 100, 0, 1);
    const tired = stats.energy < 35 ? 1 : 0;

    const wfx = weatherEffects();
    const speedCap = (lerp(5.2, 3.2, tired) + anxious * 0.6) * wfx.speedMul;
    const forceCap = lerp(0.25, 0.18, tired) + anxious * 0.05;

    let steer = createVector(0, 0);
    if (this.mode === "ARRIVE") steer = this.arrive(this.target, speedCap);
    if (this.mode === "ARRIVE_FAST") steer = this.arrive(this.target, speedCap + 1.5);
    if (this.mode === "SEEK") steer = this.seek(this.target, speedCap);

    steer.limit(forceCap);
    this.applyForce(steer);

    this.applyForce(this.vel.copy().mult(-0.02));

    this.vel.add(this.acc);
    this.vel.limit(speedCap);
    this.pos.add(this.vel);
    this.acc.mult(0);

    const world = getWorldRect();
    this.pos.x = constrain(this.pos.x, 40, world.w - 40);
    this.pos.y = constrain(this.pos.y, world.y + 60, world.y + world.h - 40);

    this.step += this.vel.mag() * 0.06;

    if (random() < 0.010) this.blink = 10;
    if (this.blink > 0) this.blink--;
    if (this.petGlow > 0) this.petGlow--;
    if (this.faceWink > 0) this.faceWink--;
  }

  applyForce(f) { this.acc.add(f); }

  seek(target, speedCap) {
    const desired = p5.Vector.sub(target, this.pos);
    desired.setMag(speedCap);
    return p5.Vector.sub(desired, this.vel);
  }

  arrive(target, speedCap) {
    const desired = p5.Vector.sub(target, this.pos);
    const d = desired.mag();
    let s = speedCap;
    const slowRadius = 140;
    if (d < slowRadius) s = map(d, 0, slowRadius, 0, speedCap);
    desired.setMag(s);
    return p5.Vector.sub(desired, this.vel);
  }

  hitFood(f) {
    const mouth = createVector(this.pos.x, this.pos.y + 48);
    return mouth.dist(createVector(f.x, f.y)) < 34;
  }

  draw(stats, equip) {
    const low = min(stats.hunger, stats.hygiene, stats.fun, stats.energy);
    const anxious = map(100 - low, 0, 100, 0, 1);
    const happy = (low >= 65);
    const tired = (stats.energy < 35);
    const dirty = (stats.hygiene < 35);

    const base = profile.petStyle || { hue: 210, sat: 70, bri: 100, species: "CAT" };
    const moodShift = lerp(0, 25, anxious);
    const bodyHue = (base.hue + moodShift) % 360;
    const bodySat = lerp(base.sat, min(100, base.sat + 10), happy ? 1 : 0.2);
    const bodyBri = lerp(base.bri, max(80, base.bri - 8), anxious);
    const species = base.species || "CAT";

    const wag = sin(this.t * (2.2 + this.vel.mag() * 0.7)) * (18 + anxious * 10);
    const earWig = sin(this.t * 1.6) * 6;

    const mx = mouseX, my = mouseY;
    const lookX = constrain((mx - this.pos.x) / 260, -0.18, 0.18);
    const lookY = constrain((my - this.pos.y) / 260, -0.12, 0.12);

    const outline = color(0, 0, 0, 22);

    push();
    translate(this.pos.x, this.pos.y);

    if (equip.aura) {
      noStroke();
      for (let i = 0; i < 8; i++) {
        fill(280 + i * 6, 70, 100, 7 - i * 0.7);
        ellipse(0, 40, 320 + i * 20, 260 + i * 16);
      }
    }

    noStroke();
    fill(0, 0, 0, 14);
    ellipse(0, 126, 240, 42);

    if (this.petGlow > 0) {
      const a = map(this.petGlow, 0, 24, 0, 18);
      noStroke();
      fill(55, 50, 100, a);
      ellipse(0, 40, 320, 270);
    }

    // tail
    push();
    rotate(radians(wag));
    stroke(outline); strokeWeight(5);
    fill(bodyHue, bodySat, bodyBri, 95);
    if (species === "BUNNY") {
      ellipse(112, 104, 34, 30);
    } else {
      beginShape();
      vertex(94, 55);
      bezierVertex(156, 28, 156, 128, 98, 112);
      bezierVertex(112, 98, 124, 76, 94, 55);
      endShape(CLOSE);
    }
    pop();

    // ears
    stroke(outline); strokeWeight(5);
    fill(bodyHue, bodySat, bodyBri, 98);

    if (species === "BUNNY") {
      push(); translate(-70, -92 + earWig); rotate(radians(-8)); rect(-10, -70, 20, 95, 999); pop();
      push(); translate(70, -92 + earWig);  rotate(radians(8));  rect(-10, -70, 20, 95, 999); pop();
      noStroke(); fill(330, 40, 100, 45);
      ellipse(-70, -126 + earWig, 12, 30);
      ellipse(70, -126 + earWig, 12, 30);
    } else if (species === "DOG") {
      push(); translate(-96, -72 + earWig); rotate(radians(-25)); ellipse(0, 0, 44, 78); pop();
      push(); translate(96, -72 + earWig);  rotate(radians(25));  ellipse(0, 0, 44, 78); pop();
    } else {
      triangle(-92, -70 + earWig, -40, -142 + earWig, -18, -62);
      triangle(92, -70 + earWig, 40, -142 + earWig, 18, -62);
    }

    // body
    fill(bodyHue, bodySat, bodyBri, 98);
    ellipse(0, 22 + sin(this.t) * 3, 284, 232);

    noStroke();
    fill(bodyHue, 20, 100, 55);
    ellipse(0, 58, 182, 142);

    // legs
    const sp = this.vel.mag();
    const walk = min(1, sp / 3.2);
    const stepA = sin(this.step) * 10 * walk;
    const stepB = sin(this.step + PI) * 10 * walk;

    stroke(outline); strokeWeight(5);
    fill(bodyHue, bodySat, bodyBri, 98);
    ellipse(-70, 98 + stepA, 62, 50);
    ellipse(70, 98 + stepB, 62, 50);

    // cheeks
    noStroke();
    fill(350, 55, 100, happy ? 35 : 18);
    ellipse(-92, 28, 34, 22);
    ellipse(92, 28, 34, 22);

    // eyes
    stroke(outline); strokeWeight(4);
    fill(0, 0, 100, 96);
    const eyeH = (this.blink > 0) ? 6 : 30;
    const winkLeft = (this.faceWink > 0) ? 6 : eyeH;

    push();
    translate(lookX * 28, lookY * 18);
    ellipse(-60, -6, 26, winkLeft);
    ellipse(60, -6, 26, eyeH);
    pop();

    if (this.blink <= 0) {
      noStroke();
      fill(0, 0, 100, 70);
      ellipse(-66 + lookX * 18, -12 + lookY * 12, 7, 9);
      ellipse(54 + lookX * 18, -12 + lookY * 12, 7, 9);
    }

    // brows
    stroke(outline); strokeWeight(4);
    noFill();
    const brow = anxious * 14;
    arc(-60, -42, 36, 22 + brow, PI, TWO_PI);
    arc(60, -42, 36, 22 + brow, PI, TWO_PI);

    // mouth area
    noStroke();
    fill(0, 0, 100, 92);
    ellipse(0, 78, 128, 72);
    fill(0, 0, 10, 16);
    ellipse(0, 84, 104, 52);

    stroke(outline); strokeWeight(4); noFill();
    if (species === "DOG") {
      noStroke(); fill(0, 0, 20, 35); ellipse(0, 66, 18, 14);
      stroke(outline); strokeWeight(4); noFill();
      if (happy) arc(0, 72, 42, 28, 0, PI);
      else line(-16, 76, 16, 76);
    } else if (species === "BUNNY") {
      noStroke(); fill(0, 0, 20, 30); triangle(0, 64, -6, 70, 6, 70);
      stroke(outline); strokeWeight(3);
      line(0, 70, 0, 84);
      noStroke();
      fill(0, 0, 100, 92);
      rect(-6, 84, 5, 10, 2);
      rect(1, 84, 5, 10, 2);
    } else {
      if (happy) arc(0, 72, 36, 24, 0, PI);
      else if (tired || dirty) {
        beginShape();
        vertex(-16, 76);
        quadraticVertex(-6, 86, 6, 76);
        quadraticVertex(16, 66, 24, 76);
        endShape();
      } else line(-14, 76, 14, 76);
    }

    // sweat
    if (anxious > 0.65) {
      noStroke();
      fill(200, 40, 100, 55);
      ellipse(98, -24, 16, 20);
      triangle(98, -38, 90, -24, 106, -24);
    }

    // cosmetics
    if (equip.bow) {
      noStroke();
      fill(330, 65, 100, 85);
      ellipse(0, 6, 16, 14);
      ellipse(-12, 6, 20, 16);
      ellipse(12, 6, 20, 16);
    }
    if (equip.hat) {
      noStroke();
      fill(55, 70, 100, 88);
      triangle(0, -150, -44, -88, 44, -88);
      fill(0, 0, 100, 88);
      ellipse(0, -150, 12, 12);
    }

    // speech bubble
    const moodLine = this.talkLine(stats, low);
    noStroke();
    fill(0, 0, 0, 14);
    rect(-170, -162, 340, 70, 18);
    fill(0, 0, 100, 90);
    textAlign(CENTER, TOP);
    textSize(12);
    textLeading(14);
    text(moodLine, 0, -152);

    pop();
  }

  talkLine(stats, low) {
    if (mode === "MEMORY") return bi("把你的话变成星星～", "Turn your words into stars~");
    if (mode === "CLEAN") return bi("擦干净我会更安心～", "Cleaning makes me feel safe~");
    if (mode === "FEED") return bi("我饿啦！点地面投喂～", "I'm hungry! Click to feed~");
    if (mode === "SHOP") return bi("想换个装扮或颜色吗？", "Want a new look or color?");
    if (low < 25) return bi("我有点撑不住了…", "I'm not doing great…");
    if (low < 45) return bi("我们做个小仪式好吗？", "Can we do a small ritual?");
    if (low < 65) return bi("还不错～再照顾一下我吧。", "Not bad~ take care of me a bit more.");
    return bi("今天超开心！谢谢你！", "So happy today! Thank you!");
  }
}

class Food {
  constructor(x, y, kind) {
    this.x = x; this.y = y;
    this.kind = kind;
    this.r = random(10, 15);
    this.h = (kind === "GOURMET") ? 55 : (kind === "SNACK" ? 35 : random([40, 60, 80]));
    this.vx = random(-0.4, 0.4);
    this.vy = random(-0.2, 0.6);
    this.life = 320;
  }
  update() {
    this.vy += 0.04;
    this.x += this.vx;
    this.y += this.vy;

    const world = getWorldRect();
    const floorY = world.y + world.h - 28;
    if (this.y > floorY) {
      this.y = floorY;
      this.vy *= -0.35;
      this.vx *= 0.95;
    }
    this.life--;
  }
  draw() {
    noStroke();
    fill(0, 0, 0, 14);
    ellipse(this.x + 2, this.y + 4, this.r * 2.1, this.r * 1.8);

    fill(this.h, 80, 100, 85);
    ellipse(this.x, this.y, this.r * 2);

    fill(0, 0, 100, 18);
    ellipse(this.x - this.r * 0.3, this.y - this.r * 0.3, this.r, this.r * 0.6);

    fill(0, 0, 100, 14);
    rect(this.x - 18, this.y - 28, 36, 14, 6);
    fill(0, 0, 100, 75);
    textAlign(CENTER, CENTER);
    textSize(9);
    text(this.kind[0], this.x, this.y - 21);
  }
  dead() { return this.life <= 0; }
}

class Dirt {
  constructor(x, y, r) {
    this.x = x; this.y = y; this.r = r;
    this.cleaned = false;
    this.cleanPower = 0;
  }
  draw() {
    if (this.cleaned) {
      const a = map(this.cleanPower, 100, 130, 30, 0);
      noStroke();
      fill(30, 25, 25, a);
      ellipse(this.x, this.y, this.r * 2);
      this.cleanPower += 1.2;
      return;
    }

    noStroke();
    fill(0, 0, 0, 14);
    ellipse(this.x + 4, this.y + 6, this.r * 2.1, this.r * 1.7);
    fill(30, 25, 25, 50);
    ellipse(this.x, this.y, this.r * 2);

    noFill();
    stroke(55, 50, 100, 28);
    strokeWeight(3);
    const p = this.cleanPower / 100;
    arc(this.x, this.y, this.r * 2.2, this.r * 2.2, -HALF_PI, -HALF_PI + TWO_PI * p);
  }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < this.r + 18; }
  gone() { return this.cleaned && this.cleanPower > 130; }
}

class SoapBubble {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = random(-1.0, 1.0);
    this.vy = random(-2.2, -0.8);
    this.r = random(6, 14);
    this.life = 80;
    this.h = random([180, 200, 260, 320]);
  }
  update() {
    this.vy -= 0.01;
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }
  draw() {
    noStroke();
    fill(this.h, 35, 100, 18);
    ellipse(this.x, this.y, this.r * 2);
    fill(0, 0, 100, 10);
    ellipse(this.x - this.r * 0.3, this.y - this.r * 0.3, this.r, this.r * 0.6);
  }
  dead() { return this.life <= 0; }
}

class Star {
  constructor(text, emo) {
    this.text = text;
    this.emo = emo;
    this.ts = Date.now();
    this.rx = random();
    this.ry = random();
    this.size = random(5, 10);
  }
  hue() {
    if (this.emo === "HAPPY") return 55;
    if (this.emo === "SAD") return 210;
    if (this.emo === "ANGRY") return 10;
    return 160;
  }
  draw(x, y, w, h) {
    const px = x + 14 + this.rx * (w - 28);
    const py = y + 44 + this.ry * (h - 76);
    const tw = 0.6 + 0.4 * sin(frameCount * 0.04 + this.rx * 10);

    noStroke();
    fill(this.hue(), 85, 100, 60 * tw);
    ellipse(px, py, this.size * 2);

    fill(0, 0, 100, 16);
    ellipse(px - this.size * 0.2, py - this.size * 0.2, this.size, this.size * 0.7);
  }
  hit(mx, my, x, y, w, h) {
    const px = x + 14 + this.rx * (w - 28);
    const py = y + 44 + this.ry * (h - 76);
    return dist(mx, my, px, py) < (this.size + 6);
  }
  pack() { return { text: this.text, emo: this.emo, ts: this.ts, rx: this.rx, ry: this.ry, size: this.size }; }
  static unpack(p) {
    if (!p || !p.text || !p.emo) return null;
    const s = new Star(p.text, p.emo);
    s.ts = p.ts ?? Date.now();
    s.rx = typeof p.rx === "number" ? p.rx : random();
    s.ry = typeof p.ry === "number" ? p.ry : random();
    s.size = typeof p.size === "number" ? p.size : random(5, 10);
    return s;
  }
}

class Particle {
  constructor(x, y, hue) {
    this.x = x; this.y = y;
    this.vx = random(-2.2, 2.2);
    this.vy = random(-4.8, -1.2);
    this.life = 70;
    this.h = hue;
    this.r = random(3, 7);
  }
  update() { this.vy += 0.14; this.x += this.vx; this.y += this.vy; this.life--; }
  draw() {
    noStroke();
    fill(this.h, 85, 100, map(this.life, 0, 70, 0, 80));
    ellipse(this.x, this.y, this.r);
  }
  dead() { return this.life <= 0; }
}
