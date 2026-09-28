import { formatNumber, renderShell, safeText, setShellContext } from "./core.js";

const requestedStage = typeof window === "undefined"
  ? ""
  : new URLSearchParams(window.location.search).get("stage");
const validStageIds = new Set(["resource", "production", "engineering", "commercial", "result"]);

const state = {
  root: null,
  config: null,
  result: null,
  loading: false,
  error: "",
  stage: validStageIds.has(requestedStage) ? requestedStage : "resource",
  view: "inputs",
  activeId: null,
  filters: {
    keyword: "",
    country: "全部国家",
    basin: "全部盆地",
    status: "全部状态",
    hydrocarbon: "全部油气类型",
    minRemainingMmboe: 10,
    maxWaterDepthMeter: "",
    page: 1,
    pageSize: 20
  },
  assumptions: {
    oilPriceUsdPerBbl: 75,
    gasPriceUsdPerMcf: 4.2,
    boeRevenueUsdPerBoe: 58,
    onshoreCostUsdPerBoe: 14,
    shelfCostUsdPerBoe: 24,
    deepwaterCostUsdPerBoe: 42,
    opexUsdPerBoe: 10,
    discountRatePct: 10,
    evaluationYears: 12,
    geologicalRiskPct: 18,
    fiscalTakePct: 45,
    facilityReuseCreditPct: 12
  }
};

const STAGE_COPY = {
  resource: {
    title: "资源基础",
    columns: ["油气田", "国家", "盆地", "剩余可采", "可采规模", "采收率", "阶段指数"],
    metricKeys: ["remainingMmboe", "recoverableMmboe", "recoveryFactorPct", "reserveConfidence"]
  },
  production: {
    title: "生产状态",
    columns: ["油气田", "国家", "状态", "年产量", "总井", "生产井", "阶段指数"],
    metricKeys: ["annualBoeMm", "wells", "producers", "activeProducers", "depletionRatioPct"]
  },
  engineering: {
    title: "工程成本",
    columns: ["油气田", "国家", "地形", "成本", "开发投资", "水深", "阶段指数"],
    metricKeys: ["costPerBoe", "developmentCostMM", "waterDepthMeter", "reservoirs", "terrain"]
  },
  commercial: {
    title: "商业条件",
    columns: ["油气田", "国家", "合同区块", "作业者", "合同匹配", "商业系数", "阶段指数"],
    metricKeys: ["commercialFactor", "contracts", "block", "operator"]
  },
  result: {
    title: "评价结果",
    columns: ["油气田", "国家", "分级", "经济指数", "NPV代理", "利润率", "剩余可采"],
    metricKeys: ["economicIndex", "npvProxyMM", "marginPct", "grossRevenueMM", "developmentCostMM"]
  }
};

const ASSUMPTION_META = {
  oilPriceUsdPerBbl: { label: "油价", unit: "USD/bbl", step: 1 },
  gasPriceUsdPerMcf: { label: "气价", unit: "USD/Mcf", step: 0.1 },
  boeRevenueUsdPerBoe: { label: "桶油当量收入", unit: "USD/boe", step: 1 },
  onshoreCostUsdPerBoe: { label: "陆上基准成本", unit: "USD/boe", step: 1 },
  shelfCostUsdPerBoe: { label: "陆架基准成本", unit: "USD/boe", step: 1 },
  deepwaterCostUsdPerBoe: { label: "深水基准成本", unit: "USD/boe", step: 1 },
  opexUsdPerBoe: { label: "操作成本", unit: "USD/boe", step: 1 },
  discountRatePct: { label: "折现率", unit: "%", step: 0.5 },
  evaluationYears: { label: "评价年限", unit: "年", step: 1 },
  geologicalRiskPct: { label: "地质风险扣减", unit: "%", step: 1 },
  fiscalTakePct: { label: "税费权益扣减", unit: "%", step: 1 },
  facilityReuseCreditPct: { label: "设施复用抵减", unit: "%", step: 1 }
};

