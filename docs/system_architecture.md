# 综合展示系统架构说明

## 目标

将当前会议展示原型扩展为可持续演进的系统雏形，既能支撑近期专题进展推进会，也能作为后续 Spring Boot + Vue + MapGIS 工程化建设的蓝图。

## 当前架构

```text
data/*.csv/json/geojson
  -> frontend/index.html + app.js
  -> Leaflet + MapGIS Leaflet Plugin
  -> 本地展示看板
```

同时预留 Spring Boot 接口骨架：

```text
backend-springboot/src/main/resources/data
  -> DemoDataController
  -> /api/well-logs
  -> /api/structures
  -> /api/progress
  -> /api/system-overview
  -> /api/map-layers
```

## 扩展后的模块

- 数据接入中心：统一接入测井数据、构造基础表和空间数据。
- 空间图层服务：先使用本地 GeoJSON，后续接入 GeoServer WMS/WFS 或 MapGIS IGServer。
- 测井分析看板：展示井位、测井曲线、解释结果和表格。
- 构造基础库：维护盆地、一级构造、二级构造、区块和层系属性。
- 会议汇报工作台：沉淀阶段成果、风险、协调事项和路线图。
- 后端接口服务：逐步从静态资源接口演进到数据库和服务代理。

## 推荐演进路线

```text
阶段 1：静态原型
  -> 保证会议能演示，所有数据本地可访问。

阶段 2：数据服务化
  -> Spring Boot 接管数据接口，GeoServer/MapGIS 接管空间图层。

阶段 3：前端工程化
  -> Vue 拆分地图、曲线、表格、治理、路线图组件。

阶段 4：生产化
  -> 数据库、权限、审计、日志、数据质量流程和运维监控。
```

## 后续建议

- 数据库优先考虑 PostgreSQL/PostGIS，方便同时管理业务属性和空间几何。
- 图层服务短期使用 GeoServer，具备 MapGIS 环境后再替换或并行接入 MapGIS 服务。
- 前端保持当前展示口径不变，逐步迁移为组件化实现，避免影响会议演示。
- 后端先补服务层和 DTO，再接入数据库，避免控制器直接承载复杂业务逻辑。
