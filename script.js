// ===== 配置 =====
// 手机上同时播放太多 GIF 会卡，所以手机上限少一些
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const MAX_POPUPS = isMobile ? 8 : 15;   // 最多弹窗数量

// 广告弹窗标题池（可自行修改）
const AD_TITLES = [
  "🎉 恭喜您中奖了！",
  "💰 限时优惠",
  "🔥 热门推荐",
  "🎁 免费领取",
  "⭐ 精彩广告",
  "📢 特别通知",
  "🎊 惊喜活动",
  "💎 尊享特权",
];

// 弹窗图片池（assets 目录下的素材，随机取用）
const AD_IMAGES = [
  "assets/2547.GIF",
  "assets/2615.GIF",
  "assets/2600.PNG",
  "assets/76c8db04842bf7bd9ab88981148d4863.JPG",
  "assets/cb2990c259045d0ca38041491108568b.JPG",
  "assets/IMG_1624.GIF",
  "assets/IMG_9526.GIF",
];

// 弹窗最大显示尺寸占画布的比例（相对画布宽高，手机上会自动变小）
const MAX_W_RATIO = 0.28;   // 弹窗最大宽度 = 画布宽 * 0.28
const MAX_H_RATIO = 0.42;   // 弹窗最大高度 = 画布高 * 0.42

let popupCount = 0;
let popupZIndex = 1;   // 弹窗递增层级，后创建的在上层
const popupLayer = document.getElementById("popupLayer");
const playBtn = document.getElementById("playBtn");

// ===== 图片洗牌队列：一轮内不重复，全部用完后再重新洗牌 =====
let imageQueue = [];

// 洗牌函数（Fisher-Yates）
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 取下一张图：队列空了就重新洗牌
function nextImage() {
  if (imageQueue.length === 0) {
    imageQueue = shuffle(readyImages);
  }
  return imageQueue.shift();
}

// 预先加载并解码素材；弹窗只使用已经准备好的图片。
const imageCache = new Map();
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try { if (img.decode) await img.decode(); } catch (_) {}
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}
playBtn.disabled = true;
playBtn.setAttribute("aria-label", "素材加载中");
const readyImages = [];
Promise.all(AD_IMAGES.map(async (src) => {
  try {
    await loadImage(src);
    readyImages.push(src);
    // 第一张就绪就允许播放，其余素材继续后台加载。
    playBtn.disabled = false;
    playBtn.setAttribute("aria-label", "播放");
  } catch (_) { console.warn("图片加载失败：", src); }
})).then(() => {
  if (!readyImages.length) playBtn.setAttribute("aria-label", "素材加载失败，请刷新重试");
});

// 封面与壁纸准备好后，一起显示桌面，避免 UI 和图片分批出现。
Promise.all([loadImage("IMG_5614.JPG"), loadImage("未命名的作品.jpg")])
  .catch(() => {})
  .finally(() => document.documentElement.classList.remove("loading"));

// ===== 时钟 =====
function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  document.getElementById("clock").textContent = `${hh}:${mm}`;
}
updateClock();
setInterval(updateClock, 1000);

// ===== 随机整数 =====
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ===== 生成随机位置（优先四角/边缘，逐渐向中间，且避开中央播放器）=====
// 注意：弹窗的 left/top 是画布内的逻辑坐标（未受 transform 影响），
// 所以这里必须用逻辑尺寸（offsetWidth/offsetLeft），不好愤怒能用 getBoundingClientRect。
function randomPosition(w, h) {
  const desktop = document.getElementById("desktop");
  const areaW = desktop ? desktop.offsetWidth : 1280;
  const areaH = desktop ? desktop.offsetHeight : 720;
  const margin = 10;
  const maxX = areaW - w - margin;
  const maxY = areaH - h - 50; // 留出任务栏

  // 播放器在画布内是居中的，用逻辑坐标算出它的区域
  const player = document.getElementById("player");
  let avoid = null;
  if (player) {
    const pw = player.offsetWidth;
    const ph = player.offsetHeight;
    const pl = (areaW - pw) / 2;
    const pt = (areaH - ph) / 2;
    avoid = { left: pl, top: pt, right: pl + pw, bottom: pt + ph };
  }

  function overlaps(x, y) {
    if (!avoid) return false;
    return (
      x < avoid.right &&
      x + w > avoid.left &&
      y < avoid.bottom &&
      y + h > avoid.top
    );
  }

  // 画布中心
  const cx = areaW / 2;
  const cy = areaH / 2;
  // 到中心的最大可能距离（用于归一化）
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  // 生成候选点，选"离中心最远"的（即最靠边/角的），同时避开播放器
  let best = null;
  let bestScore = -1;
  for (let i = 0; i < 30; i++) {
    const x = randInt(margin, Math.max(margin, maxX));
    const y = randInt(margin, Math.max(margin, maxY));
    if (overlaps(x, y)) continue;
    // 弹窗中心到画布中心的距离
    const px = x + w / 2;
    const py = y + h / 2;
    const dist = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
    // 归一化距离 + 少量随机，避免每次都固定同一角
    const score = dist / maxDist + Math.random() * 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = { x, y };
    }
  }
  if (best) return best;

  // 兜底：所有候选都重叠播放器，就返回随机位置
  return {
    x: randInt(margin, Math.max(margin, maxX)),
    y: randInt(margin, Math.max(margin, maxY)),
  };
}

