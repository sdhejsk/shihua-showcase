import { formatNumber, loadPlatformState, renderShell, safeText, unique } from "./core.js";

const MODEL_PARAMETER_SCHEMAS = {
  "basin-potential": {
    objectLabel: "盆地",
    intro: "面向区域资源潜力识别，重点考察盆地规模、含油气系统、play 与地层组合、勘探活动背景和资料支撑程度。",
    parameters: [
      { key: "areaReferenceSqkm", label: "规模基准面积", type: "number", min: 1000, step: 1000, default: 120000, suffix: "km²", help: "面积达到该基准时，规模容量维度接近满分。" },
      { key: "petroleumSystemTarget", label: "含油气系统目标数", type: "number", min: 1, step: 1, default: 4, help: "用于衡量成藏系统丰富度。" },
      { key: "playRichnessTarget", label: "play/地层组合目标值", type: "number", min: 1, step: 1, default: 12, help: "综合 play、地层单元和成因单元的目标参考值。" },
      { key: "activityTarget", label: "勘探活动目标值", type: "number", min: 1, step: 1, default: 30, help: "同盆地内井、区块、油气田对象数的目标参考值。" },
      { key: "dataSupportTarget", label: "资料支撑目标值", type: "number", min: 1, step: 1, default: 25, help: "图件、地层摘要、生产储量摘要等支撑点数目标。" }
    ]
  },
  "block-exploration": {
    objectLabel: "区块",
    intro: "面向区块勘探与投资优选，重点关注合同阶段、面积保有、作业条件、活动强度、权益结构和周边发现背景。",
    parameters: [
      { key: "areaReferenceSqkm", label: "区块面积基准", type: "number", min: 10, step: 10, default: 1200, suffix: "km²", help: "区块面积达到该基准时，面积潜力维度接近满分。" },
      { key: "remainingAreaTargetPct", label: "原始面积保有参考值", type: "number", min: 1, max: 100, step: 1, default: 75, suffix: "%", help: "保有比例越高，说明区块后续工作空间越大。" },
      { key: "historyEventTarget", label: "历史事件目标数", type: "number", min: 1, step: 1, default: 4, help: "用于衡量区块活动阶段和演化丰富度。" },
      { key: "scheduledEventTarget", label: "计划事件目标数", type: "number", min: 1, step: 1, default: 3, help: "用于衡量区块近期活动与时效性。" },
      { key: "nearbyWellTarget", label: "周边井参考值", type: "number", min: 1, step: 1, default: 15, help: "以同盆地或同合同背景下的井对象数量作为周边约束参考。" },
      { key: "nearbyFieldTarget", label: "周边油气田参考值", type: "number", min: 1, step: 1, default: 6, help: "用于衡量区块周边发现背景和开发成熟度。" },
      { key: "shallowWaterThresholdM", label: "浅水上限", type: "number", min: 0, step: 10, default: 200, suffix: "m", help: "浅水以下通常认为工程进入条件更友好。" },
      { key: "deepWaterThresholdM", label: "深水分界", type: "number", min: 100, step: 50, default: 800, suffix: "m", help: "超过该值后，作业条件会显著降低评分。" }
    ]
  },
  "field-development": {
    objectLabel: "油气田",
    intro: "面向油气田开发价值判断，重点考察资源规模、开发阶段、生产基础、储层支撑、商业结构与作业条件。",
    parameters: [
      { key: "recoverableReferenceMmboe", label: "总可采当量基准", type: "number", min: 1, step: 1, default: 120, suffix: "MMboe", help: "总可采当量达到该值时，资源规模维度接近满分。" },
      { key: "reservoirTarget", label: "储层目标数", type: "number", min: 1, step: 1, default: 3, help: "用于衡量储层支撑丰富度。" },
      { key: "productionRecordTarget", label: "生产记录目标值", type: "number", min: 1, step: 1, default: 8, help: "综合年产、累计产量、汇总生产和储量历史记录数。" },
      { key: "companyInterestTarget", label: "权益结构目标数", type: "number", min: 1, step: 1, default: 4, help: "权益和经营主体信息越完整，商业结构支撑越强。" },
      { key: "shallowWaterThresholdM", label: "浅水上限", type: "number", min: 0, step: 10, default: 200, suffix: "m", help: "用于判断海上作业条件。" },
      { key: "deepWaterThresholdM", label: "深水分界", type: "number", min: 100, step: 50, default: 1000, suffix: "m", help: "深水条件下工程难度和成本压力会增加。" }
    ]
  },
  "well-support": {
    objectLabel: "井",
    intro: "面向单井资料支撑能力评价，重点考察档案完整性、井史丰富度、测试分层支撑、测量资料、辅助资料和曲线覆盖程度。",
    parameters: [
      { key: "profileFieldTarget", label: "档案字段目标数", type: "number", min: 1, step: 1, default: 14, help: "井档案中关键字段达到该数量时，档案完整性较高。" },
      { key: "historyEventTarget", label: "井史事件目标数", type: "number", min: 1, step: 1, default: 4, help: "井史和作业周期记录越丰富，支撑越充分。" },
      { key: "testTarget", label: "测试/分层目标值", type: "number", min: 1, step: 1, default: 6, help: "综合测试、层顶、地层记录的目标参考值。" },
      { key: "surveyTarget", label: "测量资料目标值", type: "number", min: 1, step: 1, default: 2, help: "井斜与 checkshot 等测量资料覆盖目标。" },
      { key: "ancillaryTarget", label: "辅助资料目标值", type: "number", min: 1, step: 1, default: 5, help: "样品、设备、文献、成本等辅助资料数量目标。" },
      { key: "logPointTarget", label: "曲线采样点目标数", type: "number", min: 1, step: 1, default: 20, help: "曲线采样点数越高，曲线支撑越充分。" }
    ]
  }
};

const SCORE_CLASSES = {
  priority: "grade-priority",
  good: "grade-good",
  watch: "grade-watch",
  gap: "grade-gap"
};

