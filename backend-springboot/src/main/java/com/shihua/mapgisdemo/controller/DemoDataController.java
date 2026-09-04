package com.shihua.mapgisdemo.controller;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DemoDataController {
    @GetMapping(value = "/api/well-logs", produces = "text/csv; charset=utf-8")
    public String wellLogs() throws IOException {
        return readClasspathText("data/well_logs.csv");
    }

    @GetMapping(value = "/api/structures", produces = MediaType.APPLICATION_JSON_VALUE)
    public String structures() throws IOException {
        return readClasspathText("data/structure_base_table.json");
    }

    @GetMapping(value = "/api/system-overview", produces = MediaType.APPLICATION_JSON_VALUE)
    public String systemOverview() throws IOException {
        return readClasspathText("data/system_overview.json");
    }

    @GetMapping("/api/map-layers")
    public Map<String, Object> mapLayers() {
        return Map.of(
            "currentMode", "Local GeoJSON fallback with optional GeoServer WMS overlay",
            "layers", List.of(
                Map.of(
                    "name", "构造范围图层",
                    "type", "Polygon",
                    "source", "data/structures.geojson",
                    "nextService", "GeoServer WMS/WFS 或 MapGIS IGServer"
                ),
                Map.of(
                    "name", "测井井位图层",
                    "type", "Point",
                    "source", "data/wells.geojson",
                    "nextService", "GeoServer WFS 或 MapGIS 要素服务"
                ),
                Map.of(
                    "name", "GeoServer WMS 图层",
                    "type", "Tile",
                    "source", "http://localhost:8080/geoserver/shihua/wms",
                    "nextService", "替换为实际服务地址和图层命名空间"
                )
            )
        );
    }

    @GetMapping("/api/progress")
    public Map<String, Object> progress() {
        return Map.of(
            "completed", List.of("测井样例数据", "50字段基础构造表", "本地展示看板", "后端接口骨架", "PPT提纲", "系统模块蓝图", "数据治理风险看板"),
            "issues", List.of("缺真实测井数据", "缺专家基础表模板", "缺 MapGIS 环境和授权", "尚未接入数据库和权限体系"),
            "nextPlan", List.of("接入真实 MapGIS 图层", "替换真实数据", "Vue 工程化改造", "完善会议 PPT", "补充数据库表结构和数据质量流程")
        );
    }

    private String readClasspathText(String location) throws IOException {
        var resource = new ClassPathResource(location);
        try (var input = resource.getInputStream()) {
            return StreamUtils.copyToString(input, StandardCharsets.UTF_8);
        }
    }
}
