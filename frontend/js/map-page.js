import {
  formatNumber,
  forceRefreshMapLayers,
  getIgsLayerTotalCounts,
  loadMapLayersForState,
  loadPlatformState,
  renderShell,
  safeText,
  unique
} from "./core.js";
import { createCanvasPointLayer } from "./canvas-points.js";

const TDT_TOKEN = "04265e698b77d4fd1d990d5e69d65647";
const ONLINE_BASEMAP = {
  configured: Boolean(TDT_TOKEN),
  vectorUrl: `http://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TDT_TOKEN}`,
  vectorLabelUrl: `http://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TDT_TOKEN}`,
  subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"]
};

const LAYER_TITLES = {
  basins: "盆地",
  contract_blocks: "合同区块",
  wells: "井位"
};

function matchesKeyword(values, keyword) {
  if (!keyword) return true;
  const normalized = keyword.toLowerCase();
  return values.filter(Boolean).some(value => String(value).toLowerCase().includes(normalized));
}

function buildFilterSummary(filters) {
  const parts = [];
  if (filters.keyword) parts.push(`关键字:${filters.keyword}`);
  if (filters.country) parts.push(`国家:${filters.country}`);
  if (filters.basin) parts.push(`盆地:${filters.basin}`);
  if (filters.block) parts.push(`区块:${filters.block}`);
  if (filters.operator) parts.push(`作业者:${filters.operator}`);
  return parts.length ? parts.join(" / ") : "未设置";
}

function hasActiveFilters(filters) {
  return Boolean(filters.keyword || filters.country || filters.basin || filters.block || filters.operator);
}

function renderFilterOptions(root, state) {
  const countryOptions = unique([
    ...state.structuresGeoJson.features.map(item => item.properties?.countries),
    ...state.blocksGeoJson.features.map(item => item.properties?.country),
    ...Object.values(state.wellProfiles || {}).map(item => item.country)
  ].filter(Boolean)).sort();
  const basinOptions = unique([
    ...state.structuresGeoJson.features.map(item => item.properties?.basin_name),
    ...state.blocksGeoJson.features.flatMap(item => String(item.properties?.bas_names || "").split("~")),
    ...state.wellsGeoJson.features.map(item => item.properties?.basin_name)
  ].map(value => String(value).trim()).filter(Boolean)).sort();
  const blockOptions = unique(state.blocksGeoJson.features.map(item => String(item.properties?.block_name || "").trim()).filter(Boolean)).sort();
  const operatorOptions = unique([
    ...state.blocksGeoJson.features.map(item => item.properties?.operator),
    ...Object.values(state.wellProfiles || {}).map(item => item.operator_name),
    ...state.wellsGeoJson.features.map(item => item.properties?.operator)
  ].map(value => String(value).trim()).filter(Boolean)).sort();

  const fillSelect = (selector, options, defaultLabel) => {
    const select = root.querySelector(selector);
    const current = select.value;
    if (select.options.length - 1 === options.length) {
      if (!current || [...select.options].some(option => option.value === current)) {
        return;
      }
    }
    select.innerHTML = `<option value="">${defaultLabel}</option>${options.map(option => `<option value="${option}">${option}</option>`).join("")}`;
    if (current && [...select.options].some(option => option.value === current)) {
      select.value = current;
    } else {
      select.value = "";
    }
  };
  fillSelect("#countryFilter", countryOptions, "全部国家");
  fillSelect("#basinFilter", basinOptions, "全部盆地");
  fillSelect("#contractBlockFilter", blockOptions, "全部区块");
  fillSelect("#operatorFilter", operatorOptions, "全部作业者");
}

function renderSelectedFeature(root, typeLabel, title, pairs) {
  root.querySelector("#selectedFeatureType").textContent = typeLabel;
  root.querySelector("#selectedFeatureTitle").textContent = title;
  root.querySelector("#selectedFeatureMeta").innerHTML = pairs.map(item => `<span>${item.label}</span><strong>${safeText(item.value)}</strong>`).join("");
}