const STAGE_INPUTS = {
  resource: {
    filters: ["keyword", "country", "basin", "hydrocarbon", "minRemainingMmboe", "pageSize"],
    assumptions: [],
    emptyParameterText: "本阶段没有额外人工计算参数，直接依据油气田资源字段计算。",
    sources: [{
      name: "油气田数据 CSV",
      fields: [
        ["剩余油", "Oil Remaining Pp Mmbbl"],
        ["剩余气", "Gas Remaining Pp Mmscf"],
        ["剩余凝析油", "Cond Remaining Pp Mmbbl"],
        ["剩余可采当量", "Tot Remaining Pp Mmboe"],
        ["总可采当量", "Tot Recoverable Pp Mmboe"],
        ["原始地质储量", "Tot In Place Pp Mmboe"],
        ["累计产量", "Cumul Tot Prod Mmboe"],
        ["储量数据来源", "Oil/Gas/Cond Reserve Data Srce"],
        ["储层数量", "Numb Reservoirs"]
      ]
    }]
  },
  production: {
    filters: ["keyword", "country", "basin", "status", "minRemainingMmboe", "pageSize"],
    assumptions: ["evaluationYears"],
    sources: [{
      name: "油气田数据 CSV",
      fields: [
        ["生产状态", "Prod Status"],
        ["最新年原油产量", "Latest Annual Oil Prod Bbl"],
        ["最新年天然气产量", "Latest Annual Gas Prod Tscf"],
        ["最新年凝析油产量", "Latest Annual Cond Prod Bbl"],
        ["累计产量", "Cumul Tot Prod Mmboe"],
        ["总可采当量", "Tot Recoverable Pp Mmboe"],
        ["总井数", "Numb Wells"],
        ["生产井数", "Numb Producers"],
        ["活动生产井数", "Numb Act Producers"]
      ]
    }]
  },
  engineering: {
    filters: ["keyword", "country", "basin", "status", "hydrocarbon", "maxWaterDepthMeter", "pageSize"],
    assumptions: ["onshoreCostUsdPerBoe", "shelfCostUsdPerBoe", "deepwaterCostUsdPerBoe", "facilityReuseCreditPct"],
    sources: [{
      name: "油气田数据 CSV",
      fields: [
        ["陆上/海上", "Ons Offshore"],
        ["地形", "Terrain"],
        ["最大水深", "Water Depth Max Val Meter"],
        ["储层数量", "Numb Reservoirs"],
        ["油田面积", "Field Sqkm"],
        ["生产状态", "Prod Status"],
        ["生产井数", "Numb Producers"],
        ["活动生产井数", "Numb Act Producers"],
        ["显示井数", "Numb Shows Wells"],
        ["干井数", "Numb Dry Wells"]
      ]
    }]
  },
  commercial: {
    filters: ["keyword", "country", "basin", "status", "pageSize"],
    assumptions: [],
    emptyParameterText: "本阶段没有额外人工计算参数，合同状态、匹配质量和作业者一致性直接参与商业条件计算；合同到期信息缺失时只计入数据完整度，不使用默认日期代替。",
    sources: [
      {
        name: "油气田数据 CSV",
        fields: [
          ["当前合同区块", "Cur Contract Block Names"],
          ["当前作业者", "Cur Operator Names"],
          ["当前集团", "Cur Group Names"],
          ["盆地", "Basin Name"],
          ["国家", "Country Names"],
          ["总井数/生产井数", "Numb Wells / Numb Producers"]
        ]
      },
      {
        name: "合同区块 GIS 服务",
        fields: [
          ["区块与合同名称", "BLOCK_NAME / CONTRACT"],
          ["所属盆地", "BAS_NAMES"],
          ["作业者", "OPERATOR"],
          ["合同与区块状态", "CON_STATUS / BLK_STATUS"],
          ["合同到期年份", "EXP_DT_YR"]
        ]
      }
    ]
  },
  result: {
    filters: ["keyword", "country", "basin", "status", "hydrocarbon", "minRemainingMmboe", "maxWaterDepthMeter", "pageSize"],
    assumptions: ["oilPriceUsdPerBbl", "gasPriceUsdPerMcf", "boeRevenueUsdPerBoe", "opexUsdPerBoe", "discountRatePct", "evaluationYears", "geologicalRiskPct", "fiscalTakePct"],
    sources: [
      {
        name: "前序阶段输出",
        fields: [
          ["资源基础", "剩余可采、储量可信度、资源基础指数"],
          ["生产状态", "年产量代理、生产状态指数"],
          ["工程成本", "单位成本、开发投资代理、工程成本指数"],
          ["商业条件", "商业条件系数、商业条件指数"]
        ]
      },
      {
        name: "油气田数据 CSV",
        fields: [
          ["剩余油/气/凝析油", "Oil / Gas / Cond Remaining"],
          ["井数", "Numb Wells"],
          ["陆上/海上", "Ons Offshore"]
        ]
      }
    ]
  }
};

