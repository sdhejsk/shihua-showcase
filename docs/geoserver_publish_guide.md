# Shapefile 发布为地图服务指南

## 目标

不再要求前端直接读取 `shp`，而是将以下数据发布成 GeoServer 或 MapGIS 服务：

- `Main_Basins.shp`：盆地/构造范围面图层
- `Wells.shp`：井位点图层

前端通过 WFS 读取要素，通过 WMS 叠加服务图层。

## 推荐发布命名

- 工作空间：`shihua`
- 盆地图层：`main_basins`
- 井位图层：`wells`

发布后前端配置文件应对应：

- [map_service_config.json](D:/pythonProject/shihua_showcase/data/map_service_config.json)

## GeoServer 发布步骤

1. 启动 GeoServer，打开管理页面。
2. 新建工作空间 `shihua`。
3. 新建 Store，类型选择 Shapefile。
4. 选择 `Main_Basins.shp` 所在路径，发布图层名为 `main_basins`。
5. 选择 `Wells.shp` 所在路径，发布图层名为 `wells`。
6. 在图层发布页面确认坐标系，优先使用 `EPSG:4326`。
7. 勾选启用 WMS 和 WFS。
8. 保存后测试以下地址是否可访问：

```text
http://localhost:8080/geoserver/shihua/wms
http://localhost:8080/geoserver/shihua/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=shihua:main_basins&outputFormat=application/json&srsName=EPSG:4326
http://localhost:8080/geoserver/shihua/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=shihua:wells&outputFormat=application/json&srsName=EPSG:4326
```

## 前端切换到服务模式

编辑：

- [map_service_config.json](D:/pythonProject/shihua_showcase/data/map_service_config.json)

将：

```json
"enabled": false
```

改为：

```json
"enabled": true
```

如果你的 GeoServer 地址、工作空间或图层名不同，也在这个文件里一起改掉。

## 页面运行逻辑

前端会按以下顺序加载：

```text
优先 WFS 读取盆地与井位要素
  -> 成功：地图直接使用服务要素
  -> 失败：自动回退到本地 GeoJSON 演示数据

可选勾选“服务面图层叠加”
  -> 叠加 WMS 图层
```

## 常见问题

### 1. WMS 有图，WFS 没数据

- 检查是否启用了 WFS。
- 检查 `typeName` 是否为 `工作空间:图层名`。
- 检查图层坐标系是否正确。

### 2. 页面提示已回退到本地演示数据

- 说明 WFS 地址不可访问或返回错误。
- 先在浏览器直接打开上面的 WFS URL 测试。

### 3. 图层发布后位置不对

- 检查 `.prj` 文件和 GeoServer 中声明的坐标系。
- 当前前端默认按 `EPSG:4326` 读取。

### 4. 井位能显示，曲线没变化

- 地图服务只负责空间图层。
- 测井曲线仍来自：
  - [well_logs.csv](D:/pythonProject/shihua_showcase/data/well_logs.csv)

如果后续要完全服务化，可以再把测井数据做成后端接口。