function renderServiceInsights(root, basins, wells, blocks, sourceLabel) {
  const countries = [...new Set([
    ...basins.map(item => item.properties?.countries),
    ...blocks.map(item => item.properties?.country)
  ].filter(Boolean))];
  const maxBasin = basins.reduce((best, current) => Number(current.properties?.bs_skm || 0) > Number(best?.properties?.bs_skm || 0) ? current : best, null);
  const maxBlock = blocks.reduce((best, current) => Number(current.properties?.blk_sqkm || current.properties?.cont_sqkm || 0) > Number(best?.properties?.blk_sqkm || best?.properties?.cont_sqkm || 0) ? current : best, null);
  const operatorCounts = wells.reduce((acc, item) => {
    const key = item.properties?.operator || "未提供";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topOperator = Object.entries(operatorCounts).sort((a, b) => b[1] - a[1])[0];

  root.querySelector("#serviceSourceBadge").textContent = sourceLabel;
  root.querySelector("#basinFeatureCount").textContent = `${basins.length} 个`;
  root.querySelector("#blockFeatureCount").textContent = `${blocks.length} 个`;
  root.querySelector("#wellFeatureCount").textContent = `${wells.length} 个`;
  root.querySelector("#countryCount").textContent = `${countries.length} 个`;
  root.querySelector("#highlightBasin").textContent = maxBasin?.properties?.basin_name || "-";
  root.querySelector("#highlightBlock").textContent = maxBlock?.properties?.block_name || "-";
  root.querySelector("#highlightWell").textContent = wells[0]?.properties?.well_name || "-";
  root.querySelector("#maxBasinArea").textContent = maxBasin?.properties?.bs_skm ? `${formatNumber(maxBasin.properties.bs_skm, 1)} km²` : "-";
  root.querySelector("#topOperator").textContent = topOperator ? `${topOperator[0]} (${topOperator[1]}口)` : "-";
  root.querySelector("#visibleBasinCount").textContent = `${basins.length} 个`;
  root.querySelector("#visibleBlockCount").textContent = `${blocks.length} 个`;
  root.querySelector("#visibleWellCount").textContent = `${wells.length} 个`;
}

function renderWorkspaceHints(root, basins, wells, blocks, layerSource) {
  const hints = [
    { title: "服务状态", desc: layerSource === "service" ? "当前优先读取 MapGIS IGServer 已发布服务。" : "当前 MapGIS 空间服务未成功返回。" },
    { title: "对象筛选", desc: "可按国家、盆地、区块、作业者和关键字过滤对象，筛选时会按条件实时向服务查询。" },
    { title: "对象联动", desc: "点击盆地、区块或井位后，可在右侧查看详情。" }
  ];
  root.querySelector("#workspaceHints").innerHTML = hints.map(item => `
    <article class="hint-item">
      <strong>${item.title}</strong>
      <p>${item.desc}</p>
    </article>
  `).join("");
}

function renderQuickLocate(root, items, onLocate) {
  const container = root.querySelector("#quickLocateList");
  if (!items.length) {
    container.innerHTML = `<article class="quick-item"><strong>暂无对象</strong><p>当前筛选条件下没有可定位对象。</p></article>`;
    return;
  }
  container.innerHTML = items.slice(0, 12).map((item, index) => `
    <article class="quick-item">
      <strong>${safeText(item.title)}</strong>
      <p>${safeText(item.meta)}</p>
      <button type="button" data-idx="${index}">定位查看</button>
    </article>
  `).join("");
  container.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => onLocate(items[Number(button.dataset.idx)]));
  });
}

function filterBasins(features, filters, context = {}) {
  const { blocks = [], wells = [] } = context;
  return features.filter(feature => {
    const props = feature.properties || {};
    const basinName = String(props.basin_name || props.name || "").trim();
    if (filters.country && String(props.countries || "").trim() !== filters.country) return false;
    if (filters.basin && basinName !== filters.basin) return false;
    if (filters.block) {
      const linked = blocks.some(block => {
        const blockProps = block.properties || {};
        return String(blockProps.block_name || "").trim() === filters.block
          && String(blockProps.bas_names || "").split("~").map(value => value.trim()).includes(basinName);
      });
      if (!linked) return false;
    }
    if (filters.operator) {
      const linkedByBlock = blocks.some(block => {
        const blockProps = block.properties || {};
        return String(blockProps.operator || "").trim() === filters.operator
          && String(blockProps.bas_names || "").split("~").map(value => value.trim()).includes(basinName);
      });
      const linkedByWell = wells.some(well => {
        const wellProps = well.properties || {};
        return String(wellProps.operator || "").trim() === filters.operator
          && String(wellProps.basin_name || "").trim() === basinName;
      });
      if (!linkedByBlock && !linkedByWell) return false;
    }
    return matchesKeyword([basinName, props.countries, props.prt_bsn_nm, props.king_class], filters.keyword);
  });
}

function filterBlocks(features, filters) {
  return features.filter(feature => {
    const props = feature.properties || {};
    const country = String(props.country || "").trim();
    const basinNames = String(props.bas_names || "").split("~").map(value => value.trim());
    const blockName = String(props.block_name || "").trim();
    const operator = String(props.operator || "").trim();
    if (filters.country && country !== filters.country) return false;
    if (filters.basin && !basinNames.includes(filters.basin)) return false;
    if (filters.block && blockName !== filters.block) return false;
    if (filters.operator && operator !== filters.operator) return false;
    return matchesKeyword([props.block_name, props.contract, props.country, props.bas_names, props.operator, props.con_status, props.blk_status], filters.keyword);
  });
}

