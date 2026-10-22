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

// ===== 生成随机位置（保证在屏幕内）=====
function randomPosition(w, h) {
  const maxX = window.innerWidth - w - 10;
  const maxY = window.innerHeight - h - 50; // 留出任务栏
  const x = Math.max(10, randInt(10, Math.max(10, maxX)));
  const y = Math.max(10, randInt(10, Math.max(10, maxY)));
  return { x, y };
}

// ===== 创建广告弹窗 =====
function createAdPopup() {
  if (popupCount >= MAX_POPUPS) return;

  const idx = popupCount;
  const title = AD_TITLES[idx % AD_TITLES.length];
  const imgSrc = AD_IMAGES[randInt(0, AD_IMAGES.length - 1)];

  // 先加载图片，拿到原始尺寸后按比例计算弹窗大小
  const img = new Image();
  img.onload = () => {
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
    img.alt = title;
    body.appendChild(img);

    // 关闭按钮：关不掉，反而跳到别的位置
    const closeBtn = popup.querySelector(".ad-close");
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      movePopup(popup, w, h);
    });

    popupLayer.appendChild(popup);
    popupCount++;
  };
  img.onerror = () => {
    console.warn("广告图片加载失败：", imgSrc);
  };
  img.src = imgSrc;
}

// ===== 把弹窗移动到新位置 =====
function movePopup(popup, w, h) {
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
  document.querySelectorAll(".ad-popup").forEach((p) => {
    const w = p.offsetWidth;
    const h = p.offsetHeight;
    const left = parseInt(p.style.left, 10);
    const top = parseInt(p.style.top, 10);
    const maxX = window.innerWidth - w - 10;
    const maxY = window.innerHeight - h - 50;
    if (left > maxX) p.style.left = Math.max(10, maxX) + "px";
    if (top > maxY) p.style.top = Math.max(10, maxY) + "px";
  });
});
