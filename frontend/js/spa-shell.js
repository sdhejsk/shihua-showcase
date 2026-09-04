const SCRIPT_BY_KEY = {
  overview: "./home-page.js",
  data: "./data-page.js",
  evaluation: "./evaluation-page.js",
  services: "./services-page.js"
};
const HREF_TO_KEY = {
  "./index.html": "overview",
  "index.html": "overview",
  "./data.html": "data",
  "data.html": "data",
  "./evaluation.html": "evaluation",
  "evaluation.html": "evaluation",
  "./services.html": "services",
  "services.html": "services"
};

const loaded = new Set();
let activeKey = null;

function applyHero(key) {
  const hero = window.__moduleHero?.[key];
  if (!hero) return;
  const shell = document.querySelector(".app-shell[data-spa-shell]");
  if (!shell) return;
  const modeTitle = shell.querySelector(".mode-card strong");
  const modeSubtitle = shell.querySelector(".mode-card small");
  if (modeTitle) modeTitle.textContent = hero.moduleTitle;
  if (modeSubtitle) modeSubtitle.textContent = hero.moduleSubtitle;
  const heroEyebrow = shell.querySelector(".page-hero__eyebrow");
  const heroTitleNode = shell.querySelector(".page-hero h2");
  const heroDescNode = shell.querySelector(".page-hero p");
  const heroTags = shell.querySelector(".hero-tags");
  if (heroEyebrow) heroEyebrow.textContent = hero.moduleTitle;
  if (heroTitleNode) heroTitleNode.textContent = hero.heroTitle;
  if (heroDescNode) heroDescNode.textContent = hero.heroDesc;
  if (heroTags) heroTags.innerHTML = (hero.heroMeta || []).map(item => `<span>${item}</span>`).join("");
}

function activate(key) {
  if (!SCRIPT_BY_KEY[key] || key === activeKey) {
    applyHero(key);
    return;
  }
  activeKey = key;
  document.querySelectorAll("[data-module-container]").forEach(el => {
    el.style.display = el.dataset.moduleContainer === key ? "" : "none";
  });
  document.querySelectorAll("[data-module-nav]").forEach(el => {
    el.classList.toggle("is-active", el.dataset.moduleNav === key);
  });
  applyHero(key);
  if (!loaded.has(key)) {
    loaded.add(key);
    import(SCRIPT_BY_KEY[key]).catch(error => {
      console.error("模块加载失败", key, error);
    });
  }
  window.dispatchEvent(new CustomEvent("module-shown", { detail: { key } }));
  if (location.hash !== `#${key}`) {
    history.replaceState(null, "", `#${key}`);
  }
}

document.querySelectorAll("[data-module-nav]").forEach(el => {
  el.addEventListener("click", event => {
    event.preventDefault();
    activate(el.dataset.moduleNav);
  });
});

document.addEventListener("click", event => {
  const anchor = event.target.closest('a[href]');
  if (!anchor) return;
  const href = anchor.getAttribute("href") || "";
  const clean = href.split("#")[0].split("?")[0];
  const key = HREF_TO_KEY[clean] || HREF_TO_KEY[clean.replace(/^.*\//, "")];
  if (key && SCRIPT_BY_KEY[key]) {
    event.preventDefault();
    activate(key);
  }
});

window.addEventListener("hashchange", () => {
  const key = (location.hash || "").replace("#", "") || "overview";
  if (SCRIPT_BY_KEY[key]) activate(key);
});

const initialKey = (location.hash || "").replace("#", "") || "overview";
activeKey = null;
activate(initialKey);
