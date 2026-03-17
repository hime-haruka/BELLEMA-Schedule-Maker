const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const STORAGE_KEY = "bellema-schedule-state-v3";

const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");

const imagePaths = {
  backZ: "./static/images/back-z.jpg",
  back: "./static/images/back.png",
  rows: {
    mon: { on: "./static/images/mon-on.png", off: "./static/images/mon-off.png" },
    tue: { on: "./static/images/tue-on.png", off: "./static/images/tue-off.png" },
    wed: { on: "./static/images/wed-on.png", off: "./static/images/wed-off.png" },
    thu: { on: "./static/images/thu-on.png", off: "./static/images/thu-off.png" },
    fri: { on: "./static/images/fri-on.png", off: "./static/images/fri-off.png" },
    sat: { on: "./static/images/sat-on.png", off: "./static/images/sat-off.png" },
    sun: { on: "./static/images/sun-on.png", off: "./static/images/sun-off.png" },
  },
};

const dayOrder = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const dayLabelMap = {
  mon: "MON",
  tue: "TUE",
  wed: "WED",
  thu: "THU",
  fri: "FRI",
  sat: "SAT",
  sun: "SUN",
};

const rowLayout = [
  { key: "mon", x: 980, y: 80, w: 858, h: 150 },
  { key: "tue", x: 873, y: 238, w: 858, h: 150 },
  { key: "wed", x: 980, y: 397, w: 858, h: 150 },
  { key: "thu", x: 873, y: 555, w: 858, h: 150 },
  { key: "fri", x: 980, y: 713, w: 858, h: 150 },
  { key: "sat", x: 873, y: 872, w: 858, h: 150 },
  { key: "sun", x: 980, y: 1030, w: 858, h: 150 },
].map((row) => ({
  ...row,
  y: Math.round((row.y / 1260) * CANVAS_HEIGHT),
  h: Math.round((row.h / 1260) * CANVAS_HEIGHT),
}));

const imageAreaRect = {
  x: 0,
  y: 0,
  w: 860,
  h: CANVAS_HEIGHT,
};

const textLayout = {
  on: {
    contentXRatio: 0.5,
    contentYRatio: 0.5,
    contentMaxWidthRatio: 0.6,
    contentFontSize: 26,
    subFontSize: 16,
    subOffsetY: 22,

    timeXRatio: 0.892,
    timeYRatio: 0.48,
    timeMaxWidthRatio: 0.10,
    timeFontSize: 22,
  },
};

const state = {
  assets: {
    backZ: null,
    back: null,
    rows: {},
  },

  character: {
    image: null,
    src: "",
    x: 365,
    y: 560,
    baseFitScale: 1,
    scale: 1,
    rotation: 0,
    opacity: 1,
    flipX: false,
    flipY: false,
  },

  pointer: {
    isDown: false,
    dragStarted: false,
    downX: 0,
    downY: 0,
    lastX: 0,
    lastY: 0,
    downOnCharacter: false,
    downInImageArea: false,
  },

  days: {
    mon: { enabled: true, text: "여기에 내용을 채워 주세요", time: "00:00" },
    tue: { enabled: true, text: "여기에 내용을 채워 주세요", time: "00:00" },
    wed: { enabled: true, text: "여기에 내용을 채워 주세요", time: "00:00" },
    thu: { enabled: false, text: "", time: "" },
    fri: { enabled: true, text: "여기에 내용을 채워 주세요", time: "00:00" },
    sat: { enabled: false, text: "", time: "" },
    sun: { enabled: true, text: "여기에 내용을 채워 주세요", time: "00:00" },
  },
};

const ui = {
  characterFile: document.getElementById("characterFile"),
  characterRotation: document.getElementById("characterRotation"),
  characterOpacity: document.getElementById("characterOpacity"),
  flipXBtn: document.getElementById("flipXBtn"),
  flipYBtn: document.getElementById("flipYBtn"),
  resetCharacterBtn: document.getElementById("resetCharacterBtn"),
  removeCharacterBtn: document.getElementById("removeCharacterBtn"),
  scheduleForm: document.getElementById("scheduleForm"),
  saveBtn: document.getElementById("saveBtn"),
};

