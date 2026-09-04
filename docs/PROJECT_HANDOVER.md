# 石化地学数据展示平台交接文档

更新时间：2026-07-13
项目目录：`D:\shihua_pj\shihua_showcase`

## 1. 项目背景

本项目最初是围绕石化地学数据展示需求搭建的 Web 原型，早期目标偏向演示：把少量井位、盆地范围、测井样例和基础表格放到前端页面中，验证 MapGIS 前端组件、地图展示和数据可视化的基本可行性。

随着后续工作推进，项目已经从“演示 Demo”逐步扩展为一个面向真实资料管理和展示的平台原型。当前平台重点服务于石化地学数据的统一浏览、空间定位、专题资料查看、服务状态检查和评价算法试验，已不再只是单页展示页面。

目前平台的核心定位是：

- 以 MapGIS IGServer 为主要 GIS 服务来源。
- 以盆地、井、区块、合同、油气田等对象为组织中心。
- 以 Shapefile 发布服务 + Excel 专题表整理为主要数据接入方式。
- 以 Web 前端页面承载地图、对象详情、资料目录、评价算法和服务状态。
- 为后续接入更多石化数据对象、真实测井曲线和评价算法模块预留扩展空间。

## 2. 当前项目总体状态

项目目前处于“第一阶段平台原型基本完成，正在向数据治理和业务化展示深化”的状态。

已经完成的主链路包括：

- 本地 Node 服务启动前端页面。
- 前端通过 `/igs/` 代理访问本机 MapGIS IGServer。
- MapGIS IGServer 已作为主要空间服务来源。
- 盆地、井、区块、油气田空间数据已接入前端展示。
- 多类 Excel 专题表已整理为 JSON，并在平台中展示。
- 前端已经从早期单页演示重构为模块化页面结构。
- 初步建立评价算法模块，用于盆地、区块、油气田和井对象的综合评价试验。
- 最近修复了井资料页仍读取旧示例井的问题，使其优先展示真实井服务和真实井表资料。

当前还没有完全完成的部分包括：

- 真实 LAS、DLIS、LIS 等测井曲线文件尚未正式接入。
- 评价算法模块仍属于原型，需要继续补充专业指标、参数输入和专家校验。
- 部分页面的信息组织还需要继续统一和产品化。
- 数据更新、字段治理、服务发布规范还需要形成固定流程。

## 3. 技术架构

当前系统采用轻量前后端结构。

### 3.1 前端

前端位于：`frontend/`

主要技术：

- HTML
- CSS
- 原生 JavaScript 模块
- Leaflet
- `@mapgis/webclient-leaflet-plugin`

主要页面：

- `frontend/index.html`：数据概览首页。
- `frontend/data.html`：数据信息模块，统一查看盆地、区块、合同、油气田、井和目录。
- `frontend/evaluation.html`：评价算法模块。
- `frontend/services.html`：服务状态模块。
- `frontend/map.html`、`frontend/wells.html`、`frontend/blocks.html`、`frontend/catalog.html`：历史拆分页面或辅助页面，部分能力已整合进数据信息模块。

主要脚本：

- `frontend/js/core.js`：公共数据加载、MapGIS 服务读取、状态聚合、通用工具函数。
- `frontend/js/data-page.js`：数据信息模块主逻辑。
- `frontend/js/evaluation-page.js`：评价算法模块逻辑。
- `frontend/js/services-page.js`：服务状态页逻辑。
- `frontend/js/home-page.js`：首页概览逻辑。
- `frontend/js/wells-page.js`：井资料独立页逻辑。
- `frontend/js/map-page.js`：地图页逻辑。

### 3.2 后端/本地服务

当前后端不是完整业务后端，而是一个轻量 Node 静态服务。

核心文件：`server.js`

作用：

- 提供本地页面访问。
- 提供静态资源访问。
- 将 `/igs/` 开头的请求代理到 `http://localhost:8089`，即本机 MapGIS IGServer。

启动方式：

```powershell
cd D:\shihua_pj\shihua_showcase
npm start
```

启动后访问：

```text
http://localhost:5173/frontend/index.html
```

### 3.3 GIS 服务层

当前 GIS 服务优先使用 MapGIS IGServer。

配置文件：`data/map_service_config.json`

当前配置状态：

- `serviceMode`: `mapgis-igs`
- `enabled`: `true`
- `igs.baseUrl`: `/igs/rest/services`
- `igs.outSrs`: `EPSG:4326`

