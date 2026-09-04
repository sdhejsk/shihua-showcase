export const MODULES = [
  {
    key: "overview",
    href: "./index.html",
    title: "数据概览",
    subtitle: "总览",
    description: "查看当前接入的数据对象、专题资料和服务状态。"
  },
  {
    key: "data",
    href: "./data.html",
    title: "数据信息模块",
    subtitle: "数据",
    description: "统一查看盆地、区块、井位、油气田、资料和对象目录。"
  },
  {
    key: "evaluation",
    href: "./evaluation.html",
    title: "评价算法模块",
    subtitle: "评价",
    description: "设置评价参数、执行计算，并查看盆地、区块、油气田和井对象的专业评价结果。"
  },
  {
    key: "services",
    href: "./services.html",
    title: "服务状态",
    subtitle: "服务",
    description: "查看接口、图层和资料文件状态。"
  }
];

const SAMPLE_WELL_LOGS_CSV = `well_id,well_name,basin,block,longitude,latitude,depth_m,gr_api,rt_ohmm,rhob_gcc,nphi_vv,ac_usft,cal_in,sp_mv,lithology,formation,interpretation
WELL-SH-001,石化-示例井1,塔里木盆地,塔中北坡,83.6721,40.2154,1200,78,18.6,2.42,0.22,78.4,8.6,-42,粉砂岩,目的层A,含油气显示
WELL-SH-001,石化-示例井1,塔里木盆地,塔中北坡,83.6721,40.2154,1210,82,21.3,2.39,0.24,80.1,8.5,-45,粉砂岩,目的层A,含油气显示
WELL-SH-001,石化-示例井1,塔里木盆地,塔中北坡,83.6721,40.2154,1220,95,8.9,2.55,0.18,74.2,8.4,-38,泥质粉砂岩,目的层A,致密层
WELL-SH-002,石化-示例井2,鄂尔多斯盆地,陕北斜坡,108.9462,38.1743,1560,112,6.2,2.61,0.13,69.5,8.3,-31,泥岩,目的层C,盖层
WELL-SH-002,石化-示例井2,鄂尔多斯盆地,陕北斜坡,108.9462,38.1743,1580,71,28.4,2.35,0.25,82.8,8.6,-48,细砂岩,目的层D,含油气显示
WELL-SH-003,石化-示例井3,四川盆地,川中隆起,105.8841,30.6549,2320,49,58.2,2.67,0.08,62.3,8.2,-22,白云岩,目的层E,裂缝性储层
WELL-SH-003,石化-示例井3,四川盆地,川中隆起,105.8841,30.6549,2340,76,19.5,2.56,0.16,70.9,8.4,-29,灰质白云岩,目的层E,一般储层`;

const FALLBACK_STRUCTURE_TABLE = {
  records: [
    { basin_name: "塔里木盆地", first_order_name: "塔中隆起", second_order_name: "塔中北坡", block_name: "塔中北坡示例区", min_longitude: 82.9, max_longitude: 84.4, min_latitude: 39.7, max_latitude: 40.8 },
    { basin_name: "鄂尔多斯盆地", first_order_name: "陕北斜坡", second_order_name: "延安-靖边区带", block_name: "陕北斜坡示例区", min_longitude: 108.1, max_longitude: 109.8, min_latitude: 37.6, max_latitude: 38.7 },
    { basin_name: "四川盆地", first_order_name: "川中隆起", second_order_name: "川中北部构造带", block_name: "川中隆起示例区", min_longitude: 105.2, max_longitude: 106.5, min_latitude: 30.1, max_latitude: 31.0 }
  ]
};

const FALLBACK_MAP_SERVICE_CONFIG = {
  serviceMode: "mapgis-igs",
  enabled: false,
  serviceName: "MapGIS IGServer",
  igs: {
    baseUrl: "/igs/rest/services",
    outSrs: "EPSG:4326",
    wells: { serviceName: "wells", layerId: "0", outFields: ["objectid", "well_name", "country", "basin_name", "operator", "class", "tch_stat", "td_m", "tvd_meter", "wel_id", "lat_dec", "long_dec"] },
    basins: { serviceName: "main_basins", layerId: "0", outFields: ["objectid", "basin_name", "countries", "prt_bsn_nm", "king_class", "bs_skm", "bs_dp_wat"] },
    contractBlocks: { serviceName: "contract_blocks", layerId: "0", outFields: ["objectid", "block_name", "contract", "country", "bas_names", "operator", "con_status", "blk_status", "blk_sqkm", "ons_off", "terrains", "province", "min_wd_mt", "med_wd_mt", "max_wd_mt", "app_date", "exp_date", "group", "grp_name"] },
    fields: { serviceName: "fields", layerId: "0", outFields: ["objectid", "field_name", "countries", "basin_name", "opr_curr", "prod_stat", "hc_type", "field_type", "wd_max_m", "fie_id", "lat_dec", "long_dec"] }
  }
};

const FALLBACK_SYSTEM_OVERVIEW = {
  modules: [
    { name: "空间服务发布", status: "已接入", owner: "GIS 组", description: "提供盆地、区块、井位与油气田要素服务。", inputs: ["Wells.shp", "Main_Basins.shp", "Valid_Contract_Blocks.shp", "Fields.shp"], outputs: ["井位服务", "盆地服务", "区块服务", "油气田服务"] },
    { name: "井资料工作台", status: "已接入", owner: "前端组", description: "查看井档案、井史、专题表和曲线。", inputs: ["井位服务", "井表 Excel", "well_logs.csv"], outputs: ["井对象视图", "样例曲线区"] },
    { name: "区块工作台", status: "已接入", owner: "业务组", description: "查看区块边界、状态、面积与水深。", inputs: ["Valid_Contract_Blocks.shp", "区块 Excel"], outputs: ["区块图层", "区块名录"] },
    { name: "油气田工作台", status: "已接入", owner: "业务组", description: "查看油气田位置、资源属性、生产摘要和公司权益。", inputs: ["Fields.shp", "Field Excel"], outputs: ["油气田对象", "油气田详情"] },
    { name: "评价算法模块", status: "已接入", owner: "业务组", description: "面向盆地、区块、油气田和井对象提供参数录入、计算执行和结果解释。", inputs: ["四类对象服务", "专题资料整合表", "evaluation_models.json"], outputs: ["排序结果", "分项得分", "等级建议"] }
  ],
  dataQuality: [],
  roadmap: [],
  apiEndpoints: [],
  layerCatalog: []
};

const FALLBACK_DATA_INVENTORY = {
  well_tables: {},
  basin_tables: {},
  block_tables: {},
  contract_tables: {},
  field_tables: {}
};

const FALLBACK_REGIONAL_STORIES = {
  stories: []
};

export function unique(values) {
  return [...new Set(values)];
}

export function safeText(value) {
  return value == null || value === "" ? "-" : String(value);
}

