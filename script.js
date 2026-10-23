// ===== 配置 =====
const MAX_POPUPS = 8;          // 最多弹窗数量

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
];

// 弹窗最大显示尺寸（宽 x 高，单位 px）—— 图片会等比缩放到这个范围内
const MAX_W = 420;
const MAX_H = 360;

let popupCount = 0;
const popupLayer = document.getElementById("popupLayer");
const playBtn = document.getElementById("playBtn");

// ===== 预加载所有广告图片 =====
// 页面加载时就把图片全部下载并解码进内存，点击时直接从缓存取，弹窗瞬间出现
const preloadedImages = {};
const preloadPromises = AD_IMAGES.map((src) => {
  const im = new Image();
  im.src = src;
  preloadedImages[src] = im;
  // decode() 返回 Promise，确保图片真正解码完成（不只是下载完）
  if (im.decode) {
    return im.decode().catch(() => {});
  }
  // 老浏览器兜底：等 onload
  return new Promise((resolve) => {
    if (im.complete) resolve();
    else {
      im.onload = () => resolve();
      im.onerror = () => resolve();
    }
  });
});
// 所有图片解码完成的标志
let imagesReady = false;
Promise.all(preloadPromises).then(() => {
  imagesReady = true;
});

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

// ===== 生成随机位置（保证在画布内，且避开中央播放按钮）=====
// 注意：弹窗的 left/top 是画布内的逻辑坐标（未受 transform 影响），
// 所以这里必须用逻辑尺寸（offsetWidth/offsetLeft），不能用 getBoundingClientRect。
function randomPosition(w, h) {
  const desktop = document.getElementById("desktop");
  const areaW = desktop ? desktop.offsetWidth : CANVAS_W;
  const areaH = desktop ? desktop.offsetHeight : CANVAS_H;
  const maxX = areaW - w - 10;
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

  // 尝试多次找一个不与播放器重叠的位置
  for (let i = 0; i < 30; i++) {
    const x = Math.max(10, randInt(10, Math.max(10, maxX)));
    const y = Math.max(10, randInt(10, Math.max(10, maxY)));
    if (!avoid) return { x, y };
    const overlap =
      x < avoid.right &&
      x + w > avoid.left &&
      y < avoid.bottom &&
      y + h > avoid.top;
    if (!overlap) return { x, y };
  }
  // 实在找不到就返回随机位置
  return {
    x: Math.max(10, randInt(10, Math.max(10, maxX))),
    y: Math.max(10, randInt(10, Math.max(10, maxY))),
  };
}

// ===== 创建广告弹窗 =====
function createAdPopup() {
  if (popupCount >= MAX_POPUPS) return;

  const idx = popupCount;
  const title = AD_TITLES[idx % AD_TITLES.length];
  const imgSrc = AD_IMAGES[randInt(0, AD_IMAGES.length - 1)];
  const cached = preloadedImages[imgSrc];

  // 确保图片已解码完成再显示，避免白屏
  const ready = cached && cached.complete && cached.naturalWidth > 0;
  if (ready && cached.decode) {
    cached.decode().then(() => buildPopup(cached, title)).catch(() => {
      buildPopup(cached, title);
    });
  } else if (ready) {
    buildPopup(cached, title);
  } else {
    // 兜底：还没加载完，等加载完成再创建
    const img = cached || new Image();
    img.onload = () => buildPopup(img, title);
    img.onerror = () => console.warn("广告图片加载失败：", imgSrc);
    if (!cached) img.src = imgSrc;
  }
}

// ===== 用图片真实尺寸构建弹窗 =====
function buildPopup(img, title) {
  const ratio = img.naturalWidth / img.naturalHeight;
  let w = MAX_W;
  let h = w / ratio;
  if (h > MAX_H) {
    h = MAX_H;
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

  popup.innerHTML = `
    <span class="ad-close" title="关闭">✕</span>
    <div class="ad-body"></div>
  `;

  const body = popup.querySelector(".ad-body");
  // 克隆图片节点，避免同一张图被多个弹窗复用时互相"抢走"导致变白
  const imgEl = img.cloneNode();
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

  // 抖动一下
  popup.classList.remove("shake");
  void popup.offsetWidth; // 触发重排以重启动画
  popup.classList.add("shake");
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

// ===== 横屏画布适配：竖屏时旋转 90° + 等比缩放铺满屏幕 =====
const rotateWrap = document.getElementById("rotateWrap");
const CANVAS_W = 1280;
const CANVAS_H = 720;

function fitCanvas() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 先重置到左上角、无偏移，只做旋转+缩放
  rotateWrap.style.left = "0px";
  rotateWrap.style.top = "0px";

  if (vh > vw) {
    // 竖屏：旋转 90°，让横屏画布铺满竖屏手机
    const s = Math.min(vw / CANVAS_H, vh / CANVAS_W);
    rotateWrap.style.transform = "rotate(90deg) scale(" + s + ")";

    // 自校准：实测旋转后元素实际占据的屏幕区域，反推偏移让它居中
    const rect = rotateWrap.getBoundingClientRect();
    const dx = (vw - rect.width) / 2 - rect.left;
    const dy = (vh - rect.height) / 2 - rect.top;
    rotateWrap.style.left = dx + "px";
    rotateWrap.style.top = dy + "px";
  } else {
    // 横屏：正常等比缩放居中
    const s = Math.min(vw / CANVAS_W, vh / CANVAS_H);
    rotateWrap.style.transform = "scale(" + s + ")";

    const rect = rotateWrap.getBoundingClientRect();
    const dx = (vw - rect.width) / 2 - rect.left;
    const dy = (vh - rect.height) / 2 - rect.top;
    rotateWrap.style.left = dx + "px";
    rotateWrap.style.top = dy + "px";
  }
}

fitCanvas();
window.addEventListener("resize", fitCanvas);
window.addEventListener("orientationchange", () => {
  setTimeout(fitCanvas, 100);
});