已配置的 MapGIS 服务：

- `wells`：井位点服务。
- `main_basins`：盆地面服务。
- `contract_blocks`：合同区块面服务。
- `fields`：油气田面服务。

前端访问 MapGIS 服务时，不直接访问 `localhost:8089`，而是通过 Node 代理访问：

```text
/igs/rest/services/{serviceName}/FeatureServer/query
```

这样可以减少跨域问题，也方便前端统一请求路径。

## 4. 数据组织方式

项目当前数据主要放在 `data/` 目录下，分为空间服务配置、回退空间数据、专题表整合数据、评价模型配置几类。

### 4.1 空间数据

空间数据原始来源主要是 Shapefile，包括 `.shp`、`.shx`、`.dbf`、`.prj`、`.cpg` 等文件。正式使用时，需要先在 MapGIS IGServer 中发布为要素服务，再由前端读取。

当前已接入的空间对象：

| 对象 | 服务名 | 几何类型 | 用途 |
|---|---|---|---|
| 井 | `wells` | Point | 展示井位、井基础属性、井资料入口 |
| 盆地 | `main_basins` | Polygon | 展示盆地范围、面积、分类、油气系统等 |
| 合同区块 | `contract_blocks` | Polygon | 展示区块边界、合同、权益、状态等 |
| 油气田 | `fields` | Polygon | 展示油气田范围、资源规模、生产状态等 |

本地还保留了回退数据：

- `data/wells.geojson`
- `data/structures.geojson`
- `data/fields.geojson`

这些主要用于 MapGIS 服务不可用时回退展示，不应作为正式数据主来源。

### 4.2 表格数据

Excel 表格数据已经被整理为 JSON，供前端直接读取。

主要文件：

- `data/well_excel_profiles.json`
- `data/well_integrated_tables.json`
- `data/basin_integrated_tables.json`
- `data/block_integrated_tables.json`
- `data/contract_integrated_tables.json`
- `data/field_integrated_tables.json`
- `data/data_inventory.json`

当前已整理的数据规模：

| 类型 | 已整理表数量 | 说明 |
|---|---:|---|
| 井 | 21 张 | 包含 basic、general、history、tests、tops、deviation、checkshot 等 |
| 盆地 | 11 张 | 包含 basic、general、lithostratigraphic、petroleum system、play 等 |
| 区块 | 6 张 | 包含 general、history、locations、outlines、scheduled events、company interests |
| 合同 | 10 张 | 包含 general、history、locations、commitments、company interests 等 |
| 油气田 | 17 张 | 包含 basic、general、production、reserve、events、interests 等 |

### 4.3 测井曲线数据

当前项目中存在：

- `data/well_logs.csv`

但它目前仍是样例曲线数据，主要用于曲线区域占位展示。真实测井曲线文件尚未正式接入。

后续如果要做真实曲线，应优先补充：

- LAS
- DLIS
- LIS
- ASCII 深度采样曲线
- 曲线字段说明和曲线道配置

## 5. 已完成工作

### 5.1 平台结构重构

已经将项目从早期偏演示的单页结构，重构为模块化平台结构。

当前主要模块包括：

- 数据概览
- 数据信息模块
- 评价算法模块
- 服务状态

其中“数据信息模块”已经成为当前最主要的数据工作区，集中承载盆地、区块、合同、油气田、井资料和数据目录。

### 5.2 MapGIS 服务接入

已完成 MapGIS IGServer 的接入链路：

- 本机启动 MapGIS IGServer。
- 在 IGServer 中发布 Shapefile 服务。
- 前端通过 Node 代理访问 `/igs/rest/services/...`。
- 前端优先读取 MapGIS 服务，服务异常时才使用本地回退数据。

已接入服务：

- `wells`
- `main_basins`
- `contract_blocks`
- `fields`

### 5.3 真实数据接入

已经接入的数据对象包括：

- 井数据
- 盆地数据
- 区块数据
- 合同数据
- 油气田数据

每类数据不仅有空间对象，还尽量整合了对应专题表。

### 5.4 数据信息模块建设

数据信息模块目前支持：

- 空间总览
- 盆地信息
- 区块信息
- 合同信息
- 油气田信息
- 井资料
- 对象目录

已实现的能力包括：

