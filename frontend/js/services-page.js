import { loadPlatformState, renderShell, safeText, setShellContext } from "./core.js";

function riskClass(level = "") {
  if (level.includes("高")) return "risk-high";
  if (level.includes("中")) return "risk-mid";
  return "risk-low";
}

async function init() {
  const root = renderShell({
    currentKey: "services",
    heroTitle: "服务状态",
    heroDesc: "查看当前接口、图层和资料文件状态。",
    heroMeta: ["REST API", "图层目录", "数据治理"]
  });
  const state = await loadPlatformState({ includeMapLayers: false });

  root.innerHTML = `
    <div class="module-workbench module-workbench--services">
      <section class="module-workbench__content">
        <div class="module-contextbar"><span>服务与治理</span><i>/</i><strong id="serviceWorkspaceTitle">REST API</strong></div>
        <section class="service-module-panel" data-service-panel="api">
          <section class="content-section">
            <div class="section-heading"><div><h3>REST API</h3><p>查看平台当前发布的访问接口及用途。</p></div></div>
            <div class="list-stack service-list" id="apiList"></div>
          </section>
        </section>
        <section class="service-module-panel" data-service-panel="layers">
          <section class="content-section">
            <div class="section-heading"><div><h3>地图图层</h3><p>查看已接入的空间服务、图层类型和数据来源。</p></div></div>
            <div class="list-stack service-list" id="layerList"></div>
          </section>
        </section>
        <section class="service-module-panel" data-service-panel="quality">
          <section class="content-section">
            <div class="section-heading"><div><h3>数据治理待办</h3><p>查看当前数据接入、字段治理和质量核查事项。</p></div></div>
            <div class="quality-list" id="qualityList"></div>
          </section>
        </section>
        <section class="service-module-panel" data-service-panel="inventory">
          <section class="content-section">
            <div class="section-heading"><div><h3>数据清单统计</h3><p>按对象类型查看已接入专题表及数据行数。</p></div></div>
            <div class="list-stack service-list" id="inventoryList"></div>
          </section>
        </section>
        <section class="service-module-panel" data-service-panel="roadmap">
          <section class="content-section">
            <div class="section-heading"><div><h3>建设计划</h3><p>记录当前待处理事项和后续接入计划。</p></div></div>
            <div class="timeline" id="roadmapList"></div>
          </section>
        </section>
      </section>
    </div>
  `;

  const servicePanels = [...root.querySelectorAll("[data-service-panel]")];
  const serviceTitle = root.querySelector("#serviceWorkspaceTitle");
  let activeServiceView = "api";

  const syncServiceView = () => {
    document.querySelectorAll("[data-service-view]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.serviceView === activeServiceView);
    });
    servicePanels.forEach(panel => panel.classList.toggle("is-active", panel.dataset.servicePanel === activeServiceView));
    const activeButton = document.querySelector(`[data-service-view="${activeServiceView}"]`);
    if (serviceTitle && activeButton) serviceTitle.textContent = activeButton.textContent.trim();
  };

  const activateServiceView = view => {
    activeServiceView = view;
    syncServiceView();
  };

  const mountServiceContext = () => {
    const context = setShellContext(`
      <div class="nav-context__title">服务与治理</div>
      <div class="nav-context__group">服务目录</div>
      <button type="button" class="nav-context__item" data-service-view="api"><i></i>REST API</button>
      <button type="button" class="nav-context__item" data-service-view="layers"><i></i>地图图层</button>
      <div class="nav-context__group">数据治理</div>
      <button type="button" class="nav-context__item" data-service-view="quality"><i></i>治理待办</button>
      <button type="button" class="nav-context__item" data-service-view="inventory"><i></i>数据清单</button>
      <div class="nav-context__group">建设管理</div>
      <button type="button" class="nav-context__item" data-service-view="roadmap"><i></i>建设计划</button>
    `);
    context?.querySelectorAll("[data-service-view]").forEach(button => {
      button.addEventListener("click", () => activateServiceView(button.dataset.serviceView));
    });
    syncServiceView();
  };

  mountServiceContext();
  window.addEventListener("module-shown", event => {
    if (event.detail?.key === "services") mountServiceContext();
  });

  const renderDirectoryTable = (columns, rows, emptyText) => `
    <div class="table-wrap service-table-wrap">
      <table>
        <thead><tr>${columns.map(column => `<th>${column}</th>`).join("")}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${columns.length}">${emptyText}</td></tr>`}</tbody>
      </table>
    </div>
  `;

  root.querySelector("#apiList").innerHTML = renderDirectoryTable(
    ["请求方式", "接口地址", "用途说明"],
    (state.overview.apiEndpoints || []).map(api => `
      <tr><td><strong>${safeText(api.method)}</strong></td><td><code>${safeText(api.path)}</code></td><td>${safeText(api.description)}</td></tr>
    `).join(""),
    "system_overview.json 中尚未配置接口清单。"
  );

  root.querySelector("#layerList").innerHTML = renderDirectoryTable(
    ["图层名称", "图层类型", "服务", "数据来源"],
    (state.overview.layerCatalog || []).map(layer => `
      <tr><td><strong>${safeText(layer.name)}</strong></td><td>${safeText(layer.type)}</td><td>${safeText(layer.service)}</td><td>${safeText(layer.source)}</td></tr>
    `).join(""),
    "当前未配置图层目录。"
  );

  root.querySelector("#qualityList").innerHTML = (state.overview.dataQuality || []).map(item => `
    <article class="quality-item ${riskClass(item.level)}">
      <div class="quality-title">
        <strong>${safeText(item.name)}</strong>
        <span>${safeText(item.level)}</span>
      </div>
      <div class="progress-bar"><i style="width:${Number(item.progress || 0)}%"></i></div>
      <p>${safeText(item.action)}</p>
    </article>
  `).join("") || `<article class="info-tile"><h4>暂无治理清单</h4><p>当前未配置治理待办。</p></article>`;

  const inventoryEntries = [
    ...Object.entries(state.dataInventory?.well_tables || {}).map(([name, count]) => ({ group: "井表", name, count })),
    ...Object.entries(state.dataInventory?.basin_tables || {}).map(([name, count]) => ({ group: "盆地表", name, count })),
    ...Object.entries(state.dataInventory?.block_tables || {}).map(([name, count]) => ({ group: "区块表", name, count })),
    ...Object.entries(state.dataInventory?.contract_tables || {}).map(([name, count]) => ({ group: "合同表", name, count })),
    ...Object.entries(state.dataInventory?.field_tables || {}).map(([name, count]) => ({ group: "油气田表", name, count }))
  ];
  root.querySelector("#inventoryList").innerHTML = renderDirectoryTable(
    ["对象类型", "专题表", "数据行数"],
    inventoryEntries.map(item => `
      <tr><td>${safeText(item.group)}</td><td>${safeText(item.name)}</td><td>${safeText(item.count)}</td></tr>
    `).join(""),
    "当前未配置资料清单。"
  );

  root.querySelector("#roadmapList").innerHTML = (state.overview.roadmap || []).map(item => `
    <article>
      <span>${safeText(item.phase)}</span>
      <h3>${safeText(item.title)}</h3>
      <small>${safeText(item.window)}</small>
      <ul>${(item.items || []).map(plan => `<li>${safeText(plan)}</li>`).join("")}</ul>
    </article>
  `).join("") || `<article class="info-tile"><h4>暂无建设计划</h4><p>当前未配置计划内容。</p></article>`;
}

init().catch(error => {
  const container = document.querySelector('[data-module-container="services"]') || document.body;
  container.innerHTML = `<pre class="error-panel">${error.message}</pre>`;
});
