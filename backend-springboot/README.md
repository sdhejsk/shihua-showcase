# Spring Boot 后端骨架

该目录提供后端接口设计骨架，便于后续按“Java Spring Boot + Vue + MapGIS”的建议继续工程化。

当前工作区没有 Maven/Gradle，因此这里先提供源码和 `pom.xml`。若后续安装 Maven，可执行：

```bat
cd /d E:\shihua_showcase\backend-springboot
mvn spring-boot:run
```

## 计划接口

- `GET /api/well-logs`：返回测井样例数据。
- `GET /api/structures`：返回盆地/一级构造/二级构造基础表。
- `GET /api/progress`：返回会议准备任务进展、问题和协调事项。
- `GET /api/system-overview`：返回系统模块、数据质量风险、路线图和接口目录。
- `GET /api/map-layers`：返回地图图层目录和后续 GeoServer/MapGIS 接入建议。

## 后续工程化方向

- 数据层：把 `src/main/resources/data` 下的 CSV/JSON 替换为数据库表或对象存储文件。
- 服务层：拆分测井数据服务、构造基础库服务、地图图层服务和进展管理服务。
- GIS：对接 GeoServer WMS/WFS 或 MapGIS IGServer，后端可作为服务地址配置与权限代理。
- 前端：将当前静态看板迁移到 Vue，按模块调用上述 REST API。