- 地图浏览。
- 图层开关。
- 按关键字、国家、盆地、区块、作业者筛选。
- 对象快速定位。
- 点击对象查看摘要。
- 选择对象查看详细资料。
- 展示专题表摘要。
- 展示对象目录和资料覆盖情况。

### 5.5 井资料修复

近期发现“井资料”页仍使用 `well_logs.csv` 中的旧示例井作为下拉框和默认展示，导致页面看不到真实井数据。

已完成修复：

- 新增真实井记录聚合逻辑。
- 井资料页优先使用 MapGIS `wells` 服务和 `well_excel_profiles.json`。
- 井档案、井史、专题资料按真实井名展示。
- 如果真实井没有曲线数据，则曲线区只显示空状态，不再强行显示旧示例井。

涉及文件：

- `frontend/js/core.js`
- `frontend/js/data-page.js`
- `frontend/js/wells-page.js`

### 5.6 评价算法模块原型

评价算法模块已完成初步原型。

当前支持对象：

- 盆地
- 区块
- 油气田
- 井

当前模块主要用于：

- 展示评价对象。
- 组织评价指标。
- 设置权重和参数。
- 计算综合得分。
- 展示分项得分和等级建议。

配置文件：

- `data/evaluation_models.json`

需要注意：当前评价算法仍是原型，指标、权重和解释逻辑还需要结合石化专业知识继续校正。

### 5.7 服务状态模块

服务状态模块用于查看：

- REST API 列表。
- MapGIS 图层列表。
- 本地回退图层。
- 专题表文件覆盖情况。
- 当前数据治理风险。

对应页面：

- `frontend/services.html`

对应脚本：

- `frontend/js/services-page.js`

## 6. 当前主要模块说明

### 6.1 数据概览

入口页面，用于快速查看平台已经接入了哪些对象、多少数据、有哪些模块、当前数据质量风险在哪里。

适合用于项目汇报和快速了解系统整体情况。

### 6.2 数据信息模块

当前最核心的业务模块。

包含：

- 空间总览：地图、图层、筛选、定位。
- 盆地信息：盆地基础资料、油气系统、play、地层摘要。
- 区块信息：区块基础属性、历史、计划事件、公司权益。
- 合同信息：合同基础信息、历史、计划事件、权益、承诺。
- 油气田信息：基础属性、资源生产、事件、公司权益。
- 井资料：井档案、井史、专题资料、曲线区。
- 数据目录：对象清单和资料覆盖情况。

### 6.3 评价算法模块

用于探索石化领域评价算法的平台化实现。

当前更适合看作“评价算法试验台”，后续需要继续做：

- 更清晰的参数输入入口。
- 更专业的评价指标体系。
- 更可信的权重来源。
- 与真实对象数据的深度绑定。
- 评价结果地图化展示。

### 6.4 服务状态模块

用于辅助排查系统运行状态。

重点关注：

- MapGIS IGServer 是否可用。
- 前端是否读取真实服务还是本地回退数据。
- 当前有哪些图层配置。
- 哪些专题表已经整理。
- 哪些数据质量问题需要继续处理。

## 7. 当前运行方式

### 7.1 启动 MapGIS IGServer

需要先确认 MapGIS IGServer 已启动。

常用访问地址：

```text
http://localhost:8089/igs/manager/dashboard
```

如果打不开，通常说明 IGServer 没有启动或端口异常。

### 7.2 启动本项目

进入项目目录：

```powershell
cd D:\shihua_pj\shihua_showcase
npm start
```

访问前端：

```text
http://localhost:5173/frontend/index.html
```

### 7.3 检查服务是否读取真实数据

重点看：

- 地图上是否显示真实盆地、真实井、真实区块、真实油气田。
- 服务状态页是否显示 MapGIS 服务。
- 页面是否出现“本地回退”提示。
- 井资料页是否仍出现 `石化-示例井1`，如果出现说明缓存或曲线样例仍在被展示。

## 8. 后续计划

### 8.1 短期任务，1-2 周

建议优先做以下工作：

1. 梳理数据信息模块页面结构。
2. 统一盆地、井、区块、合同、油气田的详情页展示风格。
3. 补强井资料页，把井史、测试、tops、井斜、checkshot 做成更清楚的分组视图。
4. 检查所有下拉框和对象目录是否都优先使用真实服务和真实表数据。
5. 完善服务状态页，让它能更直观显示“真实服务/本地回退/服务异常”。
6. 继续清理老 demo 文案和旧示例数据影响。
7. 整理一份数据接入规范，明确 Shapefile 和 Excel 如何命名、放置、发布、配置和验证。