export function formatNumber(value, digits = 0) {
  if (value == null || value === "") return "-";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return safeText(value);
  return numeric.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export function emptyFeatureCollection(name = "empty") {
  return { type: "FeatureCollection", name, features: [] };
}

const IGS_PAGE_SIZE = 1000;
const IGS_MAX_PAGES = 80;
const IGS_FEATURE_FORMAT = "geojson";
const FEATURE_TYPE_TO_CONFIG_KEY = {
  wells: "wells",
  basins: "basins",
  contract_blocks: "contractBlocks",
  fields: "fields"
};
const FEATURE_TYPE_TO_STATE_KEY = {
  wells: "wellsGeoJson",
  basins: "structuresGeoJson",
  contract_blocks: "blocksGeoJson",
  fields: "fieldsGeoJson"
};
const STATE_KEY_TO_FEATURE_TYPE = {
  wellsGeoJson: "wells",
  structuresGeoJson: "basins",
  blocksGeoJson: "contract_blocks",
  fieldsGeoJson: "fields"
};
const LAYER_CACHE_DB = "shihua-showcase-cache";
const LAYER_CACHE_STORE = "igs-layers";
const LAYER_CACHE_VERSION = "v2-20260804";
const LAYER_CACHE_TTL_MS = 30 * 60 * 1000;
const LAYER_REFRESH_GUARD_MS = 5 * 60 * 1000;
const LAYER_CHUNK_SIZE = 5000;

function getUrlParams() {
  if (typeof location === "undefined") return null;
  try {
    return new URLSearchParams(location.search);
  } catch (error) {
    return null;
  }
}

function simpleHash(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function openLayerCacheDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("indexedDB 不可用"));
      return;
    }
    const request = window.indexedDB.open(LAYER_CACHE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LAYER_CACHE_STORE)) {
        db.createObjectStore(LAYER_CACHE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let layerCachePurged = false;
async function purgeOldLayerCache() {
  if (layerCachePurged) return;
  layerCachePurged = true;
  try {
    const db = await openLayerCacheDb();
    await new Promise(resolve => {
      const transaction = db.transaction(LAYER_CACHE_STORE, "readwrite");
      const store = transaction.objectStore(LAYER_CACHE_STORE);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        const key = String(cursor.key);
        if (!key.startsWith(`${LAYER_CACHE_VERSION}:`) && key !== "meta:last-refresh") {
          cursor.delete();
        }
        cursor.continue();
      };
      request.onerror = () => resolve();
    });
  } catch (error) {
    // Non-blocking.
  }
}

function layerCacheKey(igs, featureType) {
  const configKey = FEATURE_TYPE_TO_CONFIG_KEY[featureType] || featureType;
  const layerConfig = igs?.[configKey] || {};
  const sources = (layerConfig.sources || [layerConfig]).filter(Boolean).map(source => ({
    serviceName: source.serviceName,
    layerId: source.layerId,
    outFields: source.outFields
  }));
  const signature = JSON.stringify({
    outSrs: igs?.outSrs,
    pageSize: igs?.pageSize,
    sources
  });
  return `${LAYER_CACHE_VERSION}:${featureType}:${simpleHash(signature)}`;
}

async function loadCachedLayerEntry(igs, featureType) {
  try {
    const db = await openLayerCacheDb();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(LAYER_CACHE_STORE, "readonly");
      const request = transaction.objectStore(LAYER_CACHE_STORE).get(layerCacheKey(igs, featureType));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    return null;
  }
}

async function loadCachedRawEntry(db, rawKey) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(LAYER_CACHE_STORE, "readonly");
    const request = transaction.objectStore(LAYER_CACHE_STORE).get(rawKey);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function saveCachedLayerEntry(igs, featureType, collection) {
  try {
    const key = layerCacheKey(igs, featureType);
    const features = collection?.features || [];
    if (!features.length) return;
    const db = await openLayerCacheDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(LAYER_CACHE_STORE, "readwrite");
      const store = transaction.objectStore(LAYER_CACHE_STORE);
      if (featureType === "wells") {
        store.put({ savedAt: Date.now(), chunkCount: Math.ceil(features.length / LAYER_CHUNK_SIZE) }, `${key}:chunks`);
        for (let index = 0; index < features.length; index += LAYER_CHUNK_SIZE) {
          store.put({ savedAt: Date.now(), features: features.slice(index, index + LAYER_CHUNK_SIZE) }, `${key}:chunk:${Math.floor(index / LAYER_CHUNK_SIZE)}`);
        }
      } else {
        store.put({ savedAt: Date.now(), collection }, key);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    // Cache write failures are non-blocking.
  }
}

async function getLastLayerRefreshAt() {
  try {
    const db = await openLayerCacheDb();
    return await new Promise(resolve => {
      const transaction = db.transaction(LAYER_CACHE_STORE, "readonly");
      const request = transaction.objectStore(LAYER_CACHE_STORE).get("meta:last-refresh");
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => resolve(0);
    });
  } catch (error) {
    return 0;
  }
}

async function setLastLayerRefreshAt() {
  try {
    const db = await openLayerCacheDb();
    await new Promise(resolve => {
      const transaction = db.transaction(LAYER_CACHE_STORE, "readwrite");
      transaction.objectStore(LAYER_CACHE_STORE).put(Date.now(), "meta:last-refresh");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  } catch (error) {
    // Non-blocking.
  }
}

export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  return lines.map(line => {
    const cells = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
  });
}

async function loadText(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`无法加载 ${path}`);
    return response.text();
  } catch (error) {
    if (path.includes("well_logs.csv")) return SAMPLE_WELL_LOGS_CSV;
    throw error;
  }
}

async function loadJson(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`无法加载 ${path}`);
    return response.json();
  } catch (error) {
    if (path.includes("structure_base_table.json")) return FALLBACK_STRUCTURE_TABLE;
    if (path.includes("map_service_config.json")) return FALLBACK_MAP_SERVICE_CONFIG;
    if (path.includes("system_overview.json")) return FALLBACK_SYSTEM_OVERVIEW;
    if (path.includes("data_inventory.json")) return FALLBACK_DATA_INVENTORY;
    if (path.includes("well_excel_profiles.json")) return {};
    if (path.includes("well_integrated_tables.json")) return {};
    if (path.includes("basin_integrated_tables.json")) return { profiles: {}, tables: {} };
    if (path.includes("block_integrated_tables.json")) return { profiles: {}, tables: {} };
    if (path.includes("contract_integrated_tables.json")) return { profiles: {}, tables: {}, global_tables: {} };
    if (path.includes("field_integrated_tables.json")) return { profiles: {}, tables: {} };
    if (path.includes("regional_story_africa.json")) return FALLBACK_REGIONAL_STORIES;
    if (path.includes("africa_integrated_index.json")) return { summary: {}, services: {}, tables: {}, pdfIndex: { folders: [] }, samples: {} };
    throw error;
  }
}

