import { MODULES, deriveMetrics, loadPlatformState, renderShell, setShellContext } from "./core.js";

function renderKpis(root, metrics) {
  root.insertAdjacentHTML("beforeend", `
    <section class="content-section">
      <div class="section-heading">
        <div>
          <h3>当前接入能力</h3>
          <p>汇总当前对象数量、专题资料数量和图层目录数量。</p>
        </div>
      </div>
      <div class="metric-grid">
        <article class="metric-card"><span>井位对象</span><strong>${metrics.wellCount}</strong></article>
        <article class="metric-card"><span>盆地对象</span><strong>${metrics.basinCount}</strong></article>
        <article class="metric-card"><span>合同区块</span><strong>${metrics.blockCount}</strong></article>
        <article class="metric-card"><span>合同对象</span><strong>${metrics.contractProfileCount}</strong></article>
        <article class="metric-card"><span>油气田对象</span><strong>${metrics.fieldCount}</strong></article>
        <article class="metric-card"><span>区块资料对象</span><strong>${metrics.blockProfileCount}</strong></article>
        <article class="metric-card"><span>油气田资料对象</span><strong>${metrics.fieldProfileCount}</strong></article>
        <article class="metric-card"><span>样例曲线点</span><strong>${metrics.logCount}</strong></article>
        <article class="metric-card"><span>井专题表</span><strong>${metrics.wellTableCount}</strong></article>
        <article class="metric-card"><span>盆地专题表</span><strong>${metrics.basinTableCount}</strong></article>
        <article class="metric-card"><span>区块专题表</span><strong>${metrics.blockTableCount}</strong></article>
        <article class="metric-card"><span>合同专题表</span><strong>${metrics.contractTableCount}</strong></article>
        <article class="metric-card"><span>油气田专题表</span><strong>${metrics.fieldTableCount}</strong></article>
      </div>
    </section>
  `);
}

function renderModuleCards(root) {
  root.insertAdjacentHTML("beforeend", `
    <section class="content-section">
      <div class="section-heading">
        <div>
          <h3>平台模块</h3>
          <p>按模块进入数据查看和服务管理。</p>
        </div>
      </div>
      <div class="module-grid module-grid--wide">
        ${MODULES.filter(module => module.key !== "overview").map(module => `
          <article class="module-card module-card--nav">
            <div class="module-head">
              <span>${module.subtitle}</span>
              <small>模块页</small>
            </div>
            <h3>${module.title}</h3>
            <p>${module.description}</p>
            <a class="module-link" href="${module.href}">进入模块</a>
          </article>
        `).join("")}
      </div>
    </section>
  `);
}

function renderArchitecture(root, state) {
  root.insertAdjacentHTML("beforeend", `
    <section class="content-section content-grid">
      <article class="content-card">
        <h3>数据底座与读取边界</h3>
        <ul class="plain-list">
          <li>PostgreSQL：对象档案、专题表、测井序列、评价参数与评价运行记录</li>
          <li>PostGIS：盆地、合同区块、油气田和井位的属性与几何，按需输出 GeoJSON</li>
          <li>MinIO：PDF、Excel、Shapefile 及其附属文件的原件；数据库仅保存目录和对象键</li>
          <li>Node 数据 API：前端唯一的数据入口，负责查询、空间筛选、文件下载和评价计算</li>
          <li>空间总览：先加载小图层，井位按批次读取；全量井位由用户在地图中显式触发</li>
        </ul>
      </article>
      <article class="content-card">
        <h3>业务模块分工</h3>
        <ul class="plain-list">
          <li>数据概览：数据规模、模块入口与数据底座说明</li>
          <li>数据信息模块：空间总览、对象资料、区域专题和资料目录</li>
          <li>评价算法模块：经济评价流程与评价方法库；计算由后端使用库内数据执行</li>
          <li>服务状态：API、图层数量、资料清单与数据治理待办</li>
        </ul>
      </article>
    </section>
  `);
}