### 8.2 中期任务，2-4 周

建议推进：

1. 接入真实测井曲线文件。
2. 重构评价算法模块，使其支持参数输入、点击计算、结果解释和结果对比。
3. 建立对象关系，比如盆地-区块-合同-油气田-井之间的联动关系。
4. 增加专题地图，比如按油气类型、作业者、状态、资源规模、区块有效期等着色展示。
5. 增加更多数据对象，比如公司、储层、远景圈闭、油气系统、play 等。

### 8.3 长期任务，1-2 月

建议考虑：

1. 从静态 JSON 逐步升级到数据库存储。
2. 引入正式后端服务，统一管理数据、权限、算法和日志。
3. 完善用户权限和数据安全控制。
4. 建立数据版本管理和更新流程。
5. 形成可部署、可演示、可持续扩展的平台版本。

## 9. 需要注意的事项

### 9.1 项目路径已经变更

当前项目路径是：

```text
D:\shihua_pj\shihua_showcase
```

旧路径 `D:\pythonProject\shihua_showcase` 已不可用或不应再作为主路径使用。

如果运行或编辑时出现目录无效，需要检查工具、终端或 IDE 是否仍指向旧目录。

### 9.2 MapGIS 服务是正式空间数据主来源

当前正式空间数据应优先来自 MapGIS IGServer，而不是本地 GeoJSON。

本地 GeoJSON 只是回退数据，不能代表正式展示效果。

### 9.3 Shapefile 更新后需要重新发布或刷新服务

如果替换了 `.shp/.dbf/.shx/.prj` 文件内容，即使文件名不变，也建议在 MapGIS IGServer 中检查服务是否读取了新内容。

稳妥流程：

1. 停止或删除旧服务。
2. 用新 Shapefile 重新发布服务。
3. 确认服务字段和范围。
4. 打开 query 页面检查返回数据。
5. 前端强制刷新。

### 9.4 字段名非常关键

前端展示依赖字段名，例如：

- 井：`well_name`、`basin_name`、`operator`、`td_m`、`tvd_meter`、`wel_id`、`lat_dec`、`long_dec`
- 盆地：`basin_name`、`countries`、`king_class`、`bs_skm`、`bs_dp_wat`
- 区块：`block_name`、`contract`、`country`、`bas_names`、`operator`、`blk_sqkm`
- 油气田：`field_name`、`countries`、`basin_name`、`opr_curr`、`prod_stat`、`hc_type`

如果重新下载数据后字段名变化，前端可能无法正确显示。

### 9.5 井曲线仍是薄弱环节

当前井资料已经能展示真实井档案和专题表，但测井曲线仍没有真实生产级接入。

不要把当前 `well_logs.csv` 理解为正式曲线数据，它主要是样例占位。

### 9.6 评价算法需要专业校验

当前评价算法模块已经有平台结构和配置思路，但石化评价算法不能只靠前端规则拼出来。

后续应补充：

- 指标来源。
- 权重依据。
- 专家意见。
- 计算公式。
- 结果解释。
- 样本验证。

### 9.7 README 可能不是最新状态

项目早期 README 还保留了一些 demo 阶段描述。后续建议更新 README，使其与当前模块化平台状态一致。

## 10. 建议交接后的第一轮检查清单

接手后建议按以下顺序检查：

1. 确认项目路径是 `D:\shihua_pj\shihua_showcase`。
2. 启动 MapGIS IGServer。
3. 打开 `http://localhost:8089/igs/manager/dashboard`。
4. 确认 `wells`、`main_basins`、`contract_blocks`、`fields` 服务存在。
5. 启动项目：`npm start`。
6. 打开 `http://localhost:5173/frontend/index.html`。
7. 查看数据信息模块的空间总览。
8. 检查井资料页是否显示真实井。
9. 检查服务状态页是否显示 MapGIS 服务。
10. 检查评价算法模块是否能正常切换对象和计算。

## 11. 当前项目一句话总结

本项目已经完成了石化地学数据展示平台的第一阶段建设，打通了真实空间服务发布、专题表资料整合、模块化前端展示、对象详情浏览和评价算法原型这条主链路，后续重点是继续提升数据治理、真实曲线接入、评价算法专业化和系统产品化程度。
