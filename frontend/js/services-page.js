import { loadPlatformState, renderShell, safeText } from "./core.js";

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
    <section class="content-section content-grid">
      <article class="content-card">
        <h3>REST API</h3>
        <div class="list-stack" id="apiList"></div>
      </article>
      <article class="content-card">
        <h3>地图图层</h3>
        <div class="list-stack" id="layerList"></div>
      </article>
    </section>
    <section class="content-section content-grid">
      <article class="content-card">
        <h3>数据治理待办</h3>
        <div class="quality-list" id="qualityList"></div>
      </article>
      <article class="content-card">
        <h3>数据清单统计</h3>
        <div class="list-stack" id="inventoryList"></div>
      </article>
    </section>
    <section class="content-section">
      <div class="section-heading">
        <div>
          <h3>建设计划</h3>
          <p>记录当前待处理事项和后续接入计划。</p>
        </div>
      </div>
      <div class="timeline" id="roadmapList"></div>
    </section>
  `;

  root.querySelector("#apiList").innerHTML = (state.overview.apiEndpoints || []).map(api => `
    <article class="info-tile">
      <h4>${safeText(api.method)} ${safeText(api.path)}</h4>
      <p>${safeText(api.description)}</p>
    </article>
  `).join("") || `<article class="info-tile"><h4>暂无接口目录</h4><p>system_overview.json 中尚未配置接口清单。</p></article>`;

  root.querySelector("#layerList").innerHTML = (state.overview.layerCatalog || []).map(layer => `
    <article class="info-tile">
      <h4>${safeText(layer.name)}</h4>
      <p>${safeText(layer.type)} / ${safeText(layer.service)}</p>
      <small>${safeText(layer.source)}</small>
    </article>
  `).join("") || `<article class="info-tile"><h4>暂无图层目录</h4><p>当前未配置图层目录。</p></article>`;

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
  root.querySelector("#inventoryList").innerHTML = inventoryEntries.map(item => `
    <article class="info-tile">
      <h4>${item.group}</h4>
      <p>${item.name}</p>
      <small>数据行数：${item.count}</small>
    </article>
  `).join("") || `<article class="info-tile"><h4>暂无数据清单</h4><p>当前未配置资料清单。</p></article>`;

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
