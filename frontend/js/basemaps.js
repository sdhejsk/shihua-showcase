const TDT_SUBDOMAINS = ["0", "1", "2", "3", "4", "5", "6", "7"];

function tiandituWmtsUrl(layerCode, token = "") {
  const layerName = layerCode.split("_")[0];
  const key = token ? `&tk=${encodeURIComponent(token)}` : "";
  return `http://t{s}.tianditu.gov.cn/${layerCode}/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layerName}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}${key}`;
}

export const DEFAULT_ONLINE_BASEMAP_KEY = "tiandituVector";

export function getOnlineBasemaps(token = "") {
  return {
  tiandituImage: {
    name: "天地图影像",
    baseUrl: tiandituWmtsUrl("img_w", token),
    labelUrl: tiandituWmtsUrl("cia_w", token),
    baseAttribution: "天地图影像底图",
    labelAttribution: "天地图影像注记",
    subdomains: TDT_SUBDOMAINS
  },
  tiandituVector: {
    name: "天地图矢量",
    baseUrl: tiandituWmtsUrl("vec_w", token),
    labelUrl: tiandituWmtsUrl("cva_w", token),
    baseAttribution: "天地图矢量底图",
    labelAttribution: "天地图矢量注记",
    subdomains: TDT_SUBDOMAINS
  },
  tiandituTerrain: {
    name: "天地图地形",
    baseUrl: tiandituWmtsUrl("ter_w", token),
    labelUrl: tiandituWmtsUrl("cta_w", token),
    baseAttribution: "天地图地形晕渲",
    labelAttribution: "天地图地形注记",
    subdomains: TDT_SUBDOMAINS
  }
  };
}

export function getOnlineBasemapOptions() {
  return Object.entries(getOnlineBasemaps()).map(([key, item]) => ({ key, name: item.name }));
}

export function createOnlineBasemapLayers(LMap, key = DEFAULT_ONLINE_BASEMAP_KEY, token = "") {
  const basemaps = getOnlineBasemaps(token);
  const config = basemaps[key] || basemaps[DEFAULT_ONLINE_BASEMAP_KEY];
  const commonOptions = {
    maxZoom: 18,
    minZoom: 1,
    subdomains: config.subdomains
  };

  return {
    key,
    name: config.name,
    baseLayer: LMap.tileLayer(config.baseUrl, {
      ...commonOptions,
      attribution: config.baseAttribution
    }),
    labelLayer: LMap.tileLayer(config.labelUrl, {
      ...commonOptions,
      attribution: config.labelAttribution
    })
  };
}
