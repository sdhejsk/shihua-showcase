import { forceRefreshMapLayers, formatNumber, getWellOptions, getWellRecords, loadAfricaIndex, loadMapLayersForState, loadPlatformState, renderShell, safeText, unique } from "./core.js";

import { DEFAULT_ONLINE_BASEMAP_KEY, createOnlineBasemapLayers, getOnlineBasemapOptions } from "./basemaps.js?v=20260802-diag";
import { createCanvasPointLayer } from "./canvas-points.js";

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

function renderEmptyCard(title, desc) {
  return `<article class="info-tile"><h4>${title}</h4><p>${desc}</p></article>`;
}

function renderFeatureList(features, mapper) {
  if (!features.length) return renderEmptyCard("暂无数据", "当前没有可展示对象。");
  return features.map(feature => mapper(feature)).join("");
}

function buildActionAttrs(action = {}) {
  return Object.entries(action)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ` ${key}="${encodeURIComponent(String(value))}"`)
    .join("");
}

function flashFocus(element) {
  if (!element) return;
  element.classList.remove("focus-flash");
  void element.offsetWidth;
  element.classList.add("focus-flash");
  window.setTimeout(() => element.classList.remove("focus-flash"), 1400);
}

function inferModuleAction(module = {}) {
  const text = `${module.name || ""} ${module.description || ""} ${(module.inputs || []).join(" ")} ${(module.outputs || []).join(" ")}`;
  if (text.includes("区域") || text.includes("闭环")) return { tab: "regional", scroll: "#regionalStorySummary" };
  if (text.includes("空间") || text.includes("地图")) return { tab: "spatial", scroll: "#map" };
  if (text.includes("盆地")) return { tab: "basins", scroll: "#basinSummaryCard" };
  if (text.includes("合同")) return { tab: "contracts", scroll: "#contractSummaryCard" };
  if (text.includes("区块")) return { tab: "blocks", scroll: "#blockSummaryCard" };
  if (text.includes("油气田")) return { tab: "fields", scroll: "#fieldSummaryCard" };
  if (text.includes("井")) return { tab: "wells", scroll: "#wellSummaryCard" };
  if (text.includes("目录") || text.includes("名录")) return { tab: "catalog", scroll: "#catalogModuleGrid" };
  return { tab: "catalog", scroll: "#catalogModuleGrid" };
}

function ensureDataBucket(state, key) {
  state[key] = state[key] || {};
  state[key].profiles = state[key].profiles || {};
  state[key].tables = state[key].tables || {};
  return state[key];
}