// ===== 创建广告弹窗 =====
function createAdPopup() {
  if (popupCount >= MAX_POPUPS || !readyImages.length) return;

  const idx = popupCount;
  const title = AD_TITLES[idx % AD_TITLES.length];

  // 选图：从洗牌队列取，一轮内不重复，用完再重新洗牌
  const imgSrc = nextImage();
  // 立即创建弹窗，不让慢速或失败的图片请求阻塞点击反馈。
  buildPopup(imgSrc, title);
}

// ===== 用图片真实尺寸构建弹窗 =====
function buildPopup(imgSrc, title) {
  const desktop = document.getElementById("desktop");
  const areaW = desktop ? desktop.offsetWidth : 1280;
  const areaH = desktop ? desktop.offsetHeight : 720;

  // 竖屏手机：画布是 100vh x 100vw（实际像素，无缩放），
  // 弹窗直接用较小的绝对像素，避免占满屏幕
  const isPortrait = window.innerHeight > window.innerWidth;
  let maxW, maxH;
  if (isPortrait) {
    // 屏幕短边（手机宽度）
    const shortSide = Math.min(window.innerWidth, window.innerHeight);
    // 弹窗在屏幕上占短边约 42%
    const target = shortSide * 0.42;
    maxW = target;
    maxH = target;
  } else {
    maxW = areaW * MAX_W_RATIO;
    maxH = areaH * MAX_H_RATIO;
  }

  const cached = imageCache.get(imgSrc);
  const ratio = cached.naturalWidth / cached.naturalHeight;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  w = Math.round(w);
  h = Math.round(h);

  const { x, y } = randomPosition(w, h);

  const popup = document.createElement("div");
  popup.className = "ad-popup";
  popup.style.width = w + "px";
  popup.style.height = h + "px";
  popup.style.left = x + "px";
  popup.style.top = y + "px";
  // 递增层级：后创建的弹窗整体在上层，叉叉不会串到别的弹窗上
  popup.style.zIndex = popupZIndex++;

  popup.innerHTML = `
    <span class="ad-close" title="关闭">✕</span>
    <div class="ad-body"></div>
  `;

  const body = popup.querySelector(".ad-body");
  const imgEl = imageCache.get(imgSrc).cloneNode();
  imgEl.alt = title;
  body.appendChild(imgEl);

  // 关闭按钮：关不掉，反而跳到别的位置
  const closeBtn = popup.querySelector(".ad-close");
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    movePopup(popup);
  });

  popupLayer.appendChild(popup);
  popupCount++;
}

// ===== 把弹窗移动到新位置 =====
function movePopup(popup) {
  // 用弹窗当前实际尺寸，避免图片加载后尺寸变化导致定位不准
  const w = popup.offsetWidth;
  const h = popup.offsetHeight;
  const { x, y } = randomPosition(w, h);
  popup.style.left = x + "px";
  popup.style.top = y + "px";

  // 抖动一下（用 requestAnimationFrame 避免强制同步重排）
  popup.classList.remove("shake");
  requestAnimationFrame(() => {
    popup.classList.add("shake");
  });
}

// ===== 点击播放按钮 =====
playBtn.addEventListener("click", () => {
  createAdPopup();
});

// ===== 窗口尺寸变化时，防止弹窗跑出屏幕 =====
window.addEventListener("resize", () => {
  const desktop = document.getElementById("desktop");
  const areaW = desktop ? desktop.clientWidth : window.innerWidth;
  const areaH = desktop ? desktop.clientHeight : window.innerHeight;
  document.querySelectorAll(".ad-popup").forEach((p) => {
    const w = p.offsetWidth;
    const h = p.offsetHeight;
    const left = parseInt(p.style.left, 10);
    const top = parseInt(p.style.top, 10);
    const maxX = areaW - w - 10;
    const maxY = areaH - h - 50;
    if (left > maxX) p.style.left = Math.max(10, maxX) + "px";
    if (top > maxY) p.style.top = Math.max(10, maxY) + "px";
  });
});