export function renderShell({ currentKey, heroTitle, heroDesc, heroMeta = [] }) {
  const currentModule = MODULES.find(module => module.key === currentKey) || MODULES[0];
  const navItems = MODULES.map(module => `
    <a class="main-nav__item ${module.key === currentKey ? "is-active" : ""}" href="${module.href}">
      <span>${module.title}</span>
      <small>${module.subtitle}</small>
    </a>
  `).join("");
  const metaItems = heroMeta.map(item => `<span>${item}</span>`).join("");

  const spaShell = document.querySelector(".app-shell[data-spa-shell]");
  if (spaShell) {
    window.__moduleHero = window.__moduleHero || {};
    window.__moduleHero[currentKey] = {
      moduleTitle: currentModule.title,
      moduleSubtitle: currentModule.subtitle,
      heroTitle,
      heroDesc,
      heroMeta
    };
    const applyShell = () => {
      const modeTitle = spaShell.querySelector(".mode-card strong");
      const modeSubtitle = spaShell.querySelector(".mode-card small");
      if (modeTitle) modeTitle.textContent = currentModule.title;
      if (modeSubtitle) modeSubtitle.textContent = currentModule.subtitle;
      spaShell.querySelectorAll(".main-nav__item").forEach(item => {
        item.classList.toggle("is-active", item.dataset.moduleNav === currentKey);
      });
      const heroEyebrow = spaShell.querySelector(".page-hero__eyebrow");
      const heroTitleNode = spaShell.querySelector(".page-hero h2");
      const heroDescNode = spaShell.querySelector(".page-hero p");
      const heroTags = spaShell.querySelector(".hero-tags");
      if (heroEyebrow) heroEyebrow.textContent = currentModule.title;
      if (heroTitleNode) heroTitleNode.textContent = heroTitle;
      if (heroDescNode) heroDescNode.textContent = heroDesc;
      if (heroTags) heroTags.innerHTML = metaItems;
    };
    applyShell();
    const container = spaShell.querySelector(`[data-module-container="${currentKey}"]`);
    return container || document.querySelector("#page-root");
  }

  document.body.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div class="app-header__brand">
          <p class="app-eyebrow">Data Workspace</p>
          <h1>石化地学数据展示平台</h1>
          <p class="app-header__desc">统一查看盆地、区块、井位和资料服务。</p>
        </div>
        <div class="app-header__side">
          <div class="mode-card">
            <span>当前模块</span>
            <strong>${currentModule.title}</strong>
            <small>${currentModule.subtitle}</small>
          </div>
          <div class="hero-tags">${metaItems}</div>
        </div>
      </header>
      <nav class="main-nav">${navItems}</nav>
      <main class="page-main">
        <section class="page-hero">
          <div>
            <p class="page-hero__eyebrow">${currentModule.title}</p>
            <h2>${heroTitle}</h2>
            <p>${heroDesc}</p>
          </div>
        </section>
        <div id="page-root" class="page-content"></div>
      </main>
    </div>
  `;
  return document.querySelector("#page-root");
}

function buildStructuresGeoJson(structure) {
  return {
    type: "FeatureCollection",
    name: "local_basins",
    features: (structure.records || []).map((row, index) => ({
      type: "Feature",
      properties: {
        objectid: index + 1,
        basin_name: row.basin_name,
        countries: row.country_names || row.country || "未提供",
        prt_bsn_nm: row.first_order_name || "",
        king_class: row.basin_type || "",
        bs_skm: row.area_km2 || row.bs_skm || null,
        bs_dp_wat: row.max_water_depth || null
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [Number(row.min_longitude), Number(row.min_latitude)],
          [Number(row.max_longitude), Number(row.min_latitude)],
          [Number(row.max_longitude), Number(row.max_latitude)],
          [Number(row.min_longitude), Number(row.max_latitude)],
          [Number(row.min_longitude), Number(row.min_latitude)]
        ]]
      }
    }))
  };
}

function buildWellsGeoJson(logs) {
  const wells = unique(logs.map(row => row.well_id)).map(id => logs.find(row => row.well_id === id));
  return {
    type: "FeatureCollection",
    name: "local_wells",
    features: wells.map((well, index) => ({
      type: "Feature",
      properties: {
        objectid: index + 1,
        well_id: well.well_id,
        well_name: well.well_name,
        basin_name: well.basin,
        block_name: well.block,
        operator: "未提供"
      },
      geometry: {
        type: "Point",
        coordinates: [Number(well.longitude), Number(well.latitude)]
      }
    }))
  };
}

function buildIgsQueryUrl(baseUrl, serviceName, layerId, outFields, outSrs, format = "geojson", options = {}) {
  const pageSize = Number(options.pageSize) || IGS_PAGE_SIZE;
  const page = Number(options.page) || 0;
  const offset = Number.isFinite(Number(options.offset)) ? Number(options.offset) : page * pageSize;
  const returnIdsOnly = options.returnIdsOnly === true;
  const returnCountOnly = options.returnCountOnly === true;
  const params = new URLSearchParams({
    where: options.where || "1=1",
    outFields: Array.isArray(outFields) ? outFields.join(",") : outFields,
    outSrs,
    resultRecordCount: String(pageSize),
    pageSize: String(pageSize),
    page: String(page),
    skip: String(offset),
    resultOffset: String(offset),
    returnCountOnly: returnCountOnly ? "true" : "false",
    returnIdsOnly: returnIdsOnly ? "true" : "false",
    returnGeometry: options.returnGeometry === false || returnIdsOnly || returnCountOnly ? "false" : "true",
    returnAttribute: options.returnAttribute === false || returnIdsOnly || returnCountOnly ? "false" : "true",
    returnZ: "false",
    returnStyle: "false",
    f: format
  });
  if (options.objectIds) params.set("objectIds", options.objectIds);
  return `${baseUrl}/${serviceName}/FeatureServer/${layerId}/query?${params.toString()}`;
}

function getRawIgsFeatures(response) {
  if (!response || typeof response !== "object") return [];
  if (Array.isArray(response.features)) return response.features;
  if (Array.isArray(response.layers)) {
    return response.layers.flatMap(layer => Array.isArray(layer.features) ? layer.features : []);
  }
  return [];
}

function extractIgsObjectIds(response) {
  if (!response || typeof response !== "object") return [];
  const directIds = response.objectIds || response.objectids || response.ids || response.objectidsList;
  if (Array.isArray(directIds)) return unique(directIds.map(value => String(value)).filter(Boolean));

  const layerIds = response.layers?.flatMap(layer => {
    if (Array.isArray(layer.objectIds)) return layer.objectIds;
    if (Array.isArray(layer.objectids)) return layer.objectids;
    return [];
  });
  if (Array.isArray(layerIds) && layerIds.length) return unique(layerIds.map(value => String(value)).filter(Boolean));

  const featureIds = getRawIgsFeatures(response)
    .map(feature => feature.attributes?.FID
      ?? feature.attributes?.fid
      ?? feature.attributes?.objectid
      ?? feature.attributes?.OBJECTID
      ?? feature.attributes?.ObjectID
      ?? feature.properties?.FID
      ?? feature.properties?.fid
      ?? feature.properties?.objectid
      ?? feature.properties?.OBJECTID
      ?? feature.properties?.ObjectID)
    .filter(value => value != null && value !== "");
  return unique(featureIds.map(value => String(value)));
}

function webMercatorToLngLat(x, y) {
  const lng = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lng, lat];
}

function isLikelyProjectedPoint(coordinates) {
  return Array.isArray(coordinates)
    && coordinates.length >= 2
    && typeof coordinates[0] === "number"
    && typeof coordinates[1] === "number"
    && (Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90);
}

function transformCoordinates(coordinates, wkid) {
  if (!Array.isArray(coordinates)) return coordinates;
  if (typeof coordinates[0] === "number") {
    if (wkid === 3857 && isLikelyProjectedPoint(coordinates)) {
      return webMercatorToLngLat(coordinates[0], coordinates[1]);
    }
    return coordinates;
  }
  return coordinates.map(item => transformCoordinates(item, wkid));
}

function mapIgsGeometryType(type) {
  if (type === "Pnt") return "Point";
  if (type === "Lin") return "LineString";
  if (type === "Reg" || type === "Polygon") return "Polygon";
  return type || "Geometry";
}

function normalizeLocalFeatureGeometry(feature) {
  if (!feature?.geometry) return feature;
  const geometry = feature.geometry;
  const properties = feature.properties || {};

  if (geometry.type === "Point" && isLikelyProjectedPoint(geometry.coordinates)) {
    const lng = Number(properties.long_dec);
    const lat = Number(properties.lat_dec);
    const coordinates = Number.isFinite(lng) && Number.isFinite(lat)
      ? [lng, lat]
      : transformCoordinates(geometry.coordinates, 3857);
    return {
      ...feature,
      geometry: {
        ...geometry,
        coordinates
      }
    };
  }

  if (["LineString", "Polygon", "MultiLineString", "MultiPolygon"].includes(geometry.type)) {
    const firstPoint = geometry.type === "LineString"
      ? geometry.coordinates?.[0]
      : geometry.type === "Polygon"
        ? geometry.coordinates?.[0]?.[0]
        : geometry.type === "MultiLineString"
          ? geometry.coordinates?.[0]?.[0]
          : geometry.coordinates?.[0]?.[0]?.[0];

    if (isLikelyProjectedPoint(firstPoint)) {
      return {
        ...feature,
        geometry: {
          ...geometry,
          coordinates: transformCoordinates(geometry.coordinates, 3857)
        }
      };
    }
  }

  return feature;
}

function normalizeLocalFeatureCollection(featureCollection, fallbackName = "local") {
  return {
    type: "FeatureCollection",
    name: featureCollection?.name || fallbackName,
    features: (featureCollection?.features || []).map(normalizeLocalFeatureGeometry)
  };
}

function normalizeFeatureProperties(attributes = {}) {
  return Object.entries(attributes || {}).reduce((acc, [key, value]) => {
    acc[key] = value;
    acc[String(key).toLowerCase()] = value;
    return acc;
  }, {});
}

function normalizeIgsFeatureCollection(response, featureType) {
  const layer = response?.layers?.[0] || (Array.isArray(response?.features) ? response : null);
  if (!layer || !Array.isArray(layer.features)) {
    throw new Error("MapGIS IGServer 返回结果中未找到图层要素");
  }
  const wkid = layer.spatialReference?.wkid;
  return {
    type: "FeatureCollection",
    name: layer.name || featureType,
    features: layer.features.map(feature => ({
      type: "Feature",
      properties: normalizeFeatureProperties(feature.attributes || feature.properties),
      geometry: feature.geometry
        ? {
            type: feature.geometry.type || mapIgsGeometryType(layer.geometryType),
            coordinates: transformCoordinates(feature.geometry.coordinates, wkid)
          }
        : null
    }))
  };
}

function normalizeIgsResponse(response, featureType) {
  if (response?.type === "FeatureCollection" && Array.isArray(response.features)) return response;
  if (Array.isArray(response) && response[0]?.type === "FeatureCollection") return response[0];
  return normalizeIgsFeatureCollection(response, featureType);
}

function annotateFeatureCollection(collection, sourceConfig = {}, featureType) {
  return {
    type: "FeatureCollection",
    name: collection?.name || featureType,
    features: (collection?.features || []).map(feature => ({
      ...feature,
      properties: {
        ...normalizeFeatureProperties(feature.properties || {}),
        _source_label: sourceConfig.label || sourceConfig.serviceName || featureType,
        _source_service: sourceConfig.serviceName || "",
        _source_layer: featureType
      }
    }))
  };
}

function mergeFeatureCollections(name, collections) {
  return {
    type: "FeatureCollection",
    name,
    features: collections.flatMap(collection => collection?.features || [])
  };
}

function getIgsSources(config) {
  if (Array.isArray(config?.sources) && config.sources.length) return config.sources;
  return config?.serviceName ? [config] : [];
}

function getFeaturePageSignature(collection) {
  const features = collection?.features || [];
  if (!features.length) return "empty";
  const pick = feature => {
    const properties = feature.properties || {};
    return [
      properties.objectid,
      properties.fid,
      properties.wel_id,
      properties.fie_id,
      properties.well_name,
      properties.basin_name,
      properties.block_name,
      properties.field_name
    ].filter(value => value !== undefined && value !== null && value !== "").join("|");
  };
  return `${features.length}:${pick(features[0])}:${pick(features[features.length - 1])}`;
}

function yieldToBrowser() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, items.length));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await worker(items[current], current);
      await yieldToBrowser();
    }
  }));

  return results;
}

async function loadMapLayers(structure, logs, serviceConfig, options = {}) {
  const layerDiagnostics = [];
  const notifyLayerLoaded = typeof options.onLayerLoaded === "function" ? options.onLayerLoaded : null;
  const notifyBatchLoaded = typeof options.onBatchLoaded === "function" ? options.onBatchLoaded : null;
  const skipLayer = featureType => Array.isArray(options.skipLayers) && options.skipLayers.includes(featureType);
  let structuresGeoJson = emptyFeatureCollection("basins_loading");
  let wellsGeoJson = emptyFeatureCollection("wells_loading");
  let blocksGeoJson = emptyFeatureCollection("contract_blocks_loading");
  let fieldsGeoJson = emptyFeatureCollection("fields_loading");
  const emitLayerProgress = detail => {
    if (!notifyLayerLoaded) return;
    notifyLayerLoaded({
      structuresGeoJson,
      wellsGeoJson,
      blocksGeoJson,
      fieldsGeoJson,
      layerSource: "service",
      layerDiagnostics: [...layerDiagnostics],
      ...detail
    });
  };
  const emitBatchProgress = (featureType, collection, detail) => {
    if (!notifyBatchLoaded) return;
    notifyBatchLoaded(featureType, collection || emptyFeatureCollection(featureType), {
      loadedCount: detail?.loadedCount ?? collection?.features?.length ?? 0,
      totalCount: detail?.totalCount ?? 0,
      done: detail?.done === true,
      sourceLabel: detail?.sourceLabel || "",
      sourceServiceName: detail?.sourceServiceName || "",
      error: detail?.error || ""
    });
  };
  const localStructuresPromise = loadJson("../data/structures.geojson")
    .then(data => normalizeLocalFeatureCollection(data, "local_basins"))
    .catch(() => buildStructuresGeoJson(structure));
  const localWellsPromise = loadJson("../data/wells.geojson")
    .then(data => normalizeLocalFeatureCollection(data, "local_wells"))
    .catch(() => buildWellsGeoJson(logs));
  const localBlocksPromise = Promise.resolve(emptyFeatureCollection("contract_blocks_local"));
  const localFieldsPromise = loadJson("../data/fields.geojson")
    .then(data => normalizeLocalFeatureCollection(data, "fields_local"))
    .catch(() => emptyFeatureCollection("fields_local"));

  if (!serviceConfig.enabled) {
    structuresGeoJson = await localStructuresPromise;
    wellsGeoJson = await localWellsPromise;
    blocksGeoJson = await localBlocksPromise;
    fieldsGeoJson = await localFieldsPromise;
    return {
      structuresGeoJson,
      wellsGeoJson,
      blocksGeoJson,
      fieldsGeoJson,
      layerSource: "local",
      layerDiagnostics
    };
  }

  try {
    const igs = serviceConfig.igs || {};
    const outSrs = igs.outSrs || "EPSG:4326";
    const pageSize = Number(igs.pageSize) || IGS_PAGE_SIZE;
    const maxPages = Number(igs.maxPages) || IGS_MAX_PAGES;

    const loadIgsSource = async (sourceConfig, featureType, label, sourceOptions = {}, onSourceBatch = null) => {
      const emitSourceProgress = (ft, collection, detail) => {
        if (typeof onSourceBatch === "function") {
          onSourceBatch(ft, collection, detail);
        } else {
          emitBatchProgress(ft, collection, detail);
        }
      };
      const startedAt = performance.now();
      const collections = [];
      const signatures = new Set();
      const sourcePageSize = Number(sourceConfig.pageSize) || pageSize;
      const sourceMaxPages = Number(sourceConfig.maxPages) || maxPages;
      const sourcePageConcurrency = Math.max(1, Math.min(Number(sourceConfig.pageConcurrency) || Number(igs.pageConcurrency) || 4, 8));
      const where = sourceOptions.where || "1=1";
      let page = 0;
      let status = "ok";
      let message = "";
      let batchMode = "page";

      async function loadByObjectIds() {
        const idsResponse = await loadJson(buildIgsQueryUrl(
          igs.baseUrl,
          sourceConfig.serviceName,
          sourceConfig.layerId || "0",
          sourceConfig.outFields || "objectid",
          outSrs,
          IGS_FEATURE_FORMAT,
          { page: 0, pageSize: 1, returnIdsOnly: true, where }
        ));
        const objectIds = extractIgsObjectIds(idsResponse);
        if (!objectIds.length) return null;

        const idBatchSize = Math.max(100, Math.min(sourcePageSize, Number(sourceConfig.idBatchSize) || Number(igs.idBatchSize) || 1000));
        const idBatchConcurrency = Math.max(1, Math.min(Number(sourceConfig.idBatchConcurrency) || Number(igs.idBatchConcurrency) || 3, 6));
        const idBatches = [];
        for (let index = 0; index < objectIds.length; index += idBatchSize) {
          idBatches.push(objectIds.slice(index, index + idBatchSize));
        }

        let failedBatchCount = 0;
        const batchResults = [];
        const batchedCollections = await runWithConcurrency(idBatches, idBatchConcurrency, async (ids, batchIndex) => {
          try {
            const response = await loadJson(buildIgsQueryUrl(
              igs.baseUrl,
              sourceConfig.serviceName,
              sourceConfig.layerId || "0",
              sourceConfig.outFields || "objectid",
              outSrs,
              IGS_FEATURE_FORMAT,
              { page: 0, pageSize: ids.length, offset: 0, objectIds: ids.join(","), where }
            ));
            const collection = annotateFeatureCollection(normalizeIgsResponse(response, featureType), sourceConfig, featureType);
            batchResults.push(collection);
            const soFar = mergeFeatureCollections(`${featureType}:${sourceConfig.serviceName}:ids`, batchResults);
            emitSourceProgress(featureType, soFar, {
              sourceLabel: sourceConfig.label || label,
              sourceServiceName: sourceConfig.serviceName,
              loadedCount: soFar.features?.length || 0,
              totalCount: objectIds.length,
              done: false
            });
            await yieldToBrowser();
            return collection.features?.length ? collection : null;
          } catch (error) {
            failedBatchCount += 1;
            emitSourceProgress(featureType, mergeFeatureCollections(`${featureType}:${sourceConfig.serviceName}:ids`, batchResults), {
              sourceLabel: sourceConfig.label || label,
              sourceServiceName: sourceConfig.serviceName,
              loadedCount: batchResults.reduce((sum, item) => sum + (item.features?.length || 0), 0),
              totalCount: objectIds.length,
              done: false,
              error: error.message
            });
            layerDiagnostics.push({
              key: `${featureType}:${sourceConfig.serviceName}:batch-${batchIndex + 1}`,
              featureType,
              label: sourceConfig.label || label,
              serviceName: sourceConfig.serviceName,
              loadedCount: 0,
              requestLimit: ids.length,
              pageCount: 1,
              durationMs: Math.round(performance.now() - startedAt),
              hasMore: true,
              status: "warning",
              message: `第 ${batchIndex + 1} 批对象读取失败，已跳过该批：${error.message}`
            });
            return null;
          }
        });

        return {
          collection: mergeFeatureCollections(`${featureType}:${sourceConfig.serviceName}:ids`, batchedCollections.filter(Boolean)),
          objectCount: objectIds.length,
          batchSize: idBatchSize,
          batchCount: idBatches.length,
          failedBatchCount
        };
      }

      try {
        if (sourceConfig.preferObjectIds === true) {
          const batched = await loadByObjectIds();
          if (batched?.collection?.features?.length) {
            batchMode = "objectIds";
            const incomplete = batched.collection.features.length < batched.objectCount || batched.failedBatchCount > 0;
            layerDiagnostics.push({
              key: `${featureType}:${sourceConfig.serviceName}`,
              featureType,
              label: sourceConfig.label || label,
              serviceName: sourceConfig.serviceName,
              loadedCount: batched.collection.features.length,
              requestLimit: batched.batchSize,
              pageCount: batched.batchCount,
              durationMs: Math.round(performance.now() - startedAt),
              hasMore: incomplete,
              status: incomplete ? "warning" : "ok",
              message: incomplete
                ? `按对象编号分批读取，返回 ${batched.collection.features.length}/${batched.objectCount} 个对象，其中 ${batched.failedBatchCount} 批失败。`
                : `按对象编号分 ${batched.batchCount} 批读取完成，避免单次大请求压垮服务。`
            });
            return batched.collection;
          }
        }
      } catch (error) {
        status = "warning";
        message = `对象编号分批读取不可用，已改用分页读取：${error.message}`;
      }

      const loadPageWithRetry = async (pageIndex, attempts = 3) => {
        let lastError = null;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          try {
            const response = await loadJson(buildIgsQueryUrl(
              igs.baseUrl,
              sourceConfig.serviceName,
              sourceConfig.layerId || "0",
              sourceConfig.outFields || "objectid",
              outSrs,
              IGS_FEATURE_FORMAT,
              { page: pageIndex, pageSize: sourcePageSize, offset: pageIndex * sourcePageSize, where }
            ));
            return annotateFeatureCollection(normalizeIgsResponse(response, featureType), sourceConfig, featureType);
          } catch (error) {
            lastError = error;
            if (attempt < attempts - 1) {
              await delay(250 * (attempt + 1));
            } else {
              await yieldToBrowser();
            }
          }
        }
        throw lastError;
      };

      let reachedEnd = false;
      const failedPages = new Set();
      let firstPageSignature = null;
      while (page < sourceMaxPages && !reachedEnd) {
        const wave = [];
        const waveSize = Math.min(sourcePageConcurrency, sourceMaxPages - page);
        for (let index = 0; index < waveSize; index += 1) wave.push(page + index);
        await runWithConcurrency(wave, waveSize, async pageIndex => {
          try {
            const pageCollection = await loadPageWithRetry(pageIndex);
            const pageCount = pageCollection.features?.length || 0;
            if (pageCount) {
              const signature = getFeaturePageSignature(pageCollection);
              if (signatures.has(signature)) {
                if (signature === firstPageSignature) {
                  status = "warning";
                  message = "服务疑似未按分页参数返回下一页，已停止重复读取。";
                  reachedEnd = true;
                }
                return;
              }
              signatures.add(signature);
              if (firstPageSignature === null) firstPageSignature = signature;
              collections.push(pageCollection);
              const soFar = mergeFeatureCollections(`${featureType}:${sourceConfig.serviceName}`, collections);
              emitSourceProgress(featureType, soFar, {
                sourceLabel: sourceConfig.label || label,
                sourceServiceName: sourceConfig.serviceName,
                loadedCount: soFar.features?.length || 0,
                totalCount: 0,
                done: false
              });
              if (pageCount < sourcePageSize) reachedEnd = true;
            }
          } catch (error) {
            failedPages.add(pageIndex);
            layerDiagnostics.push({
              key: `${featureType}:${sourceConfig.serviceName}:page-${pageIndex + 1}`,
              featureType,
              label: sourceConfig.label || label,
              serviceName: sourceConfig.serviceName,
              loadedCount: 0,
              requestLimit: sourcePageSize,
              pageCount: 1,
              durationMs: 0,
              hasMore: true,
              status: "warning",
              message: `第 ${pageIndex + 1} 页读取失败（已重试 ${3 - 1} 次）：${error.message}`
            });
          }
          await yieldToBrowser();
        });
        page += wave.length;
        await yieldToBrowser();
      }

      if (failedPages.size) {
        const recoveryPages = [...failedPages].sort((a, b) => a - b);
        let recoveredCount = 0;
        await runWithConcurrency(recoveryPages, 2, async pageIndex => {
          try {
            const pageCollection = await loadPageWithRetry(pageIndex, 4);
            const pageCount = pageCollection.features?.length || 0;
            if (pageCount) {
              const signature = getFeaturePageSignature(pageCollection);
              if (!signatures.has(signature)) {
                signatures.add(signature);
                collections.push(pageCollection);
                recoveredCount += pageCount;
                const soFar = mergeFeatureCollections(`${featureType}:${sourceConfig.serviceName}`, collections);
                emitSourceProgress(featureType, soFar, {
                  sourceLabel: sourceConfig.label || label,
                  sourceServiceName: sourceConfig.serviceName,
                  loadedCount: soFar.features?.length || 0,
                  totalCount: 0,
                  done: false
                });
              }
            }
            failedPages.delete(pageIndex);
          } catch (error) {
            layerDiagnostics.push({
              key: `${featureType}:${sourceConfig.serviceName}:recovery-${pageIndex + 1}`,
              featureType,
              label: sourceConfig.label || label,
              serviceName: sourceConfig.serviceName,
              loadedCount: 0,
              requestLimit: sourcePageSize,
              pageCount: 1,
              durationMs: 0,
              hasMore: true,
              status: "error",
              message: `第 ${pageIndex + 1} 页补读后仍失败：${error.message}`
            });
          }
          await yieldToBrowser();
        });
        if (failedPages.size) {
          status = "warning";
          message = `${failedPages.size} 页在重试后仍未读取成功（共补回 ${recoveredCount} 条）。`;
        } else {
          status = "ok";
          message = `初次读取失败 ${recoveryPages.length} 页，已全部补读成功（补回 ${recoveredCount} 条）。`;
        }
      }

      const merged = mergeFeatureCollections(`${featureType}:${sourceConfig.serviceName}`, collections);
      const hasMore = page >= sourceMaxPages && (collections[collections.length - 1]?.features?.length || 0) >= sourcePageSize;
      if (hasMore) {
        status = "warning";
        message = `达到最大读取页数 ${sourceMaxPages}，可能还有后续数据。`;
      }
      layerDiagnostics.push({
        key: `${featureType}:${sourceConfig.serviceName}`,
        featureType,
        label: sourceConfig.label || label,
        serviceName: sourceConfig.serviceName,
        loadedCount: merged.features.length,
        requestLimit: sourcePageSize,
        pageCount: page,
        durationMs: Math.round(performance.now() - startedAt),
        hasMore,
        status,
        message: message || (batchMode === "page" ? "按分页参数读取。" : "")
      });
      return merged;
    };

    const loadIgsLayer = async (config, featureType, localPromise, label, onLoadedSource, sourceOptions = {}) => {
      const sources = getIgsSources(config);
      if (!sources.length) return localPromise;
      const collections = [];
      for (const sourceConfig of sources) {
        const priorCollections = [...collections];
        try {
          collections.push(await loadIgsSource(
            sourceConfig,
            featureType,
            label,
            sourceOptions,
            (ft, sourceSoFar, detail) => {
              const layerSoFar = mergeFeatureCollections(featureType, [...priorCollections, sourceSoFar]);
              emitBatchProgress(featureType, layerSoFar, {
                ...detail,
                loadedCount: layerSoFar.features?.length || 0
              });
            }
          ));
          if (onLoadedSource) onLoadedSource(mergeFeatureCollections(featureType, collections), sourceConfig);
        } catch (error) {
          layerDiagnostics.push({
            key: `${featureType}:${sourceConfig.serviceName}`,
            featureType,
            label: sourceConfig.label || label,
            serviceName: sourceConfig.serviceName,
            loadedCount: 0,
            requestLimit: pageSize,
            pageCount: 0,
            durationMs: 0,
            status: "error",
            message: error.message
          });
          collections.push(emptyFeatureCollection(`${featureType}_${sourceConfig.serviceName}_error`));
          if (onLoadedSource) onLoadedSource(mergeFeatureCollections(featureType, collections), sourceConfig);
        }
        emitBatchProgress(featureType, mergeFeatureCollections(featureType, collections), {
          sourceLabel: sourceConfig.label || label,
          sourceServiceName: sourceConfig.serviceName,
          loadedCount: collections.reduce((sum, item) => sum + (item.features?.length || 0), 0),
          done: true
        });
      }
      return mergeFeatureCollections(featureType, collections);
    };

    structuresGeoJson = skipLayer("basins")
      ? emptyFeatureCollection("basins_skipped")
      : await loadIgsLayer(igs.basins, "basins", localStructuresPromise, "盆地", collection => {
      structuresGeoJson = collection;
      emitLayerProgress({ activeLayerLabel: "盆地" });
    });
    if (structuresGeoJson.features?.length) saveCachedLayerEntry(igs, "basins", structuresGeoJson);
    blocksGeoJson = skipLayer("contract_blocks")
      ? emptyFeatureCollection("contract_blocks_skipped")
      : await loadIgsLayer(igs.contractBlocks, "contract_blocks", localBlocksPromise, "合同区块", collection => {
      blocksGeoJson = collection;
      emitLayerProgress({ activeLayerLabel: "合同区块" });
    });
    if (blocksGeoJson.features?.length) saveCachedLayerEntry(igs, "contract_blocks", blocksGeoJson);
    fieldsGeoJson = skipLayer("fields")
      ? emptyFeatureCollection("fields_skipped")
      : await loadIgsLayer(igs.fields, "fields", localFieldsPromise, "油气田", collection => {
      fieldsGeoJson = collection;
      emitLayerProgress({ activeLayerLabel: "油气田" });
    });
    if (fieldsGeoJson.features?.length) saveCachedLayerEntry(igs, "fields", fieldsGeoJson);
    wellsGeoJson = skipLayer("wells")
      ? emptyFeatureCollection("wells_skipped")
      : await loadIgsLayer(igs.wells, "wells", localWellsPromise, "井位", collection => {
      wellsGeoJson = collection;
      emitLayerProgress({ activeLayerLabel: "井位" });
    });
    if (wellsGeoJson.features?.length) saveCachedLayerEntry(igs, "wells", wellsGeoJson);
    return { structuresGeoJson, wellsGeoJson, blocksGeoJson, fieldsGeoJson, layerSource: "service", layerDiagnostics };
  } catch (error) {
    return {
      structuresGeoJson: emptyFeatureCollection("basins_service_error"),
      wellsGeoJson: emptyFeatureCollection("wells_service_error"),
      blocksGeoJson: emptyFeatureCollection("contract_blocks_service_error"),
      fieldsGeoJson: emptyFeatureCollection("fields_service_error"),
      layerSource: "service-error",
      layerError: error.message,
      layerDiagnostics
    };
  }
}

export function deriveMetrics(state) {
  const featureCount = featureCollection => featureCollection?.features?.length || 0;
  const profileCount = data => Object.keys(data?.profiles || {}).length;
  const wellProfileCount = Object.keys(state.wellProfiles || {}).length;
  return {
    wellCount: featureCount(state.wellsGeoJson) || wellProfileCount || unique(state.logs.map(row => row.well_name).filter(Boolean)).length,
    basinCount: featureCount(state.structuresGeoJson) || profileCount(state.basinData),
    blockCount: featureCount(state.blocksGeoJson) || profileCount(state.blockData),
    fieldCount: featureCount(state.fieldsGeoJson) || profileCount(state.fieldData),
    blockProfileCount: Object.keys(state.blockData?.profiles || {}).length,
    contractProfileCount: Object.keys(state.contractData?.profiles || {}).length,
    fieldProfileCount: Object.keys(state.fieldData?.profiles || {}).length,
    logCount: state.logs.length,
    wellTableCount: Object.keys(state.dataInventory?.well_tables || {}).length,
    basinTableCount: Object.keys(state.dataInventory?.basin_tables || {}).length,
    blockTableCount: Object.keys(state.dataInventory?.block_tables || {}).length,
    contractTableCount: Object.keys(state.dataInventory?.contract_tables || {}).length,
    fieldTableCount: Object.keys(state.dataInventory?.field_tables || {}).length,
    layerCount: state.overview.layerCatalog?.length || 0
  };
}

function normalizeWellId(value) {
  if (value == null || value === "") return "";
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (Number.isInteger(numeric)) return String(numeric);
    return String(Number(numeric.toFixed(6)));
  }
  return String(value);
}

export function getWellRecords(state) {
  const features = state?.wellsGeoJson?.features || [];
  const profiles = state?.wellProfiles || {};
  const logs = state?.logs || [];
  const featureByName = new Map();
  for (const feature of features) {
    const name = feature.properties?.well_name;
    if (name && !featureByName.has(name)) featureByName.set(name, feature);
  }
  const names = unique([
    ...featureByName.keys(),
    ...Object.keys(profiles),
    ...logs.map(row => row.well_name)
  ].filter(Boolean)).sort((a, b) => a.localeCompare(b, "en"));

  return names.map(name => {
    const profile = profiles[name] || {};
    const feature = featureByName.get(name) || null;
    const featureProps = feature?.properties || {};
    const profileId = normalizeWellId(profile.wel_id);
    const featureId = normalizeWellId(featureProps.wel_id || featureProps.well_id || featureProps.objectid);
    const logRows = logs.filter(row => row.well_name === name);
    const logId = normalizeWellId(logRows[0]?.well_id);
    const wellId = profileId || featureId || logId;
    const rows = logs.filter(row => row.well_name === name || normalizeWellId(row.well_id) === wellId);

    return {
      value: name,
      name,
      wellId,
      label: wellId ? `${name} (${wellId})` : name,
      profile,
      feature,
      rows
    };
  });
}

export function getWellOptions(state) {
  return getWellRecords(state).map(record => ({
    value: record.value,
    label: record.label,
    row: record.rows[0] || record.feature?.properties || record.profile || {}
  }));
}

export async function loadAfricaIndex() {
  return loadJson("../data/africa_integrated_index.json");
}

function unloadedMapLayerState() {
  return {
    structuresGeoJson: emptyFeatureCollection("basins_not_loaded"),
    wellsGeoJson: emptyFeatureCollection("wells_not_loaded"),
    blocksGeoJson: emptyFeatureCollection("contract_blocks_not_loaded"),
    fieldsGeoJson: emptyFeatureCollection("fields_not_loaded"),
    layerSource: "not-loaded",
    layerDiagnostics: []
  };
}

async function restoreAllCachedLayers(state, options = {}) {
  const igs = state.serviceConfig?.igs;
  if (!igs) return { complete: false };
  const skipLayers = Array.isArray(options.skipLayers) ? options.skipLayers : [];
  const restoredLayers = [];
  const mapLayerState = {};
  let savedAt = Infinity;

  // Restore small layers first so the map becomes usable quickly; wells (largest) last.
  const restoreOrder = ["basins", "contract_blocks", "fields", "wells"];
  for (const featureType of restoreOrder) {
    if (skipLayers.includes(featureType)) continue;
    if (featureType === "wells") {
      const wellsResult = await restoreCachedWells(igs, options);
      if (!wellsResult.complete) return { complete: false };
      savedAt = Math.min(savedAt, wellsResult.savedAt);
      restoredLayers.push({ featureType: "wells", collection: wellsResult.collection });
      mapLayerState.wellsGeoJson = wellsResult.collection;
      continue;
    }
    const entry = await loadCachedLayerEntry(igs, featureType);
    if (!entry?.collection?.features?.length) return { complete: false };
    restoredLayers.push({ featureType, collection: entry.collection });
    mapLayerState[FEATURE_TYPE_TO_STATE_KEY[featureType]] = entry.collection;
    savedAt = Math.min(savedAt, entry.savedAt || 0);
    if (typeof options.onBatchLoaded === "function") {
      options.onBatchLoaded(featureType, entry.collection, {
        loadedCount: entry.collection.features?.length || 0,
        totalCount: entry.collection.features?.length || 0,
        done: true,
        sourceLabel: "本地缓存",
        cached: true
      });
    }
  }

  if (!restoredLayers.length) return { complete: false };

  if (typeof options.onLayerLoaded === "function") {
    options.onLayerLoaded();
  }
  return { complete: true, savedAt, mapLayerState };
}

async function restoreCachedWells(igs, options = {}) {
  try {
    const key = layerCacheKey(igs, "wells");
    const db = await openLayerCacheDb();
    const meta = await loadCachedRawEntry(db, `${key}:chunks`);
    if (!meta?.chunkCount) return { complete: false };
    const accumulated = [];
    let savedAt = meta.savedAt || 0;
    for (let index = 0; index < meta.chunkCount; index += 1) {
      const entry = await loadCachedRawEntry(db, `${key}:chunk:${index}`);
      if (!entry?.features?.length) return { complete: false };
      savedAt = Math.min(savedAt, entry.savedAt || 0);
      accumulated.push(...entry.features);
      if (typeof options.onBatchLoaded === "function") {
        options.onBatchLoaded("wells", {
          type: "FeatureCollection",
          name: "wells_cached",
          features: accumulated
        }, {
          loadedCount: accumulated.length,
          totalCount: accumulated.length,
          done: index === meta.chunkCount - 1,
          sourceLabel: "本地缓存",
          cached: true
        });
      }
      await yieldToBrowser();
    }
    return {
      complete: true,
      savedAt,
      collection: { type: "FeatureCollection", name: "wells_cached", features: accumulated }
    };
  } catch (error) {
    return { complete: false };
  }
}

function refreshMapLayersInBackground(state, options = {}) {
  if (state._layerRefreshPromise) return state._layerRefreshPromise;
  const silentOptions = {
    ...options,
    onBatchLoaded: undefined,
    onLayerLoaded: undefined,
    onLoadedSource: undefined
  };
  const promise = getLastLayerRefreshAt().then(lastRefreshAt => {
    if (Date.now() - lastRefreshAt < LAYER_REFRESH_GUARD_MS) {
      state._layerRefreshPromise = null;
      return state;
    }
    return setLastLayerRefreshAt().then(() => loadMapLayers(state.structure, state.logs, state.serviceConfig, silentOptions))
      .then(mapLayerState => {
        Object.assign(state, mapLayerState);
        state._layerRefreshPromise = null;
        if (typeof options.onRefreshed === "function") {
          try {
            options.onRefreshed(state);
          } catch (error) {
            // Display refresh errors must not break the background flow.
          }
        }
        return state;
      })
      .catch(() => {
        state._layerRefreshPromise = null;
        return state;
      });
  });
  state._layerRefreshPromise = promise;
  return promise;
}

function verifyLayerCountsInBackground(state, restoredState, options = {}) {
  getIgsLayerTotalCounts(state).then(counts => {
    let changed = false;
    for (const [stateKey, featureType] of Object.entries(STATE_KEY_TO_FEATURE_TYPE)) {
      const collection = restoredState[stateKey];
      if (!collection) continue;
      const expected = counts[featureType];
      if (expected && expected !== (collection.features?.length || 0)) {
        changed = true;
        break;
      }
    }
    if (changed) {
      refreshMapLayersInBackground(state, options);
    }
  }).catch(() => {
    // Count verification is best-effort; failures simply skip the freshness check.
  });
}

export async function loadMapLayersForState(state, options = {}) {
  const urlParams = getUrlParams();
  const noCache = options.useLayerCache === false || urlParams?.get("nocache") === "1";
  const forceRefresh = options.refreshCache === true || urlParams?.get("refresh") === "1";
  const useCache = state.serviceConfig?.enabled && !noCache;
  if (useCache) {
    await purgeOldLayerCache();
  }
  if (useCache) {
    const restored = await restoreAllCachedLayers(state, options);
    if (restored.complete) {
      Object.assign(state, restored.mapLayerState);
      state.layerSource = "service";
      state.layerSourceCached = true;
      const stale = forceRefresh || Date.now() - restored.savedAt > (options.cacheTtlMs ?? LAYER_CACHE_TTL_MS);
      if (!stale || options.refreshCache === false) {
        if (!stale) verifyLayerCountsInBackground(state, restored.mapLayerState, options);
        return state;
      }
      refreshMapLayersInBackground(state, options);
      return state;
    }
  }
  const mapLayerState = await loadMapLayers(state.structure, state.logs, state.serviceConfig, options);
  Object.assign(state, mapLayerState);
  state.layerSourceCached = false;
  return state;
}

export function forceRefreshMapLayers(state, options = {}) {
  if (state._layerRefreshPromise) return state._layerRefreshPromise;
  const promise = loadMapLayers(state.structure, state.logs, state.serviceConfig, {
    ...options,
    onBatchLoaded: options.onBatchLoaded,
    onLayerLoaded: options.onLayerLoaded
  }).then(mapLayerState => {
    Object.assign(state, mapLayerState);
    state.layerSource = "service";
    state.layerSourceCached = false;
    state._layerRefreshPromise = null;
    return state;
  }).catch(error => {
    state._layerRefreshPromise = null;
    throw error;
  });
  state._layerRefreshPromise = promise;
  return promise;
}

function pickFieldName(sourceConfig, candidates) {
  const outFields = (sourceConfig?.outFields || []).map(field => String(field));
  for (const candidate of candidates) {
    if (outFields.includes(candidate)) return candidate;
    const upper = candidate.toUpperCase();
    if (outFields.includes(upper)) return upper;
  }
  const hasUpperCase = outFields.some(field => field !== field.toLowerCase());
  return hasUpperCase ? candidates[0].toUpperCase() : candidates[0];
}

function escapeSqlValue(value) {
  return String(value).replace(/'/g, "''");
}

export function buildWhereForFilters(sourceConfig, filters = {}) {
  const parts = [];
  const addEquals = (candidates, value) => {
    if (!value) return;
    parts.push(`${pickFieldName(sourceConfig, candidates)} = '${escapeSqlValue(value)}'`);
  };
  addEquals(["country", "countries"], filters.country);
  addEquals(["basin_name", "bas_names", "basin"], filters.basin);
  addEquals(["block_name"], filters.block);
  addEquals(["operator"], filters.operator);
  if (filters.keyword) {
    const field = pickFieldName(sourceConfig, ["well_name", "field_name", "block_name", "basin_name"]);
    parts.push(`${field} like '%${escapeSqlValue(filters.keyword).replace(/%/g, "")}%'`);
  }
  return parts.length ? parts.join(" and ") : "1=1";
}

function getIgsLayerSources(igs, featureType) {
  const configKey = FEATURE_TYPE_TO_CONFIG_KEY[featureType] || featureType;
  const layerConfig = igs?.[configKey];
  if (!layerConfig) return [];
  return getIgsSources(layerConfig);
}

export async function queryIgsLayerForFilters(state, featureType, filters = {}, options = {}) {
  const config = state?.serviceConfig;
  if (!config?.enabled) return null;
  const igs = config.igs || {};
  const outSrs = igs.outSrs || "EPSG:4326";
  const pageSize = Number(igs.pageSize) || IGS_PAGE_SIZE;
  const maxPages = Number(options.maxPages) || 20;
  const pageConcurrency = Math.max(1, Math.min(Number(options.pageConcurrency) || Number(igs.pageConcurrency) || 4, 8));
  const onBatch = typeof options.onBatch === "function" ? options.onBatch : null;
  const sources = getIgsLayerSources(igs, featureType);
  if (!sources.length) return null;

  const collections = [];
  for (const sourceConfig of sources) {
    try {
      const where = buildWhereForFilters(sourceConfig, filters);
      const pages = [];
      const signatures = new Set();
      let pageIndex = 0;
      let reachedEnd = false;
      while (pageIndex < maxPages && !reachedEnd) {
        const wave = [];
        const waveSize = Math.min(pageConcurrency, maxPages - pageIndex);
        for (let index = 0; index < waveSize; index += 1) wave.push(pageIndex + index);
        const waveResults = await runWithConcurrency(wave, waveSize, async currentPage => {
          try {
            const response = await loadJson(buildIgsQueryUrl(
              igs.baseUrl,
              sourceConfig.serviceName,
              sourceConfig.layerId || "0",
              sourceConfig.outFields || "objectid",
              outSrs,
              IGS_FEATURE_FORMAT,
              { page: currentPage, pageSize, offset: currentPage * pageSize, where }
            ));
            return annotateFeatureCollection(normalizeIgsResponse(response, featureType), sourceConfig, featureType);
          } catch (error) {
            return emptyFeatureCollection(`${featureType}:${sourceConfig.serviceName}:filter-page-error`);
          }
        });
        for (const pageCollection of waveResults) {
          const pageCount = pageCollection.features?.length || 0;
          if (!pageCount) {
            reachedEnd = true;
            continue;
          }
          const signature = getFeaturePageSignature(pageCollection);
          if (signatures.has(signature)) {
            reachedEnd = true;
            continue;
          }
          signatures.add(signature);
          pages.push(pageCollection);
          if (pageCount < pageSize) reachedEnd = true;
        }
        pageIndex += wave.length;
        await yieldToBrowser();
        if (onBatch) {
          onBatch(mergeFeatureCollections(`${featureType}:${sourceConfig.serviceName}:filter`, pages), sourceConfig);
        }
      }
      collections.push(mergeFeatureCollections(`${featureType}:${sourceConfig.serviceName}:filter`, pages));
    } catch (error) {
      collections.push(emptyFeatureCollection(`${featureType}:${sourceConfig.serviceName}:filter-error`));
    }
  }
  const merged = mergeFeatureCollections(`${featureType}:filter`, collections);
  if (onBatch) onBatch(merged, null, true);
  return merged;
}

export async function getIgsLayerTotalCounts(state) {
  const counts = { wells: 0, basins: 0, contract_blocks: 0, fields: 0 };
  const config = state?.serviceConfig;
  if (!config?.enabled) return counts;
  const igs = config.igs || {};
  const outSrs = igs.outSrs || "EPSG:4326";
  for (const featureType of Object.keys(counts)) {
    const sources = getIgsLayerSources(igs, featureType);
    let total = 0;
    for (const sourceConfig of sources) {
      try {
        const response = await loadJson(buildIgsQueryUrl(
          igs.baseUrl,
          sourceConfig.serviceName,
          sourceConfig.layerId || "0",
          sourceConfig.outFields?.[0] || "objectid",
          outSrs,
          "json",
          { page: 0, pageSize: 1, returnCountOnly: true, returnGeometry: false, returnAttribute: false }
        ));
        total += Number(response?.count ?? response?.totalCount ?? 0);
      } catch (error) {
        // Count-only is optional; keep total at 0 so progress falls back to loaded-only display.
      }
    }
    counts[featureType] = total;
  }
  return counts;
}

export async function loadPlatformState(options = {}) {
  const includeMapLayers = options.includeMapLayers !== false;
  const [csvText, structure, overview, serviceConfig, wellProfiles, wellTables, basinData, blockData, contractData, fieldData, dataInventory, regionalStories] = await Promise.all([
    loadText("../data/well_logs.csv"),
    loadJson("../data/structure_base_table.json"),
    loadJson("../data/system_overview.json"),
    loadJson("../data/map_service_config.json"),
    loadJson("../data/well_excel_profiles.json"),
    loadJson("../data/well_integrated_tables.json"),
    loadJson("../data/basin_integrated_tables.json"),
    loadJson("../data/block_integrated_tables.json"),
    loadJson("../data/contract_integrated_tables.json"),
    loadJson("../data/field_integrated_tables.json"),
    loadJson("../data/data_inventory.json"),
    loadJson("../data/regional_story_africa.json")
  ]);

  const logs = parseCsv(csvText);
  const mapLayerState = includeMapLayers
    ? await loadMapLayers(structure, logs, serviceConfig)
    : unloadedMapLayerState();
  return {
    logs,
    structure,
    overview,
    serviceConfig,
    wellProfiles,
    wellTables,
    basinData,
    blockData,
    contractData,
    fieldData,
    dataInventory,
    regionalStories,
    ...mapLayerState
  };
}