function filterWells(features, filters, wellProfiles) {
  return features.filter(feature => {
    const props = feature.properties || {};
    const profile = wellProfiles?.[props.well_name] || {};
    const basinName = String(profile.basin_name || props.basin_name || "").trim();
    const operator = String(profile.operator_name || props.operator || "").trim();
    const country = String(profile.country || props.country || props.countries || "").trim();
    const blockName = String(props.block_name || "").trim();
    if (filters.country && country !== filters.country) return false;
    if (filters.basin && basinName !== filters.basin) return false;
    if (filters.block && blockName !== filters.block) return false;
    if (filters.operator && operator !== filters.operator) return false;
    return matchesKeyword([props.well_name, basinName, blockName, operator], filters.keyword);
  });
}

function runtimeVersion() {
  return window.zondy?.leaflet?.VERSION || window.MapGISLeafletPlugin?.L?.version || window.L?.version || "未检测到";
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function init() {
  const root = renderShell({
    currentKey: "map",
    heroTitle: "地图工作台",
    heroDesc: "查看盆地、合同区块和井位，支持筛选、定位和详情查看。",
    heroMeta: ["MapGIS IGServer", "按需加载", "对象联动"]
  });
  const state = await loadPlatformState({ includeMapLayers: false });
  const blockProfiles = state.blockData?.profiles || {};
  const blockTables = state.blockData?.tables || {};

  root.innerHTML = `
    <section class="content-section">
      <div class="toolbar-row">
        <label><input type="checkbox" id="toggleBaseMap" checked> 在线底图</label>
        <label><input type="checkbox" id="toggleBasins" checked> 盆地图层</label>
        <label><input type="checkbox" id="toggleBlocks" checked> 合同区块图层</label>
        <label><input type="checkbox" id="toggleWells" checked> 井位图层</label>
        <button type="button" id="refreshMapData" class="button-ghost" title="后台重新读取数据，完成后更新显示（不影响当前画面）">刷新数据</button>
        <button type="button" id="reloadMapData" class="button-ghost" title="清空当前画面，按加载顺序重新展示全部数据">重新加载</button>
        <span id="mapRuntime">${runtimeVersion()}</span>
      </div>
      <div class="toolbar-row toolbar-row--progress">
        <span id="layerProgress">正在准备图层…</span>
      </div>
      <div class="workspace-grid">
        <aside class="sidebar">
          <article class="content-card">
            <h3>筛选条件</h3>
            <div class="filter-form">
              <label><span>关键字</span><input id="searchKeyword" type="text" placeholder="输入井名、盆地名、作业者"></label>
              <label><span>国家</span><select id="countryFilter"></select></label>
              <label><span>盆地</span><select id="basinFilter"></select></label>
              <label><span>区块</span><select id="contractBlockFilter"></select></label>
              <label><span>作业者</span><select id="operatorFilter"></select></label>
            </div>
            <div class="button-row">
              <button id="applyFilters" type="button">应用筛选</button>
              <button id="resetFilters" type="button" class="button-ghost">重置</button>
            </div>
          </article>
          <article class="content-card">
            <h3>筛选结果</h3>
            <div class="meta-grid">
              <span>可见盆地</span><strong id="visibleBasinCount">-</strong>
              <span>可见区块</span><strong id="visibleBlockCount">-</strong>
              <span>可见井位</span><strong id="visibleWellCount">-</strong>
              <span>当前检索</span><strong id="activeFilterSummary">未设置</strong>
            </div>
          </article>
          <article class="content-card">
            <h3>快速定位</h3>
            <div id="quickLocateList" class="list-stack"></div>
          </article>
        </aside>
        <div class="map-card">
          <div id="map" class="map-view"></div>
        </div>
        <aside class="sidebar">
          <article class="content-card">
            <h3>运行状态</h3>
            <div class="meta-grid">
              <span>数据来源</span><strong id="serviceSourceBadge">-</strong>
              <span>盆地图层</span><strong id="basinFeatureCount">-</strong>
              <span>区块图层</span><strong id="blockFeatureCount">-</strong>
              <span>井位图层</span><strong id="wellFeatureCount">-</strong>
              <span>覆盖国家</span><strong id="countryCount">-</strong>
            </div>
          </article>
          <article class="content-card">
            <h3>当前选中对象</h3>
            <span class="sidebar-tag" id="selectedFeatureType">未选择</span>
            <strong class="sidebar-title" id="selectedFeatureTitle">点击盆地、区块或井位查看详情</strong>
            <div class="meta-grid" id="selectedFeatureMeta"></div>
          </article>
          <article class="content-card">
            <h3>对象摘要</h3>
            <div class="meta-grid">
              <span>代表盆地</span><strong id="highlightBasin">-</strong>
              <span>代表区块</span><strong id="highlightBlock">-</strong>
              <span>代表井位</span><strong id="highlightWell">-</strong>
              <span>最大盆地面积</span><strong id="maxBasinArea">-</strong>
              <span>活跃作业者</span><strong id="topOperator">-</strong>
            </div>
          </article>
          <article class="content-card">
            <h3>使用提示</h3>
            <div id="workspaceHints" class="list-stack"></div>
          </article>
        </aside>
      </div>
    </section>
  `;

  if (!window.L) {
    root.querySelector("#mapRuntime").textContent = "未加载地图组件，地图模块无法渲染";
    return;
  }

  const LMap = window.L;
  const map = LMap.map("map", { zoomControl: true, attributionControl: true }).setView([12, 20], 3);
  map.attributionControl.addAttribution("Leaflet + 天地图；业务图层来自 MapGIS IGServer FeatureServer");

  const baseMapLayer = LMap.tileLayer(ONLINE_BASEMAP.vectorUrl, {
    maxZoom: 18,
    minZoom: 1,
    subdomains: ONLINE_BASEMAP.subdomains,
    attribution: "天地图矢量底图"
  });
  const baseLabelLayer = LMap.tileLayer(ONLINE_BASEMAP.vectorLabelUrl, {
    maxZoom: 18,
    minZoom: 1,
    subdomains: ONLINE_BASEMAP.subdomains,
    attribution: "天地图矢量注记"
  });
  let tiandituTileLoaded = false;
  const updateMapRuntime = message => {
    const runtimeNode = root.querySelector("#mapRuntime");
    if (runtimeNode) runtimeNode.textContent = message;
  };
  baseMapLayer.on("tileload", () => {
    if (!tiandituTileLoaded) {
      tiandituTileLoaded = true;
      updateMapRuntime(`地图组件已加载，版本：${runtimeVersion()}；天地图底图已显示`);
    }
  });
  baseMapLayer.on("tileerror", () => {
    if (!tiandituTileLoaded) updateMapRuntime("天地图底图请求失败：请检查 key、应用类型、白名单或网络");
  });
  baseLabelLayer.on("tileerror", () => {
    if (!tiandituTileLoaded) updateMapRuntime("天地图注记请求失败：请检查 key、应用类型、白名单或网络");
  });
  if (ONLINE_BASEMAP.configured) {
    baseMapLayer.addTo(map);
    baseLabelLayer.addTo(map);
    updateMapRuntime(`地图组件已加载，版本：${runtimeVersion()}；天地图已启用`);
  }

  const filters = { keyword: "", country: "", basin: "", block: "", operator: "" };
  const layerData = {
    basins: { features: [], total: 0, done: false },
    contract_blocks: { features: [], total: 0, done: false },
    wells: { features: [], total: 0, done: false }
  };
  let basinLayer = null;
  let blockLayer = null;
  let fitted = false;
  let allLoaded = false;
  let prevWellsFeatures = [];
  const canvasRenderer = LMap.canvas({ padding: 0.5 });

  const syncStateFromLayerData = () => {
    state.structuresGeoJson = { type: "FeatureCollection", features: layerData.basins.features };
    state.blocksGeoJson = { type: "FeatureCollection", features: layerData.contract_blocks.features };
    state.wellsGeoJson = { type: "FeatureCollection", features: layerData.wells.features };
  };

  const updateProgressText = () => {
    const progressNode = root.querySelector("#layerProgress");
    if (!progressNode) return;
    const parts = [];
    Object.keys(layerData).forEach(key => {
      const item = layerData[key];
      const loaded = item.features.length;
      parts.push(`${LAYER_TITLES[key]}${item.total ? ` ${loaded.toLocaleString("zh-CN")}/${item.total.toLocaleString("zh-CN")}` : ` ${loaded.toLocaleString("zh-CN")}`}`);
    });
    progressNode.textContent = allLoaded ? `图层加载完成：${parts.join(" · ")}` : `后台加载中：${parts.join(" · ")}`;
  };

  const selectWell = feature => {
    const profile = state.wellProfiles?.[feature.properties?.well_name] || {};
    renderSelectedFeature(root, "井位", feature.properties?.well_name || "未命名井", [
      { label: "井号", value: profile.wel_id || feature.properties?.wel_id || feature.properties?.objectid },
      { label: "盆地", value: profile.basin_name || feature.properties?.basin_name },
      { label: "作业者", value: profile.operator_name || feature.properties?.operator },
      { label: "总井深", value: profile.td_meter ? `${profile.td_meter} m` : (feature.properties?.td_m ? `${feature.properties.td_m} m` : "-") },
      { label: "技术状态", value: profile.technical_status || feature.properties?.tch_stat || feature.properties?.tech_stat },
      { label: "井型", value: profile.well_class || feature.properties?.class }
    ]);
  };

  const buildWellItems = features => features
    .map(feature => {
      if (feature?.geometry?.type !== "Point" || !Array.isArray(feature.geometry.coordinates)) return null;
      const [lng, lat] = feature.geometry.coordinates;
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
      return { feature, latlng: LMap.latLng(Number(lat), Number(lng)) };
    })
    .filter(Boolean);

  const createBasinLayer = features => LMap.geoJSON({ type: "FeatureCollection", features }, {
    renderer: canvasRenderer,
    style: { color: "#1d62d6", weight: 3, fillColor: "#9fc0ff", fillOpacity: 0.15 },
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(feature.properties?.basin_name || "未命名盆地", { sticky: true, className: "feature-label feature-label--basin" });
      layer.on("click", () => {
        renderSelectedFeature(root, "盆地", feature.properties?.basin_name || "未命名盆地", [
          { label: "国家", value: feature.properties?.countries },
          { label: "上级盆地", value: feature.properties?.prt_bsn_nm },
          { label: "分类", value: feature.properties?.king_class },
          { label: "面积", value: feature.properties?.bs_skm ? `${formatNumber(feature.properties.bs_skm, 1)} km²` : "-" },
          { label: "最大水深", value: feature.properties?.bs_dp_wat ? `${formatNumber(feature.properties.bs_dp_wat, 1)} m` : "-" }
        ]);
      });
    }
  });

  const renderBlockSelection = feature => {
    const profile = blockProfiles[feature.properties?.block_name] || {};
    const tables = blockTables[feature.properties?.block_name] || {};
    renderSelectedFeature(root, "合同区块", feature.properties?.block_name || "未命名区块", [
      { label: "合同", value: profile.contract_name || feature.properties?.contract },
      { label: "国家", value: profile.country_name || feature.properties?.country },
      { label: "盆地", value: profile.basin_names || feature.properties?.bas_names },
      { label: "作业者", value: profile.operator_name || feature.properties?.operator },
      { label: "合同状态", value: profile.contract_status || feature.properties?.con_status },
      { label: "区块状态", value: profile.block_status || feature.properties?.blk_status },
      { label: "面积", value: feature.properties?.blk_sqkm ? `${formatNumber(feature.properties.blk_sqkm, 1)} km²` : "-" },
      { label: "平均水深", value: profile.median_water_depth_meter ? `${formatNumber(profile.median_water_depth_meter, 1)} m` : (feature.properties?.med_wd_mt ? `${formatNumber(feature.properties.med_wd_mt, 1)} m` : "-") },
      { label: "授予日期", value: profile.award_date },
      { label: "权益方数量", value: tables.company_interests?.length || 0 }
    ]);
  };

  const createBlockLayer = features => {
    const interactive = features.length <= 800;
    const layer = LMap.geoJSON({ type: "FeatureCollection", features }, {
      renderer: canvasRenderer,
      style: { color: "#d97706", weight: 2, fillColor: "#f59e0b", fillOpacity: 0.12 },
      onEachFeature: interactive ? (feature, pathLayer) => {
        pathLayer.bindTooltip(feature.properties?.block_name || "未命名区块", { sticky: true, className: "feature-label feature-label--block" });
        pathLayer.on("click", () => renderBlockSelection(feature));
      } : undefined
    });
    if (!interactive) {
      layer.on("click", event => {
        let best = null;
        let bestDistance = Infinity;
        layer.eachLayer(pathLayer => {
          const bounds = pathLayer.getBounds();
          if (!bounds?.isValid()) return;
          const distance = bounds.getCenter().distanceTo(event.latlng);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = pathLayer.feature;
          }
        });
        if (best) renderBlockSelection(best);
      });
    }
    return layer;
  };

  const wellCanvasLayer = createCanvasPointLayer(LMap, {
    radius: 2.6,
    fillColor: "#13a37f",
    strokeColor: "#ffffff",
    strokeWidth: 0.7
  });
  wellCanvasLayer.setPickHandler(selectWell);
  wellCanvasLayer.addTo(map);

  window.__mapDebug = {
    map,
    getLayers: () => ({ basinLayer, blockLayer, wellCanvasLayer }),
    getLayerData: () => layerData,
    getState: () => state
  };

  const updateWellLayer = () => {
    const features = layerData.wells.features;
    const noFilter = !hasActiveFilters(filters);
    const prefixOk = !prevWellsFeatures.length || features[prevWellsFeatures.length - 1] === prevWellsFeatures[prevWellsFeatures.length - 1];
    if (noFilter && prefixOk && features.length > prevWellsFeatures.length) {
      wellCanvasLayer.appendItems(buildWellItems(features.slice(prevWellsFeatures.length)));
    } else {
      wellCanvasLayer.setItems(buildWellItems(filterWells(features, filters, state.wellProfiles)));
    }
    prevWellsFeatures = features;
  };

  const updateBasinLayer = () => {
    if (basinLayer) basinLayer.remove();
    const visibleBasins = filterBasins(layerData.basins.features, filters, {
      blocks: layerData.contract_blocks.features,
      wells: layerData.wells.features
    });
    basinLayer = createBasinLayer(visibleBasins);
    if (root.querySelector("#toggleBasins").checked) basinLayer.addTo(map);
  };

  const updateBlockLayer = () => {
    if (blockLayer) blockLayer.remove();
    const visibleBlocks = filterBlocks(layerData.contract_blocks.features, filters);
    blockLayer = createBlockLayer(visibleBlocks);
    if (root.querySelector("#toggleBlocks").checked) blockLayer.addTo(map);
  };

  const refreshDisplayFromState = () => {
    layerData.wells.features = state.wellsGeoJson.features || [];
    layerData.basins.features = state.structuresGeoJson.features || [];
    layerData.contract_blocks.features = state.blocksGeoJson.features || [];
    prevWellsFeatures = layerData.wells.features;
    updateWellLayer();
    updateBasinLayer();
    updateBlockLayer();
    renderStats();
  };

  let visibleCounts = { basins: 0, blocks: 0, wells: 0 };
  let lastStatsRefreshAt = 0;
  const renderCountsLight = () => {
    const noFilter = !hasActiveFilters(filters);
    const wellsLen = noFilter
      ? layerData.wells.features.length
      : filterWells(layerData.wells.features, filters, state.wellProfiles).length;
    const basinsLen = noFilter
      ? layerData.basins.features.length
      : filterBasins(layerData.basins.features, filters, {
        blocks: layerData.contract_blocks.features,
        wells: layerData.wells.features
      }).length;
    const blocksLen = noFilter
      ? layerData.contract_blocks.features.length
      : filterBlocks(layerData.contract_blocks.features, filters).length;
    visibleCounts = { basins: basinsLen, blocks: blocksLen, wells: wellsLen };
    root.querySelector("#visibleWellCount").textContent = `${wellsLen} 个`;
    root.querySelector("#visibleBasinCount").textContent = `${basinsLen} 个`;
    root.querySelector("#visibleBlockCount").textContent = `${blocksLen} 个`;
    root.querySelector("#wellFeatureCount").textContent = `${wellsLen} 个`;
    root.querySelector("#basinFeatureCount").textContent = `${basinsLen} 个`;
    root.querySelector("#blockFeatureCount").textContent = `${blocksLen} 个`;
    root.querySelector("#activeFilterSummary").textContent = buildFilterSummary(filters);
  };
  const renderStats = () => {
    const visibleBasins = filterBasins(layerData.basins.features, filters, {
      blocks: layerData.contract_blocks.features,
      wells: layerData.wells.features
    });
    const visibleBlocks = filterBlocks(layerData.contract_blocks.features, filters);
    const visibleWells = filterWells(layerData.wells.features, filters, state.wellProfiles);
    visibleCounts = { basins: visibleBasins.length, blocks: visibleBlocks.length, wells: visibleWells.length };
    const sourceLabel = state.layerSource === "service-error"
      ? "MapGIS 服务异常"
      : (state.layerSource === "service" || layerData.wells.features.length > 0 ? "MapGIS 真实服务" : "MapGIS 服务加载中");
    renderServiceInsights(root, visibleBasins, visibleWells, visibleBlocks, sourceLabel);
    renderWorkspaceHints(root, visibleBasins, visibleWells, visibleBlocks, state.layerSource);
    root.querySelector("#activeFilterSummary").textContent = buildFilterSummary(filters);

    const quickItems = [
      ...visibleBlocks.slice(0, 60).map(feature => ({ type: "block", title: feature.properties?.block_name, meta: `${safeText(feature.properties?.country)} / ${safeText(feature.properties?.contract)}`, feature })),
      ...visibleWells.slice(0, 60).map(feature => {
        const profile = state.wellProfiles?.[feature.properties?.well_name] || {};
        return { type: "well", title: feature.properties?.well_name, meta: `${safeText(profile.basin_name || feature.properties?.basin_name)} / ${safeText(profile.operator_name || feature.properties?.operator)}`, feature };
      })
    ];
    renderQuickLocate(root, quickItems, item => {
      if (!item?.feature) return;
      if (item.type === "block") {
        const bounds = LMap.geoJSON(item.feature).getBounds();
        if (bounds.isValid()) map.fitBounds(bounds.pad(0.18));
      } else if (item.feature.geometry?.coordinates) {
        const [lng, lat] = item.feature.geometry.coordinates;
        map.setView([lat, lng], 7);
      }
    });
  };

  const fitDataBounds = () => {
    const targets = [];
    if (visibleCounts.wells > 0) targets.push(wellCanvasLayer);
    else if (visibleCounts.blocks > 0 && blockLayer) targets.push(blockLayer);
    else if (visibleCounts.basins > 0 && basinLayer) targets.push(basinLayer);
    if (!targets.length) return;
    const bounds = LMap.featureGroup(targets).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.18), { maxZoom: 7 });
  };

  let lastFilterOptionsRefresh = 0;
  const refreshFilterOptionsThrottled = () => {
    const now = Date.now();
    if (now - lastFilterOptionsRefresh < 15000) return;
    lastFilterOptionsRefresh = now;
    renderFilterOptions(root, state);
  };

  const handleBatch = (featureType, collection, detail) => {
    if (!layerData[featureType]) return;
    layerData[featureType].features = collection?.features || [];
    if (detail?.totalCount) layerData[featureType].total = Number(detail.totalCount);
    if (detail?.done) layerData[featureType].done = true;
    syncStateFromLayerData();

    if (featureType === "wells") {
      if (!state._forceRefreshing) updateWellLayer();
      const now = Date.now();
      if (now - lastStatsRefreshAt >= 1500) {
        lastStatsRefreshAt = now;
        renderCountsLight();
      }
    } else if (featureType === "basins") {
      if (detail?.done && !state._forceRefreshing) updateBasinLayer();
      renderStats();
    } else if (featureType === "contract_blocks") {
      if (detail?.done && !state._forceRefreshing) updateBlockLayer();
      renderStats();
    }
    updateProgressText();
    if (detail?.done && ["basins", "contract_blocks"].includes(featureType)) {
      renderFilterOptions(root, state);
    } else {
      refreshFilterOptionsThrottled();
    }
    if (!fitted && layerData.wells.features.length >= 1000) {
      fitted = true;
      setTimeout(fitDataBounds, 50);
    }
  };

  const handleAllLoaded = () => {
    allLoaded = true;
    updateProgressText();
    updateMapRuntime(`图层加载完成，版本：${runtimeVersion()}`);
  };

  loadMapLayersForState(state, {
    skipLayers: ["fields"],
    onRefreshed: () => {
      const refresh = () => {
        refreshDisplayFromState();
      };
      if (window.requestIdleCallback) {
        window.requestIdleCallback(refresh, { timeout: 3000 });
      } else {
        setTimeout(refresh, 500);
      }
    },
    onBatchLoaded: handleBatch,
    onLayerLoaded: () => {
      updateWellLayer();
      updateBasinLayer();
      updateBlockLayer();
      renderStats();
      updateProgressText();
      renderFilterOptions(root, state);
    }
  }).then(() => {
    allLoaded = true;
    syncStateFromLayerData();
    renderStats();
    updateProgressText();
    updateMapRuntime(`图层加载完成，版本：${runtimeVersion()}${state.layerSourceCached ? "（本地缓存）" : ""}`);
  }).catch(error => {
    updateMapRuntime(`图层后台加载中断：${error.message}`);
  });

  getIgsLayerTotalCounts(state).then(counts => {
    if (counts.wells) layerData.wells.total = counts.wells;
    if (counts.basins) layerData.basins.total = counts.basins;
    if (counts.contract_blocks) layerData.contract_blocks.total = counts.contract_blocks;
    updateProgressText();
  }).catch(() => {});

  const applyFilters = () => {
    filters.keyword = root.querySelector("#searchKeyword").value.trim();
    filters.country = root.querySelector("#countryFilter").value;
    filters.basin = root.querySelector("#basinFilter").value;
    filters.block = root.querySelector("#contractBlockFilter").value;
    filters.operator = root.querySelector("#operatorFilter").value;
    updateBasinLayer();
    updateBlockLayer();
    updateWellLayer();
    renderStats();
    if (hasActiveFilters(filters)) {
      fitDataBounds();
    } else if (!fitted) {
      setTimeout(fitDataBounds, 50);
    }
  };

  const debouncedApply = debounce(applyFilters, 250);

  root.querySelector("#applyFilters").addEventListener("click", applyFilters);
  root.querySelector("#resetFilters").addEventListener("click", () => {
    Object.assign(filters, { keyword: "", country: "", basin: "", block: "", operator: "" });
    root.querySelector("#searchKeyword").value = "";
    root.querySelector("#countryFilter").value = "";
    root.querySelector("#basinFilter").value = "";
    root.querySelector("#contractBlockFilter").value = "";
    root.querySelector("#operatorFilter").value = "";
    updateBasinLayer();
    updateBlockLayer();
    updateWellLayer();
    renderStats();
    setTimeout(fitDataBounds, 50);
  });
  ["searchKeyword", "countryFilter", "basinFilter", "contractBlockFilter", "operatorFilter"].forEach(id => {
    root.querySelector(`#${id}`).addEventListener("change", debouncedApply);
  });
  root.querySelector("#searchKeyword").addEventListener("input", debouncedApply);

  root.querySelector("#toggleBaseMap").addEventListener("change", event => {
    if (!ONLINE_BASEMAP.configured) return;
    if (event.target.checked) {
      baseMapLayer.addTo(map);
      baseLabelLayer.addTo(map);
    } else {
      baseMapLayer.removeFrom(map);
      baseLabelLayer.removeFrom(map);
    }
  });
  root.querySelector("#toggleBasins").addEventListener("change", () => {
    if (!basinLayer) return;
    if (root.querySelector("#toggleBasins").checked) basinLayer.addTo(map);
    else basinLayer.remove();
  });
  root.querySelector("#toggleBlocks").addEventListener("change", () => {
    if (!blockLayer) return;
    if (root.querySelector("#toggleBlocks").checked) blockLayer.addTo(map);
    else blockLayer.remove();
  });
  root.querySelector("#toggleWells").addEventListener("change", () => {
    if (root.querySelector("#toggleWells").checked) wellCanvasLayer.addTo(map);
    else wellCanvasLayer.remove();
  });

  const refreshMapDataButton = root.querySelector("#refreshMapData");
  if (refreshMapDataButton) {
    refreshMapDataButton.addEventListener("click", async () => {
      if (!allLoaded || state._forceRefreshing || state._layerRefreshPromise) {
        updateMapRuntime("数据正在刷新中，请稍候…");
        return;
      }
      state._forceRefreshing = true;
      updateMapRuntime("正在从 MapGIS IGServer 重新读取全部图层数据…（完成后自动更新显示）");
      try {
        await forceRefreshMapLayers(state, { skipLayers: ["fields"], onBatchLoaded: handleBatch });
        state._forceRefreshing = false;
        refreshDisplayFromState();
        allLoaded = true;
        updateProgressText();
        updateMapRuntime(`图层数据已更新为最新（${new Date().toLocaleTimeString("zh-CN")}）`);
      } catch (error) {
        state._forceRefreshing = false;
        updateMapRuntime(`图层刷新失败：${error.message}`);
      }
    });
  }

  const reloadMapDataButton = root.querySelector("#reloadMapData");
  if (reloadMapDataButton) {
    reloadMapDataButton.addEventListener("click", async () => {
      if (!allLoaded || state._forceRefreshing || state._layerRefreshPromise) {
        updateMapRuntime("加载正在进行中，请稍候…");
        return;
      }
      updateMapRuntime("正在重新加载全部图层数据（逐步显示）…");
      // 清空当前显示，进入逐批加载
      prevWellsFeatures = [];
      wellCanvasLayer.setItems([]);
      if (basinLayer) { basinLayer.remove(); basinLayer = null; }
      if (blockLayer) { blockLayer.remove(); blockLayer = null; }
      layerData.wells.features = [];
      layerData.basins.features = [];
      layerData.contract_blocks.features = [];
      state.wellsGeoJson = { type: "FeatureCollection", features: [] };
      state.structuresGeoJson = { type: "FeatureCollection", features: [] };
      state.blocksGeoJson = { type: "FeatureCollection", features: [] };
      renderCountsLight();
      try {
        await forceRefreshMapLayers(state, { skipLayers: ["fields"], onBatchLoaded: handleBatch });
        renderStats();
        allLoaded = true;
        updateProgressText();
        updateMapRuntime(`图层数据已重新加载完成（${new Date().toLocaleTimeString("zh-CN")}）`);
      } catch (error) {
        updateMapRuntime(`图层重新加载失败：${error.message}`);
      }
    });
  }

  updateProgressText();
}

init().catch(error => {
  document.body.innerHTML = `<pre class="error-panel">${error.message}</pre>`;
});