function debounce(fn, wait = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

const persistState = debounce(saveStateToStorage, 150);

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지 로드 실패: ${src}`));
    img.src = src;
  });
}

async function preloadAssets() {
  try {
    state.assets.backZ = await loadImage(imagePaths.backZ);
  } catch (error) {
    console.warn("back-z.jpg 로드 실패, 생략하고 진행");
    state.assets.backZ = null;
  }

  state.assets.back = await loadImage(imagePaths.back);

  for (const day of dayOrder) {
    const [onImg, offImg] = await Promise.all([
      loadImage(imagePaths.rows[day].on),
      loadImage(imagePaths.rows[day].off),
    ]);

    state.assets.rows[day] = {
      on: onImg,
      off: offImg,
    };
  }
}

function buildScheduleForm() {
  ui.scheduleForm.innerHTML = "";

  dayOrder.forEach((dayKey) => {
    const dayState = state.days[dayKey];

    const card = document.createElement("div");
    card.className = "day-card";
    card.dataset.day = dayKey;

    const top = document.createElement("div");
    top.className = "day-card__top";

    const title = document.createElement("div");
    title.className = "day-card__title";
    title.textContent = dayLabelMap[dayKey];

    const toggleWrap = document.createElement("label");
    toggleWrap.className = "day-card__toggle";

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = dayState.enabled;
    toggle.addEventListener("change", (e) => {
      state.days[dayKey].enabled = e.target.checked;

      if (!e.target.checked) {
        state.days[dayKey].text = "";
        state.days[dayKey].time = "";
      } else {
        if (!state.days[dayKey].text) state.days[dayKey].text = "여기에 내용을 채워 주세요";
        if (!state.days[dayKey].time) state.days[dayKey].time = "00:00";
      }

      syncScheduleInputs();
      updateDayCardVisibility(dayKey);
      persistState();
      render();
    });

    const toggleText = document.createElement("span");
    toggleText.textContent = "ON";

    toggleWrap.appendChild(toggle);
    toggleWrap.appendChild(toggleText);

    top.appendChild(title);
    top.appendChild(toggleWrap);

    const contentWrap = document.createElement("div");
    contentWrap.className = "day-card__content";
    contentWrap.dataset.role = "content";

    const textField = document.createElement("div");
    textField.className = "field";

    const textLabel = document.createElement("label");
    textLabel.textContent = "내용";

    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.dataset.day = dayKey;
    textInput.dataset.kind = "text";
    textInput.placeholder = "예시: 방송 있음 (합방)";
    textInput.value = dayState.text;
    textInput.addEventListener("input", (e) => {
      state.days[dayKey].text = e.target.value;
      persistState();
      render();
    });

    const textHint = document.createElement("p");
    textHint.className = "field__hint";
    textHint.textContent = "괄호 안 텍스트는 작은 서브 텍스트로 출력돼요.";

    textField.appendChild(textLabel);
    textField.appendChild(textInput);
    textField.appendChild(textHint);

    const timeField = document.createElement("div");
    timeField.className = "field";

    const timeLabel = document.createElement("label");
    timeLabel.textContent = "시간";

    const timeInput = document.createElement("input");
    timeInput.type = "text";
    timeInput.maxLength = 5;
    timeInput.placeholder = "00:00";
    timeInput.dataset.day = dayKey;
    timeInput.dataset.kind = "time";
    timeInput.value = dayState.time;
    timeInput.addEventListener("input", (e) => {
      state.days[dayKey].time = e.target.value;
      persistState();
      render();
    });

    timeField.appendChild(timeLabel);
    timeField.appendChild(timeInput);

    contentWrap.appendChild(textField);
    contentWrap.appendChild(timeField);

    card.appendChild(top);
    card.appendChild(contentWrap);

    ui.scheduleForm.appendChild(card);
    updateDayCardVisibility(dayKey);
  });
}

function syncScheduleInputs() {
  const inputs = ui.scheduleForm.querySelectorAll("input[data-day]");
  inputs.forEach((input) => {
    const day = input.dataset.day;
    const kind = input.dataset.kind;
    input.value = state.days[day][kind];
  });

  dayOrder.forEach((dayKey) => {
    const card = ui.scheduleForm.querySelector(`.day-card[data-day="${dayKey}"]`);
    if (!card) return;

    const toggle = card.querySelector('.day-card__toggle input[type="checkbox"]');
    if (toggle) toggle.checked = state.days[dayKey].enabled;

    updateDayCardVisibility(dayKey);
  });
}

function updateDayCardVisibility(dayKey) {
  const card = ui.scheduleForm.querySelector(`.day-card[data-day="${dayKey}"]`);
  if (!card) return;

  const content = card.querySelector('[data-role="content"]');
  if (!content) return;

  content.style.display = state.days[dayKey].enabled ? "" : "none";
}

function setCharacterImage(img, src = "") {
  state.character.image = img;
  state.character.src = src;

  const targetHeight = 980;
  const fitScale = targetHeight / img.height;

  state.character.baseFitScale = fitScale;
  state.character.scale = 1;
  state.character.rotation = 0;
  state.character.opacity = 1;
  state.character.flipX = false;
  state.character.flipY = false;
  state.character.x = 365;
  state.character.y = 560;

  if (ui.characterRotation) ui.characterRotation.value = "0";
  if (ui.characterOpacity) ui.characterOpacity.value = "1";

  persistState();
  render();
}

function removeCharacterImage() {
  state.character.image = null;
  state.character.src = "";
  persistState();
  render();
}

function resetCharacterTransform() {
  if (!state.character.image) return;

  state.character.scale = 1;
  state.character.rotation = 0;
  state.character.opacity = 1;
  state.character.flipX = false;
  state.character.flipY = false;
  state.character.x = 365;
  state.character.y = 560;

  if (ui.characterRotation) ui.characterRotation.value = "0";
  if (ui.characterOpacity) ui.characterOpacity.value = "1";

  persistState();
  render();
}

function getCharacterRenderSize() {
  const img = state.character.image;
  if (!img) return null;

  const scale = state.character.baseFitScale * state.character.scale;
  return {
    width: img.width * scale,
    height: img.height * scale,
  };
}

function drawBackgroundZ(targetCtx) {
  if (state.assets.backZ) {
    targetCtx.drawImage(state.assets.backZ, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    targetCtx.fillStyle = "#000";
    targetCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
}

function drawBackground(targetCtx) {
  if (state.assets.back) {
    targetCtx.drawImage(state.assets.back, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
}

function drawCharacter(targetCtx) {
  const char = state.character;
  if (!char.image) return;

  const size = getCharacterRenderSize();
  if (!size) return;

  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.round(size.width));
  off.height = Math.max(1, Math.round(size.height));
  const offCtx = off.getContext("2d");

  offCtx.save();
  offCtx.translate(off.width / 2, off.height / 2);
  offCtx.scale(char.flipX ? -1 : 1, char.flipY ? -1 : 1);
  offCtx.globalAlpha = char.opacity;
  offCtx.drawImage(char.image, -off.width / 2, -off.height / 2, off.width, off.height);
  offCtx.restore();

  targetCtx.save();
  targetCtx.translate(char.x, char.y);
  targetCtx.rotate((char.rotation * Math.PI) / 180);
  targetCtx.drawImage(off, -off.width / 2, -off.height / 2);
  targetCtx.restore();
}

function drawRows(targetCtx) {
  rowLayout.forEach((row) => {
    const dayState = state.days[row.key];
    const rowImage = state.assets.rows[row.key]?.[dayState.enabled ? "on" : "off"];
    if (!rowImage) return;

    targetCtx.drawImage(rowImage, row.x, row.y, row.w, row.h);
    drawRowTexts(targetCtx, row, dayState);
  });
}

function fitFontSize(targetCtx, text, maxWidth, initialSize, fontWeight = 700, fontFamily = "Arial") {
  let size = initialSize;

  while (size > 12) {
    targetCtx.font = `${fontWeight} ${size}px "${fontFamily}"`;
    if (targetCtx.measureText(text).width <= maxWidth) return size;
    size -= 1;
  }

  return 12;
}

function createVerticalGradient(ctx, x, y, size, colors) {
  const gradient = ctx.createLinearGradient(x, y - size * 0.75, x, y + size * 0.75);
  const step = colors.length > 1 ? 1 / (colors.length - 1) : 1;

  colors.forEach((color, index) => {
    gradient.addColorStop(step * index, color);
  });

  return gradient;
}

function drawSpacedText(ctx, value, drawX, drawY, method = "fillText", letterSpacing = 0) {
  if (!letterSpacing) {
    ctx[method](value, drawX, drawY);
    return;
  }

  const chars = [...value];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const totalWidth = widths.reduce((sum, w) => sum + w, 0) + letterSpacing * (chars.length - 1);

  let currentX = drawX - totalWidth / 2;

  chars.forEach((ch, index) => {
    const w = widths[index];
    ctx[method](ch, currentX + w / 2, drawY);
    currentX += w + letterSpacing;
  });
}

function drawCyberText(targetCtx, options) {
  const {
    text,
    x,
    y,
    maxWidth,
    initialSize,
    align = "center",
    baseline = "middle",
    fontWeight = 700,
    fontFamily = "Arial",

    gradientColors = ["#7ef6ff", "#36d7ff", "#1a84ff"],
    strokeColor = "rgba(54, 123, 255, 0.95)",
    strokeWidth = 3,
    outerGlowColor = "rgba(42, 156, 255, 0.40)",
    outerGlowBlur = 14,

    innerShadowColor = "rgba(5, 16, 92, 0.58)",
    innerShadowOffsetY = 2,
    innerShadowStart = 0.45,

    highlightColor = "rgba(255,255,255,0.18)",
    highlightEnd = 0.32,

    letterSpacing = 0,
  } = options;

  const safeText = String(text ?? "");
  const size = fitFontSize(targetCtx, safeText, maxWidth, initialSize, fontWeight, fontFamily);

  targetCtx.save();
  targetCtx.font = `${fontWeight} ${size}px "${fontFamily}"`;
  targetCtx.textAlign = align;
  targetCtx.textBaseline = baseline;

  const metrics = targetCtx.measureText(safeText);
  const extraWidth = Math.max(0, (safeText.length - 1) * letterSpacing);
  const textWidth = Math.ceil(metrics.width + extraWidth);
  const textHeight = Math.ceil(size * 1.8);
  const pad = Math.ceil(Math.max(16, outerGlowBlur + strokeWidth + 8));

  const off = document.createElement("canvas");
  off.width = Math.max(1, textWidth + pad * 2);
  off.height = Math.max(1, textHeight + pad * 2);

  const offCtx = off.getContext("2d");
  offCtx.font = `${fontWeight} ${size}px "${fontFamily}"`;
  offCtx.textAlign = "center";
  offCtx.textBaseline = "middle";

  const cx = off.width / 2;
  const cy = off.height / 2;

  offCtx.save();
  offCtx.shadowColor = outerGlowColor;
  offCtx.shadowBlur = outerGlowBlur;
  offCtx.fillStyle = gradientColors[Math.min(1, gradientColors.length - 1)];
  drawSpacedText(offCtx, safeText, cx, cy, "fillText", letterSpacing);
  offCtx.restore();

  if (strokeWidth > 0) {
    offCtx.save();
    offCtx.lineJoin = "round";
    offCtx.miterLimit = 2;
    offCtx.lineWidth = strokeWidth;
    offCtx.strokeStyle = strokeColor;
    drawSpacedText(offCtx, safeText, cx, cy, "strokeText", letterSpacing);
    offCtx.restore();
  }

  offCtx.save();
  offCtx.fillStyle = createVerticalGradient(offCtx, cx, cy, size, gradientColors);
  drawSpacedText(offCtx, safeText, cx, cy, "fillText", letterSpacing);
  offCtx.restore();

  const highlightCanvas = document.createElement("canvas");
  highlightCanvas.width = off.width;
  highlightCanvas.height = off.height;
  const hCtx = highlightCanvas.getContext("2d");

  hCtx.font = `${fontWeight} ${size}px "${fontFamily}"`;
  hCtx.textAlign = "center";
  hCtx.textBaseline = "middle";
  hCtx.fillStyle = "#ffffff";
  drawSpacedText(hCtx, safeText, cx, cy, "fillText", letterSpacing);

  hCtx.globalCompositeOperation = "source-in";
  const highlightGradient = hCtx.createLinearGradient(0, cy - size, 0, cy + size);
  highlightGradient.addColorStop(0, highlightColor);
  highlightGradient.addColorStop(highlightEnd, "rgba(255,255,255,0)");
  highlightGradient.addColorStop(1, "rgba(255,255,255,0)");
  hCtx.fillStyle = highlightGradient;
  hCtx.fillRect(0, 0, highlightCanvas.width, highlightCanvas.height);

  offCtx.drawImage(highlightCanvas, 0, 0);

  const insetCanvas = document.createElement("canvas");
  insetCanvas.width = off.width;
  insetCanvas.height = off.height;
  const iCtx = insetCanvas.getContext("2d");

  iCtx.font = `${fontWeight} ${size}px "${fontFamily}"`;
  iCtx.textAlign = "center";
  iCtx.textBaseline = "middle";
  iCtx.fillStyle = "#ffffff";
  drawSpacedText(iCtx, safeText, cx, cy, "fillText", letterSpacing);

  iCtx.globalCompositeOperation = "source-in";
  const insetGradient = iCtx.createLinearGradient(0, cy - size * 0.2, 0, cy + size);
  insetGradient.addColorStop(0, "rgba(0,0,0,0)");
  insetGradient.addColorStop(innerShadowStart, "rgba(0,0,0,0)");
  insetGradient.addColorStop(1, innerShadowColor);
  iCtx.fillStyle = insetGradient;
  iCtx.fillRect(0, 0, insetCanvas.width, insetCanvas.height);

  offCtx.drawImage(insetCanvas, 0, innerShadowOffsetY);

  let drawX = x;
  if (align === "center") drawX = x - off.width / 2;
  else if (align === "right" || align === "end") drawX = x - off.width;

  let drawY = y;
  if (baseline === "middle") drawY = y - off.height / 2;
  else if (baseline === "bottom" || baseline === "ideographic") drawY = y - off.height;

  targetCtx.drawImage(off, drawX, drawY);
  targetCtx.restore();
}

function parseDisplayText(rawText = "") {
  const normalized = String(rawText ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return { main: "", sub: "" };
  }

  const match = normalized.match(/^(.*?)(?:\s*\(([^()]*)\))\s*$/);
  if (!match) {
    return { main: normalized, sub: "" };
  }

  const main = match[1].trim();
  const sub = match[2].trim();

  if (!main && sub) {
    return { main: sub, sub: "" };
  }

  return { main, sub };
}

function drawRowTexts(targetCtx, row, dayState) {
  if (!dayState.enabled) return;

  const contentCenterX = row.x + row.w * textLayout.on.contentXRatio;
  const contentY = row.y + row.h * textLayout.on.contentYRatio;
  const contentMaxWidth = row.w * textLayout.on.contentMaxWidthRatio;

  const timeX = row.x + row.w * textLayout.on.timeXRatio;
  const timeY = row.y + row.h * textLayout.on.timeYRatio;
  const timeMaxWidth = row.w * textLayout.on.timeMaxWidthRatio;

  const parsed = parseDisplayText(dayState.text || "");
  const mainText = parsed.main || "여기에 내용을 채워 주세요";
  const subText = parsed.sub || "";
  const time = (dayState.time || "").trim() || "00:00";

  const mainInitialSize = textLayout.on.contentFontSize;
  const subInitialSize = Math.round(textLayout.on.contentFontSize * 0.75);

  const mainLetterSpacing = 1.2;
  const subLetterSpacing = 0.6;
  const subGap = 14;

  const contentLeft = contentCenterX - contentMaxWidth / 2;
  const contentRight = contentCenterX + contentMaxWidth / 2;

  const safeRight = Math.min(contentRight, timeX - timeMaxWidth / 2 - 12);
  const safeWidth = Math.max(120, safeRight - contentLeft);

  const fittedMainSize = fitFontSize(
    targetCtx,
    mainText,
    safeWidth,
    mainInitialSize,
    700,
    "KblJump"
  );

  targetCtx.save();
  targetCtx.font = `700 ${fittedMainSize}px "KblJump"`;
  const mainWidth =
    targetCtx.measureText(mainText).width +
    Math.max(0, (mainText.length - 1) * mainLetterSpacing);
  targetCtx.restore();

  let fittedSubSize = subInitialSize;
  let subWidth = 0;

  if (subText) {
    const remainWidth = Math.max(80, safeWidth - mainWidth - subGap);

    fittedSubSize = fitFontSize(
      targetCtx,
      subText,
      remainWidth,
      subInitialSize,
      700,
      "KblJump"
    );

    targetCtx.save();
    targetCtx.font = `700 ${fittedSubSize}px "KblJump"`;
    subWidth =
      targetCtx.measureText(subText).width +
      Math.max(0, (subText.length - 1) * subLetterSpacing);
    targetCtx.restore();
  }

  const totalTextWidth = subText
    ? mainWidth + subGap + subWidth
    : mainWidth;

  const lineLeft = contentCenterX - totalTextWidth / 2;
  const mainCenterX = lineLeft + mainWidth / 2;
  const subCenterX = lineLeft + mainWidth + subGap + subWidth / 2;

  drawCyberText(targetCtx, {
    text: mainText,
    x: mainCenterX,
    y: contentY,
    maxWidth: mainWidth + 10,
    initialSize: fittedMainSize,
    align: "center",
    baseline: "middle",
    fontWeight: 700,
    fontFamily: "KblJump",
    gradientColors: ["#f8ffff", "#70ecff", "#2a8fff"],
    strokeColor: "rgba(50, 115, 255, 0)",
    strokeWidth: 3,
    outerGlowColor: "rgba(35, 156, 255, 0.26)",
    outerGlowBlur: 12,
    innerShadowColor: "rgba(5, 18, 98, 0.55)",
    innerShadowOffsetY: 2,
    innerShadowStart: 0.42,
    highlightColor: "rgba(255,255,255,0.2)",
    highlightEnd: 0.28,
    letterSpacing: mainLetterSpacing,
  });

  if (subText) {
    drawCyberText(targetCtx, {
      text: subText,
      x: subCenterX,
      y: contentY,
      maxWidth: subWidth + 10,
      initialSize: fittedSubSize,
      align: "center",
      baseline: "middle",
      fontWeight: 700,
      fontFamily: "KblJump",
      gradientColors: ["#ffffff", "#dff6ff", "#99dcff"],
      strokeColor: "rgba(89, 183, 255, 0)",
      strokeWidth: 2,
      outerGlowColor: "rgba(130, 220, 255, 0.14)",
      outerGlowBlur: 8,
      innerShadowColor: "rgba(28, 71, 140, 0.25)",
      innerShadowOffsetY: 1,
      innerShadowStart: 0.5,
      highlightColor: "rgba(255,255,255,0.1)",
      highlightEnd: 0.2,
      letterSpacing: subLetterSpacing,
    });
  }

  drawCyberText(targetCtx, {
    text: time,
    x: timeX,
    y: timeY,
    maxWidth: timeMaxWidth,
    initialSize: textLayout.on.timeFontSize,
    fontWeight: 700,
    fontFamily: "KblJump",
    gradientColors: ["#ffffff", "#42dbff", "#2b93ff"],
    strokeColor: "rgba(55, 118, 255, 0)",
    strokeWidth: 2.4,
    outerGlowColor: "rgba(36, 150, 255, 0.3)",
    outerGlowBlur: 10,
    innerShadowColor: "rgba(6, 18, 96, 0.52)",
    innerShadowOffsetY: 1.5,
    innerShadowStart: 0.46,
    highlightColor: "rgba(255,255,255,0.14)",
    highlightEnd: 0.26,
    letterSpacing: 1.2,
  });
}

function render(targetCanvas = canvas, targetCtx = ctx) {
  targetCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawBackgroundZ(targetCtx);
  drawCharacter(targetCtx);
  drawBackground(targetCtx);
  drawRows(targetCtx);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getCanvasPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function isPointInsideRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

function isPointInsideCharacter(px, py) {
  if (!state.character.image) return false;

  const size = getCharacterRenderSize();
  if (!size) return false;

  const dx = px - state.character.x;
  const dy = py - state.character.y;
  const rad = (-state.character.rotation * Math.PI) / 180;

  const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
  const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

  return (
    localX >= -size.width / 2 &&
    localX <= size.width / 2 &&
    localY >= -size.height / 2 &&
    localY <= size.height / 2
  );
}

function openImagePicker() {
  ui.characterFile.click();
}

function handleCharacterUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => setCharacterImage(img, reader.result);
    img.src = reader.result;
  };
  reader.readAsDataURL(file);

  event.target.value = "";
}

function updateCanvasHoverState(event) {
  const pos = getCanvasPointerPosition(event);
  const isHoveringImageArea = isPointInsideRect(pos.x, pos.y, imageAreaRect);
  canvas.classList.toggle("is-hover-image", isHoveringImageArea && !state.pointer.dragStarted);
}

function saveStateToStorage() {
  const payload = {
    days: state.days,
    character: {
      src: state.character.src,
      x: state.character.x,
      y: state.character.y,
      scale: state.character.scale,
      rotation: state.character.rotation,
      opacity: state.character.opacity,
      flipX: state.character.flipX,
      flipY: state.character.flipY,
    },
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("로컬 저장 실패. 업로드 이미지가 너무 크면 저장 제한에 걸릴 수 있음.");
  }
}

async function restoreStateFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);

    if (saved.days) {
      state.days = {
        ...state.days,
        ...saved.days,
      };
    }

    if (saved.character) {
      state.character.x = saved.character.x ?? state.character.x;
      state.character.y = saved.character.y ?? state.character.y;
      state.character.scale = saved.character.scale ?? state.character.scale;
      state.character.rotation = saved.character.rotation ?? state.character.rotation;
      state.character.opacity = saved.character.opacity ?? state.character.opacity;
      state.character.flipX = saved.character.flipX ?? state.character.flipX;
      state.character.flipY = saved.character.flipY ?? state.character.flipY;
      state.character.src = saved.character.src ?? "";

      if (ui.characterRotation) ui.characterRotation.value = String(state.character.rotation);
      if (ui.characterOpacity) ui.characterOpacity.value = String(state.character.opacity);

      if (state.character.src) {
        try {
          const img = await loadImage(state.character.src);
          state.character.image = img;
          const targetHeight = 980;
          state.character.baseFitScale = targetHeight / img.height;
        } catch (error) {
          console.warn("저장된 캐릭터 이미지 복원 실패");
          state.character.image = null;
          state.character.src = "";
        }
      }
    }
  } catch (error) {
    console.warn("저장된 상태 복원 실패");
  }
}

function attachEvents() {
  ui.characterFile.addEventListener("change", handleCharacterUpload);

  if (ui.characterRotation) {
    ui.characterRotation.addEventListener("input", (e) => {
      state.character.rotation = Number(e.target.value);
      persistState();
      render();
    });
  }

  if (ui.characterOpacity) {
    ui.characterOpacity.addEventListener("input", (e) => {
      state.character.opacity = Number(e.target.value);
      persistState();
      render();
    });
  }

  ui.flipXBtn.addEventListener("click", () => {
    state.character.flipX = !state.character.flipX;
    persistState();
    render();
  });

  ui.flipYBtn.addEventListener("click", () => {
    state.character.flipY = !state.character.flipY;
    persistState();
    render();
  });

  ui.resetCharacterBtn.addEventListener("click", resetCharacterTransform);
  ui.removeCharacterBtn.addEventListener("click", removeCharacterImage);

  canvas.addEventListener("pointerdown", (e) => {
    const pos = getCanvasPointerPosition(e);

    state.pointer.isDown = true;
    state.pointer.dragStarted = false;
    state.pointer.downX = pos.x;
    state.pointer.downY = pos.y;
    state.pointer.lastX = pos.x;
    state.pointer.lastY = pos.y;
    state.pointer.downOnCharacter = isPointInsideCharacter(pos.x, pos.y);
    state.pointer.downInImageArea = isPointInsideRect(pos.x, pos.y, imageAreaRect);
  });

  canvas.addEventListener("pointermove", (e) => {
    updateCanvasHoverState(e);

    if (!state.pointer.isDown) return;

    const pos = getCanvasPointerPosition(e);
    const moved = Math.hypot(pos.x - state.pointer.downX, pos.y - state.pointer.downY);

    if (!state.pointer.dragStarted && moved > 8 && state.pointer.downOnCharacter) {
      state.pointer.dragStarted = true;
      canvas.classList.add("dragging");
    }

    if (!state.pointer.dragStarted) return;

    const dx = pos.x - state.pointer.lastX;
    const dy = pos.y - state.pointer.lastY;

    state.character.x += dx;
    state.character.y += dy;

    state.pointer.lastX = pos.x;
    state.pointer.lastY = pos.y;

    persistState();
    render();
  });

  window.addEventListener("pointerup", (e) => {
    if (!state.pointer.isDown) return;

    const pos = getCanvasPointerPosition(e);
    const moved = Math.hypot(pos.x - state.pointer.downX, pos.y - state.pointer.downY);

    const shouldOpenPicker =
      !state.pointer.dragStarted &&
      moved <= 8 &&
      state.pointer.downInImageArea;

    state.pointer.isDown = false;
    state.pointer.dragStarted = false;
    state.pointer.downOnCharacter = false;
    state.pointer.downInImageArea = false;
    canvas.classList.remove("dragging");

    if (shouldOpenPicker) {
      openImagePicker();
    }
  });

canvas.addEventListener(
  "wheel",
  (e) => {
    if (!state.character.image) return;

    const pos = getCanvasPointerPosition(e);
    if (!isPointInsideCharacter(pos.x, pos.y)) return;

    e.preventDefault();

    if (e.ctrlKey) {
      const rotateStep = 2;
      state.character.rotation += e.deltaY < 0 ? rotateStep : -rotateStep;

      state.character.rotation =
        ((state.character.rotation % 360) + 360) % 360;
    } else {
      const scaleStep = 1.05;
      const delta = e.deltaY < 0 ? scaleStep : 1 / scaleStep;
      state.character.scale = clamp(state.character.scale * delta, 0.2, 3);
    }

    persistState();
    render();
  },
  { passive: false }
);

  ui.saveBtn.addEventListener("click", () => {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = CANVAS_WIDTH;
    exportCanvas.height = CANVAS_HEIGHT;
    const exportCtx = exportCanvas.getContext("2d");

    render(exportCanvas, exportCtx);

    const link = document.createElement("a");
    link.href = exportCanvas.toDataURL("image/png");
    link.download = `bellema-schedule-${Date.now()}.png`;
    link.click();
  });
}

async function init() {
  buildScheduleForm();
  attachEvents();

  try {
    await preloadAssets();
    await restoreStateFromStorage();
    syncScheduleInputs();
    render();
  } catch (error) {
    console.error(error);
    alert("이미지 파일 로드에 실패했어. 경로를 다시 확인해줘.");
  }
}

init();