function renderRecommendations(root) {
  root.insertAdjacentHTML("beforeend", "");
}

function renderLoadingHome(root) {
  root.innerHTML = `
    <section class="content-section">
      <div class="section-heading">
        <div>
          <h3>数据加载中</h3>
          <p>正在通过平台数据 API 读取数据库中的对象资料与模块配置；空间图层进入地图工作区后再读取。</p>
        </div>
      </div>
      <div class="module-grid module-grid--wide">
        ${MODULES.filter(module => module.key !== "overview").map(module => `
          <article class="module-card module-card--nav">
            <div class="module-head">
              <span>${module.subtitle}</span>
              <small>模块页</small>
            </div>
            <h3>${module.title}</h3>
            <p>${module.description}</p>
            <a class="module-link" href="${module.href}">先进入模块</a>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderOverviewWorkspace(root) {
  root.innerHTML = `
    <div class="module-workbench module-workbench--overview">
      <section class="module-workbench__content">
        <div class="module-contextbar"><span>平台总览</span><i>/</i><strong id="overviewWorkspaceTitle">接入概览</strong></div>
        <section class="overview-module-panel" data-overview-panel="platform"><div id="overviewPlatform"></div></section>
        <section class="overview-module-panel" data-overview-panel="modules"><div id="overviewModules"></div></section>
        <section class="overview-module-panel" data-overview-panel="architecture"><div id="overviewArchitecture"></div></section>
      </section>
    </div>
  `;
  const panels = [...root.querySelectorAll("[data-overview-panel]")];
  const title = root.querySelector("#overviewWorkspaceTitle");
  let activeView = "platform";

  const mountContext = () => {
    const context = setShellContext(`
      <div class="nav-context__title">平台总览</div>
      <div class="nav-context__group">工作区</div>
      <button type="button" class="nav-context__item" data-overview-view="platform"><i></i>接入概览</button>
      <button type="button" class="nav-context__item" data-overview-view="modules"><i></i>业务模块</button>
      <button type="button" class="nav-context__item" data-overview-view="architecture"><i></i>数据构成</button>
    `);
    context?.querySelectorAll("[data-overview-view]").forEach(button => {
      button.addEventListener("click", () => activate(button.dataset.overviewView));
    });
    sync();
  };

  const sync = () => {
    document.querySelectorAll("[data-overview-view]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.overviewView === activeView);
    });
    panels.forEach(panel => panel.classList.toggle("is-active", panel.dataset.overviewPanel === activeView));
    const activeButton = document.querySelector(`[data-overview-view="${activeView}"]`);
    if (title && activeButton) title.textContent = activeButton.textContent.trim();
  };

  const activate = view => {
    activeView = view;
    sync();
  };

  mountContext();
  window.addEventListener("module-shown", event => {
    if (event.detail?.key === "overview") mountContext();
  });
  return {
    platform: root.querySelector("#overviewPlatform"),
    modules: root.querySelector("#overviewModules"),
    architecture: root.querySelector("#overviewArchitecture")
  };
}

async function init() {
  const root = renderShell({
    currentKey: "overview",
    heroTitle: "数据概览",
    heroDesc: "查看当前接入的数据对象、专题资料和模块入口。",
    heroMeta: ["PostgreSQL / PostGIS", "盆地 / 区块 / 井位"]
  });
  const views = renderOverviewWorkspace(root);
  renderLoadingHome(views.platform);
  const state = await loadPlatformState({ includeMapLayers: false });
  const metrics = deriveMetrics(state);
  views.platform.innerHTML = "";
  renderKpis(views.platform, metrics);
  renderModuleCards(views.modules);
  renderArchitecture(views.architecture, state);
  renderRecommendations(views.architecture);
}

init().catch(error => {
  const container = document.querySelector('[data-module-container="overview"]') || document.body;
  container.innerHTML = `<pre class="error-panel">${error.message}</pre>`;
});