const STAGE_METHODS = {
  resource: {
    purpose: "确认油气田是否仍具备足以开展经济评价的可采资源规模，并同时反映储量可信度和采收率。",
    outputs: "输出：剩余可采当量、总可采当量、采收率、储量可信度、资源基础指数。",
    formulas: [
      "剩余可采当量 = 已报剩余可采当量；缺失时 = 剩余油 + 剩余气 ÷ 6000 + 剩余凝析油；仍缺失时 = 总可采当量 - 累计产量",
      "资源基础指数 = 剩余可采规模评分 × 0.46 + 总可采规模评分 × 0.20 + 采收率评分 × 0.12 + 储量可信度评分 × 0.14 + 储层数量评分 × 0.08"
    ]
  },
  production: {
    purpose: "判断剩余资源是否具备转化为产量和现金流的生产基础，重点关注生产状态、井网和采出程度。",
    outputs: "输出：年产量代理、生产井比例、活动生产井比例、采出程度、生产状态指数。",
    formulas: [
      "年产量代理 = 年原油产量 ÷ 1,000,000 + 年天然气产量折算为油当量 + 年凝析油产量 ÷ 1,000,000；缺少年产量时按剩余可采量与评价年限估算",
      "生产状态指数 = 生产状态评分 × 0.38 + 生产井比例评分 × 0.22 + 活动生产井比例评分 × 0.16 + 年产量规模评分 × 0.14 + 采出程度压力评分 × 0.10"
    ]
  },
  engineering: {
    purpose: "把陆海环境、水深、储层复杂程度和可复用设施等工程因素转换为开发成本和开发投资压力。",
    outputs: "输出：单位开发成本、开发投资代理、工程成本指数。",
    formulas: [
      "基准成本 = 按陆上、陆架/浅海、深水类别选取用户输入的单位成本；水深附加成本 = max(0, 最大水深 - 200) × 0.012",
      "单位开发成本 = (基准成本 + 水深附加成本) × 储层复杂度系数 × 生产阶段系数 × (1 - 设施复用抵减)",
      "开发投资代理 = 剩余可采当量 × 单位开发成本；工程成本指数 = 单位成本评分 × 0.45 + 水深评分 × 0.24 + 井证据评分 × 0.16 + 储层复杂度评分 × 0.15"
    ]
  },
  commercial: {
    purpose: "把合同区块状态、匹配可信度、作业者一致性和合同数据完整度纳入评价，反映项目从资源到可进入项目之间的商业约束。",
    outputs: "输出：匹配合同区块、商业条件系数、商业条件指数。",
    formulas: [
      "合同匹配 = 当前合同区块名称精确匹配区块名称或合同名称；未匹配时按同国别盆地回退匹配，并降低匹配可信度",
      "商业条件系数 = 匹配合同的平均值；单合同系数由细分合同状态、合同类型、可用状态、油气田与合同作业者一致性、匹配可信度及字段完整度共同确定",
      "合同到期年份仅在源数据实际存在时参与评分；缺失时只降低数据完整度，不以统一默认年份或默认分数替代",
      "商业条件指数 = 商业条件系数 × 100 × 0.52 + 合同状态评分 × 0.16 + 匹配可信度 × 0.16 + 数据完整度 × 0.10 + 油气田作业者记录 × 0.06"
    ]
  },
  result: {
    purpose: "把资源规模、产量能力、工程投资、商业条件和价格风险统一为金额型价值结果与可比较的经济吸引力结论。",
    outputs: "输出：风险后收入、NPV 代理、价值结果指数、经济指数和经济分级。",
    formulas: [
      "总收入代理 = 剩余油 × 油价 + 剩余气 × 气价 ÷ 1000 + 剩余凝析油 × 油价；年现金流现值 = [年产量代理 × 桶油当量收入 × (1 - 税费权益扣减) - 年产量代理 × 操作成本] × 年金现值系数",
      "风险后收入 = (年现金流现值 + 剩余资源折减价值) × 储量可信度 × 商业条件系数 × (1 - 地质风险扣减)",
      "NPV 代理 = 风险后收入 - 开发投资代理 - 废弃成本代理；经济指数 = 资源基础指数 × 0.20 + 生产状态指数 × 0.18 + 工程成本指数 × 0.18 + 商业条件指数 × 0.16 + 价值结果指数 × 0.28"
    ]
  }
};

