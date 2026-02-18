/*
  Home page script (isolated from task page script)
*/

const TASKS = [
  { id: "new-level", title: "علام جيت لِفل جديد", desc: "إثبات نقطتين + حساب م س م + حساب قراءة الجيت لفل + صور." },
  { id: "check-tbm-villa-wall", title: "تشييك تايبيم (TBM) فيلا أو سور", desc: "(لاحقًا) فورم مراجعة TBM." },
  { id: "check-slabs", title: "تشييك على الأسقف", desc: "(لاحقًا) فورم الأسقف." },
  { id: "check-excavation-level", title: "تشييك على منسوب الحفر", desc: "(لاحقًا) فورم الحفر." },
  { id: "stake-demarcation", title: "توقيع نقاط الديماركشن", desc: "(لاحقًا) فورم الديماركشن." },
  { id: "stake-villa-points", title: "توقيع نقاط داخل الفيلا", desc: "(لاحقًا) فورم نقاط الفيلا." },
  { id: "survey-for-consultant", title: "رفع أرض للاستشاري", desc: "(لاحقًا) فورم الرفع للاستشاري." },
  { id: "natural-ground-survey", title: "رفع أرض طبيعية", desc: "(لاحقًا) فورم الأرض الطبيعية." },
];

const $ = (s, r = document) => r.querySelector(s);

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (_) {
    return false;
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderHomeCards() {
  $("#cards").innerHTML = TASKS.map((t) => {
    return `
      <a class="cardLink" href="./tasks/${encodeURIComponent(t.id)}.html">
        <h3 class="cardTitle">${escapeHtml(t.title)}</h3>
      </a>
    `;
  }).join("");
}

function loadTheme() {
  safeStorageSet("theme", "light");
  document.body.classList.add("light-mode");
  $("#themeToggle").textContent = "🌙";
}

function toggleTheme() {
  const isLight = document.body.classList.contains("light-mode");
  const newTheme = isLight ? "dark" : "light";
  safeStorageSet("theme", newTheme);
  document.body.classList.toggle("light-mode", !isLight);
  $("#themeToggle").textContent = newTheme === "light" ? "🌙" : "☀️";
}

function showHome() {
  renderHomeCards();

  const footer = $("#gridFooter");
  if (footer) {
    footer.style.display = "none";
  }
}

function wireGlobalEvents() {
  $("#themeToggle").addEventListener("click", toggleTheme);
}

function warmTaskPageAssets() {
  const assets = [
    ...TASKS.map((t) => ({
      href: `./tasks/${encodeURIComponent(t.id)}.html`,
      as: "document",
    })),
    { href: "./assets/css/task.css", as: "style" },
    { href: "./assets/JS/task.js", as: "script" },
    { href: "./assets/JS/pwa-update.js", as: "script" },
  ];

  for (const asset of assets) {
    if (
      document.head.querySelector(
        `link[rel="prefetch"][href="${asset.href}"]`,
      )
    ) {
      continue;
    }

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = asset.href;
    if (asset.as) link.as = asset.as;
    document.head.appendChild(link);
  }
}

(function init() {
  loadTheme();
  showHome();
  wireGlobalEvents();
  warmTaskPageAssets();
})();
