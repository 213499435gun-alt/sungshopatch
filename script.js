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

// 弹窗尺寸范围（宽 x 高，单位 px）—— 随机生成，适配不同尺寸图片
const SIZE_RANGES = [
  { w: [260, 320], h: [180, 240] },
  { w: [300, 380], h: [200, 280] },
  { w: [340, 420], h: [240, 320] },
  { w: [280, 360], h: [260, 340] },
  { w: [320, 400], h: [180, 260] },
  { w: [260, 340], h: [220, 300] },
  { w: [360, 440], h: [200, 280] },
  { w: [300, 380], h: [240, 320] },
];

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
  const range = SIZE_RANGES[idx % SIZE_RANGES.length];
  const w = randInt(range.w[0], range.w[1]);
  const h = randInt(range.h[0], range.h[1]);
  const { x, y } = randomPosition(w, h);

  const popup = document.createElement("div");
  popup.className = "ad-popup";
  popup.style.width = w + "px";
  popup.style.height = h + "px";
  popup.style.left = x + "px";
  popup.style.top = y + "px";

  // 图片占位：之后替换为 assets/ad1.jpg ... ad8.jpg
  // 如果对应图片存在则显示图片，否则显示占位
  const imgSrc = `assets/ad${idx + 1}.jpg`;

  popup.innerHTML = `
    <span class="ad-close" title="关闭">✕</span>
    <div class="ad-body">
      <div class="ad-placeholder">
        <span class="ad-num">${idx + 1}</span>
        <span>广告图片 ${idx + 1}</span>
        <small>（替换 assets/ad${idx + 1}.jpg）</small>
      </div>
    </div>
  `;

  // 尝试加载图片，成功则替换占位
  const testImg = new Image();
  testImg.onload = () => {
    const body = popup.querySelector(".ad-body");
    body.innerHTML = "";
    const img = document.createElement("img");
    img.src = imgSrc;
    img.alt = title;
    body.appendChild(img);
  };
  testImg.src = imgSrc;

  // 关闭按钮：关不掉，反而跳到别的位置
  const closeBtn = popup.querySelector(".ad-close");
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    movePopup(popup, w, h);
  });

  popupLayer.appendChild(popup);
  popupCount++;
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
