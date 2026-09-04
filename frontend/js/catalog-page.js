import { formatNumber, loadPlatformState, renderShell, safeText } from "./core.js";

function renderFeatureList(features, mapper) {
  if (!features.length) {
    return `<article class="info-tile"><h4>暂无数据</h4><p>当前模块没有加载到对应对象。</p></article>`;
  }
  return features.map(feature => mapper(feature)).join("");
}

function renderModuleGrid(container, modules) {
  container.innerHTML = modules.map(module => `
    <article class="module-card">
      <div class="module-head">
        <span>${module.status}</span>
        <small>${module.owner}</small>
      </div>
      <h3>${module.name}</h3>
      <p>${module.description}</p>
      <div class="tag-row">${(module.inputs || []).map(item => `<b>${item}</b>`).join("")}</div>
      <div class="module-output">输出：${(module.outputs || []).join("、")}</div>
    </article>
  `).join("");
}

async function init() {
  const root = renderShell({
    currentKey: "catalog",
    heroTitle: "数据目录",
    heroDesc: "浏览当前已接入的盆地、合同区块、井位和专题资料。",
    heroMeta: ["盆地名录", "区块名录", "井位名录"]
  });
  const state = await loadPlatformState({ includeMapLayers: false });
  const blockProfiles = state.blockData?.profiles || {};
  const blockTables = state.blockData?.tables || {};

  root.innerHTML = `
    <section class="content-section">
      <div class="section-heading">
        <div>
          <h3>对象名录</h3>
          <p>统一浏览当前对象和专题资料清单。</p>
        </div>
      </div>
      <div class="content-grid content-grid--triple">
        <article class="content-card">
          <h3>盆地名录</h3>
          <div id="basinList" class="list-stack"></div>
        </article>
        <article class="content-card">
          <h3>区块名录</h3>
          <div id="blockList" class="list-stack"></div>
        </article>
        <article class="content-card">
          <h3>井位名录</h3>
          <div id="wellList" class="list-stack"></div>
        </article>
      </div>
    </section>
    <section class="content-section content-grid">
      <article class="content-card">
        <h3>系统数据能力</h3>
        <div id="moduleGrid" class="module-grid"></div>
      </article>
      <article class="content-card">
        <h3>当前资料覆盖</h3>
        <div class="tiles-grid" id="coverageTiles"></div>
      </article>
    </section>
  `;

  root.querySelector("#basinList").innerHTML = renderFeatureList(state.structuresGeoJson.features, feature => `
    <article class="info-tile">
      <h4>${safeText(feature.properties?.basin_name)}</h4>
      <p>${safeText(feature.properties?.countries)} / ${safeText(feature.properties?.king_class)}</p>
      <small>面积：${feature.properties?.bs_skm ? `${formatNumber(feature.properties.bs_skm, 1)} km²` : "-"}</small>
    </article>
  `);

  root.querySelector("#blockList").innerHTML = renderFeatureList(state.blocksGeoJson.features, feature => `
    <article class="info-tile">
      <h4>${safeText(feature.properties?.block_name)}</h4>
      <p>${safeText(blockProfiles[feature.properties?.block_name]?.contract_name || feature.properties?.contract)} / ${safeText(blockProfiles[feature.properties?.block_name]?.country_name || feature.properties?.country)}</p>
      <small>盆地：${safeText(blockProfiles[feature.properties?.block_name]?.basin_names || feature.properties?.bas_names)}</small>
      <small>作业者：${safeText(blockProfiles[feature.properties?.block_name]?.operator_name || feature.properties?.operator)}</small>
      <small>状态：${safeText(blockProfiles[feature.properties?.block_name]?.contract_status || feature.properties?.con_status || blockProfiles[feature.properties?.block_name]?.block_status || feature.properties?.blk_status)}</small>
      <small>面积：${feature.properties?.blk_sqkm ? `${formatNumber(feature.properties.blk_sqkm, 1)} km²` : (blockProfiles[feature.properties?.block_name]?.block_sqkm ? `${formatNumber(blockProfiles[feature.properties?.block_name].block_sqkm, 1)} km²` : "-")}</small>
    </article>
  `);

  root.querySelector("#wellList").innerHTML = renderFeatureList(state.wellsGeoJson.features, feature => {
    const profile = state.wellProfiles?.[feature.properties?.well_name] || {};
    return `
      <article class="info-tile">
        <h4>${safeText(feature.properties?.well_name)}</h4>
        <p>${safeText(profile.basin_name || feature.properties?.basin_name)} / ${safeText(profile.operator_name || feature.properties?.operator)}</p>
        <small>总井深：${profile.td_meter ? `${profile.td_meter} m` : (feature.properties?.td_m ? `${feature.properties.td_m} m` : "-")}</small>
      </article>
    `;
  });

  renderModuleGrid(root.querySelector("#moduleGrid"), state.overview.modules || []);

  root.querySelector("#coverageTiles").innerHTML = `
    <article class="info-tile"><h4>井专题表</h4><p>${Object.keys(state.dataInventory?.well_tables || {}).length} 张</p></article>
    <article class="info-tile"><h4>盆地专题表</h4><p>${Object.keys(state.dataInventory?.basin_tables || {}).length} 张</p></article>
    <article class="info-tile"><h4>区块专题表</h4><p>${Object.keys(state.dataInventory?.block_tables || {}).length} 张</p></article>
    <article class="info-tile"><h4>区块资料对象</h4><p>${Object.keys(blockProfiles).length} 个</p></article>
    <article class="info-tile"><h4>区块历史记录</h4><p>${Object.values(blockTables).reduce((sum, item) => sum + (item.history?.length || 0), 0)} 条</p></article>
    <article class="info-tile"><h4>区块权益记录</h4><p>${Object.values(blockTables).reduce((sum, item) => sum + (item.company_interests?.length || 0), 0)} 条</p></article>
    <article class="info-tile"><h4>服务来源</h4><p>${state.layerSource === "service" ? "MapGIS 真实服务" : "空间图层按需读取"}</p></article>
  `;
}

init().catch(error => {
  document.body.innerHTML = `<pre class="error-panel">${error.message}</pre>`;
});
