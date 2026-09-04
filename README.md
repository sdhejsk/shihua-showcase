# 专题进展推进会展示项目

本项目根据聊天记录整理，用于四月份专题进展推进会前的可展示交付。当前已经从“最小展示原型”扩展为“综合展示系统雏形”，覆盖数据接入、空间图层、测井分析、构造基础库、会议汇报和后端接口边界。

## 已完成内容

- `data/well_logs.csv`：测井样例数据。
- `data/structure_base_table.json`：盆地/一级构造/二级构造基础数据表，含 50 个字段设计和样例记录。
- `frontend/index.html`：本地可视化展示看板，已用 MapGIS Client for JavaScript（Leaflet）前端组件做 WebGIS 展示原型。
- `data/wells.geojson`、`data/structures.geojson`：可导入 QGIS、也可发布到 GeoServer 的演示矢量数据。
- `backend-springboot/`：Spring Boot 后端接口骨架。
- `docs/progress_ppt_outline.md`：进展汇报 PPT 提纲。
- `data/system_overview.json`：系统模块、数据治理风险、路线图、接口和图层目录配置。

## 系统模块

当前页面已按后续工程化方向拆成 6 个模块：

- 数据接入中心：统一接入测井 CSV、构造基础表、GeoJSON/Shapefile 和后续数据库表。
- 空间图层服务：本地 GeoJSON 保底展示，后续通过 GeoServer 或 MapGIS IGServer 发布 WMS/WFS。
- 测井分析看板：展示井位、测井曲线、岩性解释和关键曲线指标。
- 构造基础库：维护盆地、一级构造、二级构造、区块、层系和资源潜力等字段。
- 会议汇报工作台：汇总阶段成果、问题清单、需协调事项和下一步计划。
- 后端接口服务：当前提供静态资源接口，后续演进为 Spring Boot + 数据库 + 权限 + MapGIS 服务代理。

## 快速运行

直接双击或用浏览器打开：

```bat
D:\shihua_pj\shihua_showcase\frontend\index.html
```

如需本地服务：

```bat
cd /d D:\shihua_pj\shihua_showcase
npm install
npm start
```

然后访问：

```text
http://localhost:5173/frontend/index.html
```

## 展示口径

当前环境没有 MapGIS 商业软件和授权，因此采用用户指定的开源/免费技术路线完成 Demo：

```text
QGIS 数据整理 → GeoServer 发布 WMS/WFS → MapGIS Client for JavaScript（Leaflet）前端组件展示
```

当前前端已经安装并引入：

```text
leaflet
@mapgis/webclient-leaflet-plugin
```

页面当前先加载本地 `data/wells.geojson` 和 `data/structures.geojson`，确保没有 GeoServer 时也能看到井位和构造范围展示。后续如果启动 GeoServer 并发布图层，可在 [frontend/js/map-page.js](D:/shihua_pj/shihua_showcase/frontend/js/map-page.js) 中修改：

当前已支持“服务优先，文件兜底”的方式：

1. 将 `Main_Basins.shp` 和 `Wells.shp` 发布到 GeoServer。
2. 修改 [map_service_config.json](D:/pythonProject/shihua_showcase/data/map_service_config.json) 中的地址、工作空间和图层名。
3. 将 `enabled` 改为 `true`。
4. 页面会优先通过 MapGIS IGServer FeatureServer 分页读取要素；如果服务不可用，会自动回退到本地 GeoJSON 演示数据。

详细步骤见：

- [geoserver_publish_guide.md](D:/shihua_pj/shihua_showcase/docs/geoserver_publish_guide.md)

如果后期具备真实 MapGIS 环境和授权，可将同样的思路替换为 MapGIS IGServer 图层服务。

## 后端接口边界

Spring Boot 骨架已预留以下接口：

- `GET /api/well-logs`：返回测井 CSV 样例数据。
- `GET /api/structures`：返回基础构造表 JSON。
- `GET /api/progress`：返回会议准备进展、问题和下一步计划。
- `GET /api/system-overview`：返回系统模块、质量风险、路线图和接口目录。
- `GET /api/map-layers`：返回地图图层目录和后续服务接入建议。

## 后续扩展建议

- 前端：从当前 HTML + 原生 JS 迁移为 Vue 工程，拆分地图、曲线、表格、治理、路线图等组件。
- 后端：接入 PostgreSQL/PostGIS 或已有业务数据库，把 CSV/JSON 替换为数据库查询。
- GIS：由 QGIS 整理真实数据，通过 GeoServer 或 MapGIS 服务发布 WMS/WFS。
- 数据治理：增加字段字典、数据质量校验、数据来源追踪、审核状态和版本记录。
- 会议材料：将系统截图、风险看板和路线图同步进 PPT。

## 建议会议展示顺序

1. 说明已梳理专题推进会准备任务和当前缺口。
2. 展示基础数据表字段设计，说明可支撑盆地、一级构造、二级构造、区块和数据质量管理。
3. 展示测井样例数据，说明井号、深度、GR、RT、RHOB、NPHI 等关键曲线。
4. 展示看板中的 MapGIS Leaflet 前端组件地图、井位点击属性、图层开关、测井曲线和表格。
5. 说明下一步接入 MapGIS、替换真实数据、完善 Spring Boot + Vue 工程化架构。