const state = {
  root: null,
  platform: null,
  models: [],
  recordsByModel: {},
  currentModelId: null,
  parametersByModel: {},
  weightsByModel: {},
  gradesByModel: {},
  filters: {
    keyword: "",
    country: "全部国家",
    grade: "全部等级",
    topN: 20
  },
  evaluationResults: null,
  activeResultId: null
};

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）\-_/]/g, "");
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "" && value !== "-" && value !== "null";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function splitNames(value) {
  return String(value ?? "")
    .split(/[~;/|]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function containsName(haystack, needle) {
  if (!haystack || !needle) return false;
  const target = normalizeText(needle);
  return splitNames(haystack).some(item => normalizeText(item) === target);
}

function ratioScore(value, target, floor = 25) {
  const numeric = toNumber(value);
  const reference = toNumber(target);
  if (!reference || reference <= 0 || numeric === null) return floor;
  return Math.max(floor, Math.min(100, (numeric / reference) * 100));
}

function countScore(value, target, floor = 20) {
  return ratioScore(value, target, floor);
}

function inverseScore(value, goodThreshold, badThreshold, floor = 25) {
  const numeric = toNumber(value);
  const good = toNumber(goodThreshold);
  const bad = toNumber(badThreshold);
  if (numeric === null || good === null || bad === null || bad <= good) return floor;
  if (numeric <= good) return 100;
  if (numeric >= bad) return floor;
  const ratio = (bad - numeric) / (bad - good);
  return floor + ratio * (100 - floor);
}

function categoryScore(value, mapping, fallback = 45) {
  const normalized = normalizeText(value);
  const hit = Object.entries(mapping).find(([key]) => normalized.includes(key));
  return hit ? hit[1] : fallback;
}

function averageScore(items, fallback = 0) {
  if (!items.length) return fallback;
  return items.reduce((sum, value) => sum + value, 0) / items.length;
}

function gradeClass(label) {
  if (label.startsWith("I类")) return SCORE_CLASSES.priority;
  if (label.startsWith("II类")) return SCORE_CLASSES.good;
  if (label.startsWith("III类")) return SCORE_CLASSES.watch;
  return SCORE_CLASSES.gap;
}

function findFeatureByName(featureCollection, keys, name) {
  const target = normalizeText(name);
  return (featureCollection?.features || []).find(feature => keys.some(key => normalizeText(feature.properties?.[key]) === target));
}

function getModelsFallback() {
  return [
    {
      id: "basin-potential",
      name: "盆地资源潜力评价",
      objectType: "盆地",
      method: "专家赋权综合评价法",
      description: "区域资源潜力识别。",
      inputs: [],
      dimensions: [
        { key: "scale_capacity", label: "规模容量", weight: 0.24, description: "" },
        { key: "petroleum_system", label: "含油气系统支撑", weight: 0.24, description: "" },
        { key: "play_richness", label: "play与地层丰富度", weight: 0.18, description: "" },
        { key: "exploration_activity", label: "勘探活动背景", weight: 0.18, description: "" },
        { key: "data_support", label: "资料支撑度", weight: 0.16, description: "" }
      ],
      grades: [
        { min: 85, label: "I类 优先", advice: "优先推进。" },
        { min: 70, label: "II类 良好", advice: "持续跟踪。" },
        { min: 55, label: "III类 关注", advice: "补充关键资料。" },
        { min: 0, label: "IV类 补充资料", advice: "先补齐资料。" }
      ]
    }
  ];
}

async function loadModels() {
  try {
    const response = await fetch("../data/evaluation_models.json");
    if (!response.ok) throw new Error("无法加载评价模型配置");
    const payload = await response.json();
    return payload.models || getModelsFallback();
  } catch (error) {
    return getModelsFallback();
  }
}

function countFilledFields(record, fields) {
  return fields.reduce((total, field) => total + (hasValue(record?.[field]) ? 1 : 0), 0);
}

function createBasinRecords(platform) {
  const profiles = platform.basinData?.profiles || {};
  const tables = platform.basinData?.tables || {};
  const wells = platform.wellProfiles || {};
  const blocks = platform.blockData?.profiles || {};
  const fields = platform.fieldData?.profiles || {};

  return Object.entries(profiles).map(([name, profile]) => {
    const feature = findFeatureByName(platform.structuresGeoJson, ["basin_name"], name);
    const table = tables[name] || {};
    const wellCount = Object.values(wells).filter(row => normalizeText(row.basin_name) === normalizeText(name)).length;
    const blockCount = Object.values(blocks).filter(row => containsName(row.basin_names, name)).length;
    const fieldCount = Object.values(fields).filter(row => normalizeText(row.basin_name) === normalizeText(name)).length;
    const petroleumSystemCount = table.petroleum_systems?.length || 0;
    const playCount = table.plays?.length || 0;
    const lithostratCount = table.lithostrat_summary?.length || 0;
    const geneticUnitCount = table.genetic_units?.length || 0;
    const reserveSummary = table.reserves_production?.[0] || {};
    const reserveRecordCount = Object.values(reserveSummary).filter(hasValue).length;
    const imagesCount = toNumber(table.images_count) || 0;

    return {
      id: name,
      name,
      country: profile.country_names || "未提供",
      subtitle: `${safeText(profile.kingston_class || profile.klemme_class || profile.bally_snelson_class)} / 面积 ${formatNumber(profile.basin_sqkm, 1)} km²`,
      feature,
      profile,
      table,
      metrics: {
        areaSqkm: toNumber(profile.basin_sqkm) || toNumber(feature?.properties?.bs_skm) || 0,
        petroleumSystemCount,
        playCount,
        lithostratCount,
        geneticUnitCount,
        activityCount: wellCount + blockCount + fieldCount,
        wellCount,
        blockCount,
        fieldCount,
        supportPointCount: imagesCount + lithostratCount + reserveRecordCount + geneticUnitCount,
        imagesCount,
        reserveRecordCount,
        recoverableMmboe: toNumber(reserveSummary.total_recoverable_pp_mmboe) || 0,
        fieldDiscoveryCount: toNumber(reserveSummary.number_of_fields) || fieldCount
      },
      summary: {
        parentBasin: profile.parent_basin_name || "-",
        ageRange: `${safeText(profile.basin_old_age)} - ${safeText(profile.basin_young_age)}`,
        type: safeText(profile.bally_snelson_class || profile.kingston_class || profile.klemme_class),
        fields: toNumber(reserveSummary.number_of_fields) || fieldCount
      }
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

function createBlockRecords(platform) {
  const profiles = platform.blockData?.profiles || {};
  const tables = platform.blockData?.tables || {};
  const wells = platform.wellProfiles || {};
  const fields = platform.fieldData?.profiles || {};

  return Object.entries(profiles).map(([name, profile]) => {
    const feature = findFeatureByName(platform.blocksGeoJson, ["block_name", "con_blk_nm"], name);
    const table = tables[name] || {};
    const basinNames = splitNames(profile.basin_names || "");
    const nearbyWellCount = Object.values(wells).filter(row => containsName(row.block_name, name) || basinNames.some(basin => normalizeText(row.basin_name) === normalizeText(basin))).length;
    const nearbyFieldCount = Object.values(fields).filter(row => containsName(row.current_contract_blocks, name) || basinNames.some(basin => normalizeText(row.basin_name) === normalizeText(basin))).length;
    const companyInterestCount = table.company_interests?.length || 0;
    const historyCount = table.history?.length || 0;
    const scheduledCount = table.scheduled_events?.length || 0;
    const location = table.locations?.[0] || {};

    return {
      id: name,
      name,
      country: profile.country_name || "未提供",
      subtitle: `${safeText(profile.contract_status)} / ${safeText(profile.onshore_offshore)} / ${formatNumber(profile.block_sqkm, 1)} km²`,
      feature,
      profile,
      table,
      metrics: {
        stageNumber: toNumber(profile.stage_numb) || 0,
        areaSqkm: toNumber(profile.block_sqkm) || toNumber(feature?.properties?.blk_sqkm) || 0,
        remainingPct: toNumber(profile.pct_original_area_remaining) || 0,
        minWaterDepthM: toNumber(profile.min_water_depth_meter) || toNumber(location.min_water_depth_meter),
        medianWaterDepthM: toNumber(profile.median_water_depth_meter) || toNumber(location.median_water_depth_meter),
        maxWaterDepthM: toNumber(profile.max_water_depth_meter) || toNumber(location.max_water_depth_meter),
        companyInterestCount,
        historyCount,
        scheduledCount,
        nearbyWellCount,
        nearbyFieldCount
      },
      summary: {
        operator: safeText(profile.operator_name),
        basinNames: profile.basin_names || "-",
        status: safeText(profile.contract_status || profile.block_status),
        rightsType: safeText(profile.rights_type)
      }
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

function createFieldRecords(platform) {
  const profiles = platform.fieldData?.profiles || {};
  const tables = platform.fieldData?.tables || {};

  return Object.entries(profiles).map(([name, profile]) => {
    const feature = findFeatureByName(platform.fieldsGeoJson, ["field_name"], name);
    const table = tables[name] || {};
    const productionSummary = table.production_summary || {};
    const companyInterestCount = table.company_interests?.length || 0;
    const reservoirInterestCount = table.reservoir_company_interests?.length || 0;
    const eventCount = table.events?.length || 0;
    const reserveHistoryCount = table.reserve_history?.length || 0;
    const productionRecordCount =
      (table.annual_production?.length || 0) +
      (table.cumulative_production?.length || 0) +
      (table.aggregated_production?.length || 0) +
      reserveHistoryCount;

    return {
      id: name,
      name,
      country: profile.country_names || "未提供",
      subtitle: `${safeText(profile.prod_status)} / ${safeText(profile.hc_type)} / 可采当量 ${formatNumber(profile.total_recoverable_mmboe, 2)} MMboe`,
      feature,
      profile,
      table,
      metrics: {
        totalRecoverableMmboe: toNumber(profile.total_recoverable_mmboe) || 0,
        reservoirCount: toNumber(profile.number_of_reservoirs) || 0,
        waterDepthMaxM: toNumber(profile.water_depth_max_meter) || toNumber(feature?.properties?.wd_max_m),
        companyInterestCount,
        reservoirInterestCount,
        eventCount,
        reserveHistoryCount,
        productionRecordCount,
        imagesCount: toNumber(table.counts?.images) || 0,
        bibliographyCount: toNumber(table.counts?.bibliography) || 0,
        currentOperatorCount: splitNames(profile.current_operators).length,
        contractBlockCount: splitNames(profile.current_contract_blocks).length
      },
      summary: {
        basin: safeText(profile.basin_name),
        operator: safeText(profile.current_operators || profile.company_name),
        resource: safeText(profile.resource_type),
        development: safeText(profile.prod_status)
      }
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

function createWellRecords(platform) {
  const profiles = platform.wellProfiles || {};
  const tables = platform.wellTables || {};
  const logs = platform.logs || [];

  return Object.entries(profiles).map(([name, profile]) => {
    const feature = findFeatureByName(platform.wellsGeoJson, ["well_name"], name);
    const table = tables[name] || {};
    const logPointCount = logs.filter(row => normalizeText(row.well_name) === normalizeText(name)).length;
    const deviationPoints = toNumber(table.deviation_summary?.point_count) || 0;
    const checkshotPoints = toNumber(table.checkshot_summary?.point_count) || 0;
    const profileFieldCount = countFilledFields(profile, [
      "well_name",
      "country",
      "basin_name",
      "operator_name",
      "onshore_offshore",
      "terrain",
      "well_class",
      "technical_status",
      "general_status",
      "content",
      "td_meter",
      "tvd_meter",
      "water_depth_meter",
      "block_name",
      "contract_name",
      "field_name"
    ]);

    return {
      id: name,
      name,
      country: profile.country || "未提供",
      subtitle: `${safeText(profile.technical_status)} / 总井深 ${formatNumber(profile.td_meter, 1)} m`,
      feature,
      profile,
      table,
      metrics: {
        profileFieldCount,
        periodCount: table.periods?.length || 0,
        testCount: table.tests?.length || 0,
        topCount: table.tops?.length || 0,
        stratigraphyCount: table.stratigraphy?.length || 0,
        surveyPointCount: deviationPoints + checkshotPoints,
        deviationPoints,
        checkshotPoints,
        samplingCount: toNumber(table.sampling_count) || 0,
        equipmentCount: toNumber(table.equipment_count) || 0,
        bibliographyCount: toNumber(table.bibliography_count) || 0,
        costCount: table.costs?.length || 0,
        logPointCount
      },
      summary: {
        basin: safeText(profile.basin_name),
        block: safeText(profile.block_name),
        operator: safeText(profile.operator_name),
        class: safeText(profile.well_class)
      }
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

function buildRecordCollections(platform) {
  return {
    "basin-potential": createBasinRecords(platform),
    "block-exploration": createBlockRecords(platform),
    "field-development": createFieldRecords(platform),
    "well-support": createWellRecords(platform)
  };
}

function initializeModelState(model) {
  const schema = MODEL_PARAMETER_SCHEMAS[model.id];
  if (!state.parametersByModel[model.id]) {
    state.parametersByModel[model.id] = Object.fromEntries(
      (schema?.parameters || []).map(parameter => [parameter.key, parameter.default])
    );
  }
  if (!state.weightsByModel[model.id]) {
    state.weightsByModel[model.id] = Object.fromEntries(model.dimensions.map(dimension => [dimension.key, dimension.weight]));
  }
  if (!state.gradesByModel[model.id]) {
    state.gradesByModel[model.id] = model.grades.map(grade => ({ ...grade }));
  }
}

function getNormalizedWeights(weightMap) {
  const entries = Object.entries(weightMap).map(([key, value]) => [key, Math.max(0, toNumber(value) || 0)]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  return Object.fromEntries(entries.map(([key, value]) => [key, value / total]));
}

function getSortedGrades(grades) {
  return [...grades].map(item => ({ ...item, min: toNumber(item.min) ?? 0 })).sort((a, b) => b.min - a.min);
}

function resolveGrade(score, grades) {
  const sorted = getSortedGrades(grades);
  return sorted.find(item => score >= item.min) || sorted[sorted.length - 1];
}

function buildDimension(model, key, score, normalizedWeight, evidence, dataSupport, formula) {
  const dimension = model.dimensions.find(item => item.key === key);
  return {
    key,
    label: dimension?.label || key,
    description: dimension?.description || "",
    weight: normalizedWeight,
    score: Math.round(score * 10) / 10,
    evidence,
    dataSupport,
    formula
  };
}

function evaluateBasinRecord(model, record, parameters, normalizedWeights, grades) {
  const m = record.metrics;
  const scaleScore = ratioScore(m.areaSqkm, parameters.areaReferenceSqkm);
  const petroleumScore = averageScore([
    countScore(m.petroleumSystemCount, parameters.petroleumSystemTarget),
    ratioScore(m.recoverableMmboe, 220),
    countScore(m.fieldDiscoveryCount, 10)
  ], 30);
  const playScore = averageScore([
    countScore(m.playCount + m.geneticUnitCount, parameters.playRichnessTarget),
    countScore(m.lithostratCount, parameters.playRichnessTarget),
    countScore(m.geneticUnitCount, 8)
  ], 25);
  const activityScore = averageScore([
    countScore(m.activityCount, parameters.activityTarget),
    countScore(m.wellCount, 12),
    countScore(m.fieldCount, 6)
  ], 25);
  const supportScore = averageScore([
    countScore(m.supportPointCount, parameters.dataSupportTarget),
    countScore(m.imagesCount, 10),
    countScore(m.reserveRecordCount, 4)
  ], 25);

  const dimensions = [
    buildDimension(model, "scale_capacity", scaleScore, normalizedWeights.scale_capacity, `盆地面积 ${formatNumber(m.areaSqkm, 1)} km²，对比基准 ${formatNumber(parameters.areaReferenceSqkm, 0)} km²。`, `面积、盆地基础属性`, "面积 / 基准面积"),
    buildDimension(model, "petroleum_system", petroleumScore, normalizedWeights.petroleum_system, `含油气系统 ${m.petroleumSystemCount} 套，已识别油气田 ${m.fieldDiscoveryCount} 个，总可采当量 ${formatNumber(m.recoverableMmboe, 2)} MMboe。`, `petroleum systems、储量生产摘要`, "含油气系统 + 储量发现背景"),
    buildDimension(model, "play_richness", playScore, normalizedWeights.play_richness, `play ${m.playCount} 个，地层摘要 ${m.lithostratCount} 条，成因单元 ${m.geneticUnitCount} 个。`, `plays、lithostrat、genetic units`, "play/地层/成因单元综合"),
    buildDimension(model, "exploration_activity", activityScore, normalizedWeights.exploration_activity, `同盆地井 ${m.wellCount} 口、区块 ${m.blockCount} 个、油气田 ${m.fieldCount} 个。`, `井、区块、油气田对象统计`, "同盆地活动对象统计"),
    buildDimension(model, "data_support", supportScore, normalizedWeights.data_support, `图件 ${m.imagesCount} 幅，储量生产摘要 ${m.reserveRecordCount} 条，综合支撑点 ${m.supportPointCount}。`, `图件、摘要表、统计项`, "支撑点数 / 目标支撑值")
  ];

  return finalizeEvaluation(record, dimensions, grades, {
    mainMetricLabel: "面积",
    mainMetricValue: `${formatNumber(m.areaSqkm, 1)} km²`,
    supportSummary: [
      `含油气系统 ${m.petroleumSystemCount} 套`,
      `油气田 ${m.fieldCount} 个`,
      `图件 ${m.imagesCount} 幅`
    ],
    missingHints: [
      m.playCount ? null : "缺少 play 记录",
      m.lithostratCount ? null : "缺少地层摘要",
      m.imagesCount ? null : "图件支撑偏弱"
    ].filter(Boolean)
  });
}

function evaluateBlockRecord(model, record, parameters, normalizedWeights, grades) {
  const m = record.metrics;
  const statusScore = averageScore([
    categoryScore(record.profile.contract_status, {
      production: 92,
      development: 86,
      exploration: 78,
      appraisal: 74,
      application: 60,
      available: 56
    }, 58),
    categoryScore(record.profile.block_status, {
      production: 92,
      development: 86,
      exploration: 78,
      appraisal: 74,
      application: 60,
      available: 56
    }, 58),
    ratioScore(m.stageNumber, 5, 35)
  ], 40);
  const acreageScore = averageScore([
    ratioScore(m.areaSqkm, parameters.areaReferenceSqkm),
    ratioScore(m.remainingPct, parameters.remainingAreaTargetPct),
    categoryScore(record.profile.resource_type, {
      conventional: 82,
      unconventional: 70
    }, 60)
  ], 30);
  const waterDepthBase = averageScore([
    inverseScore(m.medianWaterDepthM, parameters.shallowWaterThresholdM, parameters.deepWaterThresholdM),
    inverseScore(m.maxWaterDepthM, parameters.shallowWaterThresholdM, parameters.deepWaterThresholdM)
  ], 65);
  const operabilityScore = averageScore([
    categoryScore(record.profile.onshore_offshore, { onshore: 95, offshore: 72 }, 70),
    categoryScore(record.profile.terrains, { shelf: 84, coastal: 82, deepwater: 52, deepwateroffshore: 52, onshore: 95 }, 72),
    waterDepthBase
  ], 30);
  const activityScore = averageScore([
    countScore(m.historyCount, parameters.historyEventTarget),
    countScore(m.scheduledCount, parameters.scheduledEventTarget),
    ratioScore(m.stageNumber, 5, 35)
  ], 25);
  const ownershipScore = averageScore([
    countScore(m.companyInterestCount, 3),
    hasValue(record.profile.operator_name) ? 95 : 45,
    hasValue(record.profile.contract_name) ? 90 : 50
  ], 35);
  const discoveryScore = averageScore([
    countScore(m.nearbyWellCount, parameters.nearbyWellTarget),
    countScore(m.nearbyFieldCount, parameters.nearbyFieldTarget),
    hasValue(record.profile.basin_names) ? 90 : 45
  ], 30);

  const dimensions = [
    buildDimension(model, "contract_stage", statusScore, normalizedWeights.contract_stage, `合同状态 ${safeText(record.profile.contract_status)}，区块状态 ${safeText(record.profile.block_status)}，阶段号 ${formatNumber(m.stageNumber, 0)}。`, `BLOCK_GENERAL、BLOCK_HISTORY`, "状态分类 + 阶段号"),
    buildDimension(model, "acreage_potential", acreageScore, normalizedWeights.acreage_potential, `区块面积 ${formatNumber(m.areaSqkm, 1)} km²，原始面积保有 ${formatNumber(m.remainingPct, 1)}%。`, `BLOCK_GENERAL、BLOCK_LOCATIONS`, "面积与保有比例综合"),
    buildDimension(model, "operability", operabilityScore, normalizedWeights.operability, `${safeText(record.profile.onshore_offshore)} / ${safeText(record.profile.terrains)}，最大水深 ${hasValue(m.maxWaterDepthM) ? `${formatNumber(m.maxWaterDepthM, 0)} m` : "未提供"}。`, `BLOCK_LOCATIONS`, "陆海属性 + 地形 + 水深"),
    buildDimension(model, "activity_intensity", activityScore, normalizedWeights.activity_intensity, `历史事件 ${m.historyCount} 条，计划事件 ${m.scheduledCount} 条。`, `BLOCK_HISTORY、BLOCK_SCHEDULED_EVENTS`, "历史与计划事件数量"),
    buildDimension(model, "ownership_support", ownershipScore, normalizedWeights.ownership_support, `权益公司 ${m.companyInterestCount} 家，作业者 ${safeText(record.profile.operator_name)}。`, `BLOCK_COMPANY_INTERESTS`, "权益结构与作业主体"),
    buildDimension(model, "discovery_context", discoveryScore, normalizedWeights.discovery_context, `同背景井 ${m.nearbyWellCount} 口，相关油气田 ${m.nearbyFieldCount} 个。`, `井与油气田关联统计`, "周边井和油气田背景")
  ];

  return finalizeEvaluation(record, dimensions, grades, {
    mainMetricLabel: "区块面积",
    mainMetricValue: `${formatNumber(m.areaSqkm, 1)} km²`,
    supportSummary: [
      `权益公司 ${m.companyInterestCount} 家`,
      `历史事件 ${m.historyCount} 条`,
      `周边井 ${m.nearbyWellCount} 口`
    ],
    missingHints: [
      m.companyInterestCount ? null : "缺少权益结构数据",
      m.historyCount ? null : "缺少历史阶段记录",
      hasValue(m.maxWaterDepthM) ? null : "水深条件未完整提供"
    ].filter(Boolean)
  });
}

function evaluateFieldRecord(model, record, parameters, normalizedWeights, grades) {
  const m = record.metrics;
  const resourceScore = averageScore([
    ratioScore(m.totalRecoverableMmboe, parameters.recoverableReferenceMmboe),
    ratioScore(record.profile.gas_recoverable_pp_mmscf, 400000),
    ratioScore(record.profile.oil_recoverable_pp_mmbbl, 120)
  ], 30);
  const stageScore = averageScore([
    categoryScore(record.profile.prod_status, {
      producing: 96,
      development: 86,
      discovered: 68,
      discovery: 68,
      appraisal: 74,
      shutin: 60,
      abandoned: 40
    }, 58),
    hasValue(record.profile.discovery_year) ? 88 : 45
  ], 35);
  const productionScore = averageScore([
    countScore(m.productionRecordCount, parameters.productionRecordTarget),
    countScore(m.reserveHistoryCount, 4),
    countScore(m.eventCount, 3)
  ], 25);
  const reservoirScore = averageScore([
    countScore(m.reservoirCount, parameters.reservoirTarget),
    countScore(m.reservoirInterestCount, parameters.companyInterestTarget),
    countScore(m.imagesCount + m.bibliographyCount, 6)
  ], 30);
  const commercialScore = averageScore([
    countScore(m.companyInterestCount, parameters.companyInterestTarget),
    countScore(m.currentOperatorCount, 1),
    countScore(m.contractBlockCount, 2)
  ], 25);
  const operatingScore = averageScore([
    categoryScore(record.profile.onshore_offshore, { onshore: 94, offshore: 74 }, 68),
    categoryScore(record.profile.terrain, { shelf: 84, deepwater: 52, onshore: 94, shallow: 88 }, 70),
    inverseScore(m.waterDepthMaxM, parameters.shallowWaterThresholdM, parameters.deepWaterThresholdM)
  ], 30);

  const dimensions = [
    buildDimension(model, "resource_endowment", resourceScore, normalizedWeights.resource_endowment, `总可采当量 ${formatNumber(m.totalRecoverableMmboe, 2)} MMboe，油/气可采规模已纳入。`, `FIELD_GENERAL、FIELD_CUMULATIVE_PRODUCTION`, "总可采规模 / 参考值"),
    buildDimension(model, "development_stage", stageScore, normalizedWeights.development_stage, `生产状态 ${safeText(record.profile.prod_status)}，发现年份 ${safeText(record.profile.discovery_year)}。`, `FIELD_BASIC、FIELD_EVENTS`, "生产状态分类"),
    buildDimension(model, "production_basis", productionScore, normalizedWeights.production_basis, `生产相关记录 ${m.productionRecordCount} 条，事件 ${m.eventCount} 条，储量历史 ${m.reserveHistoryCount} 条。`, `FIELD_ANNUAL_PRODUCTION、FIELD_CUMULATIVE_PRODUCTION、FIELD_RESERVE_HISTORY`, "生产与储量历史记录"),
    buildDimension(model, "reservoir_support", reservoirScore, normalizedWeights.reservoir_support, `储层 ${m.reservoirCount} 个，储层权益 ${m.reservoirInterestCount} 条，图件/文献 ${m.imagesCount + m.bibliographyCount} 条。`, `FIELD_RESERVOIRS_COMPANY_INTERESTS、FIELD_IMAGES、FIELD_BIBLIOGRAPHY`, "储层与补充资料支撑"),
    buildDimension(model, "commercial_structure", commercialScore, normalizedWeights.commercial_structure, `公司权益 ${m.companyInterestCount} 条，当前作业者 ${safeText(record.profile.current_operators)}。`, `FIELD_COMPANY_INTERESTS`, "权益结构与经营主体"),
    buildDimension(model, "operating_conditions", operatingScore, normalizedWeights.operating_conditions, `${safeText(record.profile.onshore_offshore)} / ${safeText(record.profile.terrain)}，最大水深 ${hasValue(m.waterDepthMaxM) ? `${formatNumber(m.waterDepthMaxM, 0)} m` : "未提供"}。`, `FIELD_LOCATIONS`, "陆海属性 + 地形 + 水深")
  ];

  return finalizeEvaluation(record, dimensions, grades, {
    mainMetricLabel: "总可采当量",
    mainMetricValue: `${formatNumber(m.totalRecoverableMmboe, 2)} MMboe`,
    supportSummary: [
      `生产记录 ${m.productionRecordCount} 条`,
      `储层 ${m.reservoirCount} 个`,
      `权益记录 ${m.companyInterestCount} 条`
    ],
    missingHints: [
      m.productionRecordCount ? null : "缺少生产记录支撑",
      m.companyInterestCount ? null : "缺少公司权益数据",
      m.reservoirCount ? null : "缺少储层支撑"
    ].filter(Boolean)
  });
}

function evaluateWellRecord(model, record, parameters, normalizedWeights, grades) {
  const m = record.metrics;
  const profileScore = ratioScore(m.profileFieldCount, parameters.profileFieldTarget);
  const historyScore = averageScore([
    countScore(m.periodCount, parameters.historyEventTarget),
    hasValue(record.profile.technical_status) ? 92 : 45,
    hasValue(record.profile.general_status) ? 88 : 45
  ], 35);
  const testStratScore = averageScore([
    countScore(m.testCount + m.topCount + m.stratigraphyCount, parameters.testTarget),
    countScore(m.topCount, 3),
    countScore(m.stratigraphyCount, 2)
  ], 25);
  const surveyScore = averageScore([
    countScore(m.surveyPointCount > 0 ? 2 : 0, parameters.surveyTarget),
    countScore(m.deviationPoints, 10),
    countScore(m.checkshotPoints, 6)
  ], 25);
  const ancillaryScore = averageScore([
    countScore(m.samplingCount + m.equipmentCount + m.bibliographyCount + m.costCount, parameters.ancillaryTarget),
    countScore(m.bibliographyCount, 2),
    countScore(m.equipmentCount, 2)
  ], 25);
  const curveScore = ratioScore(m.logPointCount, parameters.logPointTarget);

  const dimensions = [
    buildDimension(model, "profile_completeness", profileScore, normalizedWeights.profile_completeness, `关键档案字段已填 ${m.profileFieldCount} 项。`, `井档案摘要`, "已填字段数 / 目标字段数"),
    buildDimension(model, "history_richness", historyScore, normalizedWeights.history_richness, `井史周期 ${m.periodCount} 条，技术状态 ${safeText(record.profile.technical_status)}。`, `periods、井档案`, "井史周期 + 状态完备度"),
    buildDimension(model, "test_strat_support", testStratScore, normalizedWeights.test_strat_support, `测试 ${m.testCount} 条，层顶 ${m.topCount} 条，地层 ${m.stratigraphyCount} 条。`, `tests、tops、stratigraphy`, "测试与分层资料数量"),
    buildDimension(model, "survey_support", surveyScore, normalizedWeights.survey_support, `井斜点 ${m.deviationPoints} 个，checkshot 点 ${m.checkshotPoints} 个。`, `deviation、checkshot`, "测量资料覆盖"),
    buildDimension(model, "ancillary_support", ancillaryScore, normalizedWeights.ancillary_support, `样品 ${m.samplingCount}，设备 ${m.equipmentCount}，文献 ${m.bibliographyCount}，成本 ${m.costCount}。`, `sampling、equipment、bibliography、costs`, "辅助资料综合"),
    buildDimension(model, "curve_support", curveScore, normalizedWeights.curve_support, `曲线采样点 ${m.logPointCount} 个。`, `well_logs.csv`, "曲线采样点 / 目标点数")
  ];

  return finalizeEvaluation(record, dimensions, grades, {
    mainMetricLabel: "总井深",
    mainMetricValue: hasValue(record.profile.td_meter) ? `${formatNumber(record.profile.td_meter, 1)} m` : "未提供",
    supportSummary: [
      `井史 ${m.periodCount} 条`,
      `测试/分层 ${m.testCount + m.topCount + m.stratigraphyCount} 条`,
      `曲线点 ${m.logPointCount} 个`
    ],
    missingHints: [
      m.testCount + m.topCount + m.stratigraphyCount ? null : "缺少测试或分层资料",
      m.surveyPointCount ? null : "缺少测量资料",
      m.logPointCount ? null : "缺少曲线采样点"
    ].filter(Boolean)
  });
}

function finalizeEvaluation(record, dimensions, grades, extra = {}) {
  const totalScore = dimensions.reduce((sum, item) => sum + item.score * item.weight, 0);
  const roundedScore = Math.round(totalScore * 10) / 10;
  const grade = resolveGrade(roundedScore, grades);
  const sortedDimensions = [...dimensions].sort((a, b) => b.score - a.score);
  const strengths = sortedDimensions.slice(0, 2).map(item => `${item.label} ${formatNumber(item.score, 1)} 分`);
  const weaknesses = [...sortedDimensions].reverse().slice(0, 2).map(item => `${item.label} ${formatNumber(item.score, 1)} 分`);

  return {
    id: record.id,
    name: record.name,
    country: record.country,
    subtitle: record.subtitle,
    profile: record.profile,
    summary: record.summary,
    totalScore: roundedScore,
    gradeLabel: grade.label,
    gradeAdvice: grade.advice,
    gradeClassName: gradeClass(grade.label),
    dimensions,
    strengths,
    weaknesses,
    supportSummary: extra.supportSummary || [],
    missingHints: extra.missingHints || [],
    mainMetricLabel: extra.mainMetricLabel || "对象规模",
    mainMetricValue: extra.mainMetricValue || "-",
    snapshot: extra.snapshot || {},
    dataSupportText: dimensions.map(item => `${item.label}：${item.dataSupport}`).join("；")
  };
}

function evaluateRecord(model, record, parameters, normalizedWeights, grades) {
  if (model.id === "basin-potential") return evaluateBasinRecord(model, record, parameters, normalizedWeights, grades);
  if (model.id === "block-exploration") return evaluateBlockRecord(model, record, parameters, normalizedWeights, grades);
  if (model.id === "field-development") return evaluateFieldRecord(model, record, parameters, normalizedWeights, grades);
  return evaluateWellRecord(model, record, parameters, normalizedWeights, grades);
}

function runEvaluation() {
  const model = state.models.find(item => item.id === state.currentModelId);
  if (!model) return;
  const parameters = state.parametersByModel[model.id];
  const weights = state.weightsByModel[model.id];
  const grades = state.gradesByModel[model.id];
  const normalizedWeights = getNormalizedWeights(weights);
  const records = state.recordsByModel[model.id] || [];

  const rawResults = records
    .map(record => evaluateRecord(model, record, parameters, normalizedWeights, grades))
    .sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name, "zh-CN"));

  state.evaluationResults = {
    modelId: model.id,
    rawResults,
    normalizedWeights,
    grades: getSortedGrades(grades),
    generatedAt: new Date().toLocaleString("zh-CN")
  };

  const visibleResults = getVisibleResults();
  state.activeResultId = visibleResults[0]?.id || rawResults[0]?.id || null;
}

function getVisibleResults() {
  if (!state.evaluationResults || state.evaluationResults.modelId !== state.currentModelId) return [];
  const keyword = normalizeText(state.filters.keyword);
  const country = state.filters.country;
  const grade = state.filters.grade;
  const topN = Math.max(1, Number(state.filters.topN) || 20);
  return state.evaluationResults.rawResults
    .filter(result => !keyword || normalizeText(result.name).includes(keyword) || normalizeText(result.subtitle).includes(keyword))
    .filter(result => country === "全部国家" || result.country === country)
    .filter(result => grade === "全部等级" || result.gradeLabel === grade)
    .slice(0, topN);
}

function getCurrentModel() {
  return state.models.find(item => item.id === state.currentModelId) || state.models[0];
}

function renderParameterInputs(model) {
  const schema = MODEL_PARAMETER_SCHEMAS[model.id];
  const params = state.parametersByModel[model.id];
  const weights = state.weightsByModel[model.id];
  const grades = state.gradesByModel[model.id];

  return `
    <section class="content-section">
      <div class="section-heading">
        <div>
          <h3>参数设置</h3>
          <p>${schema?.intro || "设置评价参数、权重和等级阈值，然后执行计算。"}</p>
        </div>
      </div>
      <div class="parameter-layout">
        <div class="parameter-grid">
          <article class="content-card parameter-card">
            <h3>评价参数</h3>
            ${(schema?.parameters || []).map(parameter => `
              <label>
                <span>${parameter.label}${parameter.suffix ? `（${parameter.suffix}）` : ""}</span>
                <input
                  data-role="parameter-input"
                  data-key="${parameter.key}"
                  type="${parameter.type}"
                  min="${parameter.min ?? ""}"
                  max="${parameter.max ?? ""}"
                  step="${parameter.step ?? ""}"
                  value="${params?.[parameter.key] ?? parameter.default ?? ""}"
                />
                <small class="parameter-note">${parameter.help}</small>
              </label>
            `).join("")}
          </article>
          <article class="content-card parameter-card">
            <h3>权重设置</h3>
            <div class="weight-grid">
              ${model.dimensions.map(dimension => `
                <div class="weight-row">
                  <div>
                    <strong>${dimension.label}</strong>
                    <small>${dimension.description}</small>
                  </div>
                  <input
                    data-role="weight-input"
                    data-key="${dimension.key}"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value="${weights?.[dimension.key] ?? dimension.weight}"
                  />
                </div>
              `).join("")}
            </div>
            <p class="parameter-note">权重可输入任意正值，系统会自动归一化后再计算总分。</p>
          </article>
          <article class="content-card parameter-card">
            <h3>等级阈值</h3>
            <div class="grade-grid">
              ${grades.map((grade, index) => `
                <div class="grade-row">
                  <div>
                    <strong>${grade.label}</strong>
                    <small>${grade.advice}</small>
                  </div>
                  <input
                    data-role="grade-input"
                    data-index="${index}"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value="${grade.min}"
                  />
                </div>
              `).join("")}
            </div>
            <p class="parameter-note">阈值按分数下限生效，系统会自动按高到低排序。</p>
          </article>
        </div>
        <div class="parameter-actions">
          <button type="button" data-action="reset-model">恢复默认参数</button>
          <button type="button" data-action="run-evaluation">执行计算</button>
        </div>
      </div>
    </section>
  `;
}

function renderFilterSection(model, visibleResults) {
  const records = state.recordsByModel[model.id] || [];
  const countries = unique(records.map(item => item.country).filter(Boolean)).sort((a, b) => a.localeCompare(b, "zh-CN"));
  const grades = state.evaluationResults?.grades?.map(item => item.label) || getCurrentModel().grades.map(item => item.label);

  return `
    <section class="content-section">
      <div class="section-heading">
        <div>
          <h3>结果筛选</h3>
          <p>对本次计算结果按关键字、国家、等级和展示条数进行二次筛选。</p>
        </div>
      </div>
      <div class="evaluation-filter-grid">
        <label>
          <span>关键字</span>
          <input data-role="filter-keyword" type="text" placeholder="输入对象名称、状态、盆地等" value="${state.filters.keyword}" />
        </label>
        <label>
          <span>国家</span>
          <select data-role="filter-country">
            <option value="全部国家">全部国家</option>
            ${countries.map(country => `<option value="${country}" ${country === state.filters.country ? "selected" : ""}>${country}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>等级</span>
          <select data-role="filter-grade">
            <option value="全部等级">全部等级</option>
            ${grades.map(grade => `<option value="${grade}" ${grade === state.filters.grade ? "selected" : ""}>${grade}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>展示条数</span>
          <input data-role="filter-topn" type="number" min="1" step="1" value="${state.filters.topN}" />
        </label>
      </div>
      <p class="parameter-note">当前模型对象：${safeText(MODEL_PARAMETER_SCHEMAS[model.id]?.objectLabel)}，本轮结果共 ${state.evaluationResults?.rawResults?.length || 0} 条，当前视图 ${visibleResults.length} 条。</p>
    </section>
  `;
}

function renderSummaryKpis(visibleResults) {
  const average = visibleResults.length
    ? visibleResults.reduce((sum, item) => sum + item.totalScore, 0) / visibleResults.length
    : 0;
  const top = visibleResults[0];
  const topGradeCount = visibleResults.filter(item => item.gradeLabel.startsWith("I类")).length;
  const gapCount = visibleResults.filter(item => item.gradeLabel.startsWith("IV类")).length;

  return `
    <div class="metric-grid">
      <article class="metric-card"><span>当前结果数</span><strong>${visibleResults.length}</strong></article>
      <article class="metric-card"><span>平均得分</span><strong>${formatNumber(average, 1)}</strong></article>
      <article class="metric-card"><span>I类对象</span><strong>${topGradeCount}</strong></article>
      <article class="metric-card"><span>资料待补对象</span><strong>${gapCount}</strong></article>
      <article class="metric-card"><span>当前最高分</span><strong>${top ? formatNumber(top.totalScore, 1) : "-"}</strong></article>
      <article class="metric-card"><span>最高分对象</span><strong>${top ? top.name : "-"}</strong></article>
    </div>
  `;
}

function renderResultList(visibleResults) {
  if (!visibleResults.length) {
    return `<div class="placeholder-card">当前筛选条件下没有结果。可以放宽筛选条件，或者重新执行计算。</div>`;
  }
  return `
    <div class="result-list">
      ${visibleResults.map(result => `
        <article class="result-card ${result.id === state.activeResultId ? "is-active" : ""}" data-action="select-result" data-id="${result.id}">
          <div class="result-card__head">
            <div>
              <span class="grade-chip ${result.gradeClassName}">${result.gradeLabel}</span>
              <h4>${result.name}</h4>
              <p>${result.subtitle}</p>
            </div>
            <div class="result-card__score">
              <strong>${formatNumber(result.totalScore, 1)}</strong>
              <small>${safeText(result.country)}</small>
            </div>
          </div>
          <p class="parameter-note">优势：${result.strengths.join("；") || "-"}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderResultDetail(result, model) {
  if (!result) {
    return `<div class="placeholder-card">先执行计算，然后从左侧结果列表中选择对象查看详细解释。</div>`;
  }

  return `
    <div class="detail-shell">
      <article class="content-card">
        <div class="result-card__head">
          <div>
            <span class="grade-chip ${result.gradeClassName}">${result.gradeLabel}</span>
            <h3>${result.name}</h3>
            <p>${result.subtitle}</p>
          </div>
          <div class="result-card__score result-card__score--detail">
            <strong>${formatNumber(result.totalScore, 1)}</strong>
            <small>综合得分</small>
          </div>
        </div>
        <div class="detail-stat-grid">
          <article class="detail-stat"><span>国家</span><strong>${safeText(result.country)}</strong></article>
          <article class="detail-stat"><span>${result.mainMetricLabel}</span><strong>${safeText(result.mainMetricValue)}</strong></article>
          <article class="detail-stat"><span>对象类型</span><strong>${safeText(model.objectType)}</strong></article>
          <article class="detail-stat"><span>模型方法</span><strong>${safeText(model.method)}</strong></article>
        </div>
        <div class="advice-card">
          <strong>评价建议</strong>
          <p>${result.gradeAdvice}</p>
        </div>
      </article>

      <article class="content-card">
        <h3>分项得分明细</h3>
        <div class="dimension-list">
          ${result.dimensions.map(item => `
            <div class="dimension-item">
              <div class="dimension-item__head">
                <div>
                  <strong>${item.label}</strong>
                  <p>${item.description}</p>
                </div>
                <div class="dimension-item__score">
                  <strong>${formatNumber(item.score, 1)}</strong>
                  <small>权重 ${(item.weight * 100).toFixed(1)}%</small>
                </div>
              </div>
              <div class="dimension-bar"><i style="width:${Math.max(6, item.score)}%"></i></div>
              <p><strong>评价依据：</strong>${item.evidence}</p>
              <p class="parameter-note"><strong>数据来源：</strong>${item.dataSupport}</p>
              <p class="parameter-note"><strong>计算口径：</strong>${item.formula}</p>
            </div>
          `).join("")}
        </div>
      </article>

      <div class="evidence-grid">
        <article class="evidence-card">
          <span>主要拉分项</span>
          <strong>${result.strengths[0] || "-"}</strong>
          <small>${result.strengths[1] || "暂无第二拉分项"}</small>
        </article>
        <article class="evidence-card">
          <span>主要短板</span>
          <strong>${result.weaknesses[0] || "-"}</strong>
          <small>${result.weaknesses[1] || "暂无第二短板"}</small>
        </article>
        <article class="evidence-card">
          <span>数据缺口</span>
          <strong>${result.missingHints[0] || "当前无明显缺口"}</strong>
          <small>${result.missingHints[1] || "可继续补充专题资料以提升评价精度。"}</small>
        </article>
      </div>
    </div>
  `;
}

function renderMethodSection(model, visibleResults) {
  const weights = state.evaluationResults?.normalizedWeights || getNormalizedWeights(state.weightsByModel[model.id]);
  const grades = state.evaluationResults?.grades || getSortedGrades(state.gradesByModel[model.id]);
  const topObjects = visibleResults.slice(0, 5);

  return `
    <section class="content-section content-grid">
      <article class="content-card">
        <h3>算法说明</h3>
        <p>${model.description}</p>
        <ul class="workflow-list">
          <li>先选择评价对象和参数基准，再录入维度权重与等级阈值。</li>
          <li>系统按对象真实数据计算各维度分值，并自动归一化权重。</li>
          <li>综合得分按等级规则输出 I类、II类、III类、IV类结果。</li>
          <li>结果页同步给出分项得分、主要拉分项、数据缺口与解释建议。</li>
        </ul>
        <div class="top-object-list">
          <strong>本轮前五对象</strong>
          <ul class="plain-list">
            ${topObjects.map(item => `<li>${item.name}：${formatNumber(item.totalScore, 1)} 分（${item.gradeLabel}）</li>`).join("") || "<li>暂无结果</li>"}
          </ul>
        </div>
      </article>
      <article class="content-card">
        <h3>权重与等级</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>维度</th><th>归一化权重</th><th>说明</th></tr>
            </thead>
            <tbody>
              ${model.dimensions.map(item => `
                <tr>
                  <td>${item.label}</td>
                  <td>${((weights[item.key] || 0) * 100).toFixed(1)}%</td>
                  <td>${item.description}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        <div class="table-wrap" style="margin-top:16px;">
          <table>
            <thead>
              <tr><th>等级</th><th>下限分</th><th>建议</th></tr>
            </thead>
            <tbody>
              ${grades.map(item => `
                <tr>
                  <td>${item.label}</td>
                  <td>${item.min}</td>
                  <td>${item.advice}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
      <article class="content-card">
        <h3>输入数据支撑</h3>
        <ul class="plain-list">
          ${model.inputs.map(input => `<li>${input}</li>`).join("")}
        </ul>
        <p class="parameter-note">计算时间：${state.evaluationResults?.generatedAt || "尚未执行"}</p>
      </article>
      <article class="content-card">
        <h3>当前筛选后的等级分布</h3>
        <div class="distribution-grid">
          ${summarizeDistribution(visibleResults).map(item => `
            <article class="distribution-card">
              <strong>${item.label}</strong>
              <span>${item.count} 个对象</span>
              <small>${item.description}</small>
            </article>
          `).join("")}
        </div>
      </article>
    </section>
  `;
}

function summarizeDistribution(results) {
  const groups = [
    { prefix: "I类", label: "I类 优先", description: "优先进入下一轮研究或投资判断。", count: 0 },
    { prefix: "II类", label: "II类 良好", description: "具备较好基础，可持续跟踪。", count: 0 },
    { prefix: "III类", label: "III类 关注", description: "具备一定条件，但需要补充关键约束。", count: 0 },
    { prefix: "IV类", label: "IV类 补资料", description: "当前数据基础偏弱，建议先补资料。", count: 0 }
  ];
  results.forEach(result => {
    const target = groups.find(item => result.gradeLabel.startsWith(item.prefix));
    if (target) target.count += 1;
  });
  return groups;
}

function renderPlaceholder(model) {
  return `
    <section class="content-section">
      <div class="placeholder-card">
        已加载 ${safeText(model.objectType)} 评价模型。请先设置参数并点击“执行计算”，系统会基于当前接入的真实对象数据计算评价结果。
      </div>
    </section>
  `;
}

function renderPage() {
  const model = getCurrentModel();
  const visibleResults = getVisibleResults();
  const activeResult = visibleResults.find(item => item.id === state.activeResultId)
    || state.evaluationResults?.rawResults?.find(item => item.id === state.activeResultId)
    || visibleResults[0]
    || null;

  state.root.innerHTML = `
    <section class="content-section">
      <div class="section-heading section-heading--inline">
        <div>
          <h3>评价对象与模型</h3>
          <p>选择对象类型、设置参数并执行石化专业评价计算。</p>
        </div>
        <label class="inline-select">
          <span>评价模型</span>
          <select data-role="model-select">
            ${state.models.map(item => `<option value="${item.id}" ${item.id === state.currentModelId ? "selected" : ""}>${item.name}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="detail-tabbar">
        ${state.models.map(item => `<button class="detail-tabbar__item ${item.id === state.currentModelId ? "is-active" : ""}" type="button" data-action="switch-model" data-model="${item.id}">${item.objectType}</button>`).join("")}
      </div>
      <article class="content-card">
        <h3>${model.name}</h3>
        <p>${model.description}</p>
        <p class="parameter-note">方法：${safeText(model.method)}。对象数：${(state.recordsByModel[model.id] || []).length}。</p>
      </article>
    </section>
    ${renderParameterInputs(model)}
    ${state.evaluationResults ? renderFilterSection(model, visibleResults) : ""}
    ${state.evaluationResults ? `
      <section class="content-section">
        <div class="section-heading">
          <div>
            <h3>计算结果</h3>
            <p>基于当前参数和真实对象数据生成排序、等级和分项解释。</p>
          </div>
        </div>
        ${renderSummaryKpis(visibleResults)}
        <div class="content-grid" style="margin-top:16px;">
          <article class="content-card">
            <h3>对象排序</h3>
            ${renderResultList(visibleResults)}
          </article>
          <article class="content-card">
            <h3>对象明细</h3>
            ${renderResultDetail(activeResult, model)}
          </article>
        </div>
      </section>
      ${renderMethodSection(model, visibleResults)}
    ` : renderPlaceholder(model)}
  `;

  bindEvents();
}

function resetCurrentModel() {
  const model = getCurrentModel();
  state.parametersByModel[model.id] = Object.fromEntries(
    (MODEL_PARAMETER_SCHEMAS[model.id]?.parameters || []).map(parameter => [parameter.key, parameter.default])
  );
  state.weightsByModel[model.id] = Object.fromEntries(model.dimensions.map(dimension => [dimension.key, dimension.weight]));
  state.gradesByModel[model.id] = model.grades.map(grade => ({ ...grade }));
  state.evaluationResults = null;
  state.activeResultId = null;
}

function bindEvents() {
  state.root.querySelector('[data-role="model-select"]')?.addEventListener("change", event => {
    state.currentModelId = event.target.value;
    initializeModelState(getCurrentModel());
    state.evaluationResults = null;
    state.activeResultId = null;
    state.filters = { keyword: "", country: "全部国家", grade: "全部等级", topN: 20 };
    renderPage();
  });

  state.root.querySelectorAll('[data-action="switch-model"]').forEach(button => {
    button.addEventListener("click", () => {
      state.currentModelId = button.dataset.model;
      initializeModelState(getCurrentModel());
      state.evaluationResults = null;
      state.activeResultId = null;
      state.filters = { keyword: "", country: "全部国家", grade: "全部等级", topN: 20 };
      renderPage();
    });
  });

  state.root.querySelectorAll('[data-role="parameter-input"]').forEach(input => {
    input.addEventListener("input", () => {
      state.parametersByModel[state.currentModelId][input.dataset.key] = toNumber(input.value) ?? input.value;
    });
  });

  state.root.querySelectorAll('[data-role="weight-input"]').forEach(input => {
    input.addEventListener("input", () => {
      state.weightsByModel[state.currentModelId][input.dataset.key] = toNumber(input.value) ?? 0;
    });
  });

  state.root.querySelectorAll('[data-role="grade-input"]').forEach(input => {
    input.addEventListener("input", () => {
      const index = Number(input.dataset.index);
      const grades = state.gradesByModel[state.currentModelId];
      grades[index].min = toNumber(input.value) ?? grades[index].min;
    });
  });

  state.root.querySelector('[data-action="run-evaluation"]')?.addEventListener("click", () => {
    runEvaluation();
    renderPage();
  });

  state.root.querySelector('[data-action="reset-model"]')?.addEventListener("click", () => {
    resetCurrentModel();
    renderPage();
  });

  state.root.querySelectorAll('[data-action="select-result"]').forEach(card => {
    card.addEventListener("click", () => {
      state.activeResultId = card.dataset.id;
      renderPage();
    });
  });

  state.root.querySelector('[data-role="filter-keyword"]')?.addEventListener("input", event => {
    state.filters.keyword = event.target.value;
    const visibleResults = getVisibleResults();
    state.activeResultId = visibleResults[0]?.id || state.activeResultId;
    renderPage();
  });

  state.root.querySelector('[data-role="filter-country"]')?.addEventListener("change", event => {
    state.filters.country = event.target.value;
    const visibleResults = getVisibleResults();
    state.activeResultId = visibleResults[0]?.id || null;
    renderPage();
  });

  state.root.querySelector('[data-role="filter-grade"]')?.addEventListener("change", event => {
    state.filters.grade = event.target.value;
    const visibleResults = getVisibleResults();
    state.activeResultId = visibleResults[0]?.id || null;
    renderPage();
  });

  state.root.querySelector('[data-role="filter-topn"]')?.addEventListener("input", event => {
    state.filters.topN = Math.max(1, Number(event.target.value) || 20);
    const visibleResults = getVisibleResults();
    state.activeResultId = visibleResults[0]?.id || null;
    renderPage();
  });
}

async function init() {
  state.root = renderShell({
    currentKey: "evaluation",
    heroTitle: "评价算法模块",
    heroDesc: "设置评价参数、执行计算，并查看盆地、区块、油气田和井对象的专业评价结果与解释。",
    heroMeta: ["参数输入", "执行计算", "结果解释"]
  });

  state.platform = await loadPlatformState({ includeMapLayers: false });
  state.models = await loadModels();
  state.recordsByModel = buildRecordCollections(state.platform);
  state.currentModelId = state.models[0]?.id || "basin-potential";
  state.models.forEach(initializeModelState);
  renderPage();
}

init().catch(error => {
  const container = document.querySelector('[data-module-container="evaluation"]') || document.body;
  container.innerHTML = `<pre class="error-panel">${error.message}</pre>`;
});