function html(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stageIndex() {
  return state.config.stages.findIndex(stage => stage.id === state.stage);
}

function currentRows() {
  return state.result?.rows || [];
}

function activeRow() {
  return currentRows().find(row => row.id === state.activeId) || currentRows()[0] || null;
}

function gradeClass(label) {
  if (/优先|强|较好/.test(label)) return "grade-priority";
  if (/进入|支撑|复核|中等|具备/.test(label)) return "grade-good";
  if (/观察|敏感|待核/.test(label)) return "grade-watch";
  return "grade-gap";
}

async function loadConfig() {
  const response = await fetch("../api/evaluation/economic/config");
  if (!response.ok) throw new Error("无法加载经济评价配置");
  const config = await response.json();
  state.config = config;
  state.assumptions = { ...config.defaultAssumptions, ...state.assumptions };
}

async function runStage(stage = state.stage, page = 1) {
  state.stage = stage;
  state.view = "results";
  state.filters.page = page;
  state.loading = true;
  state.error = "";
  renderPage();

  try {
    const response = await fetch("../api/evaluation/economic/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage: state.stage,
        page: state.filters.page,
        pageSize: state.filters.pageSize,
        filters: state.filters,
        assumptions: state.assumptions
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || payload.message || "经济评价计算失败");
    state.result = payload;
    state.activeId = payload.rows?.[0]?.id || null;
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderPage();
  }
}

function optionList(values, current, allLabel) {
  const items = [allLabel, ...(values || [])];
  return items.map(value => `<option value="${html(value)}" ${value === current ? "selected" : ""}>${html(value)}</option>`).join("");
}

function renderShellLayout() {
  return `
    <div class="evaluation-app evaluation-app--workflow">
      <section class="evaluation-workspace">
        <section class="evaluation-view-panel ${state.view === "inputs" ? "is-active" : ""}" data-evaluation-view="inputs">${renderControls()}</section>
        <section class="evaluation-view-panel ${state.view === "method" ? "is-active" : ""}" data-evaluation-view="method">${renderMethodView()}</section>
        <section class="evaluation-view-panel ${state.view === "results" ? "is-active" : ""}" data-evaluation-view="results">${renderStagePanel()}</section>
      </section>
    </div>
  `;
}

function goStage(stageId) {
  state.stage = stageId;
  state.view = "inputs";
  state.result = null;
  state.activeId = null;
  state.error = "";
  renderPage();
}

function setEvaluationView(view) {
  state.view = view;
  renderPage();
}

function renderControls() {
  const stageInput = STAGE_INPUTS[state.stage];
  return `
    <section class="content-section evaluation-controls">
      <div class="section-heading">
        <div>
          <h3>本阶段输入</h3>
          <p>字段与参数仅展示当前阶段实际参与计算的内容。</p>
        </div>
        <div class="parameter-actions">
          <button type="button" class="button-ghost" data-action="reset-params">重置</button>
          <button type="button" class="module-link" data-action="run-stage">运行本步骤</button>
        </div>
      </div>
      <div class="evaluation-input-layout">
        <div class="evaluation-source-panel">
          <h4>已接入数据字段</h4>
          ${renderSourceGroups(stageInput.sources)}
        </div>
        <div class="evaluation-parameter-panel">
          <h4>用户输入参数</h4>
          ${stageInput.assumptions.length
            ? `<div class="evaluation-assumption-grid">${stageInput.assumptions.map(renderAssumptionInput).join("")}</div>`
            : `<p class="evaluation-empty-parameter">${stageInput.emptyParameterText}</p>`}
        </div>
      </div>
      <div class="evaluation-scope-panel">
        <h4>评价对象筛选</h4>
        <div class="evaluation-filter-grid">
          ${stageInput.filters.map(renderFilterInput).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderMethodView() {
  const method = STAGE_METHODS[state.stage];
  return `
    <section class="content-section evaluation-method-view">
      <div class="section-heading">
        <div>
          <h3>${STAGE_COPY[state.stage].title}计算方法</h3>
          <p>查看本步骤的业务作用、输入依据、主要计算逻辑和阶段输出。</p>
        </div>
        <button type="button" class="module-link" data-action="run-stage">运行本步骤</button>
      </div>
      <div class="evaluation-method-summary">
        <h4>本阶段计算意义</h4>
        <p>${method.purpose}</p>
        <strong>${method.outputs}</strong>
      </div>
      ${renderStageMethod()}
    </section>
  `;
}

function renderStageMethod() {
  const method = STAGE_METHODS[state.stage];
  return `
    <div class="evaluation-method-panel">
      <div>
        <h4>主要计算公式</h4>
        <ol>
          ${method.formulas.map(formula => `<li>${html(formula)}</li>`).join("")}
        </ol>
      </div>
    </div>
  `;
}

function renderSourceGroups(groups) {
  return groups.map(group => `
    <div class="evaluation-source-group">
      <strong>${html(group.name)}</strong>
      <div class="evaluation-field-list">
        ${group.fields.map(([label, field]) => `<span title="${html(field)}"><b>${html(label)}</b><code>${html(field)}</code></span>`).join("")}
      </div>
    </div>
  `).join("");
}

function renderAssumptionInput(key) {
  const meta = ASSUMPTION_META[key];
  return `
    <label>
      <span>${meta.label}<small>${meta.unit}</small></span>
      <input type="number" step="${meta.step}" data-assumption="${key}" value="${html(state.assumptions[key])}" />
    </label>
  `;
}

function renderFilterInput(key) {
  const options = state.config.options;
  const controls = {
    keyword: `<label><span>关键字</span><input data-filter="keyword" value="${html(state.filters.keyword)}" placeholder="油气田、盆地、区块、作业者" /></label>`,
    country: `<label><span>国家</span><select data-filter="country">${optionList(options.countries, state.filters.country, "全部国家")}</select></label>`,
    basin: `<label><span>盆地</span><select data-filter="basin">${optionList(options.basins, state.filters.basin, "全部盆地")}</select></label>`,
    status: `<label><span>生产状态</span><select data-filter="status">${optionList(options.statuses, state.filters.status, "全部状态")}</select></label>`,
    hydrocarbon: `<label><span>油气类型</span><select data-filter="hydrocarbon">${optionList(options.hydrocarbonTypes, state.filters.hydrocarbon, "全部油气类型")}</select></label>`,
    minRemainingMmboe: `<label><span>最小剩余可采</span><input type="number" min="0" step="1" data-filter="minRemainingMmboe" value="${html(state.filters.minRemainingMmboe)}" /><small>MMboe</small></label>`,
    maxWaterDepthMeter: `<label><span>最大水深</span><input type="number" min="0" step="50" data-filter="maxWaterDepthMeter" value="${html(state.filters.maxWaterDepthMeter)}" placeholder="不限" /><small>m</small></label>`,
    pageSize: `<label><span>每页结果数</span><select data-filter="pageSize">${[10, 20, 50, 100].map(size => `<option value="${size}" ${size === Number(state.filters.pageSize) ? "selected" : ""}>${size}</option>`).join("")}</select></label>`
  };
  return controls[key] || "";
}

function renderStagePanel() {
  const row = activeRow();
  return `
    <section class="content-section">
      <div class="section-heading">
        <div>
          <h3>${STAGE_COPY[state.stage].title}</h3>
          <p>${renderStageSubtitle()}</p>
        </div>
        <div class="parameter-actions">
          <button type="button" class="button-ghost" data-action="prev-stage" ${stageIndex() <= 0 ? "disabled" : ""}>上一步</button>
          <button type="button" class="module-link" data-action="next-stage" ${stageIndex() >= state.config.stages.length - 1 ? "disabled" : ""}>下一步</button>
        </div>
      </div>
      ${state.error ? `<pre class="error-panel">${html(state.error)}</pre>` : ""}
      ${state.loading ? `<div class="placeholder-card">正在计算...</div>` : renderResultContent(row)}
    </section>
  `;
}

function renderStageSubtitle() {
  const subtitles = {
    resource: "计算剩余可采、储量可信度、采收率和资源规模指数。",
    production: "计算生产准备度、井证据、年产量代理和递减压力。",
    engineering: "计算开发成本、作业难度、水深与储层复杂度。",
    commercial: "匹配合同区块服务，计算商业窗口和作业组织条件。",
    result: "汇总资源、生产、工程、商业和价值结果，形成经济评价分级。"
  };
  return subtitles[state.stage];
}

function renderResultContent(row) {
  if (!state.result) return `<div class="placeholder-card">点击运行本步骤开始计算。</div>`;
  return `
    ${renderSummary()}
    <div class="evaluation-split">
      <article class="content-card">
        ${renderTable()}
        ${renderPager()}
      </article>
      <article class="content-card evaluation-detail-panel">
        ${renderDetail(row)}
      </article>
    </div>
  `;
}

function renderSummary() {
  const cards = state.result.stageSummary?.cards || [];
  return `
    <div class="metric-grid evaluation-summary">
      ${cards.map(card => `
        <article class="metric-card">
          <span>${html(card.label)}</span>
          <strong>${formatNumber(card.value, Number.isInteger(Number(card.digits)) ? Number(card.digits) : Number.isInteger(Number(card.value)) ? 0 : 1)}</strong>
          ${card.unit ? `<small>${html(card.unit)}</small>` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function renderTable() {
  const rows = currentRows();
  if (!rows.length) return `<div class="placeholder-card">当前条件下没有可评价对象。</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${STAGE_COPY[state.stage].columns.map(column => `<th>${column}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr class="${row.id === state.activeId ? "is-selected" : ""}" data-action="select-row" data-id="${html(row.id)}">
              ${renderTableCells(row)}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTableCells(row) {
  const score = formatNumber(row.stageScore, 1);
  if (state.stage === "resource") {
    return `
      <td>${html(row.name)}</td><td>${html(row.country)}</td><td>${html(row.basin)}</td>
      <td>${formatNumber(row.stageMetrics.remainingMmboe, 1)}</td>
      <td>${formatNumber(row.stageMetrics.recoverableMmboe, 1)}</td>
      <td>${formatNumber(row.stageMetrics.recoveryFactorPct, 1)}%</td>
      <td>${score}</td>
    `;
  }
  if (state.stage === "production") {
    return `
      <td>${html(row.name)}</td><td>${html(row.country)}</td><td>${html(row.status)}</td>
      <td>${formatNumber(row.stageMetrics.annualBoeMm, 2)}</td>
      <td>${formatNumber(row.stageMetrics.wells)}</td>
      <td>${formatNumber(row.stageMetrics.producers)}</td>
      <td>${score}</td>
    `;
  }
  if (state.stage === "engineering") {
    return `
      <td>${html(row.name)}</td><td>${html(row.country)}</td><td>${html(row.stageMetrics.terrain)}</td>
      <td>${formatNumber(row.stageMetrics.costPerBoe, 1)}</td>
      <td>${formatNumber(row.stageMetrics.developmentCostMM)}</td>
      <td>${formatNumber(row.stageMetrics.waterDepthMeter)}</td>
      <td>${score}</td>
    `;
  }
  if (state.stage === "commercial") {
    return `
      <td>${html(row.name)}</td><td>${html(row.country)}</td><td>${html(row.stageMetrics.block)}</td>
      <td>${html(row.stageMetrics.operator)}</td>
      <td>${formatNumber(row.stageMetrics.contracts)}</td>
      <td>${formatNumber(row.stageMetrics.commercialFactor, 2)}</td>
      <td>${score}</td>
    `;
  }
  return `
    <td>${html(row.name)}</td><td>${html(row.country)}</td>
    <td><span class="grade-chip ${gradeClass(row.grade)}">${html(row.grade)}</span></td>
    <td>${formatNumber(row.scores.economicIndex, 1)}</td>
    <td>${formatNumber(row.economics.npvProxyMM)}</td>
    <td>${formatNumber(row.economics.marginPct, 1)}%</td>
    <td>${formatNumber(row.metrics.remainingMmboe, 1)}</td>
  `;
}

function renderPager() {
  const pager = state.result.pagination;
  return `
    <div class="evaluation-pager">
      <span>共 ${formatNumber(pager.total)} 条，第 ${pager.page} / ${pager.totalPages} 页</span>
      <div>
        <button type="button" class="button-ghost" data-action="prev-page" ${pager.page <= 1 ? "disabled" : ""}>上一页</button>
        <button type="button" class="button-ghost" data-action="next-page" ${pager.page >= pager.totalPages ? "disabled" : ""}>下一页</button>
      </div>
    </div>
  `;
}

function renderDetail(row) {
  if (!row) return `<div class="placeholder-card">请选择一个评价对象。</div>`;
  return `
    <div class="result-card__head">
      <div>
        <span class="grade-chip ${gradeClass(row.grade)}">${html(row.grade)}</span>
        <h3>${html(row.name)}</h3>
        <p>${html(row.country)} · ${html(row.basin)}</p>
      </div>
      <div class="result-card__score result-card__score--detail">
        <strong>${formatNumber(row.stageScore, 1)}</strong>
        <small>${STAGE_COPY[state.stage].title}</small>
      </div>
    </div>
    <div class="detail-stat-grid">
      ${renderDetailStats(row)}
    </div>
    <h3>${state.stage === "result" ? "分项指数" : "本阶段指数"}</h3>
    <div class="dimension-list">
      ${renderStageScoreBars(row)}
    </div>
    <h3>关键依据</h3>
    <ul class="plain-list">${row.drivers.map(item => `<li>${html(item)}</li>`).join("")}</ul>
    <h3>合同区块</h3>
    ${renderContracts(row)}
  `;
}

function renderDetailStats(row) {
  const stageStats = {
    resource: [
      ["剩余可采", `${formatNumber(row.metrics.remainingMmboe, 1)} MMboe`],
      ["总可采", `${formatNumber(row.metrics.recoverableMmboe, 1)} MMboe`],
      ["采收率", `${formatNumber(row.metrics.recoveryFactorPct, 1)}%`],
      ["储量可信度", formatNumber(row.economics.reserveConfidence, 2)]
    ],
    production: [
      ["年产量代理", `${formatNumber(row.metrics.annualBoeMm, 2)} MMboe`],
      ["总井", formatNumber(row.metrics.wells)],
      ["生产井", formatNumber(row.metrics.producers)],
      ["活动生产井", formatNumber(row.metrics.activeProducers)],
      ["采出程度", `${formatNumber(row.metrics.depletionRatioPct, 1)}%`]
    ],
    engineering: [
      ["单位成本", `${formatNumber(row.economics.costPerBoe, 1)} USD/boe`],
      ["开发投资", `${formatNumber(row.economics.developmentCostMM)} MMUSD`],
      ["最大水深", `${formatNumber(row.metrics.waterDepthMeter)} m`],
      ["储层数量", formatNumber(row.metrics.reservoirs)]
    ],
    commercial: [
      ["商业系数", formatNumber(row.economics.commercialFactor, 2)],
      ["合同匹配", formatNumber(row.contracts.length)],
      ["合同区块", row.block],
      ["作业者", row.operator]
    ],
    result: [
      ["经济指数", formatNumber(row.scores.economicIndex, 1)],
      ["NPV代理", `${formatNumber(row.economics.npvProxyMM)} MMUSD`],
      ["利润率", `${formatNumber(row.economics.marginPct, 1)}%`],
      ["风险后收入", `${formatNumber(row.economics.riskedRevenueMM)} MMUSD`],
      ["开发投资", `${formatNumber(row.economics.developmentCostMM)} MMUSD`]
    ]
  };
  const stats = stageStats[state.stage] || stageStats.result;
  return stats.map(([label, value]) => `<article class="detail-stat"><span>${label}</span><strong>${value}</strong></article>`).join("");
}

function renderStageScoreBars(row) {
  if (state.stage === "result") {
    return `
      ${renderScoreBar("资源基础", row.scores.resourceScore)}
      ${renderScoreBar("生产状态", row.scores.productionScore)}
      ${renderScoreBar("工程成本", row.scores.engineeringScore)}
      ${renderScoreBar("商业条件", row.scores.commercialScore)}
      ${renderScoreBar("价值结果", row.scores.valueScore)}
    `;
  }
  const labels = {
    resource: ["资源基础", row.scores.resourceScore],
    production: ["生产状态", row.scores.productionScore],
    engineering: ["工程成本", row.scores.engineeringScore],
    commercial: ["商业条件", row.scores.commercialScore]
  };
  const [label, value] = labels[state.stage] || ["阶段指数", row.stageScore];
  return renderScoreBar(label, value);
}

function renderScoreBar(label, value) {
  const width = Math.max(3, Math.min(100, Number(value) || 0));
  return `
    <div class="dimension-item">
      <div class="dimension-item__head">
        <strong>${label}</strong>
        <div class="dimension-item__score"><strong>${formatNumber(value, 1)}</strong></div>
      </div>
      <div class="dimension-bar"><i style="width:${width}%"></i></div>
    </div>
  `;
}

function renderContracts(row) {
  if (!row.contracts.length) return `<div class="placeholder-card">未匹配到合同区块记录。</div>`;
  return `
    <div class="evaluation-contract-list">
      ${row.contracts.map(contract => `
        <div>
          <strong>${html(contract.block)}</strong>
          <span>${html(contract.status)} · ${html(contract.operator)} · ${safeText(contract.expiryYear)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function resetInputs() {
  state.filters = {
    keyword: "",
    country: "全部国家",
    basin: "全部盆地",
    status: "全部状态",
    hydrocarbon: "全部油气类型",
    minRemainingMmboe: 10,
    maxWaterDepthMeter: "",
    page: 1,
    pageSize: 20
  };
  state.assumptions = { ...state.config.defaultAssumptions };
  state.activeId = null;
}

function bindEvents() {
  state.root.querySelectorAll("[data-action='switch-stage']").forEach(button => {
    button.addEventListener("click", () => goStage(button.dataset.stage));
  });

  state.root.querySelectorAll("[data-action='run-stage']").forEach(button => {
    button.addEventListener("click", () => runStage(state.stage, 1));
  });
  state.root.querySelector("[data-action='prev-stage']")?.addEventListener("click", () => {
    const previous = state.config.stages[Math.max(0, stageIndex() - 1)];
    if (previous) goStage(previous.id);
  });
  state.root.querySelector("[data-action='next-stage']")?.addEventListener("click", () => {
    const next = state.config.stages[Math.min(state.config.stages.length - 1, stageIndex() + 1)];
    if (next) goStage(next.id);
  });
  state.root.querySelector("[data-action='reset-params']")?.addEventListener("click", () => {
    resetInputs();
    goStage("resource");
  });

  state.root.querySelectorAll("[data-filter]").forEach(input => {
    input.addEventListener("change", event => {
      const key = input.dataset.filter;
      state.filters[key] = key === "pageSize" ? Number(event.target.value) : event.target.value;
      state.filters.page = 1;
      state.result = null;
      state.activeId = null;
      renderPage();
    });
    input.addEventListener("input", event => {
      if (input.dataset.filter === "keyword") {
        state.filters.keyword = event.target.value;
        state.result = null;
        state.activeId = null;
      }
    });
  });

  state.root.querySelectorAll("[data-assumption]").forEach(input => {
    input.addEventListener("change", event => {
      const key = input.dataset.assumption;
      const value = Number(event.target.value);
      if (Number.isFinite(value)) state.assumptions[key] = value;
      state.result = null;
      state.activeId = null;
      renderPage();
    });
  });

  state.root.querySelectorAll("[data-action='select-row']").forEach(row => {
    row.addEventListener("click", () => {
      state.activeId = row.dataset.id;
      renderPage();
    });
  });

  state.root.querySelector("[data-action='prev-page']")?.addEventListener("click", () => {
    const page = Math.max(1, (state.result?.pagination?.page || 1) - 1);
    runStage(state.stage, page);
  });

  state.root.querySelector("[data-action='next-page']")?.addEventListener("click", () => {
    const page = (state.result?.pagination?.page || 1) + 1;
    runStage(state.stage, page);
  });
}

function isEvaluationModuleActive() {
  const spaShell = document.querySelector(".app-shell[data-spa-shell]");
  return !spaShell || document.querySelector('[data-module-nav="evaluation"]')?.classList.contains("is-active");
}

function mountEvaluationContext() {
  if (!state.config || !isEvaluationModuleActive()) return;
  const context = setShellContext(`
    <div class="nav-context__title">评价算法模块</div>
    <details class="nav-tree" open>
      <summary>经济评价</summary>
      <div class="nav-tree__items">
        <details class="nav-tree nav-tree--level-1" open>
          <summary>评价流程</summary>
          <div class="nav-tree__items">
            ${state.config.stages.map((stage, index) => `
              <button type="button" class="nav-context__item nav-context__item--step ${state.stage === stage.id ? "is-active" : ""}" data-evaluation-stage="${stage.id}"><b>${index + 1}</b>${stage.name}</button>
              ${state.stage === stage.id ? `
                <div class="nav-tree__children">
                  <details class="nav-tree nav-tree--level-2" open>
                    <summary>当前步骤</summary>
                    <div class="nav-tree__items">
                      <button type="button" class="nav-context__item nav-context__item--nested ${state.view === "inputs" ? "is-active" : ""}" data-evaluation-view="inputs"><i></i>输入参数</button>
                      <button type="button" class="nav-context__item nav-context__item--nested ${state.view === "method" ? "is-active" : ""}" data-evaluation-view="method"><i></i>计算方法</button>
                      <button type="button" class="nav-context__item nav-context__item--nested ${state.view === "results" ? "is-active" : ""}" data-evaluation-view="results"><i></i>阶段结果</button>
                    </div>
                  </details>
                </div>
              ` : ""}
            `).join("")}
          </div>
        </details>
      </div>
    </details>
    <details class="nav-tree" open>
      <summary>评价方法库</summary>
      <div class="nav-tree__items">
        <a class="nav-context__item nav-context__item--nested" href="./methods.html"><i></i>石油地质及资源量估算</a>
      </div>
    </details>
  `);
  context?.querySelectorAll("[data-evaluation-stage]").forEach(button => {
    button.addEventListener("click", () => goStage(button.dataset.evaluationStage));
  });
  context?.querySelectorAll("[data-evaluation-view]").forEach(button => {
    button.addEventListener("click", () => setEvaluationView(button.dataset.evaluationView));
  });
}

function renderPage() {
  if (!state.root) return;
  if (!state.config) {
    state.root.innerHTML = `<div class="placeholder-card">正在加载评价配置...</div>`;
    return;
  }
  state.root.innerHTML = renderShellLayout();
  bindEvents();
  mountEvaluationContext();
}

async function init() {
  state.root = renderShell({
    currentKey: "evaluation",
    heroTitle: "经济评价工作台",
    heroDesc: "基于非洲油气田、合同区块和盆地数据执行分步骤经济评价。",
    heroMeta: ["参数输入", "后端计算", "阶段结果"]
  });
  renderPage();
  await loadConfig();
  renderPage();
  window.addEventListener("module-shown", event => {
    if (event.detail?.key === "evaluation") mountEvaluationContext();
  });
}

init().catch(error => {
  const container = document.querySelector('[data-module-container="evaluation"]') || document.body;
  container.innerHTML = `<pre class="error-panel">${html(error.message)}</pre>`;
});