function firstFieldValue(properties = {}, fields = []) {
  const normalized = Object.entries(properties || {}).reduce((acc, [key, value]) => {
    acc[String(key).toLowerCase()] = value;
    return acc;
  }, {});
  for (const field of fields) {
    const value = properties[field] ?? normalized[String(field).toLowerCase()];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function addMissingProfile(target, key, profile) {
  if (!key) return;
  target[key] = {
    ...profile,
    ...(target[key] || {})
  };
}

function addSpatialFeatureProfiles(state) {
  const basinData = ensureDataBucket(state, "basinData");
  const blockData = ensureDataBucket(state, "blockData");
  const fieldData = ensureDataBucket(state, "fieldData");
  state.wellProfiles = state.wellProfiles || {};

  (state.structuresGeoJson?.features || []).forEach(feature => {
    const properties = feature.properties || {};
    const name = firstFieldValue(properties, ["basin_name", "BASIN_NAME"]);
    addMissingProfile(basinData.profiles, name, {
      basin_name: name,
      country_names: firstFieldValue(properties, ["countries", "COUNTRIES", "country", "COUNTRY"]),
      parent_basin_name: firstFieldValue(properties, ["prt_bsn_nm", "PRT_BSN_NM", "mn_pa_bas", "MN_PA_BAS"]),
      basin_class: firstFieldValue(properties, ["king_class", "KING_CLASS", "klem_cl", "KLEM_CL", "gn_class", "GN_CLASS"]),
      basin_area_sqkm: firstFieldValue(properties, ["bs_skm", "BS_SKM"]),
      max_water_depth_m: firstFieldValue(properties, ["bs_dp_wat", "BS_DP_WAT", "max_wd_mt", "MAX_WD_MT"]),
      data_source: firstFieldValue(properties, ["_source_label", "_source_service"])
    });
  });

  (state.blocksGeoJson?.features || []).forEach(feature => {
    const properties = feature.properties || {};
    const name = firstFieldValue(properties, ["block_name", "BLOCK_NAME", "con_blk_nm", "CON_BLK_NM"]);
    addMissingProfile(blockData.profiles, name, {
      block_name: name,
      contract_name: firstFieldValue(properties, ["contract", "CONTRACT", "con_opt_nm", "CON_OPT_NM"]),
      country_name: firstFieldValue(properties, ["country", "COUNTRY", "gn_cnt_ty", "GN_CNT_TY", "countries", "COUNTRIES"]),
      basin_names: firstFieldValue(properties, ["bas_names", "BAS_NAMES", "main_ba10", "MAIN_BA10", "basin_name", "BASIN_NAME"]),
      operator_name: firstFieldValue(properties, ["operator", "OPERATOR", "grp_name", "GRP_NAME", "group", "GROUP"]),
      contract_status: firstFieldValue(properties, ["con_status", "CON_STATUS"]),
      block_status: firstFieldValue(properties, ["blk_status", "BLK_STATUS"]),
      block_sqkm: firstFieldValue(properties, ["blk_sqkm", "BLK_SQKM", "cont_sqkm", "CONT_SQKM"]),
      onshore_offshore: firstFieldValue(properties, ["ons_off", "ONS_OFF"]),
      terrains: firstFieldValue(properties, ["terrains", "TERRAINS"]),
      province: firstFieldValue(properties, ["province", "PROVINCE"]),
      min_water_depth_meter: firstFieldValue(properties, ["min_wd_mt", "MIN_WD_MT"]),
      median_water_depth_meter: firstFieldValue(properties, ["med_wd_mt", "MED_WD_MT"]),
      max_water_depth_meter: firstFieldValue(properties, ["max_wd_mt", "MAX_WD_MT"]),
      application_date: firstFieldValue(properties, ["app_date", "APP_DATE", "app_dat_tx", "APP_DAT_TX"]),
      expiry_date: firstFieldValue(properties, ["exp_date", "EXP_DATE", "exp_dt_tx", "EXP_DT_TX"]),
      group_name: firstFieldValue(properties, ["grp_name", "GRP_NAME", "group", "GROUP"]),
      data_source: firstFieldValue(properties, ["_source_label", "_source_service"])
    });
  });

  (state.fieldsGeoJson?.features || []).forEach(feature => {
    const properties = feature.properties || {};
    const name = firstFieldValue(properties, ["field_name", "FIELD_NAME"]);
    addMissingProfile(fieldData.profiles, name, {
      field_name: name,
      country_names: firstFieldValue(properties, ["countries", "COUNTRIES", "country", "COUNTRY"]),
      basin_name: firstFieldValue(properties, ["basin_name", "BASIN_NAME"]),
      current_operators: firstFieldValue(properties, ["opr_curr", "OPR_CURR", "operator", "OPERATOR"]),
      prod_status: firstFieldValue(properties, ["prod_stat", "PROD_STAT"]),
      hc_type: firstFieldValue(properties, ["hc_type", "HC_TYPE", "gn_hc_type", "GN_HC_TYPE"]),
      field_type: firstFieldValue(properties, ["field_type", "FIELD_TYPE"]),
      max_water_depth_m: firstFieldValue(properties, ["wd_max_m", "WD_MAX_M"]),
      field_id: firstFieldValue(properties, ["fie_id", "FIE_ID", "objectid", "OBJECTID"]),
      data_source: firstFieldValue(properties, ["_source_label", "_source_service"])
    });
  });

  (state.wellsGeoJson?.features || []).forEach(feature => {
    const properties = feature.properties || {};
    const name = firstFieldValue(properties, ["well_name", "WELL_NAME"]);
    addMissingProfile(state.wellProfiles, name, {
      well_name: name,
      wel_id: firstFieldValue(properties, ["wel_id", "WEL_ID", "objectid", "OBJECTID"]),
      country: firstFieldValue(properties, ["country", "COUNTRY", "country_name", "COUNTRY_NAME"]),
      country_name: firstFieldValue(properties, ["country", "COUNTRY", "country_name", "COUNTRY_NAME"]),
      basin_name: firstFieldValue(properties, ["basin_name", "BASIN_NAME"]),
      block_name: firstFieldValue(properties, ["block_name", "BLOCK_NAME"]),
      field_name: firstFieldValue(properties, ["field_name", "FIELD_NAME"]),
      operator_name: firstFieldValue(properties, ["operator", "OPERATOR", "operator_name", "OPERATOR_NAME"]),
      well_class: firstFieldValue(properties, ["class", "CLASS", "dev_type", "DEV_TYPE"]),
      technical_status: firstFieldValue(properties, ["tch_stat", "TCH_STAT", "tech_stat", "TECH_STAT"]),
      spud_year: firstFieldValue(properties, ["spud_dt_yr", "SPUD_DT_YR"]),
      water_depth_m: firstFieldValue(properties, ["wat_dpth_m", "WAT_DPTH_M"]),
      td_meter: firstFieldValue(properties, ["td_m", "TD_M"]),
      tvd_meter: firstFieldValue(properties, ["tvd_meter", "TVD_METER"]),
      data_source: firstFieldValue(properties, ["_source_label", "_source_service"])
    });
  });
}

function renderSelectedFeature(root, typeLabel, title, pairs) {
  root.querySelector("#selectedFeatureType").textContent = typeLabel;
  root.querySelector("#selectedFeatureTitle").textContent = title;
  root.querySelector("#selectedFeatureMeta").innerHTML = pairs.map(item => `<span>${item.label}</span><strong>${safeText(item.value)}</strong>`).join("");
}

function renderFilterOptions(root, state) {
  const basinFeatures = state.structuresGeoJson?.features || [];
  const blockFeatures = state.blocksGeoJson?.features || [];
  const wellFeatures = state.wellsGeoJson?.features || [];
  const fieldFeatures = state.fieldsGeoJson?.features || [];
  const countryOptions = unique([
    ...basinFeatures.map(item => firstFieldValue(item.properties, ["countries", "COUNTRIES", "country", "COUNTRY"])),
    ...blockFeatures.map(item => firstFieldValue(item.properties, ["country", "COUNTRY", "countries", "COUNTRIES", "gn_cnt_ty", "GN_CNT_TY"])),
    ...wellFeatures.map(item => firstFieldValue(item.properties, ["country", "COUNTRY"])),
    ...fieldFeatures.map(item => firstFieldValue(item.properties, ["countries", "COUNTRIES", "country", "COUNTRY"])),
    ...Object.values(state.wellProfiles || {}).map(item => item.country || item.country_name),
    ...Object.values(state.fieldData?.profiles || {}).map(item => item.country_names)
  ].filter(Boolean)).sort();
  const basinOptions = unique([
    ...basinFeatures.map(item => firstFieldValue(item.properties, ["basin_name", "BASIN_NAME"])),
    ...blockFeatures.flatMap(item => String(firstFieldValue(item.properties, ["bas_names", "BAS_NAMES", "main_ba10", "MAIN_BA10", "basin_name", "BASIN_NAME"]) || "").split("~")),
    ...wellFeatures.map(item => firstFieldValue(item.properties, ["basin_name", "BASIN_NAME"])),
    ...fieldFeatures.map(item => firstFieldValue(item.properties, ["basin_name", "BASIN_NAME"])),
    ...Object.values(state.fieldData?.profiles || {}).map(item => item.basin_name)
  ].map(value => String(value).trim()).filter(Boolean)).sort();
  const blockOptions = unique([
    ...blockFeatures.map(item => firstFieldValue(item.properties, ["block_name", "BLOCK_NAME", "con_blk_nm", "CON_BLK_NM"])),
    ...wellFeatures.map(item => firstFieldValue(item.properties, ["block_name", "BLOCK_NAME"]))
  ].map(value => String(value).trim()).filter(Boolean)).sort();
  const operatorOptions = unique([
    ...blockFeatures.map(item => firstFieldValue(item.properties, ["operator", "OPERATOR", "grp_name", "GRP_NAME", "group", "GROUP"])),
    ...Object.values(state.wellProfiles || {}).map(item => item.operator_name),
    ...wellFeatures.map(item => firstFieldValue(item.properties, ["operator", "OPERATOR"])),
    ...fieldFeatures.map(item => firstFieldValue(item.properties, ["opr_curr", "OPR_CURR", "operator", "OPERATOR"])),
    ...Object.values(state.fieldData?.profiles || {}).map(item => item.current_operators)
  ].map(value => String(value).trim()).filter(Boolean)).sort();

  const fillSelect = (selector, options, defaultLabel) => {
    const select = root.querySelector(selector);
    const current = select.value;
    if (select.options.length - 1 === options.length) {
      if (!current || [...select.options].some(option => option.value === current)) {
        return;
      }
    }
    select.innerHTML = `<option value="">${defaultLabel}</option>${options.map(option => `<option value="${safeText(option)}">${safeText(option)}</option>`).join("")}`;
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

function renderQuickLocate(root, items, onLocate) {
  const container = root.querySelector("#quickLocateList");
  if (!items.length) {
    container.innerHTML = renderEmptyCard("暂无对象", "当前筛选条件下没有可定位对象。");
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

function formatLayerRuntime(diagnostic) {
  if (!diagnostic) return "未记录";
  const duration = diagnostic.elapsed ?? diagnostic.durationMs ?? 0;
  const seconds = duration >= 1000
    ? `${(duration / 1000).toFixed(1)} 秒`
    : `${duration} ms`;
  const loaded = diagnostic.count ?? diagnostic.loadedCount ?? 0;
  const pageText = diagnostic.pageCount ? `；${diagnostic.pageCount} 页` : "";
  const limitText = diagnostic.requestLimit ? ` / 单页上限 ${diagnostic.requestLimit}` : "";
  const hasMoreText = diagnostic.hasMore ? "；达到分页保护上限，可能仍有后续数据" : "";
  return `${loaded} 个${limitText}${pageText}；${seconds}${hasMoreText}`;
}

function renderLayerDiagnostics(root, diagnostics = []) {
  const container = root.querySelector("#layerDiagnostics");
  if (!container) return;
  if (!diagnostics.length) {
    container.innerHTML = renderEmptyCard("等待空间服务", "进入空间总览后，会显示每个 MapGIS 图层的读取数量和耗时。");
    return;
  }
  container.innerHTML = diagnostics.map(item => `
    <article class="diagnostic-item">
      <div>
        <strong>${item.label}</strong>
        <span>${safeText(item.serviceName)}</span>
      </div>
      <p>${formatLayerRuntime(item)}</p>
    </article>
  `).join("");
}

function renderServiceInsights(root, basins, wells, blocks, fields, layerSource, diagnostics = []) {
  const countries = [...new Set([
    ...basins.map(item => firstFieldValue(item.properties, ["countries", "COUNTRIES", "country", "COUNTRY"])),
    ...blocks.map(item => firstFieldValue(item.properties, ["country", "COUNTRY", "countries", "COUNTRIES", "gn_cnt_ty", "GN_CNT_TY"])),
    ...fields.map(item => firstFieldValue(item.properties, ["countries", "COUNTRIES", "country", "COUNTRY"]))
  ].filter(Boolean))];
  const maxBasin = basins.reduce((best, current) => Number(firstFieldValue(current.properties, ["bs_skm", "BS_SKM"]) || 0) > Number(firstFieldValue(best?.properties, ["bs_skm", "BS_SKM"]) || 0) ? current : best, null);
  const maxBlock = blocks.reduce((best, current) => Number(firstFieldValue(current.properties, ["blk_sqkm", "BLK_SQKM", "cont_sqkm", "CONT_SQKM"]) || 0) > Number(firstFieldValue(best?.properties, ["blk_sqkm", "BLK_SQKM", "cont_sqkm", "CONT_SQKM"]) || 0) ? current : best, null);
  const maxField = fields.reduce((best, current) => Number(firstFieldValue(current.properties, ["field_sqkm", "FIELD_SQKM", "fld_sqkm", "FLD_SQKM"]) || 0) > Number(firstFieldValue(best?.properties, ["field_sqkm", "FIELD_SQKM", "fld_sqkm", "FLD_SQKM"]) || 0) ? current : best, null);
  const operatorCounts = wells.reduce((acc, item) => {
    const key = firstFieldValue(item.properties, ["operator", "OPERATOR"]) || "未提供";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topOperator = Object.entries(operatorCounts).sort((a, b) => b[1] - a[1])[0];

  const sourceLabel = layerSource === "service"
    ? "MapGIS 真实服务"
    : layerSource === "not-loaded"
      ? "等待读取"
      : layerSource === "service-error"
        ? "MapGIS 服务异常"
        : "本地数据";
  root.querySelector("#serviceSourceBadge").textContent = sourceLabel;
  root.querySelector("#basinFeatureCount").textContent = `本次读取 ${basins.length} 个`;
  root.querySelector("#blockFeatureCount").textContent = `本次读取 ${blocks.length} 个`;
  root.querySelector("#wellFeatureCount").textContent = `本次读取 ${wells.length} 个`;
  root.querySelector("#fieldFeatureCount").textContent = `本次读取 ${fields.length} 个`;
  root.querySelector("#countryCount").textContent = `${countries.length} 个`;
  root.querySelector("#highlightBasin").textContent = firstFieldValue(maxBasin?.properties, ["basin_name", "BASIN_NAME"]) || "-";
  root.querySelector("#highlightBlock").textContent = firstFieldValue(maxBlock?.properties, ["block_name", "BLOCK_NAME", "con_blk_nm", "CON_BLK_NM"]) || "-";
  root.querySelector("#highlightWell").textContent = firstFieldValue(wells[0]?.properties, ["well_name", "WELL_NAME"]) || "-";
  root.querySelector("#highlightField").textContent = firstFieldValue(maxField?.properties, ["field_name", "FIELD_NAME"]) || firstFieldValue(fields[0]?.properties, ["field_name", "FIELD_NAME"]) || "-";
  const maxBasinArea = firstFieldValue(maxBasin?.properties, ["bs_skm", "BS_SKM"]);
  root.querySelector("#maxBasinArea").textContent = maxBasinArea ? `${formatNumber(maxBasinArea, 1)} km²` : "-";
  root.querySelector("#topOperator").textContent = topOperator ? `${topOperator[0]} (${topOperator[1]}口)` : "-";
  root.querySelector("#visibleBasinCount").textContent = `${basins.length} 个`;
  root.querySelector("#visibleBlockCount").textContent = `${blocks.length} 个`;
  root.querySelector("#visibleWellCount").textContent = `${wells.length} 个`;
  root.querySelector("#visibleFieldCount").textContent = `${fields.length} 个`;
  renderLayerDiagnostics(root, diagnostics);
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

function filterFields(features, filters, fieldProfiles, context = {}) {
  const { blocks = [], wells = [] } = context;
  return features.filter(feature => {
    const props = feature.properties || {};
    const profile = fieldProfiles?.[props.field_name] || {};
    const country = profile.country_names || props.countries || "";
    const basinName = profile.basin_name || props.basin_name || "";
    const operator = profile.current_operators || props.opr_curr || "";
    if (filters.country && country !== filters.country) return false;
    if (filters.basin && basinName !== filters.basin) return false;
    if (filters.operator && operator !== filters.operator) return false;
    if (filters.block) {
      const linkedBasins = new Set();
      blocks.forEach(block => {
        const blockProps = block.properties || {};
        if (blockProps.block_name === filters.block) {
          String(blockProps.bas_names || "").split("~").forEach(name => linkedBasins.add(name.trim()));
        }
      });
      if (!basinName || !linkedBasins.has(basinName)) return false;
    }
    if (filters.operator && !operator) {
      const linkedBasins = new Set();
      blocks.forEach(block => {
        const blockProps = block.properties || {};
        if (blockProps.operator === filters.operator) {
          String(blockProps.bas_names || "").split("~").forEach(name => linkedBasins.add(name.trim()));
        }
      });
      wells.forEach(well => {
        const wellProps = well.properties || {};
        if (wellProps.operator === filters.operator && wellProps.basin_name) linkedBasins.add(wellProps.basin_name);
      });
      if (!basinName || !linkedBasins.has(basinName)) return false;
    }
    return matchesKeyword([
      props.field_name,
      country,
      basinName,
      operator,
      props.prod_stat,
      props.hc_type
    ], filters.keyword);
  });
}

function renderWellProfile(container, profile = {}, fallback = {}) {
  const pairs = [
    ["井名", profile.well_name || fallback.well_name || "-"],
    ["井号", profile.wel_id || fallback.well_id || fallback.objectid || "-"],
    ["盆地", profile.basin_name || fallback.basin_name || fallback.basin || "-"],
    ["作业者", profile.operator_name || fallback.operator || "-"],
    ["井型", profile.well_class || fallback.class || "-"],
    ["技术状态", profile.technical_status || fallback.tch_stat || fallback.tech_stat || "-"],
    ["开钻日期", profile.spud_date || fallback.spud_dt_yr || "-"],
    ["完钻日期", profile.completed_date || "-"],
    ["总井深", profile.td_meter ? `${profile.td_meter} m` : (fallback.td_m ? `${fallback.td_m} m` : "-")],
    ["垂深", profile.tvd_meter ? `${profile.tvd_meter} m` : (fallback.tvd_meter ? `${fallback.tvd_meter} m` : "-")],
    ["地理位置", profile.country || fallback.country || "-"]
  ];
  container.innerHTML = pairs.map(([label, value]) => `<span>${label}</span><strong>${safeText(value)}</strong>`).join("");
}

function renderWellHistory(container, history = []) {
  if (!history.length) {
    container.innerHTML = renderEmptyCard("暂无井史摘要", "当前井没有关联的井史事件。");
    return;
  }
  container.innerHTML = history.map(item => `
    <article class="history-item">
      <strong>${safeText(item.event_type || item.stage_name || "事件")}</strong>
      <small>${safeText(item.event_date || item.start_date || "-")}</small>
      <p>${safeText(item.content || item.comment || item.status || "-")}</p>
    </article>
  `).join("");
}

function renderWellDatasets(container, wellName, wellTables = {}) {
  const data = wellTables?.[wellName];
  if (!data) {
    container.innerHTML = renderEmptyCard("暂无井专题资料", "当前井没有匹配到专题表。");
    return;
  }
  const cards = [
    ["作业期次", data.periods?.length ? data.periods.map(item => `${safeText(item.period_type)} / ${safeText(item.operator_name)}`).join("；") : "无"],
    ["井测试", data.tests?.length ? data.tests.map(item => `${safeText(item.test_type)} / ${safeText(item.content)}`).join("；") : "无"],
    ["分层与 Tops", data.tops?.length ? data.tops.slice(0, 3).map(item => `${safeText(item.lithostrat_unit)} ${safeText(item.lithologies)}`).join("；") : "无"],
    ["地层导出", data.stratigraphy?.length ? data.stratigraphy.slice(0, 3).map(item => safeText(item.stratigraphic_unit)).join("；") : "无"],
    ["井斜测量", data.deviation_summary ? `测点 ${safeText(data.deviation_summary.survey_points)}，最大井深 ${safeText(data.deviation_summary.max_measured_depth_m)} m` : "无"],
    ["Checkshot/VSP", data.checkshot_summary ? `测点 ${safeText(data.checkshot_summary.survey_points)}，最大 TVD ${safeText(data.checkshot_summary.max_tvd_m)} m` : "无"],
    ["取样与装备", `取样 ${safeText(data.sampling_count)} 条，装备 ${safeText(data.equipment_count)} 条，文献 ${safeText(data.bibliography_count)} 条`]
  ];
  container.innerHTML = cards.map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${desc}</p>
    </article>
  `).join("");
}

function renderCurveInsights(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = renderEmptyCard("暂无曲线解读", "当前没有对应的曲线采样数据。");
    return;
  }
  const average = values => (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2);
  const grValues = rows.map(row => Number(row.gr_api));
  const rtValues = rows.map(row => Number(row.rt_ohmm));
  const rhobValues = rows.map(row => Number(row.rhob_gcc));
  const lithology = [...new Set(rows.map(row => row.lithology))].join(" / ");
  const interpretations = [...new Set(rows.map(row => row.interpretation))].join(" / ");
  container.innerHTML = [
    ["曲线覆盖", `${rows[0].well_name}，深度 ${rows[0].depth_m}m 至 ${rows[rows.length - 1].depth_m}m`],
    ["平均 GR", `${average(grValues)} API，岩性以 ${lithology} 为主`],
    ["平均电阻率", `${average(rtValues)} Ω·m`],
    ["平均密度", `${average(rhobValues)} g/cc，解释：${interpretations}`]
  ].map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${desc}</p>
    </article>
  `).join("");
}

function renderWellTable(container, rows = []) {
  const fields = ["well_name", "basin", "block", "depth_m", "gr_api", "rt_ohmm", "rhob_gcc", "nphi_vv", "lithology", "formation", "interpretation"];
  const labels = { well_name: "井名", basin: "盆地", block: "区块", depth_m: "深度(m)", gr_api: "GR", rt_ohmm: "RT", rhob_gcc: "RHOB", nphi_vv: "NPHI", lithology: "岩性", formation: "层位", interpretation: "解释" };
  container.innerHTML = `
    <table>
      <thead><tr>${fields.map(field => `<th>${labels[field]}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(row => `<tr>${fields.map(field => `<td>${safeText(row[field])}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
}

function scale(value, min, max, start, end) {
  if (max === min) return (start + end) / 2;
  return start + ((value - min) / (max - min)) * (end - start);
}

function renderWellChart(canvas, rows = []) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    context.fillStyle = "#64748b";
    context.font = "16px Microsoft YaHei, Arial";
    context.fillText("当前没有可绘制的曲线数据。", 24, 40);
    return;
  }

  const depths = rows.map(row => Number(row.depth_m));
  const minDepth = Math.min(...depths);
  const maxDepth = Math.max(...depths);
  const tracks = [
    { key: "gr_api", label: "GR(API)", color: "#1d62d6", xStart: 80, xEnd: 270 },
    { key: "rt_ohmm", label: "RT(Ω·m)", color: "#13a37f", xStart: 350, xEnd: 540 },
    { key: "rhob_gcc", label: "RHOB(g/cc)", color: "#d97706", xStart: 620, xEnd: 820 }
  ];

  context.font = "14px Microsoft YaHei, Arial";
  context.fillStyle = "#667085";
  context.fillText(`井号：${rows[0].well_name}，深度范围：${minDepth}-${maxDepth}m`, 24, 24);
  context.strokeStyle = "#dbe3ef";
  context.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const y = scale(i, 0, 5, 50, 310);
    context.beginPath();
    context.moveTo(50, y);
    context.lineTo(850, y);
    context.stroke();
    context.fillStyle = "#667085";
    context.fillText(`${Math.round(scale(i, 0, 5, minDepth, maxDepth))}m`, 16, y + 4);
  }

  tracks.forEach(track => {
    const values = rows.map(row => Number(row[track.key]));
    context.strokeStyle = track.color;
    context.lineWidth = 2;
    context.beginPath();
    rows.forEach((row, index) => {
      const x = scale(Number(row[track.key]), Math.min(...values), Math.max(...values), track.xStart, track.xEnd);
      const y = scale(Number(row.depth_m), minDepth, maxDepth, 50, 310);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    context.fillStyle = track.color;
    context.fillText(track.label, track.xStart, 34);
  });
}

function getFeatureLocateBounds(LMap, feature) {
  if (!feature) return null;
  const layer = LMap.geoJSON(feature);
  const bounds = layer.getBounds();
  return bounds.isValid() ? bounds : null;
}

function renderBlockProfile(container, profile = {}) {
  const pairs = [
    ["区块名称", profile.block_name],
    ["合同名称", profile.contract_name],
    ["国家", profile.country_name],
    ["盆地", profile.basin_names],
    ["作业者", profile.operator_name],
    ["权利类型", profile.rights_type],
    ["合同类型", profile.contract_type],
    ["合同状态", profile.contract_status],
    ["区块状态", profile.block_status],
    ["区块面积", profile.block_sqkm ? `${formatNumber(profile.block_sqkm, 1)} km²` : "-"],
    ["陆海属性", profile.onshore_offshore],
    ["地形", profile.terrains],
    ["行政区", profile.main_political_province],
    ["资源类型", profile.resource_type],
    ["授予日期", profile.award_date],
    ["到期日期", profile.expiry_date]
  ];
  container.innerHTML = pairs.map(([label, value]) => `<span>${label}</span><strong>${safeText(value)}</strong>`).join("");
}

function renderLocationTiles(container, profile = {}, tables = {}) {
  const location = tables.locations?.[0] || {};
  const outline = tables.outline_summary || {};
  const cards = [
    ["坐标位置", location.approx_latitude_dec_deg && location.approx_longitude_dec_deg ? `${location.approx_latitude_dec_deg}, ${location.approx_longitude_dec_deg}` : `${safeText(profile.approx_latitude)} / ${safeText(profile.approx_longitude)}`],
    ["水深范围", profile.min_water_depth_meter || profile.max_water_depth_meter ? `${safeText(profile.min_water_depth_meter)} - ${safeText(profile.max_water_depth_meter)} m` : "-"],
    ["平均水深", profile.median_water_depth_meter ? `${formatNumber(profile.median_water_depth_meter, 1)} m` : "-"],
    ["轮廓点数", outline.point_count || 0],
    ["包围盒", outline.point_count ? `${formatNumber(outline.min_longitude, 3)}, ${formatNumber(outline.min_latitude, 3)} ~ ${formatNumber(outline.max_longitude, 3)}, ${formatNumber(outline.max_latitude, 3)}` : "-"],
    ["原始面积保留", profile.pct_original_area_remaining != null && profile.pct_original_area_remaining !== "" ? `${formatNumber(profile.pct_original_area_remaining, 1)}%` : "-"]
  ];
  container.innerHTML = cards.map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${safeText(desc)}</p>
    </article>
  `).join("");
}

function renderBlockHistory(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = renderEmptyCard("暂无区块历史", "当前区块没有匹配到历史阶段信息。");
    return;
  }
  container.innerHTML = rows.map(row => `
    <article class="history-item">
      <strong>阶段 ${safeText(row.stage_numb)}</strong>
      <small>${safeText(row.start_date)} ~ ${safeText(row.end_date)}</small>
      <p>${safeText(row.contract_stage_events || row.block_events || row.contract_status || row.block_status)}</p>
    </article>
  `).join("");
}

function renderBlockSchedule(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = renderEmptyCard("暂无计划事件", "当前区块没有匹配到计划日期信息。");
    return;
  }
  const row = rows[0];
  const cards = [
    ["申请日期", row.application_date],
    ["授予日期", row.award_date],
    ["到期日期", row.expiry_date],
    ["续约计划", row.renewal_sch_dates],
    ["缩减计划", row.reduction_sch_dates],
    ["勘探到期计划", row.exp_expiry_sch_date],
    ["生产到期计划", row.prod_expiry_sch_date]
  ];
  container.innerHTML = cards.map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${safeText(desc)}</p>
    </article>
  `).join("");
}

function renderCompanyTable(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = renderEmptyCard("暂无公司权益", "当前区块没有匹配到公司权益表。");
    return;
  }
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>公司</th>
          <th>简称</th>
          <th>权益(%)</th>
          <th>公司类型</th>
          <th>业务属性</th>
          <th>是否作业者</th>
          <th>净面积(km²)</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${safeText(row.company_name)}</td>
            <td>${safeText(row.company_acronym)}</td>
            <td>${row.interests_pct != null && row.interests_pct !== "" ? formatNumber(row.interests_pct, 2) : "-"}</td>
            <td>${safeText(row.company_type)}</td>
            <td>${safeText(row.business_activity)}</td>
            <td>${safeText(row.operator_flag)}</td>
            <td>${row.total_net_sqkm != null && row.total_net_sqkm !== "" ? formatNumber(row.total_net_sqkm, 3) : "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderOwnership(container, profile = {}) {
  const cards = [
    ["当前本地公司结构", profile.block_local_companies_curr],
    ["当前母公司结构", profile.block_parent_companies_curr],
    ["上一期本地公司结构", profile.block_local_companies_prev],
    ["上一期母公司结构", profile.block_parent_companies_prev]
  ];
  container.innerHTML = cards.map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${safeText(desc)}</p>
    </article>
  `).join("");
}

function renderContractProfile(container, profile = {}) {
  const pairs = [
    ["合同名称", profile.contract_name],
    ["国家", profile.country_name],
    ["盆地", profile.basin_names],
    ["作业者", profile.operator_name],
    ["公司组", profile.group_name],
    ["权利类型", profile.rights_type],
    ["合同类型", profile.contract_type || profile.general_contract_type],
    ["合同状态", profile.contract_status],
    ["资源类型", profile.resource_type],
    ["非常规类型", profile.unconventional_type],
    ["陆海属性", profile.onshore_offshore],
    ["地形", profile.terrains],
    ["合同面积", profile.contract_sqkm ? `${formatNumber(profile.contract_sqkm, 1)} km²` : "-"],
    ["原始面积保留", profile.pct_original_area_remaining != null ? `${formatNumber(profile.pct_original_area_remaining, 1)}%` : "-"],
    ["区块数量", profile.number_of_blocks != null ? `${profile.number_of_blocks} 个` : "-"],
    ["授予日期", profile.award_date],
    ["到期日期", profile.expiry_date],
    ["计划到期日期", profile.expiry_scheduled_date]
  ];
  container.innerHTML = pairs.map(([label, value]) => `<span>${label}</span><strong>${safeText(value)}</strong>`).join("");
}

function renderContractLocationTiles(container, profile = {}, tables = {}) {
  const summary = tables.location_summary || {};
  const cards = [
    ["近似坐标", summary.approx_latitude_dec_deg && summary.approx_longitude_dec_deg
      ? `${formatNumber(summary.approx_latitude_dec_deg, 4)}, ${formatNumber(summary.approx_longitude_dec_deg, 4)}`
      : `${safeText(summary.approx_latitude || profile.approx_latitude)} / ${safeText(summary.approx_longitude || profile.approx_longitude)}`],
    ["行政区", summary.province || profile.main_political_province || "-"],
    ["地形", summary.terrains || profile.terrains || "-"],
    ["主要 FSS 区", summary.main_fss_zone || "-"],
    ["陆上面积", summary.onshore_sqkm != null ? `${formatNumber(summary.onshore_sqkm, 1)} km²` : "-"],
    ["陆架面积", summary.continental_shelf_sqkm != null ? `${formatNumber(summary.continental_shelf_sqkm, 1)} km²` : "-"],
    ["深水面积", summary.deepwater_sqkm != null ? `${formatNumber(summary.deepwater_sqkm, 1)} km²` : "-"],
    ["有效性", profile.contract_validity]
  ];
  container.innerHTML = cards.map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${safeText(desc)}</p>
    </article>
  `).join("");
}

function renderContractHistory(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = renderEmptyCard("暂无合同历史", "当前合同没有匹配到历史阶段信息。");
    return;
  }
  container.innerHTML = rows.map(row => `
    <article class="history-item">
      <strong>阶段 ${safeText(row.stage_numb)}</strong>
      <small>${safeText(row.start_date)} ~ ${safeText(row.end_date)}</small>
      <p>${safeText(row.contract_stage_events || row.contract_status || row.general_contract_type)}</p>
    </article>
  `).join("");
}

function renderContractSchedule(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = renderEmptyCard("暂无计划事件", "当前合同没有匹配到计划日期信息。");
    return;
  }
  const row = rows[0];
  const cards = [
    ["申请日期", row.application_date],
    ["授予日期", row.award_date],
    ["到期日期", row.expiry_date],
    ["续约计划", row.renewal_sch_dates],
    ["缩减计划", row.reduction_sch_dates],
    ["勘探到期计划", row.exp_expiry_sch_date],
    ["生产到期计划", row.prod_expiry_sch_date],
    ["计划到期", row.expiry_sch_date]
  ];
  container.innerHTML = cards.map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${safeText(desc)}</p>
    </article>
  `).join("");
}

function renderContractCompanyTable(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = renderEmptyCard("暂无公司权益", "当前合同没有匹配到公司权益表。");
    return;
  }
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>公司</th>
          <th>简称</th>
          <th>权益(%)</th>
          <th>作业者</th>
          <th>公司类型</th>
          <th>国际化</th>
          <th>净面积(km²)</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${safeText(row.company_name)}</td>
            <td>${safeText(row.company_acronym)}</td>
            <td>${row.interests_pct != null && row.interests_pct !== "" ? formatNumber(row.interests_pct, 2) : "-"}</td>
            <td>${safeText(row.operator_flag)}</td>
            <td>${safeText(row.company_type)}</td>
            <td>${safeText(row.international_flag)}</td>
            <td>${row.total_net_sqkm != null && row.total_net_sqkm !== "" ? formatNumber(row.total_net_sqkm, 2) : "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderContractCommitments(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = renderEmptyCard("暂无合同承诺", "当前合同没有匹配到承诺工作量信息。");
    return;
  }
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>期间</th>
          <th>承诺类型</th>
          <th>井数</th>
          <th>金额(USD MM)</th>
          <th>备注</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${safeText(row.period_name || row.period || row.stage_period)}</td>
            <td>${safeText(row.commitment_type || row.commitment_category)}</td>
            <td>${row.wells_to_drill != null && row.wells_to_drill !== "" ? formatNumber(row.wells_to_drill, 0) : "-"}</td>
            <td>${row.invest_amount_usd_million != null && row.invest_amount_usd_million !== "" ? formatNumber(row.invest_amount_usd_million, 2) : "-"}</td>
            <td>${safeText(row.remarks || row.comments)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderContractRelatedBlocks(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = renderEmptyCard("暂无关联区块", "当前合同没有匹配到关联区块信息。");
    return;
  }
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>区块名称</th>
          <th>盆地</th>
          <th>作业者</th>
          <th>状态</th>
          <th>面积(km²)</th>
          <th>陆海</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${safeText(row.block_name)}</td>
            <td>${safeText(row.basin_names)}</td>
            <td>${safeText(row.operator_name)}</td>
            <td>${safeText(row.contract_status)}</td>
            <td>${row.block_sqkm != null && row.block_sqkm !== "" ? formatNumber(row.block_sqkm, 1) : "-"}</td>
            <td>${safeText(row.ons_offshore || row.ons_offshore)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderContractSupplementTiles(container, profile = {}, tables = {}) {
  const counts = tables.counts || {};
  const companySummary = tables.company_interest_summary || {};
  const commitmentSummary = tables.commitment_summary || {};
  const cards = [
    ["历史阶段记录", `${counts.history || 0} 条`],
    ["位置记录", `${counts.locations || 0} 条`],
    ["计划事件记录", `${counts.scheduled_events || 0} 条`],
    ["公司权益记录", `${counts.company_interests || 0} 条`],
    ["承诺记录", `${counts.commitments || 0} 条`],
    ["关联区块记录", `${counts.related_blocks || 0} 条`],
    ["文献记录", `${counts.bibliography || 0} 条`],
    ["权益公司数", `${companySummary.company_count || 0} 家`],
    ["作业者数", `${companySummary.operator_count || 0} 家`],
    ["最大权益占比", companySummary.max_interest_pct != null ? `${formatNumber(companySummary.max_interest_pct, 2)}%` : "-"],
    ["承诺井数", `${commitmentSummary.wells_to_drill || 0} 口`],
    ["承诺投资", commitmentSummary.invest_amount_usd_million != null ? `${formatNumber(commitmentSummary.invest_amount_usd_million, 2)} USD MM` : "-"]
  ];
  container.innerHTML = cards.map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${safeText(desc)}</p>
    </article>
  `).join("");
}

function renderFieldProfile(container, profile = {}, fallback = {}) {
  const pairs = [
    ["油气田名称", profile.field_name || fallback.field_name || "-"],
    ["油气田编号", profile.field_id || fallback.fie_id || "-"],
    ["国家", profile.country_names || fallback.countries || "-"],
    ["盆地", profile.basin_name || fallback.basin_name || "-"],
    ["合同区块", profile.current_contract_blocks || fallback.block_curr || "-"],
    ["当前作业者", profile.current_operators || fallback.opr_curr || "-"],
    ["开发状态", profile.prod_status || fallback.prod_stat || "-"],
    ["油气类型", profile.hc_type || fallback.hc_type || "-"],
    ["资源类型", profile.resource_type || fallback.resourc12 || "-"],
    ["非常规类型", profile.unconventional_type || fallback.unc_type1 || "-"],
    ["发现年份", profile.discovery_year || "-"],
    ["发现井", profile.discovery_well_name || "-"],
    ["陆海属性", profile.onshore_offshore || "-"],
    ["地形", profile.terrain || "-"],
    ["最大水深", profile.water_depth_max_meter ? `${formatNumber(profile.water_depth_max_meter, 1)} m` : (fallback.wd_max_m ? `${formatNumber(fallback.wd_max_m, 1)} m` : "-")],
    ["面积", profile.field_sqkm ? `${formatNumber(profile.field_sqkm, 2)} km²` : "-"]
  ];
  container.innerHTML = pairs.map(([label, value]) => `<span>${label}</span><strong>${safeText(value)}</strong>`).join("");
}

function renderFieldReserveTiles(container, profile = {}, tables = {}) {
  const summary = tables.production_summary || {};
  const counts = tables.counts || {};
  const cards = [
    ["总可采当量", profile.total_recoverable_mmboe != null ? `${formatNumber(profile.total_recoverable_mmboe, 2)} MMboe` : "-"],
    ["油可采资源", profile.oil_recoverable_pp_mmbbl != null ? `${formatNumber(profile.oil_recoverable_pp_mmbbl, 2)} MMbbl` : "-"],
    ["气可采资源", profile.gas_recoverable_pp_mmscf != null ? `${formatNumber(profile.gas_recoverable_pp_mmscf, 0)} MMscf` : "-"],
    ["凝析油可采资源", profile.cond_recoverable_pp_mmbbl != null ? `${formatNumber(profile.cond_recoverable_pp_mmbbl, 2)} MMbbl` : "-"],
    ["储层数量", profile.number_of_reservoirs != null ? `${profile.number_of_reservoirs} 个` : "-"],
    ["年度产量记录", `${summary.annual_records || 0} 条`],
    ["累计产量记录", `${summary.cumulative_records || 0} 条`],
    ["权益记录", `${counts.company_interests || 0} 条`]
  ];
  container.innerHTML = cards.map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${safeText(desc)}</p>
    </article>
  `).join("");
}

function renderFieldEvents(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = renderEmptyCard("暂无油气田事件", "当前油气田没有匹配到事件记录。");
    return;
  }
  container.innerHTML = rows.map(row => `
    <article class="history-item">
      <strong>${safeText(row["Field Event Type"] || row.field_event_type || "事件")}</strong>
      <small>${safeText(row["Start Date"] || row.start_date || "-")}</small>
      <p>${safeText(row["Planned Actual Indicator"] || row.planned_actual_indicator)} / ${safeText(row["Event Remarks"] || row.event_remarks || "-")}</p>
    </article>
  `).join("");
}

function renderFieldCompanyTable(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = renderEmptyCard("暂无油气田权益", "当前油气田没有匹配到公司权益数据。");
    return;
  }
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>公司</th>
          <th>简称</th>
          <th>权益(%)</th>
          <th>作业者</th>
          <th>国家</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${safeText(row["Company Name"] || row.company_name)}</td>
            <td>${safeText(row["Company Acronym"] || row.company_acronym)}</td>
            <td>${row["Interests Pct"] != null && row["Interests Pct"] !== "" ? formatNumber(row["Interests Pct"], 2) : (row.interests_pct != null && row.interests_pct !== "" ? formatNumber(row.interests_pct, 2) : "-")}</td>
            <td>${safeText(row["Operator Flag"] || row.operator_flag)}</td>
            <td>${safeText(row["Country Names"] || row.country_names)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderFieldSupplementTiles(container, tables = {}) {
  const summary = tables.production_summary || {};
  const outline = tables.outline_summary || {};
  const counts = tables.counts || {};
  const cards = [
    ["最近年度产量年份", safeText(summary.latest_annual_year)],
    ["最近油产量", summary.latest_oil_prod_bbl != null ? `${formatNumber(summary.latest_oil_prod_bbl, 0)} bbl` : "-"],
    ["最近气产量", summary.latest_gas_prod_mscf != null ? `${formatNumber(summary.latest_gas_prod_mscf, 0)} Mscf` : "-"],
    ["轮廓点数", `${outline.point_count || 0} 个`],
    ["图像记录", `${counts.images || 0} 条`],
    ["文献记录", `${counts.bibliography || 0} 条`],
    ["储层权益记录", `${counts.reservoirs_company_interests || 0} 条`],
    ["成本记录", `${counts.costs || 0} 条`]
  ];
  container.innerHTML = cards.map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${safeText(desc)}</p>
    </article>
  `).join("");
}

function renderBasinProfile(container, profile = {}, feature = {}, tables = {}) {
  const props = feature.properties || {};
  const pairs = [
    ["盆地名称", props.basin_name || "-"],
    ["国家", profile.country_names || props.countries || "-"],
    ["上级盆地", profile.parent_basin_name || props.prt_bsn_nm || "-"],
    ["别名", profile.alternate_basin_names || "-"],
    ["Kingston 分类", profile.kingston_class || props.king_class || "-"],
    ["Bally-Snelson 分类", profile.bally_snelson_class || "-"],
    ["Klemme 分类", profile.klemme_class || "-"],
    ["面积", profile.basin_sqkm ? `${formatNumber(profile.basin_sqkm, 1)} km²` : (props.bs_skm ? `${formatNumber(props.bs_skm, 1)} km²` : "-")],
    ["陆上面积", profile.basin_onshore_sqkm ? `${formatNumber(profile.basin_onshore_sqkm, 1)} km²` : "-"],
    ["海上面积", profile.basin_offshore_sqkm ? `${formatNumber(profile.basin_offshore_sqkm, 1)} km²` : "-"],
    ["陆架面积", profile.basin_shelf_sqkm ? `${formatNumber(profile.basin_shelf_sqkm, 1)} km²` : "-"],
    ["深水面积", profile.basin_deep_water_sqkm ? `${formatNumber(profile.basin_deep_water_sqkm, 1)} km²` : (props.bs_dp_wat ? `${formatNumber(props.bs_dp_wat, 1)} m` : "-")],
    ["最年轻时代", profile.basin_young_age || "-"],
    ["最老时代", profile.basin_old_age || "-"],
    ["图像资料", tables.images_count != null ? `${tables.images_count} 份` : "-"]
  ];
  container.innerHTML = pairs.map(([label, value]) => `<span>${label}</span><strong>${safeText(value)}</strong>`).join("");
}

function renderBasinPetroleumSystems(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = renderEmptyCard("暂无含油气系统", "当前盆地没有匹配到 petroleum systems。");
    return;
  }
  container.innerHTML = rows.slice(0, 8).map(row => `
    <article class="history-item">
      <strong>${safeText(row.pet_system_name)}</strong>
      <small>${safeText(row.source_rock_unit)}</small>
      <p>${safeText(row.play_names)}</p>
    </article>
  `).join("");
}

function renderBasinGeology(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = renderEmptyCard("暂无地层摘要", "当前盆地没有匹配到 lithostrat summary。");
    return;
  }
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>地层单元</th>
          <th>岩性</th>
          <th>油气意义</th>
          <th>沉积环境</th>
        </tr>
      </thead>
      <tbody>
        ${rows.slice(0, 12).map(row => `
          <tr>
            <td>${safeText(row.lithostrat_unit)}</td>
            <td>${safeText(row.lithology_name)}</td>
            <td>${safeText(row.hc_significance)}</td>
            <td>${safeText(row.deposit_environment)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderBasinReserveTiles(container, tables = {}) {
  const reserve = tables.reserves_production?.[0] || {};
  const geneticUnits = tables.genetic_units?.length || 0;
  const plays = tables.plays?.length || 0;
  const cards = [
    ["含油气系统", `${tables.petroleum_systems?.length || 0} 个`],
    ["Play 数量", `${plays} 个`],
    ["成因单元", `${geneticUnits} 个`],
    ["油可采资源", reserve.oil_recoverable_pp_mmbbl != null ? `${formatNumber(reserve.oil_recoverable_pp_mmbbl, 1)} MMbbl` : "-"],
    ["气可采资源", reserve.gas_recoverable_pp_mmscf != null ? `${formatNumber(reserve.gas_recoverable_pp_mmscf, 0)} MMscf` : "-"],
    ["总可采当量", reserve.total_recoverable_pp_mmboe != null ? `${formatNumber(reserve.total_recoverable_pp_mmboe, 2)} MMboe` : "-"],
    ["累计产量", reserve.cumul_tot_prod_mmboe != null ? `${formatNumber(reserve.cumul_tot_prod_mmboe, 2)} MMboe` : "-"],
    ["图像资料", tables.images_count != null ? `${tables.images_count} 份` : "-"]
  ];
  container.innerHTML = cards.map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${safeText(desc)}</p>
    </article>
  `).join("");
}

function renderModuleGrid(container, modules) {
  container.innerHTML = modules.map(module => `
    <article class="module-card is-action"${buildActionAttrs({
      "data-action-tab": inferModuleAction(module).tab,
      "data-action-scroll": inferModuleAction(module).scroll
    })} tabindex="0" role="button">
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

function renderRegionalStory(root, regionalStories = {}, africaIndex = {}) {
  const story = regionalStories.stories?.[0];
  const hasAfricaIndex = Boolean(africaIndex?.summary && Object.keys(africaIndex.summary).length);
  const summary = root.querySelector("#regionalStorySummary");
  const datasets = root.querySelector("#regionalStoryDatasets");
  const relations = root.querySelector("#regionalStoryRelations");
  const steps = root.querySelector("#regionalStorySteps");
  const samples = root.querySelector("#regionalStorySamples");
  const checklist = root.querySelector("#regionalPublishChecklist");
  const docs = root.querySelector("#regionalPdfFolders");

  if (!story && !hasAfricaIndex) {
    summary.innerHTML = renderEmptyCard("暂无区域专题", "当前还没有整理好的区域闭环数据。");
    [datasets, relations, steps, samples, checklist, docs].forEach(container => { container.innerHTML = ""; });
    return;
  }

  const summaryData = africaIndex.summary || {};
  const services = africaIndex.services || {};
  const sourceFiles = africaIndex.sourceFiles || {};
  const fieldTable = africaIndex.tables?.fields || {};
  const wellTable = africaIndex.tables?.wells || {};
  const fieldRecords = fieldTable.records || story?.samples?.fields || [];
  const wellRecords = wellTable.records || story?.samples?.wells || [];
  const pdfFolders = africaIndex.pdfIndex?.folders || story?.samples?.pdfFolders || [];
  const topFieldCountries = summaryData.topFieldCountries || [];
  const topWellCountries = summaryData.topWellCountries || [];
  const topFieldStatuses = summaryData.topFieldStatuses || [];
  const topWellStatuses = summaryData.topWellStatuses || [];

  const countCards = [
    ["专题区域", africaIndex.region || story?.region || "Africa"],
    ["盆地", `${formatNumber(summaryData.basins ?? story?.counts?.basins ?? 0)} 个`],
    ["合同区块", `${formatNumber(summaryData.contractBlocks ?? story?.counts?.contractBlocks ?? 0)} 个`],
    ["油气田", `${formatNumber(summaryData.fields ?? story?.counts?.fields ?? 0)} 个`],
    ["钻井", `${formatNumber(summaryData.wells ?? story?.counts?.wells ?? 0)} 口`],
    ["PDF资料", `${formatNumber(summaryData.pdfFiles ?? story?.counts?.basinMonitorPdfs ?? 0)} 份`]
  ];
  summary.innerHTML = countCards.map(([title, value]) => `
    <article class="stat-card">
      <span>${title}</span>
      <strong>${safeText(value)}</strong>
    </article>
  `).join("");

  const datasetCards = [
    {
      name: "非洲盆地边界",
      objectType: "盆地",
      format: "Shapefile",
      geometry: "Polygon",
      service: services.basins,
      source: sourceFiles.basinsShp,
      count: summaryData.basins,
      keyFields: ["basin_name", "countries", "king_class", "bs_skm"]
    },
    {
      name: "非洲合同区块",
      objectType: "合同区块",
      format: "Shapefile",
      geometry: "Polygon",
      service: services.contractBlocks,
      source: sourceFiles.contractBlocksShp,
      count: summaryData.contractBlocks,
      keyFields: ["block_name", "contract", "operator", "blk_sqkm"]
    },
    {
      name: "非洲油气田",
      objectType: "油气田",
      format: "Shapefile + CSV",
      geometry: "Polygon",
      service: services.fields,
      source: sourceFiles.fieldsShp,
      count: summaryData.fields,
      keyFields: ["field_name", "countries", "basin_name", "opr_curr", "prod_stat"]
    },
    {
      name: "非洲钻井",
      objectType: "井",
      format: "Shapefile + Excel",
      geometry: "Point",
      service: services.wells,
      source: sourceFiles.wellsShp,
      count: summaryData.wells,
      keyFields: ["well_name", "basin_name", "operator", "td_m", "spud_dt_yr"]
    },
    {
      name: "Basin Monitor PDF",
      objectType: "盆地资料",
      format: "PDF",
      geometry: "Document",
      service: null,
      source: sourceFiles.pdfRoot,
      count: summaryData.pdfFiles,
      keyFields: ["overview", "exploration", "development", "fields", "plays"]
    }
  ];

  datasets.innerHTML = datasetCards.map(dataset => `
    <article class="info-tile">
      <h4>${dataset.name}</h4>
      <p>${dataset.objectType} / ${dataset.format} / ${dataset.geometry}</p>
      <small>数量：${formatNumber(dataset.count || 0)}；服务：${safeText(dataset.service?.name || "本地资料索引")}</small>
      <small>来源：${safeText(dataset.source?.relativePath || dataset.source?.name)}</small>
      <div class="tag-row">${(dataset.keyFields || []).slice(0, 6).map(field => `<b>${field}</b>`).join("")}</div>
    </article>
  `).join("");

  const relationCards = [
    { from: "盆地", to: "合同区块", fields: ["basin_name", "bas_names"], description: "用盆地名称把区块归入对应盆地范围，支撑按盆地查看区块分布。" },
    { from: "合同区块", to: "油气田", fields: ["block_name", "Cur Contract Block Names"], description: "用区块名称把油气田和合同区块对应起来，支撑资产/权益视角分析。" },
    { from: "油气田", to: "钻井", fields: ["field_name", "Field Name"], description: "用油气田名称关联发现井、开发井和钻探活动，形成从资源到井的链路。" },
    { from: "盆地", to: "PDF资料", fields: ["basin_name", "PDF folder"], description: "用盆地名称匹配 Basin Monitor 文档目录，点击即可查看对应盆地报告。" }
  ];
  relations.innerHTML = relationCards.map(item => `
    <article class="info-tile">
      <h4>${item.from} → ${item.to}</h4>
      <p>${item.description}</p>
      <small>关联字段：${item.fields.join(" / ")}</small>
    </article>
  `).join("");

  const storySteps = [
    "将非洲盆地、区块、油气田和钻井 Shapefile 发布为 MapGIS IGServer FeatureServer。",
    "前端通过 /igs/rest/services/.../FeatureServer/query 读取空间对象，统一放到地图上浏览。",
    "把油气田 CSV 和钻井 Excel 整理成 africa_integrated_index.json，用于详情、统计和目录展示。",
    "把 Basin Monitor PDF 建立目录索引，通过 /source-data/Africa/pdf/... 在平台中打开原始资料。",
    "通过盆地、区块、油气田、井和 PDF 的字段关系形成一个可继续扩展的区域数据闭环。"
  ];
  steps.innerHTML = storySteps.map((step, index) => `
    <article class="info-tile">
      <h4>${index + 1}. ${step}</h4>
    </article>
  `).join("");

  const basinSamples = story?.samples?.basins || [];
  const blockSamples = story?.samples?.blocks || [];
  const fieldSamples = fieldRecords.slice(0, 8);
  const wellSamples = wellRecords.slice(0, 8);
  samples.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>类型</th><th>名称</th><th>国家/盆地</th><th>关键信息</th></tr></thead>
        <tbody>
          ${basinSamples.map(item => `<tr><td>盆地</td><td>${safeText(item.name)}</td><td>${safeText(item.countries)}</td><td>${safeText(item.class)} / ${formatNumber(item.areaSqkm, 1)} km²</td></tr>`).join("")}
          ${blockSamples.map(item => `<tr><td>区块</td><td>${safeText(item.name)}</td><td>${safeText(item.country)}</td><td>${safeText(item.operator)} / ${formatNumber(item.areaSqkm, 1)} km²</td></tr>`).join("")}
          ${fieldSamples.map(item => `<tr><td>油气田</td><td>${safeText(item.name)}</td><td>${safeText(item.country || item.basin)}</td><td>${safeText(item.operator)} / ${safeText(item.status)} / ${safeText(item.hcType)}</td></tr>`).join("")}
          ${wellSamples.map(item => `<tr><td>井</td><td>${safeText(item.name)}</td><td>${safeText(item.country || item.basin)}</td><td>${safeText(item.operator)} / ${safeText(item.technicalStatus)} / TD ${safeText(item.tdMeter)} m</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div class="data-detail-grid">
      <article class="info-tile">
        <h4>油气田表格覆盖</h4>
        <p>${formatNumber(fieldTable.rowCount || 0)} 条记录 / ${formatNumber((fieldTable.columns || []).length)} 个字段</p>
        <small>${safeText(sourceFiles.fieldTable?.relativePath)}</small>
      </article>
      <article class="info-tile">
        <h4>钻井表格覆盖</h4>
        <p>${formatNumber(wellTable.rowCount || 0)} 条记录 / ${formatNumber((wellTable.columns || []).length)} 个字段</p>
        <small>${safeText(sourceFiles.wellTable?.relativePath)}</small>
      </article>
    </div>
  `;

  const checklistItems = [
    ["盆地服务", services.basins, sourceFiles.basinsShp],
    ["区块服务", services.contractBlocks, sourceFiles.contractBlocksShp],
    ["油气田服务", services.fields, sourceFiles.fieldsShp],
    ["钻井服务", services.wells, sourceFiles.wellsShp]
  ];
  checklist.innerHTML = checklistItems.map(([label, service, source]) => `
    <article class="info-tile">
      <h4>${label}</h4>
      <p>${safeText(service?.name)} / ${safeText(service?.geometry)}</p>
      <small>${safeText(service?.path)}</small>
      <div class="tag-row"><b>${safeText(source?.name)}</b><b>MapGIS IGServer</b></div>
    </article>
  `).join("");

  const renderDocLinks = documents => (documents || []).slice(0, 4).map(doc => {
    if (typeof doc === "string") {
      return `<span>${safeText(doc)}</span>`;
    }
    return doc?.url
      ? `<a href="${doc.url}" target="_blank" rel="noopener">${safeText(doc.fileName)}</a>`
      : `<span>${safeText(doc?.fileName || "")}</span>`;
  }).join("");
  docs.innerHTML = `
    <div class="data-detail-grid">
      <article class="info-tile">
        <h4>油气田国家分布</h4>
        <p>${topFieldCountries.slice(0, 5).map(item => `${safeText(item.name)} ${formatNumber(item.count)}`).join("；")}</p>
      </article>
      <article class="info-tile">
        <h4>钻井国家分布</h4>
        <p>${topWellCountries.slice(0, 5).map(item => `${safeText(item.name)} ${formatNumber(item.count)}`).join("；")}</p>
      </article>
      <article class="info-tile">
        <h4>油气田状态</h4>
        <p>${topFieldStatuses.slice(0, 5).map(item => `${safeText(item.name)} ${formatNumber(item.count)}`).join("；")}</p>
      </article>
      <article class="info-tile">
        <h4>钻井状态</h4>
        <p>${topWellStatuses.slice(0, 5).map(item => `${safeText(item.name)} ${formatNumber(item.count)}`).join("；")}</p>
      </article>
    </div>
    <div class="tiles-grid">
      ${pdfFolders.slice(0, 12).map(item => `
    <article class="info-tile">
      <h4>${safeText(item.basin)}</h4>
      <p>PDF：${formatNumber(item.documentCount || item.pdfCount || 0)} 份</p>
      <small>${renderDocLinks(item.documents || item.examples || [])}</small>
    </article>
      `).join("")}
    </div>
  `;
}

function setupTabs(root, onChange) {
  const buttons = [...root.querySelectorAll("[data-tab-target]")];
  const panels = [...root.querySelectorAll("[data-tab-panel]")];

  function activate(target) {
    buttons.forEach(button => button.classList.toggle("is-active", button.dataset.tabTarget === target));
    panels.forEach(panel => panel.classList.toggle("is-active", panel.dataset.tabPanel === target));
    onChange?.(target);
  }

  buttons.forEach(button => {
    button.addEventListener("click", () => activate(button.dataset.tabTarget));
  });

  activate("spatial");
  return { activate };
}

function setupDetailTabs(root) {
  const controllers = new Map();
  root.querySelectorAll("[data-detail-tabs]").forEach(container => {
    const buttons = [...container.querySelectorAll("[data-detail-tab]")];
    const panels = [...container.parentElement.querySelectorAll("[data-detail-panel]")];
    const sectionKey = container.parentElement.dataset.detailSection;

    function activate(target) {
      buttons.forEach(button => button.classList.toggle("is-active", button.dataset.detailTab === target));
      panels.forEach(panel => panel.classList.toggle("is-active", panel.dataset.detailPanel === target));
    }

    buttons.forEach(button => {
      button.addEventListener("click", () => activate(button.dataset.detailTab));
    });

    activate(buttons[0]?.dataset.detailTab);
    if (sectionKey) {
      controllers.set(sectionKey, { activate });
    }
  });
  return {
    activate(sectionKey, target) {
      controllers.get(sectionKey)?.activate(target);
    }
  };
}

function bindActionCards(root, tabController, detailController) {
  function handleAction(source) {
    const card = source.closest("[data-action-tab], [data-action-select]");
    if (!card) return;
    const tab = decodeURIComponent(card.dataset.actionTab || "");
    const detail = decodeURIComponent(card.dataset.actionDetail || "");
    const scrollSelector = decodeURIComponent(card.dataset.actionScroll || "");
    const selectSelector = decodeURIComponent(card.dataset.actionSelect || "");
    const selectValue = decodeURIComponent(card.dataset.actionValue || "");

    if (tab) {
      tabController?.activate(tab);
    }
    if (detail && tab) {
      detailController?.activate(tab, detail);
    }
    if (selectSelector && selectValue) {
      const select = root.querySelector(selectSelector);
      if (select && [...select.options].some(option => option.value === selectValue)) {
        select.value = selectValue;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    window.setTimeout(() => {
      const focusTarget = scrollSelector ? root.querySelector(scrollSelector) : card;
      if (focusTarget) {
        focusTarget.scrollIntoView({ behavior: "smooth", block: "start" });
        flashFocus(focusTarget);
      }
    }, 120);
  }

  root.addEventListener("click", event => {
    if (event.target.closest("[data-action-tab], [data-action-select]")) {
      handleAction(event.target);
    }
  });

  root.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target.closest(".is-action")) {
      event.preventDefault();
      handleAction(event.target);
    }
  });
}

async function init() {
  const root = renderShell({
    currentKey: "data",
    heroTitle: "数据信息模块",
    heroDesc: "统一查看盆地、区块、合同、油气田、井位、专题资料和数据目录。",
    heroMeta: ["盆地", "区块", "合同", "油气田", "井位", "资料目录"]
  });
  root.innerHTML = `
    <section class="content-section">
      <div class="section-heading">
        <div>
          <h3>数据信息正在加载</h3>
          <p>正在读取本地整理资料；空间图层会在地图工作区按需读取 MapGIS 真实服务。</p>
        </div>
      </div>
      <div class="module-grid module-grid--wide">
        <article class="module-card">
          <div class="module-head"><span>空间</span><small>MapGIS</small></div>
          <h3>空间总览</h3>
          <p>加载盆地、区块、油气田和井位图层。</p>
        </article>
        <article class="module-card">
          <div class="module-head"><span>资料</span><small>Excel / PDF</small></div>
          <h3>对象资料</h3>
          <p>读取已整理的表格、目录和专题资料。</p>
        </article>
      </div>
    </section>
  `;
  const state = await loadPlatformState({ includeMapLayers: false });
  const blockProfiles = state.blockData?.profiles || {};
  const blockTables = state.blockData?.tables || {};
  const contractProfiles = state.contractData?.profiles || {};
  const contractTables = state.contractData?.tables || {};
  const basinProfiles = state.basinData?.profiles || {};
  const basinTables = state.basinData?.tables || {};
  const fieldProfiles = state.fieldData?.profiles || {};
  const fieldTables = state.fieldData?.tables || {};
  let wellRecords = getWellRecords(state);
  let wellRecordByName = Object.fromEntries(wellRecords.map(record => [record.name, record]));
  let wellIdByName = Object.fromEntries(wellRecords.map(record => [record.name, record.wellId]));
  let refreshAfterMapLayersLoaded = () => {};

  function rebuildWellIndexes() {
    wellRecords = getWellRecords(state);
    wellRecordByName = Object.fromEntries(wellRecords.map(record => [record.name, record]));
    wellIdByName = Object.fromEntries(wellRecords.map(record => [record.name, record.wellId]));
  }

  root.innerHTML = `
    <section class="content-section">
      <div class="section-heading">
        <div>
          <h3>模块导航</h3>
          <p>按对象类型切换查看空间、盆地、区块、合同、油气田、井和目录信息。</p>
        </div>
      </div>
      <div class="subnav-tabs">
        <button type="button" class="subnav-tabs__item" data-tab-target="spatial">空间总览</button>
        <button type="button" class="subnav-tabs__item" data-tab-target="regional">区域专题</button>
        <button type="button" class="subnav-tabs__item" data-tab-target="basins">盆地信息</button>
        <button type="button" class="subnav-tabs__item" data-tab-target="blocks">区块信息</button>
        <button type="button" class="subnav-tabs__item" data-tab-target="contracts">合同信息</button>
        <button type="button" class="subnav-tabs__item" data-tab-target="fields">油气田信息</button>
        <button type="button" class="subnav-tabs__item" data-tab-target="wells">井资料</button>
        <button type="button" class="subnav-tabs__item" data-tab-target="catalog">数据目录</button>
      </div>
    </section>

    <section class="data-module-panel" data-tab-panel="spatial">
      <section class="content-section">
        <div class="workspace-grid">
          <aside class="sidebar">
            <article id="serviceSourceCard" class="content-card">
              <h3>筛选条件</h3>
              <div class="filter-form">
                <label><span>关键字</span><input id="searchKeyword" type="text" placeholder="输入井名、盆地名、区块名、油气田名"></label>
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
                <span>可见油气田</span><strong id="visibleFieldCount">-</strong>
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
            <div class="toolbar-row">
                <label><input type="checkbox" id="toggleBaseMap" checked> 在线底图</label>
                <label><input type="checkbox" id="toggleBasins" checked> 盆地图层</label>
                <label><input type="checkbox" id="toggleBlocks" checked> 合同区块图层</label>
                <label><input type="checkbox" id="toggleFields" checked> 油气田图层</label>
                <label><input type="checkbox" id="toggleWells" checked> 井位图层</label>
                <label>底图
                  <select id="onlineBasemapSelect">
                    ${getOnlineBasemapOptions().map(option => `<option value="${option.key}" ${option.key === DEFAULT_ONLINE_BASEMAP_KEY ? "selected" : ""}>${option.name}</option>`).join("")}
                  </select>
                </label>
                <button type="button" id="refreshMapData" class="button-ghost" title="后台重新读取数据，完成后更新显示（不影响当前画面）">刷新数据</button>
                <button type="button" id="reloadMapData" class="button-ghost" title="清空当前画面，按加载顺序重新展示全部数据">重新加载</button>
                <span id="mapRuntime"></span>
              </div>
            <div id="map" class="map-view"></div>
          </div>
          <aside class="sidebar">
            <article class="content-card">
              <h3>当前选中对象</h3>
              <span class="sidebar-tag" id="selectedFeatureType">未选择</span>
              <strong class="sidebar-title" id="selectedFeatureTitle">点击盆地、区块、油气田或井位查看详情</strong>
              <div class="meta-grid" id="selectedFeatureMeta"></div>
            </article>
            <article class="content-card">
              <h3>对象摘要</h3>
              <div class="meta-grid">
                <span>代表盆地</span><strong id="highlightBasin">-</strong>
                <span>代表区块</span><strong id="highlightBlock">-</strong>
                <span>代表油气田</span><strong id="highlightField">-</strong>
                <span>代表井位</span><strong id="highlightWell">-</strong>
                <span>最大盆地面积</span><strong id="maxBasinArea">-</strong>
                <span>活跃作业者</span><strong id="topOperator">-</strong>
              </div>
            </article>
            <article class="content-card">
              <h3>运行状态</h3>
              <div class="meta-grid">
                <span>数据来源</span><strong id="serviceSourceBadge">-</strong>
                <span>盆地图层</span><strong id="basinFeatureCount">-</strong>
                <span>区块图层</span><strong id="blockFeatureCount">-</strong>
                <span>油气田图层</span><strong id="fieldFeatureCount">-</strong>
                <span>井位图层</span><strong id="wellFeatureCount">-</strong>
                <span>覆盖国家</span><strong id="countryCount">-</strong>
              </div>
            </article>
            <article class="content-card">
              <h3>加载诊断</h3>
              <div id="layerDiagnostics" class="diagnostic-list"></div>
              <p class="diagnostic-note">说明：这里显示的是本次页面向 MapGIS 服务读取到的数量，不等同于服务里的全部数据。达到单次上限时，说明后续需要做分页读取或条件筛选。</p>
            </article>
          </aside>
        </div>
      </section>
    </section>

    <section class="data-module-panel" data-tab-panel="regional">
      <section class="content-section">
        <div class="section-heading">
          <div>
            <h3>区域专题</h3>
            <p>集中查看非洲区域的空间服务、表格资料、对象样例和 PDF 报告索引。</p>
          </div>
        </div>
        <div id="regionalStorySummary" class="stats-grid"></div>
        <div class="data-detail-grid">
          <article class="content-card">
            <h3>数据对象</h3>
            <div id="regionalStoryDatasets" class="tiles-grid"></div>
          </article>
          <article class="content-card">
            <h3>业务关联关系</h3>
            <div id="regionalStoryRelations" class="tiles-grid"></div>
          </article>
        </div>
        <div class="data-detail-grid">
          <article class="content-card">
            <h3>接入链路</h3>
            <div id="regionalStorySteps" class="list-stack"></div>
          </article>
          <article class="content-card">
            <h3>空间服务发布清单</h3>
            <div id="regionalPublishChecklist" class="list-stack"></div>
          </article>
        </div>
        <article class="content-card">
          <h3>对象样例与表格覆盖</h3>
          <div id="regionalStorySamples"></div>
        </article>
        <article class="content-card">
          <h3>统计摘要与 PDF 资料索引</h3>
          <div id="regionalPdfFolders" class="tiles-grid"></div>
        </article>
      </section>
    </section>

    <section class="data-module-panel" data-tab-panel="basins">
      <section class="content-section">
        <div class="section-heading section-heading--inline">
          <div>
            <h3>盆地信息</h3>
            <p>查看盆地属性、系统和地层资料。</p>
          </div>
          <label class="inline-select">选择盆地<select id="basinSelect"></select></label>
        </div>
        <section class="detail-shell" data-detail-section="basins">
          <article id="basinSummaryCard" class="content-card detail-summary">
            <div>
              <h3>盆地摘要</h3>
              <div id="basinProfile" class="profile-grid"></div>
            </div>
            <div>
              <h3>资料概况</h3>
              <div id="basinReserveTiles" class="tiles-grid"></div>
            </div>
          </article>
          <div class="detail-tabbar" data-detail-tabs>
            <button type="button" class="detail-tabbar__item" data-detail-tab="systems">含油气系统</button>
            <button type="button" class="detail-tabbar__item" data-detail-tab="geology">地层与岩性</button>
          </div>
          <section class="detail-tabpanel" data-detail-panel="systems">
            <article id="basinSystemsCard" class="content-card">
              <h3>含油气系统</h3>
              <div id="basinSystems" class="history-list"></div>
            </article>
          </section>
          <section class="detail-tabpanel" data-detail-panel="geology">
            <article id="basinGeologyCard" class="content-card">
              <h3>地层与岩性摘要</h3>
              <div class="table-wrap" id="basinGeologyTable"></div>
            </article>
          </section>
        </section>
      </section>
    </section>

    <section class="data-module-panel" data-tab-panel="blocks">
      <section class="content-section">
        <div class="section-heading section-heading--inline">
          <div>
            <h3>区块信息</h3>
            <p>查看区块基础信息、历史、计划事件和公司权益。</p>
          </div>
          <label class="inline-select">选择区块<select id="blockSelect"></select></label>
        </div>
        <section class="detail-shell" data-detail-section="blocks">
          <article id="blockSummaryCard" class="content-card detail-summary">
            <div>
              <h3>区块摘要</h3>
              <div id="blockProfile" class="profile-grid"></div>
            </div>
            <div>
              <h3>资料覆盖摘要</h3>
              <div id="blockCoverageSummary" class="tiles-grid"></div>
            </div>
          </article>
          <div class="detail-tabbar" data-detail-tabs>
            <button type="button" class="detail-tabbar__item" data-detail-tab="location">位置概览</button>
            <button type="button" class="detail-tabbar__item" data-detail-tab="history">历史阶段</button>
            <button type="button" class="detail-tabbar__item" data-detail-tab="schedule">计划事件</button>
            <button type="button" class="detail-tabbar__item" data-detail-tab="ownership">公司权益</button>
          </div>
          <section class="detail-tabpanel" data-detail-panel="location">
            <article id="blockLocationCard" class="content-card">
              <h3>位置与轮廓摘要</h3>
              <div id="blockLocationTiles" class="tiles-grid"></div>
            </article>
          </section>
          <section class="detail-tabpanel" data-detail-panel="history">
            <article id="blockHistoryCard" class="content-card">
              <h3>历史阶段</h3>
              <div id="blockHistory" class="history-list"></div>
            </article>
          </section>
          <section class="detail-tabpanel" data-detail-panel="schedule">
            <article id="blockScheduleCard" class="content-card">
              <h3>计划事件</h3>
              <div id="blockSchedule" class="tiles-grid"></div>
            </article>
          </section>
          <section class="detail-tabpanel" data-detail-panel="ownership">
            <article id="blockOwnershipCard" class="content-card">
              <h3>公司权益</h3>
              <div class="table-wrap" id="companyTableWrap"></div>
            </article>
            <article id="blockOwnershipSummaryCard" class="content-card">
              <h3>权益结构摘要</h3>
              <div id="ownershipTiles" class="tiles-grid"></div>
            </article>
          </section>
        </section>
      </section>
    </section>

    <section class="data-module-panel" data-tab-panel="contracts">
      <section class="content-section">
        <div class="section-heading section-heading--inline">
          <div>
            <h3>合同信息</h3>
            <p>查看合同基础信息、历史、计划事件和权益关系。</p>
          </div>
          <label class="inline-select">选择合同<select id="contractSelect"></select></label>
        </div>
        <section class="detail-shell" data-detail-section="contracts">
          <article id="contractSummaryCard" class="content-card detail-summary">
            <div>
              <h3>合同摘要</h3>
              <div id="contractProfile" class="profile-grid"></div>
            </div>
            <div>
              <h3>位置与面积</h3>
              <div id="contractLocationTiles" class="tiles-grid"></div>
            </div>
          </article>
          <div class="detail-tabbar" data-detail-tabs>
            <button type="button" class="detail-tabbar__item" data-detail-tab="history">历史阶段</button>
            <button type="button" class="detail-tabbar__item" data-detail-tab="schedule">计划事件</button>
            <button type="button" class="detail-tabbar__item" data-detail-tab="ownership">权益与区块</button>
            <button type="button" class="detail-tabbar__item" data-detail-tab="commitment">承诺与覆盖</button>
          </div>
          <section class="detail-tabpanel" data-detail-panel="history">
            <article id="contractHistoryCard" class="content-card">
              <h3>历史阶段</h3>
              <div id="contractHistory" class="history-list"></div>
            </article>
          </section>
          <section class="detail-tabpanel" data-detail-panel="schedule">
            <article id="contractScheduleCard" class="content-card">
              <h3>计划事件</h3>
              <div id="contractSchedule" class="tiles-grid"></div>
            </article>
          </section>
          <section class="detail-tabpanel" data-detail-panel="ownership">
            <article id="contractOwnershipCard" class="content-card">
              <h3>公司权益</h3>
              <div class="table-wrap" id="contractCompanyTableWrap"></div>
            </article>
            <article id="contractRelatedBlocksCard" class="content-card">
              <h3>关联区块</h3>
              <div class="table-wrap" id="contractRelatedBlocksWrap"></div>
            </article>
          </section>
          <section class="detail-tabpanel" data-detail-panel="commitment">
            <article id="contractCommitmentCard" class="content-card">
              <h3>合同承诺</h3>
              <div class="table-wrap" id="contractCommitmentsWrap"></div>
            </article>
            <article id="contractCoverageCard" class="content-card">
              <h3>资料覆盖摘要</h3>
              <div id="contractSupplementTiles" class="tiles-grid"></div>
            </article>
          </section>
        </section>
      </section>
    </section>

    <section class="data-module-panel" data-tab-panel="fields">
      <section class="content-section">
        <div class="section-heading section-heading--inline">
          <div>
            <h3>油气田信息</h3>
            <p>查看油气田基础属性、资源规模、事件和权益关系。</p>
          </div>
          <label class="inline-select">选择油气田<select id="fieldSelect"></select></label>
        </div>
        <div class="content-grid content-grid--logs">
          <div class="column-stack">
            <article id="fieldSummaryCard" class="content-card">
              <h3>油气田基础信息</h3>
              <div id="fieldProfile" class="profile-grid"></div>
            </article>
            <article id="fieldReserveCard" class="content-card">
              <h3>资源与生产摘要</h3>
              <div id="fieldReserveTiles" class="tiles-grid"></div>
            </article>
            <article id="fieldEventsCard" class="content-card">
              <h3>事件记录</h3>
              <div id="fieldEvents" class="history-list"></div>
            </article>
          </div>
          <div class="column-stack">
            <article id="fieldOwnershipCard" class="content-card">
              <h3>公司权益</h3>
              <div class="table-wrap" id="fieldCompanyTableWrap"></div>
            </article>
            <article id="fieldSupplementCard" class="content-card">
              <h3>附加资料摘要</h3>
              <div id="fieldSupplementTiles" class="tiles-grid"></div>
            </article>
          </div>
        </div>
      </section>
    </section>

    <section class="data-module-panel" data-tab-panel="wells">
      <section class="content-section">
        <div class="section-heading section-heading--inline">
          <div>
            <h3>井资料</h3>
            <p>查看井档案、井史、专题资料和测井曲线。</p>
          </div>
          <label class="inline-select">选择井<select id="wellSelect"></select></label>
        </div>
        <div class="content-grid content-grid--logs">
          <div class="column-stack">
            <article id="wellSummaryCard" class="content-card">
              <h3>井档案摘要</h3>
              <div id="wellProfile" class="profile-grid"></div>
            </article>
            <article id="wellHistoryCard" class="content-card">
              <h3>井史事件</h3>
              <div id="wellHistory" class="history-list"></div>
            </article>
            <article id="wellDatasetsCard" class="content-card">
              <h3>井专题资料</h3>
              <div id="wellDatasets" class="tiles-grid"></div>
            </article>
          </div>
          <div class="column-stack">
            <article id="wellChartCard" class="content-card">
              <h3>测井曲线</h3>
              <canvas id="logChart" width="900" height="360"></canvas>
            </article>
            <article id="wellInsightsCard" class="content-card">
              <h3>曲线解释提示</h3>
              <div id="curveInsights" class="tiles-grid"></div>
            </article>
            <article id="wellTableCard" class="content-card">
              <h3>测井采样表</h3>
              <div class="table-wrap" id="logTableWrap"></div>
            </article>
          </div>
        </div>
      </section>
    </section>

    <section class="data-module-panel" data-tab-panel="catalog">
      <section class="content-section">
        <div class="section-heading">
          <div>
            <h3>对象目录</h3>
            <p>统一浏览盆地、区块、合同、油气田、井位和资料清单。</p>
          </div>
        </div>
        <div class="catalog-toolbar">
          <label><span>关键字</span><input id="catalogKeyword" type="text" placeholder="输入名称、国家、作业者或盆地"></label>
          <label><span>数据类型</span>
            <select id="catalogTypeFilter">
              <option value="">全部类型</option>
              <option value="basin">盆地</option>
              <option value="block">合同区块</option>
              <option value="contract">合同</option>
              <option value="field">油气田</option>
              <option value="well">井位</option>
            </select>
          </label>
          <label><span>国家/地区</span><select id="catalogCountryFilter"><option value="">全部国家/地区</option></select></label>
          <label><span>每页</span>
            <select id="catalogPageSize">
              <option value="20">20 条</option>
              <option value="50" selected>50 条</option>
              <option value="100">100 条</option>
            </select>
          </label>
        </div>
        <div class="catalog-summary-row">
          <span id="catalogCount">-</span>
          <div class="catalog-pager">
            <button id="catalogPrevPage" type="button" class="button-ghost">上一页</button>
            <strong id="catalogPageInfo">第 1 页</strong>
            <button id="catalogNextPage" type="button" class="button-ghost">下一页</button>
          </div>
        </div>
        <div class="table-wrap catalog-table-wrap">
          <table class="catalog-table">
            <thead>
              <tr>
                <th>类型</th>
                <th>名称</th>
                <th>国家/地区</th>
                <th>关联对象</th>
                <th>关键属性</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="catalogTableBody"></tbody>
          </table>
        </div>
      </section>
      <section class="content-section content-grid">
        <article class="content-card">
          <h3>系统数据能力</h3>
          <div id="catalogModuleGrid" class="module-grid"></div>
        </article>
        <article class="content-card">
          <h3>资料覆盖</h3>
          <div class="tiles-grid" id="coverageTiles"></div>
        </article>
      </section>
    </section>
  `;

  let mapRef = null;
  let africaIndexPromise = null;

  function showRegionalLoading() {
    const summary = root.querySelector("#regionalStorySummary");
    if (summary) {
      summary.innerHTML = renderEmptyCard("正在读取非洲闭环数据", "非洲综合索引包含较多井、油气田和 PDF 资料，首次打开需要稍等。");
    }
  }

  async function ensureRegionalStoryLoaded() {
    if (!africaIndexPromise) {
      showRegionalLoading();
      africaIndexPromise = loadAfricaIndex();
    }
    try {
      const africaIndex = await africaIndexPromise;
      renderRegionalStory(root, state.regionalStories, africaIndex);
    } catch (error) {
      renderRegionalStory(root, state.regionalStories, {});
    }
  }

  const tabController = setupTabs(root, tabKey => {
    if (tabKey === "spatial" && mapRef) {
      setTimeout(() => mapRef.invalidateSize(), 50);
    }
    if (tabKey === "regional") {
      ensureRegionalStoryLoaded();
    }
  });
  const detailController = setupDetailTabs(root);
  bindActionCards(root, tabController, detailController);

  renderRegionalStory(root, state.regionalStories, {});
  renderFilterOptions(root, state);

  if (window.L) {
    const blockProfilesLocal = state.blockData?.profiles || {};
    const filters = { keyword: "", country: "", basin: "", block: "", operator: "" };
    const LMap = window.L;
    const OVERVIEW_MAX_ZOOM = 4;
    const LOCATE_MAX_ZOOM = 7;
    const vectorRenderer = LMap.canvas({ padding: 0.5 });
    const map = LMap.map("map", {
      zoomControl: true,
      attributionControl: true,
      renderer: vectorRenderer
    }).setView([5, 20], 3);
    mapRef = map;
    window.addEventListener("module-shown", event => {
      if (event.detail?.key === "data" && mapRef) {
        setTimeout(() => mapRef.invalidateSize(), 80);
      }
    });
    map.attributionControl.addAttribution("Leaflet + 天地图；业务图层来自 MapGIS IGServer FeatureServer");

    const onlineBasemapLayers = Object.fromEntries(
      getOnlineBasemapOptions().map(option => [option.key, createOnlineBasemapLayers(LMap, option.key)])
    );
    let onlineBasemap = onlineBasemapLayers[DEFAULT_ONLINE_BASEMAP_KEY];
    let baseMapLayer = onlineBasemap.baseLayer;
    let baseLabelLayer = onlineBasemap.labelLayer;
    let tiandituTileLoaded = false;
    const updateMapRuntime = message => {
      const runtimeNode = root.querySelector("#mapRuntime");
      if (runtimeNode) runtimeNode.textContent = message;
    };
    const bindBasemapDiagnostics = () => {
      baseMapLayer.on("tileload", () => {
        if (!tiandituTileLoaded) {
          tiandituTileLoaded = true;
          updateMapRuntime(`地图组件已加载；${onlineBasemap.name}底图已显示`);
        }
      });
      baseMapLayer.on("tileerror", () => {
        if (!tiandituTileLoaded) updateMapRuntime("天地图底图请求失败：请检查 key、应用类型、白名单或网络");
      });
      baseLabelLayer.on("tileerror", () => {
        if (!tiandituTileLoaded) updateMapRuntime("天地图注记请求失败：请检查 key、应用类型、白名单或网络");
      });
    };
    bindBasemapDiagnostics();
    baseMapLayer.addTo(map);
    baseLabelLayer.addTo(map);
    updateMapRuntime(`地图组件已加载；${onlineBasemap.name}已启用`);

    const getWellLatLng = feature => {
      if (feature?.geometry?.type !== "Point" || !Array.isArray(feature.geometry.coordinates)) return null;
      const [lng, lat] = feature.geometry.coordinates;
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
      return LMap.latLng(Number(lat), Number(lng));
    };

    const selectWellFeature = feature => {
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

    const createLargeWellCanvasLayer = features => {
      const pointItems = features
        .map(feature => ({ feature, latlng: getWellLatLng(feature) }))
        .filter(item => item.latlng);
      if (!pointItems.length) return LMap.layerGroup();
      const pointBounds = LMap.latLngBounds(pointItems.map(item => item.latlng));

      return new (LMap.Layer.extend({
        onAdd(layerMap) {
          this._map = layerMap;
          this._canvas = LMap.DomUtil.create("canvas", "leaflet-zoom-animated");
          this._canvas.style.pointerEvents = "none";
          this._ctx = this._canvas.getContext("2d");
          layerMap.getPanes().overlayPane.appendChild(this._canvas);
          layerMap.on("moveend zoomend resize viewreset", this._reset, this);
          layerMap.on("click", this._handleClick, this);
          this._reset();
        },
        onRemove(layerMap) {
          layerMap.off("moveend zoomend resize viewreset", this._reset, this);
          layerMap.off("click", this._handleClick, this);
          LMap.DomUtil.remove(this._canvas);
          this._canvas = null;
          this._ctx = null;
          this._map = null;
        },
        getBounds() {
          return pointBounds;
        },
        _reset() {
          if (!this._map || !this._canvas) return;
          const size = this._map.getSize();
          const topLeft = this._map.containerPointToLayerPoint([0, 0]);
          LMap.DomUtil.setPosition(this._canvas, topLeft);
          this._canvas.width = size.x;
          this._canvas.height = size.y;
          this._draw();
        },
        _draw() {
          if (!this._map || !this._ctx) return;
          const ctx = this._ctx;
          const size = this._map.getSize();
          ctx.clearRect(0, 0, size.x, size.y);
          ctx.fillStyle = "#0f9f7a";
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 0.75;
          pointItems.forEach(item => {
            const point = this._map.latLngToContainerPoint(item.latlng);
            if (point.x < -8 || point.y < -8 || point.x > size.x + 8 || point.y > size.y + 8) return;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
        },
        _handleClick(event) {
          if (!this._map) return;
          let best = null;
          let bestDistance = 36;
          pointItems.forEach(item => {
            const point = this._map.latLngToContainerPoint(item.latlng);
            const dx = point.x - event.containerPoint.x;
            const dy = point.y - event.containerPoint.y;
            const distance = dx * dx + dy * dy;
            if (distance < bestDistance) {
              bestDistance = distance;
              best = item.feature;
            }
          });
          if (best) selectWellFeature(best);
        }
      }))();
    };

    const createBasinLayer = geoJson => LMap.geoJSON(geoJson, {
      renderer: vectorRenderer,
      style: { color: "#1456b8", weight: 3.2, opacity: 0.95, fillColor: "#5f9fe8", fillOpacity: 0.16 },
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
      const profile = blockProfilesLocal[feature.properties?.block_name] || {};
      const tables = blockTables[feature.properties?.block_name] || {};
      renderSelectedFeature(root, "合同区块", feature.properties?.block_name || "未命名区块", [
        { label: "合同", value: profile.contract_name || feature.properties?.contract },
        { label: "国家", value: profile.country_name || feature.properties?.country },
        { label: "盆地", value: profile.basin_names || feature.properties?.bas_names },
        { label: "作业者", value: profile.operator_name || feature.properties?.operator },
        { label: "合同状态", value: profile.contract_status || feature.properties?.con_status },
        { label: "区块状态", value: profile.block_status || feature.properties?.blk_status },
        { label: "面积", value: feature.properties?.blk_sqkm ? `${formatNumber(feature.properties.blk_sqkm, 1)} km²` : "-" },
        { label: "平均水深", value: profile.median_water_depth_meter ? `${formatNumber(profile.median_water_depth_meter, 1)} m` : (feature.properties?.med_wd_mt ? `${formatNumber(feature.properties.med_wd_mt, 1)} m` : "-") }
      ]);
    };

    const createBlockLayer = geoJson => {
      const features = geoJson.features || [];
      const interactive = features.length <= 800;
      const layer = LMap.geoJSON(geoJson, {
        renderer: vectorRenderer,
        style: { color: "#d08300", weight: 1.6, opacity: 0.86, fillColor: "#f6c45c", fillOpacity: 0.12 },
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

    const createWellLayer = geoJson => {
      const features = geoJson.features || [];
      if (features.length > 800) {
        if (!persistentWellCanvas) {
          persistentWellCanvas = createCanvasPointLayer(LMap, {
            radius: 2.7,
            fillColor: "#0f9f7a",
            strokeColor: "#ffffff",
            strokeWidth: 0.75
          });
          persistentWellCanvas.setPickHandler(selectWellFeature);
        }
        persistentWellCanvas.setItems(features
          .map(feature => {
            const latlng = getWellLatLng(feature);
            return latlng ? { feature, latlng } : null;
          })
          .filter(Boolean));
        return persistentWellCanvas;
      }
      if (persistentWellCanvas) {
        persistentWellCanvas.remove();
        persistentWellCanvas = null;
      }

      return LMap.geoJSON(geoJson, {
        renderer: vectorRenderer,
        pointToLayer: (_, latlng) => LMap.circleMarker(latlng, {
          renderer: vectorRenderer,
          radius: 2.7,
          color: "#ffffff",
          weight: 0.75,
          fillColor: "#0f9f7a",
          fillOpacity: 0.78
        }),
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(feature.properties?.well_name || "未命名井", { sticky: true, className: "feature-label feature-label--well" });
          layer.on("click", () => selectWellFeature(feature));
        }
      });
    };

    const renderFieldSelection = feature => {
      const profile = fieldProfiles?.[feature.properties?.field_name] || {};
      renderSelectedFeature(root, "油气田", feature.properties?.field_name || "未命名油气田", [
        { label: "国家", value: profile.country_names || feature.properties?.countries },
        { label: "盆地", value: profile.basin_name || feature.properties?.basin_name },
        { label: "作业者", value: profile.current_operators || feature.properties?.opr_curr },
        { label: "开发状态", value: profile.prod_status || feature.properties?.prod_stat },
        { label: "油气类型", value: profile.hc_type || feature.properties?.hc_type },
        { label: "资源类型", value: profile.resource_type || feature.properties?.resourc12 },
        { label: "总可采当量", value: profile.total_recoverable_mmboe != null ? `${formatNumber(profile.total_recoverable_mmboe, 2)} MMboe` : "-" }
      ]);
    };

    const createFieldLayer = geoJson => {
      const features = geoJson.features || [];
      const interactive = features.length <= 800;
      const layer = LMap.geoJSON(geoJson, {
        renderer: vectorRenderer,
        style: () => ({
          color: "#7b5bd6",
          weight: 1.2,
          opacity: 0.78,
          fillColor: "#8f7cf6",
          fillOpacity: 0.1
        }),
        pointToLayer: (_, latlng) => LMap.circleMarker(latlng, {
          renderer: vectorRenderer,
          radius: 3.4,
          color: "#ffffff",
          weight: 0.8,
          fillColor: "#7b5bd6",
          fillOpacity: 0.78
        }),
        onEachFeature: interactive ? (feature, pathLayer) => {
          pathLayer.bindTooltip(feature.properties?.field_name || "未命名油气田", { sticky: true, className: "feature-label feature-label--field" });
          pathLayer.on("click", () => renderFieldSelection(feature));
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
          if (best) renderFieldSelection(best);
        });
      }
      return layer;
    };

    let basinLayer = null;
    let blockLayer = null;
    let fieldLayer = null;
    let wellLayer = null;
    let persistentWellCanvas = null;
    let mapLayersLoading = false;
    let mapLayersLoaded = state.layerSource !== "not-loaded";
    let lastIncrementalRefreshAt = 0;
    let lastFilterOptionsRefreshAt = 0;
    let dataMapFitted = false;
    let prevWellsFeatures = [];

    async function ensureMapLayersLoaded() {
      if (mapLayersLoaded || mapLayersLoading) return;
      mapLayersLoading = true;
      updateMapRuntime("正在从 MapGIS IGServer 读取空间图层...");
      try {
        await loadMapLayersForState(state, {
          onRefreshed: () => {
            if (window.requestIdleCallback) {
              window.requestIdleCallback(refreshDisplayFromState, { timeout: 3000 });
            } else {
              setTimeout(refreshDisplayFromState, 500);
            }
          },
          onBatchLoaded: handleLayerBatch
        });
        finalizeLayerLoad();
      } catch (error) {
        state.layerSource = "service-error";
        state.layerError = error.message;
        updateMapRuntime(`MapGIS 图层读取失败：${error.message}`);
      } finally {
        mapLayersLoading = false;
      }
    }

    function handleLayerBatch(featureType, collection, detail) {
      const features = collection?.features || [];
      if (featureType === "wells") {
        const noFilter = !(filters.keyword || filters.country || filters.basin || filters.block || filters.operator);
        const prefixOk = !prevWellsFeatures.length || features[prevWellsFeatures.length - 1] === prevWellsFeatures[prevWellsFeatures.length - 1];
        state.wellsGeoJson = { type: "FeatureCollection", features };
        if (state._forceRefreshing) {
          // 强制刷新期间保持当前显示不变，拉取完成后一次性切换
          throttleStatsRefresh();
        } else if (!persistentWellCanvas && features.length > 800) {
          persistentWellCanvas = createCanvasPointLayer(LMap, {
            radius: 2.7,
            fillColor: "#0f9f7a",
            strokeColor: "#ffffff",
            strokeWidth: 0.75
          });
          persistentWellCanvas.setPickHandler(selectWellFeature);
          wellLayer = persistentWellCanvas;
          if (root.querySelector("#toggleWells").checked) persistentWellCanvas.addTo(map);
        }
        if (persistentWellCanvas && !state._forceRefreshing) {
          if (noFilter && prefixOk && features.length > prevWellsFeatures.length) {
            persistentWellCanvas.appendItems(features
              .slice(prevWellsFeatures.length)
              .map(feature => {
                const latlng = getWellLatLng(feature);
                return latlng ? { feature, latlng } : null;
              })
              .filter(Boolean));
          } else {
            persistentWellCanvas.setItems(filterWells(features, filters, state.wellProfiles)
              .map(feature => {
                const latlng = getWellLatLng(feature);
                return latlng ? { feature, latlng } : null;
              })
              .filter(Boolean));
          }
          throttleStatsRefresh();
        } else if (!persistentWellCanvas && detail?.done && !state._forceRefreshing) {
          refreshMap(false);
        }
        prevWellsFeatures = features;
      } else if (featureType === "basins") {
        state.structuresGeoJson = { type: "FeatureCollection", features };
        if (detail?.done) updateLayerOnly("basins");
      } else if (featureType === "contract_blocks") {
        state.blocksGeoJson = { type: "FeatureCollection", features };
        if (detail?.done) updateLayerOnly("contract_blocks");
      } else if (featureType === "fields") {
        state.fieldsGeoJson = { type: "FeatureCollection", features };
        if (detail?.done) updateLayerOnly("fields");
      }
      const loadedCount = features.length;
      const totalCount = detail?.totalCount || 0;
      const label = detail?.sourceLabel || featureType;
      updateMapRuntime(detail?.cached
        ? `已从本地缓存恢复：${label} ${loadedCount.toLocaleString("zh-CN")}…`
        : `正在后台读取空间图层：${label} ${loadedCount.toLocaleString("zh-CN")}${totalCount ? ` / ${totalCount.toLocaleString("zh-CN")}` : ""}…`);
      const now = Date.now();
      if (now - lastFilterOptionsRefreshAt > 15000) {
        lastFilterOptionsRefreshAt = now;
        renderFilterOptions(root, state);
      }
    }

    function finalizeLayerLoad() {
      mapLayersLoaded = true;
      renderFilterOptions(root, state);
      refreshCountsLight();
      if (!dataMapFitted) {
        dataMapFitted = true;
        fitMapToVisible();
      }
      if (state.layerSource === "service-error") {
        updateMapRuntime(`MapGIS 图层读取失败：${state.layerError || "服务未返回数据"}`);
      } else {
        const slowest = [...(state.layerDiagnostics || [])].sort((a, b) => b.durationMs - a.durationMs)[0];
        updateMapRuntime(slowest ? `MapGIS 空间图层已加载；最慢图层：${slowest.label} ${formatLayerRuntime(slowest)}` : "MapGIS 空间图层已加载");
      }
      const finishLoad = async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        addSpatialFeatureProfiles(state);
        await new Promise(resolve => setTimeout(resolve, 0));
        rebuildWellIndexes();
        await new Promise(resolve => setTimeout(resolve, 0));
        refreshStatsLight();
        await new Promise(resolve => setTimeout(resolve, 3000));
        refreshAfterMapLayersLoaded();
      };
      if (window.requestIdleCallback) {
        window.requestIdleCallback(finishLoad, { timeout: 5000 });
      } else {
        setTimeout(finishLoad, 500);
      }
    }

    async function handleManualRefresh() {
      if (mapLayersLoading || state._forceRefreshing || state._layerRefreshPromise) {
        updateMapRuntime("数据正在刷新中，请稍候…");
        return;
      }
      state._forceRefreshing = true;
      mapLayersLoading = true;
      updateMapRuntime("正在从 MapGIS IGServer 重新读取全部图层数据…（完成后自动更新显示）");
      try {
        await forceRefreshMapLayers(state, { onBatchLoaded: handleLayerBatch });
        state._forceRefreshing = false;
        refreshDisplayFromState();
        finalizeLayerLoad();
        updateMapRuntime(`图层数据已更新为最新（${new Date().toLocaleTimeString("zh-CN")}）`);
      } catch (error) {
        state._forceRefreshing = false;
        updateMapRuntime(`图层刷新失败：${error.message}`);
      } finally {
        mapLayersLoading = false;
      }
    }

    async function handleVisibleReload() {
      if (mapLayersLoading || state._forceRefreshing || state._layerRefreshPromise) {
        updateMapRuntime("加载正在进行中，请稍候…");
        return;
      }
      mapLayersLoading = true;
      updateMapRuntime("正在重新加载全部图层数据（逐步显示）…");
      // 清空当前显示，进入逐批加载
      prevWellsFeatures = [];
      if (persistentWellCanvas) persistentWellCanvas.setItems([]);
      if (wellLayer && wellLayer !== persistentWellCanvas) wellLayer.remove();
      if (basinLayer) { basinLayer.remove(); basinLayer = null; }
      if (blockLayer) { blockLayer.remove(); blockLayer = null; }
      if (fieldLayer) { fieldLayer.remove(); fieldLayer = null; }
      state.wellsGeoJson = { type: "FeatureCollection", features: [] };
      state.structuresGeoJson = { type: "FeatureCollection", features: [] };
      state.blocksGeoJson = { type: "FeatureCollection", features: [] };
      state.fieldsGeoJson = { type: "FeatureCollection", features: [] };
      refreshCountsLight();
      try {
        await forceRefreshMapLayers(state, { onBatchLoaded: handleLayerBatch });
        finalizeLayerLoad();
        updateMapRuntime(`图层数据已重新加载完成（${new Date().toLocaleTimeString("zh-CN")}）`);
      } catch (error) {
        updateMapRuntime(`图层重新加载失败：${error.message}`);
      } finally {
        mapLayersLoading = false;
      }
    }

    function throttleIncrementalRefresh() {
      const now = Date.now();
      if (now - lastIncrementalRefreshAt < 800) return;
      lastIncrementalRefreshAt = now;
      refreshMap(false);
    }

    let lastStatsRefreshAt = 0;
    function throttleStatsRefresh() {
      const now = Date.now();
      if (now - lastStatsRefreshAt < 1500) return;
      lastStatsRefreshAt = now;
      refreshCountsLight();
    }

    function refreshCountsLight() {
      const noFilter = !(filters.keyword || filters.country || filters.basin || filters.block || filters.operator);
      const filterContext = {
        blocks: state.blocksGeoJson.features || [],
        wells: state.wellsGeoJson.features || []
      };
      const wellsLen = noFilter
        ? (state.wellsGeoJson.features?.length || 0)
        : filterWells(state.wellsGeoJson.features || [], filters, state.wellProfiles).length;
      const basinsLen = noFilter
        ? (state.structuresGeoJson.features?.length || 0)
        : filterBasins(state.structuresGeoJson.features || [], filters, filterContext).length;
      const blocksLen = noFilter
        ? (state.blocksGeoJson.features?.length || 0)
        : filterBlocks(state.blocksGeoJson.features || [], filters).length;
      const fieldsLen = noFilter
        ? (state.fieldsGeoJson.features?.length || 0)
        : filterFields(state.fieldsGeoJson.features || [], filters, fieldProfiles, filterContext).length;
      root.querySelector("#visibleWellCount").textContent = `${wellsLen} 个`;
      root.querySelector("#visibleBasinCount").textContent = `${basinsLen} 个`;
      root.querySelector("#visibleBlockCount").textContent = `${blocksLen} 个`;
      root.querySelector("#visibleFieldCount").textContent = `${fieldsLen} 个`;
      root.querySelector("#wellFeatureCount").textContent = `本次读取 ${state.wellsGeoJson.features?.length || 0} 个`;
      root.querySelector("#basinFeatureCount").textContent = `本次读取 ${state.structuresGeoJson.features?.length || 0} 个`;
      root.querySelector("#blockFeatureCount").textContent = `本次读取 ${state.blocksGeoJson.features?.length || 0} 个`;
      root.querySelector("#fieldFeatureCount").textContent = `本次读取 ${state.fieldsGeoJson.features?.length || 0} 个`;
      root.querySelector("#activeFilterSummary").textContent = buildFilterSummary(filters);
    }

    function updateLayerOnly(featureType) {
      const filterContext = {
        blocks: state.blocksGeoJson.features || [],
        wells: state.wellsGeoJson.features || []
      };
      if (featureType === "basins") {
        if (basinLayer) basinLayer.remove();
        basinLayer = createBasinLayer({
          type: "FeatureCollection",
          features: filterBasins(state.structuresGeoJson.features || [], filters, filterContext)
        });
        if (root.querySelector("#toggleBasins").checked) basinLayer.addTo(map);
      } else if (featureType === "contract_blocks") {
        if (blockLayer) blockLayer.remove();
        blockLayer = createBlockLayer({
          type: "FeatureCollection",
          features: filterBlocks(state.blocksGeoJson.features || [], filters)
        });
        if (root.querySelector("#toggleBlocks").checked) blockLayer.addTo(map);
      } else if (featureType === "fields") {
        if (fieldLayer) fieldLayer.remove();
        fieldLayer = createFieldLayer({
          type: "FeatureCollection",
          features: filterFields(state.fieldsGeoJson.features || [], filters, fieldProfiles, filterContext)
        });
        if (root.querySelector("#toggleFields").checked) fieldLayer.addTo(map);
      }
      refreshCountsLight();
    }

    function refreshDisplayFromState() {
      if (!map) return;
      const filterContext = {
        blocks: state.blocksGeoJson.features || [],
        wells: state.wellsGeoJson.features || []
      };
      const noFilter = !(filters.keyword || filters.country || filters.basin || filters.block || filters.operator);
      const wells = state.wellsGeoJson.features || [];
      if (persistentWellCanvas) {
        const visibleWells = noFilter ? wells : filterWells(wells, filters, state.wellProfiles);
        persistentWellCanvas.setItems(visibleWells
          .map(feature => {
            const latlng = getWellLatLng(feature);
            return latlng ? { feature, latlng } : null;
          })
          .filter(Boolean));
      } else if (wellLayer) {
        refreshMap(false);
      }
      updateLayerOnly("basins");
      updateLayerOnly("contract_blocks");
      updateLayerOnly("fields");
      prevWellsFeatures = wells;
      refreshCountsLight();
    }

    function refreshStatsLight() {
      const visibleBasins = filterBasins(state.structuresGeoJson.features || [], filters, {
        blocks: state.blocksGeoJson.features || [],
        wells: state.wellsGeoJson.features || []
      });
      const visibleBlocks = filterBlocks(state.blocksGeoJson.features || [], filters);
      const visibleFields = filterFields(state.fieldsGeoJson.features || [], filters, fieldProfiles, {
        blocks: state.blocksGeoJson.features || [],
        wells: state.wellsGeoJson.features || []
      });
      const visibleWells = filterWells(state.wellsGeoJson.features || [], filters, state.wellProfiles);
      renderServiceInsights(root, visibleBasins, visibleWells, visibleBlocks, visibleFields, state.layerSource, state.layerDiagnostics);
      root.querySelector("#activeFilterSummary").textContent = buildFilterSummary(filters);
    }

    function fitMapToVisible() {
      if (!map) return;
      const noFilter = !(filters.keyword || filters.country || filters.basin || filters.block || filters.operator);
      if (noFilter) {
        const fitTargets = [];
        if ((state.wellsGeoJson.features?.length || 0) > 0) fitTargets.push(wellLayer);
        else if ((state.blocksGeoJson.features?.length || 0) > 0) fitTargets.push(blockLayer);
        else if ((state.fieldsGeoJson.features?.length || 0) > 0) fitTargets.push(fieldLayer);
        else if ((state.structuresGeoJson.features?.length || 0) > 0) fitTargets.push(basinLayer);
        if (!fitTargets.length) return;
        const bounds = LMap.featureGroup(fitTargets).getBounds();
        if (bounds.isValid()) map.fitBounds(bounds.pad(0.18), { maxZoom: OVERVIEW_MAX_ZOOM });
        return;
      }
      const visibleBasins = filterBasins(state.structuresGeoJson.features || [], filters, {
        blocks: state.blocksGeoJson.features || [],
        wells: state.wellsGeoJson.features || []
      });
      const visibleBlocks = filterBlocks(state.blocksGeoJson.features || [], filters);
      const visibleFields = filterFields(state.fieldsGeoJson.features || [], filters, fieldProfiles, {
        blocks: state.blocksGeoJson.features || [],
        wells: state.wellsGeoJson.features || []
      });
      const visibleWells = filterWells(state.wellsGeoJson.features || [], filters, state.wellProfiles);
      const fitTargets = [];
      if (visibleWells.length > 0) fitTargets.push(wellLayer);
      else if (visibleBlocks.length > 0) fitTargets.push(blockLayer);
      else if (visibleFields.length > 0) fitTargets.push(fieldLayer);
      else if (visibleBasins.length > 0) fitTargets.push(basinLayer);
      if (!fitTargets.length) return;
      const bounds = LMap.featureGroup(fitTargets).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.18), { maxZoom: OVERVIEW_MAX_ZOOM });
    }

    function refreshMap(refit = false) {
      if (basinLayer) basinLayer.remove();
      if (blockLayer) blockLayer.remove();
      if (fieldLayer) fieldLayer.remove();
      if (wellLayer) wellLayer.remove();

      const visibleBasins = filterBasins(state.structuresGeoJson.features || [], filters, {
        blocks: state.blocksGeoJson.features || [],
        wells: state.wellsGeoJson.features || []
      });
      const visibleBlocks = filterBlocks(state.blocksGeoJson.features || [], filters);
      const visibleFields = filterFields(state.fieldsGeoJson.features || [], filters, fieldProfiles, {
        blocks: state.blocksGeoJson.features || [],
        wells: state.wellsGeoJson.features || []
      });
      const visibleWells = filterWells(state.wellsGeoJson.features || [], filters, state.wellProfiles);

      basinLayer = createBasinLayer({ type: "FeatureCollection", features: visibleBasins });
      blockLayer = createBlockLayer({ type: "FeatureCollection", features: visibleBlocks });
      fieldLayer = createFieldLayer({ type: "FeatureCollection", features: visibleFields });
      wellLayer = createWellLayer({ type: "FeatureCollection", features: visibleWells });

      const activeLayers = [];
      if (root.querySelector("#toggleBasins").checked) {
        basinLayer.addTo(map);
        activeLayers.push(basinLayer);
      }
      if (root.querySelector("#toggleBlocks").checked) {
        blockLayer.addTo(map);
        activeLayers.push(blockLayer);
      }
      if (root.querySelector("#toggleFields").checked) {
        fieldLayer.addTo(map);
        activeLayers.push(fieldLayer);
      }
      if (root.querySelector("#toggleWells").checked) {
        wellLayer.addTo(map);
        activeLayers.push(wellLayer);
      }

      renderServiceInsights(root, visibleBasins, visibleWells, visibleBlocks, visibleFields, state.layerSource, state.layerDiagnostics);
      if (state.layerSource === "not-loaded") {
        updateMapRuntime("地图组件已加载；正在等待 MapGIS 空间图层读取");
      }
      root.querySelector("#activeFilterSummary").textContent = buildFilterSummary(filters);

      const quickLimitPerType = 80;
      const quickItems = [
        ...visibleBlocks.slice(0, quickLimitPerType).map(feature => ({ type: "block", title: feature.properties?.block_name, meta: `${safeText(feature.properties?.country)} / ${safeText(feature.properties?.contract)}`, feature })),
        ...visibleFields.slice(0, quickLimitPerType).map(feature => ({ type: "field", title: feature.properties?.field_name, meta: `${safeText(fieldProfiles[feature.properties?.field_name]?.basin_name || feature.properties?.basin_name)} / ${safeText(fieldProfiles[feature.properties?.field_name]?.prod_status || feature.properties?.prod_stat)}`, feature })),
        ...visibleWells.slice(0, quickLimitPerType).map(feature => {
          const profile = state.wellProfiles?.[feature.properties?.well_name] || {};
          return { type: "well", title: feature.properties?.well_name, meta: `${safeText(profile.basin_name || feature.properties?.basin_name)} / ${safeText(profile.operator_name || feature.properties?.operator)}`, feature };
        })
      ];

      renderQuickLocate(root, quickItems, item => {
        if (!item?.feature) return;
        if (item.type === "block") {
          const bounds = getFeatureLocateBounds(LMap, item.feature);
          if (bounds?.isValid()) map.fitBounds(bounds.pad(0.18), { maxZoom: LOCATE_MAX_ZOOM });
        } else if (item.type === "field") {
          const bounds = getFeatureLocateBounds(LMap, item.feature);
          if (bounds?.isValid()) map.fitBounds(bounds.pad(0.24), { maxZoom: LOCATE_MAX_ZOOM });
        } else if (item.feature.geometry?.coordinates) {
          const [lng, lat] = item.feature.geometry.coordinates;
          map.setView([lat, lng], LOCATE_MAX_ZOOM);
        }
      });

      if (refit && activeLayers.length) {
        const fitTargets = [];
        if (visibleWells.length > 0) fitTargets.push(wellLayer);
        else if (visibleBlocks.length > 0) fitTargets.push(blockLayer);
        else if (visibleFields.length > 0) fitTargets.push(fieldLayer);
        else if (visibleBasins.length > 0) fitTargets.push(basinLayer);
        const fitTarget = LMap.featureGroup(fitTargets.length ? fitTargets : activeLayers);
        const bounds = fitTarget.getBounds();
        if (bounds.isValid()) map.fitBounds(bounds.pad(0.18), { maxZoom: OVERVIEW_MAX_ZOOM });
      }
    }

    refreshMap(true);
    ensureMapLayersLoaded();

    root.querySelector("#applyFilters").addEventListener("click", () => {
      filters.keyword = root.querySelector("#searchKeyword").value.trim();
      filters.country = root.querySelector("#countryFilter").value;
      filters.basin = root.querySelector("#basinFilter").value;
      filters.block = root.querySelector("#contractBlockFilter").value;
      filters.operator = root.querySelector("#operatorFilter").value;
      refreshMap(true);
    });

    root.querySelector("#resetFilters").addEventListener("click", () => {
      Object.assign(filters, { keyword: "", country: "", basin: "", block: "", operator: "" });
      root.querySelector("#searchKeyword").value = "";
      root.querySelector("#countryFilter").value = "";
      root.querySelector("#basinFilter").value = "";
      root.querySelector("#contractBlockFilter").value = "";
      root.querySelector("#operatorFilter").value = "";
      refreshMap(true);
    });

    root.querySelector("#toggleBaseMap").addEventListener("change", event => {
      if (event.target.checked) {
        baseMapLayer.addTo(map);
        baseLabelLayer.addTo(map);
      } else {
        baseMapLayer.removeFrom(map);
        baseLabelLayer.removeFrom(map);
      }
    });
    root.querySelector("#onlineBasemapSelect").addEventListener("change", event => {
      const shouldShowBasemap = root.querySelector("#toggleBaseMap").checked;
      baseMapLayer.removeFrom(map);
      baseLabelLayer.removeFrom(map);
      tiandituTileLoaded = false;
      onlineBasemap = onlineBasemapLayers[event.target.value] || onlineBasemapLayers[DEFAULT_ONLINE_BASEMAP_KEY];
      baseMapLayer = onlineBasemap.baseLayer;
      baseLabelLayer = onlineBasemap.labelLayer;
      bindBasemapDiagnostics();
      if (shouldShowBasemap) {
        baseMapLayer.addTo(map);
        baseLabelLayer.addTo(map);
      }
      updateMapRuntime(`地图组件已加载；已切换到${onlineBasemap.name}`);
    });
    root.querySelector("#toggleBasins").addEventListener("change", () => refreshMap(false));
    root.querySelector("#toggleBlocks").addEventListener("change", () => refreshMap(false));
    root.querySelector("#toggleFields").addEventListener("change", () => refreshMap(false));
    root.querySelector("#toggleWells").addEventListener("change", () => refreshMap(false));
    const refreshMapDataButton = root.querySelector("#refreshMapData");
    if (refreshMapDataButton) {
      refreshMapDataButton.addEventListener("click", () => handleManualRefresh());
    }
    const reloadMapDataButton = root.querySelector("#reloadMapData");
    if (reloadMapDataButton) {
      reloadMapDataButton.addEventListener("click", () => handleVisibleReload());
    }
  } else {
    root.querySelector("#mapRuntime").textContent = "未加载地图组件";
  }

  let basinNames = unique([
    ...Object.keys(basinProfiles),
    ...state.structuresGeoJson.features.map(feature => feature.properties?.basin_name).filter(Boolean)
  ]).sort();
  const basinSelect = root.querySelector("#basinSelect");
  basinSelect.innerHTML = basinNames.map(name => `<option value="${name}">${name}</option>`).join("");

  const basinProfileContainer = root.querySelector("#basinProfile");
  const basinSystemsContainer = root.querySelector("#basinSystems");
  const basinReserveTiles = root.querySelector("#basinReserveTiles");
  const basinGeologyTable = root.querySelector("#basinGeologyTable");

  function updateBasin(name) {
    const profile = basinProfiles[name] || {};
    const feature = state.structuresGeoJson.features.find(item => item.properties?.basin_name === name) || {};
    const tables = basinTables[name] || {};
    renderBasinProfile(basinProfileContainer, profile, feature, tables);
    renderBasinPetroleumSystems(basinSystemsContainer, tables.petroleum_systems || []);
    renderBasinReserveTiles(basinReserveTiles, tables);
    renderBasinGeology(basinGeologyTable, tables.lithostrat_summary || []);
  }

  if (basinNames[0]) {
    basinSelect.value = basinNames[0];
    updateBasin(basinNames[0]);
  }
  basinSelect.addEventListener("change", event => updateBasin(event.target.value));

  let blockOptions = unique([
    ...Object.keys(blockProfiles),
    ...state.blocksGeoJson.features.map(feature => feature.properties?.block_name).filter(Boolean)
  ]).sort();
  const blockSelect = root.querySelector("#blockSelect");
  blockSelect.innerHTML = blockOptions.map(name => `<option value="${name}">${name}</option>`).join("");

  function renderBlockCoverageSummary(container, profile = {}, tables = {}) {
    const companyCount = tables.company_interests?.length || 0;
    const historyCount = tables.history?.length || 0;
    const scheduleCount = tables.scheduled_events?.length || 0;
    const locationCount = tables.locations?.length || 0;
    const outlinePoints = tables.outline_summary?.point_count || 0;
    const cards = [
      ["资源类型", profile.resource_type || "-"],
      ["非常规类型", profile.unconventional_type || "-"],
      ["历史阶段记录", `${historyCount} 条`],
      ["计划事件记录", `${scheduleCount} 条`],
      ["公司权益记录", `${companyCount} 条`],
      ["位置记录", `${locationCount} 条`],
      ["轮廓点数", `${outlinePoints} 个`],
      ["当前作业者", profile.operator_name || "-"]
    ];
    container.innerHTML = cards.map(([title, desc]) => `
      <article class="info-tile">
        <h4>${title}</h4>
        <p>${safeText(desc)}</p>
      </article>
    `).join("");
  }

  const blockCoverageSummary = root.querySelector("#blockCoverageSummary");
  const blockProfileContainer = root.querySelector("#blockProfile");
  const blockLocationTiles = root.querySelector("#blockLocationTiles");
  const blockHistoryContainer = root.querySelector("#blockHistory");
  const blockScheduleContainer = root.querySelector("#blockSchedule");
  const companyTableWrap = root.querySelector("#companyTableWrap");
  const ownershipTiles = root.querySelector("#ownershipTiles");

  function updateBlock(name) {
    const profile = blockProfiles[name] || {};
    const tables = blockTables[name] || {};
    renderBlockCoverageSummary(blockCoverageSummary, profile, tables);
    renderBlockProfile(blockProfileContainer, profile);
    renderLocationTiles(blockLocationTiles, profile, tables);
    renderBlockHistory(blockHistoryContainer, tables.history || []);
    renderBlockSchedule(blockScheduleContainer, tables.scheduled_events || []);
    renderCompanyTable(companyTableWrap, tables.company_interests || []);
    renderOwnership(ownershipTiles, profile);
  }

  if (blockOptions[0]) {
    blockSelect.value = blockOptions[0];
    updateBlock(blockOptions[0]);
  }
  blockSelect.addEventListener("change", event => updateBlock(event.target.value));

  let contractOptions = Object.values(contractProfiles)
    .map(profile => ({ value: profile.contract_name, label: `${profile.contract_name} / ${profile.country_name || "未提供国家"}` }))
    .sort((a, b) => a.value.localeCompare(b.value, "en"));
  const contractSelect = root.querySelector("#contractSelect");
  contractSelect.innerHTML = contractOptions.map(option => `<option value="${option.value}">${option.label}</option>`).join("");
  const contractProfileContainer = root.querySelector("#contractProfile");
  const contractLocationTiles = root.querySelector("#contractLocationTiles");
  const contractHistoryContainer = root.querySelector("#contractHistory");
  const contractScheduleContainer = root.querySelector("#contractSchedule");
  const contractCompanyTableWrap = root.querySelector("#contractCompanyTableWrap");
  const contractCommitmentsWrap = root.querySelector("#contractCommitmentsWrap");
  const contractRelatedBlocksWrap = root.querySelector("#contractRelatedBlocksWrap");
  const contractSupplementTiles = root.querySelector("#contractSupplementTiles");

  function updateContract(name) {
    const profile = contractProfiles[name] || {};
    const tables = contractTables[name] || {};
    renderContractProfile(contractProfileContainer, profile);
    renderContractLocationTiles(contractLocationTiles, profile, tables);
    renderContractHistory(contractHistoryContainer, tables.history || []);
    renderContractSchedule(contractScheduleContainer, tables.scheduled_events || []);
    renderContractCompanyTable(contractCompanyTableWrap, tables.company_interests || []);
    renderContractCommitments(contractCommitmentsWrap, tables.commitments || []);
    renderContractRelatedBlocks(contractRelatedBlocksWrap, tables.related_blocks || []);
    renderContractSupplementTiles(contractSupplementTiles, profile, tables);
  }

  if (contractOptions[0]) {
    contractSelect.value = contractOptions[0].value;
    updateContract(contractOptions[0].value);
  }
  contractSelect.addEventListener("change", event => updateContract(event.target.value));

  let fieldOptions = unique([
    ...Object.keys(fieldProfiles),
    ...state.fieldsGeoJson.features.map(feature => feature.properties?.field_name).filter(Boolean)
  ]).sort();
  const fieldSelect = root.querySelector("#fieldSelect");
  fieldSelect.innerHTML = fieldOptions.map(name => `<option value="${name}">${name}</option>`).join("");
  const fieldProfileContainer = root.querySelector("#fieldProfile");
  const fieldReserveTilesContainer = root.querySelector("#fieldReserveTiles");
  const fieldEventsContainer = root.querySelector("#fieldEvents");
  const fieldCompanyTableWrap = root.querySelector("#fieldCompanyTableWrap");
  const fieldSupplementTiles = root.querySelector("#fieldSupplementTiles");

  function updateField(name) {
    const profile = fieldProfiles[name] || {};
    const feature = state.fieldsGeoJson.features.find(item => item.properties?.field_name === name) || {};
    const tables = fieldTables[name] || {};
    renderFieldProfile(fieldProfileContainer, profile, feature.properties || {});
    renderFieldReserveTiles(fieldReserveTilesContainer, profile, tables);
    renderFieldEvents(fieldEventsContainer, tables.events || []);
    renderFieldCompanyTable(fieldCompanyTableWrap, tables.company_interests || []);
    renderFieldSupplementTiles(fieldSupplementTiles, tables);
  }

  if (fieldOptions[0]) {
    fieldSelect.value = fieldOptions[0];
    updateField(fieldOptions[0]);
  }
  fieldSelect.addEventListener("change", event => updateField(event.target.value));

  let wellOptions = getWellOptions(state);
  const wellSelect = root.querySelector("#wellSelect");
  wellSelect.innerHTML = wellOptions.map(option => `<option value="${option.value}">${option.label}</option>`).join("");
  const wellProfileContainer = root.querySelector("#wellProfile");
  const wellHistoryContainer = root.querySelector("#wellHistory");
  const wellDatasetsContainer = root.querySelector("#wellDatasets");
  const curveInsightsContainer = root.querySelector("#curveInsights");
  const logTableWrap = root.querySelector("#logTableWrap");
  const logCanvas = root.querySelector("#logChart");

  function updateWell(wellName) {
    const record = wellRecordByName[wellName] || {};
    const rows = record.rows || [];
    const fallback = rows[0] || record.feature?.properties || {};
    const profile = record.profile || state.wellProfiles?.[wellName] || {};
    renderWellProfile(wellProfileContainer, profile, fallback);
    renderWellHistory(wellHistoryContainer, profile.history || []);
    renderWellDatasets(wellDatasetsContainer, wellName, state.wellTables);
    renderWellChart(logCanvas, rows);
    renderCurveInsights(curveInsightsContainer, rows);
    renderWellTable(logTableWrap, rows);
  }

  if (wellOptions[0]) {
    wellSelect.value = wellOptions[0].value;
    updateWell(wellOptions[0].value);
  }
  wellSelect.addEventListener("change", event => updateWell(event.target.value));

  function sortCatalogNames(values) {
    return unique(values.filter(Boolean)).sort((a, b) => String(a).localeCompare(String(b), "zh-Hans-CN"));
  }

  function setPlainSelectOptions(select, values, selectedValue) {
    select.innerHTML = values.map(name => `<option value="${safeText(name)}">${safeText(name)}</option>`).join("");
    const nextValue = values.includes(selectedValue) ? selectedValue : values[0];
    if (nextValue) {
      select.value = nextValue;
    }
    return nextValue || "";
  }

  function setObjectSelectOptions(select, options, selectedValue) {
    select.innerHTML = options.map(option => `<option value="${safeText(option.value)}">${safeText(option.label)}</option>`).join("");
    const values = options.map(option => option.value);
    const nextValue = values.includes(selectedValue) ? selectedValue : values[0];
    if (nextValue) {
      select.value = nextValue;
    }
    return nextValue || "";
  }

  async function rebuildDetailSelectors() {
    basinNames = sortCatalogNames([
      ...Object.keys(basinProfiles),
      ...state.structuresGeoJson.features.map(feature => feature.properties?.basin_name)
    ]);
    const selectedBasin = setPlainSelectOptions(basinSelect, basinNames, basinSelect.value);
    if (selectedBasin) updateBasin(selectedBasin);

    blockOptions = sortCatalogNames([
      ...Object.keys(blockProfiles),
      ...state.blocksGeoJson.features.map(feature => feature.properties?.block_name)
    ]);
    const selectedBlock = setPlainSelectOptions(blockSelect, blockOptions, blockSelect.value);
    if (selectedBlock) updateBlock(selectedBlock);

    contractOptions = Object.values(contractProfiles)
      .filter(profile => profile.contract_name)
      .map(profile => ({ value: profile.contract_name, label: `${profile.contract_name} / ${profile.country_name || "未提供国家"}` }))
      .sort((a, b) => String(a.value).localeCompare(String(b.value), "zh-Hans-CN"));
    const selectedContract = setObjectSelectOptions(contractSelect, contractOptions, contractSelect.value);
    if (selectedContract) updateContract(selectedContract);

    fieldOptions = sortCatalogNames([
      ...Object.keys(fieldProfiles),
      ...state.fieldsGeoJson.features.map(feature => feature.properties?.field_name)
    ]);
    const selectedField = setPlainSelectOptions(fieldSelect, fieldOptions, fieldSelect.value);
    if (selectedField) updateField(selectedField);

    wellOptions = getWellOptions(state);
    const selectedWellValue = wellSelect.value;
    wellSelect.innerHTML = "";
    const chunkSize = 8000;
    for (let index = 0; index < wellOptions.length; index += chunkSize) {
      const chunk = wellOptions.slice(index, index + chunkSize);
      wellSelect.insertAdjacentHTML("beforeend", chunk
        .map(option => `<option value="${safeText(option.value)}">${safeText(option.label)}</option>`)
        .join(""));
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const hasSelected = [...wellSelect.options].some(option => option.value === selectedWellValue);
    const selectedWell = hasSelected ? selectedWellValue : (wellOptions[0]?.value || "");
    if (selectedWell) {
      wellSelect.value = selectedWell;
      updateWell(selectedWell);
    }
  }

  const catalogControls = {
    keyword: root.querySelector("#catalogKeyword"),
    type: root.querySelector("#catalogTypeFilter"),
    country: root.querySelector("#catalogCountryFilter"),
    pageSize: root.querySelector("#catalogPageSize"),
    count: root.querySelector("#catalogCount"),
    pageInfo: root.querySelector("#catalogPageInfo"),
    prev: root.querySelector("#catalogPrevPage"),
    next: root.querySelector("#catalogNextPage"),
    body: root.querySelector("#catalogTableBody")
  };
  const catalogState = {
    keyword: "",
    type: "",
    country: "",
    page: 1,
    pageSize: Number(catalogControls.pageSize?.value) || 50
  };

  function primaryCountry(value) {
    return String(value || "").split(/[\/,;、~]+/).map(item => item.trim()).find(Boolean) || "";
  }

  function metricText(value, suffix = "", digits = 1) {
    return value != null && value !== "" && Number.isFinite(Number(value)) ? `${formatNumber(Number(value), digits)}${suffix}` : "";
  }

  function catalogActionAttrs(row) {
    const attrs = [`data-action-tab="${row.tab}"`];
    if (row.detail) attrs.push(`data-action-detail="${row.detail}"`);
    if (row.select && row.value) {
      attrs.push(`data-action-select="${row.select}"`);
      attrs.push(`data-action-value="${encodeURIComponent(row.value)}"`);
    }
    if (row.scroll) attrs.push(`data-action-scroll="${row.scroll}"`);
    return attrs.join(" ");
  }

  function upsertCatalogRow(rows, row) {
    if (!row.name) return;
    const key = `${row.type}:${row.name}`;
    if (!rows.has(key)) rows.set(key, row);
  }

  let catalogRowsCache = { signature: null, rows: null };
  function getCatalogRows() {
    const signature = [
      state.structuresGeoJson.features.length,
      state.blocksGeoJson.features.length,
      state.fieldsGeoJson.features.length,
      state.wellsGeoJson.features.length,
      Object.keys(basinProfiles).length,
      Object.keys(blockProfiles).length,
      Object.keys(fieldProfiles).length,
      Object.keys(contractProfiles).length
    ].join("|");
    if (catalogRowsCache.signature === signature) return catalogRowsCache.rows;
    const rows = new Map();
    state.structuresGeoJson.features.forEach(feature => {
      const props = feature.properties || {};
      const name = props.basin_name;
      const profile = basinProfiles[name] || {};
      const area = metricText(profile.basin_area_sqkm ?? props.bs_skm, " km²");
      const waterDepth = metricText(profile.max_water_depth_m ?? props.bs_dp_wat, " m");
      upsertCatalogRow(rows, {
        type: "basin",
        typeLabel: "盆地",
        name,
        country: profile.country_names || props.countries || props.country || "",
        related: profile.parent_basin_name || props.prt_bsn_nm || props.king_class || "",
        metric: [area && `面积 ${area}`, waterDepth && `最大水深 ${waterDepth}`].filter(Boolean).join("；") || "-",
        tab: "basins",
        select: "#basinSelect",
        value: name,
        scroll: "#basinSummaryCard"
      });
    });

    state.blocksGeoJson.features.forEach(feature => {
      const props = feature.properties || {};
      const name = props.block_name;
      const profile = blockProfiles[name] || {};
      upsertCatalogRow(rows, {
        type: "block",
        typeLabel: "区块",
        name,
        country: profile.country_name || props.country || "",
        related: profile.contract_name || props.contract || profile.basin_names || props.bas_names || "",
        metric: [profile.operator_name || props.operator, metricText(profile.block_sqkm ?? props.blk_sqkm, " km²") && `面积 ${metricText(profile.block_sqkm ?? props.blk_sqkm, " km²")}`].filter(Boolean).join("；") || "-",
        tab: "blocks",
        select: "#blockSelect",
        value: name,
        scroll: "#blockSummaryCard"
      });
    });

    Object.values(contractProfiles).forEach(profile => {
      upsertCatalogRow(rows, {
        type: "contract",
        typeLabel: "合同",
        name: profile.contract_name,
        country: profile.country_name || "",
        related: profile.basin_names || profile.operator_name || "",
        metric: [profile.contract_status, metricText(profile.contract_sqkm, " km²") && `面积 ${metricText(profile.contract_sqkm, " km²")}`].filter(Boolean).join("；") || "-",
        tab: "contracts",
        select: "#contractSelect",
        value: profile.contract_name,
        scroll: "#contractSummaryCard"
      });
    });

    state.fieldsGeoJson.features.forEach(feature => {
      const props = feature.properties || {};
      const name = props.field_name;
      const profile = fieldProfiles[name] || {};
      upsertCatalogRow(rows, {
        type: "field",
        typeLabel: "油气田",
        name,
        country: profile.country_names || props.countries || "",
        related: profile.basin_name || props.basin_name || profile.current_operators || props.opr_curr || "",
        metric: [profile.prod_status || props.prod_stat, profile.hc_type || props.hc_type, metricText(profile.total_recoverable_mmboe, " MMboe", 2) && `可采 ${metricText(profile.total_recoverable_mmboe, " MMboe", 2)}`].filter(Boolean).join("；") || "-",
        tab: "fields",
        select: "#fieldSelect",
        value: name,
        scroll: "#fieldSummaryCard"
      });
    });

    state.wellsGeoJson.features.forEach(feature => {
      const props = feature.properties || {};
      const name = props.well_name;
      const profile = state.wellProfiles?.[name] || {};
      const wellId = wellIdByName[name] || name;
      upsertCatalogRow(rows, {
        type: "well",
        typeLabel: "井位",
        name,
        country: profile.country || props.country || "",
        related: profile.basin_name || props.basin_name || profile.operator_name || props.operator || "",
        metric: [metricText(profile.td_meter ?? props.td_m, " m") && `总井深 ${metricText(profile.td_meter ?? props.td_m, " m")}`, profile.tech_status || props.tch_stat].filter(Boolean).join("；") || "-",
        tab: "wells",
        select: "#wellSelect",
        value: wellId,
        scroll: "#wellSummaryCard"
      });
    });

    const result = [...rows.values()].sort((a, b) => String(a.typeLabel + a.name).localeCompare(String(b.typeLabel + b.name), "zh-Hans-CN"));
    catalogRowsCache = { signature, rows: result };
    return result;
  }

  function getFilteredCatalogRows() {
    const keyword = catalogState.keyword.toLowerCase();
    return getCatalogRows().filter(row => {
      if (catalogState.type && row.type !== catalogState.type) return false;
      if (catalogState.country && primaryCountry(row.country) !== catalogState.country) return false;
      if (!keyword) return true;
      return [row.typeLabel, row.name, row.country, row.related, row.metric].join(" ").toLowerCase().includes(keyword);
    });
  }

  function renderCatalogControls() {
    const countries = sortCatalogNames(getCatalogRows().map(row => primaryCountry(row.country)).filter(Boolean));
    const selected = countries.includes(catalogState.country) ? catalogState.country : "";
    catalogState.country = selected;
    catalogControls.country.innerHTML = `<option value="">全部国家/地区</option>${countries.map(country => `<option value="${safeText(country)}">${safeText(country)}</option>`).join("")}`;
    catalogControls.country.value = selected;
  }

  function renderCatalogTable() {
    const rows = getFilteredCatalogRows();
    const totalPages = Math.max(1, Math.ceil(rows.length / catalogState.pageSize));
    catalogState.page = Math.min(catalogState.page, totalPages);
    const start = (catalogState.page - 1) * catalogState.pageSize;
    const pageRows = rows.slice(start, start + catalogState.pageSize);
    catalogControls.count.textContent = `共 ${rows.length} 条对象`;
    catalogControls.pageInfo.textContent = `第 ${catalogState.page} / ${totalPages} 页`;
    catalogControls.prev.disabled = catalogState.page <= 1;
    catalogControls.next.disabled = catalogState.page >= totalPages;
    catalogControls.body.innerHTML = pageRows.length ? pageRows.map(row => `
      <tr>
        <td><span class="catalog-type-pill">${safeText(row.typeLabel)}</span></td>
        <td><strong>${safeText(row.name || "-")}</strong></td>
        <td>${safeText(row.country || "-")}</td>
        <td>${safeText(row.related || "-")}</td>
        <td>${safeText(row.metric || "-")}</td>
        <td><button type="button" class="table-action is-action" ${catalogActionAttrs(row)}>查看</button></td>
      </tr>
    `).join("") : `<tr><td colspan="6">暂无匹配数据</td></tr>`;
  }

  catalogControls.keyword.addEventListener("input", event => {
    catalogState.keyword = event.target.value.trim();
    catalogState.page = 1;
    renderCatalogTable();
  });
  catalogControls.type.addEventListener("change", event => {
    catalogState.type = event.target.value;
    catalogState.page = 1;
    renderCatalogTable();
  });
  catalogControls.country.addEventListener("change", event => {
    catalogState.country = event.target.value;
    catalogState.page = 1;
    renderCatalogTable();
  });
  catalogControls.pageSize.addEventListener("change", event => {
    catalogState.pageSize = Number(event.target.value) || 50;
    catalogState.page = 1;
    renderCatalogTable();
  });
  catalogControls.prev.addEventListener("click", () => {
    catalogState.page = Math.max(1, catalogState.page - 1);
    renderCatalogTable();
  });
  catalogControls.next.addEventListener("click", () => {
    catalogState.page += 1;
    renderCatalogTable();
  });

  renderCatalogControls();
  renderCatalogTable();
  refreshAfterMapLayersLoaded = () => {
    rebuildDetailSelectors();
    renderCatalogControls();
    renderCatalogTable();
  };
  if (state.layerSource !== "not-loaded") {
    refreshAfterMapLayersLoaded();
  }

  renderModuleGrid(root.querySelector("#catalogModuleGrid"), state.overview.modules || []);
  const coverageTiles = [
    { title: "井专题表", value: `${Object.keys(state.dataInventory?.well_tables || {}).length} 张`, tab: "wells", scroll: "#wellDatasetsCard" },
    { title: "盆地专题表", value: `${Object.keys(state.dataInventory?.basin_tables || {}).length} 张`, tab: "basins", detail: "systems", scroll: "#basinSystemsCard" },
    { title: "区块专题表", value: `${Object.keys(state.dataInventory?.block_tables || {}).length} 张`, tab: "blocks", detail: "history", scroll: "#blockHistoryCard" },
    { title: "合同专题表", value: `${Object.keys(state.dataInventory?.contract_tables || {}).length} 张`, tab: "contracts", detail: "commitment", scroll: "#contractCoverageCard" },
    { title: "油气田专题表", value: `${Object.keys(state.dataInventory?.field_tables || {}).length} 张`, tab: "fields", scroll: "#fieldSupplementCard" },
    { title: "区块资料对象", value: `${Object.keys(blockProfiles).length} 个`, tab: "blocks", scroll: "#blockSummaryCard" },
    { title: "合同资料对象", value: `${Object.keys(contractProfiles).length} 个`, tab: "contracts", scroll: "#contractSummaryCard" },
    { title: "油气田对象", value: `${Object.keys(fieldProfiles).length} 个`, tab: "fields", scroll: "#fieldSummaryCard" },
    { title: "区块历史记录", value: `${Object.values(blockTables).reduce((sum, item) => sum + (item.history?.length || 0), 0)} 条`, tab: "blocks", detail: "history", scroll: "#blockHistoryCard" },
    { title: "合同历史记录", value: `${Object.values(contractTables).reduce((sum, item) => sum + (item.history?.length || 0), 0)} 条`, tab: "contracts", detail: "history", scroll: "#contractHistoryCard" },
    { title: "油气田事件记录", value: `${Object.values(fieldTables).reduce((sum, item) => sum + (item.events?.length || 0), 0)} 条`, tab: "fields", scroll: "#fieldEventsCard" },
    { title: "区块权益记录", value: `${Object.values(blockTables).reduce((sum, item) => sum + (item.company_interests?.length || 0), 0)} 条`, tab: "blocks", detail: "ownership", scroll: "#blockOwnershipCard" },
    { title: "合同权益记录", value: `${Object.values(contractTables).reduce((sum, item) => sum + (item.company_interests?.length || 0), 0)} 条`, tab: "contracts", detail: "ownership", scroll: "#contractOwnershipCard" },
    { title: "油气田权益记录", value: `${Object.values(fieldTables).reduce((sum, item) => sum + (item.company_interests?.length || 0), 0)} 条`, tab: "fields", scroll: "#fieldOwnershipCard" },
    { title: "服务来源", value: state.layerSource === "service" ? "MapGIS 真实服务" : state.layerSource === "not-loaded" ? "等待读取" : "MapGIS 服务异常", tab: "spatial", scroll: "#serviceSourceCard" }
  ];
  root.querySelector("#coverageTiles").innerHTML = coverageTiles.map(tile => `
    <article class="info-tile is-action" data-action-tab="${tile.tab}" ${tile.detail ? `data-action-detail="${tile.detail}"` : ""} data-action-scroll="${tile.scroll}" tabindex="0" role="button">
      <h4>${tile.title}</h4>
      <p>${tile.value}</p>
    </article>
  `).join("");
}

init().catch(error => {
  const container = document.querySelector('[data-module-container="data"]') || document.body;
  container.innerHTML = `<pre class="error-panel">${error.message}</pre>`;
});






