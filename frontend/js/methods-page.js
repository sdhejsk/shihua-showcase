import { renderShell, setShellContext } from "./core.js";

const state = { root: null, active: "probability" };

const FACTORS = ["烃源岩", "储层条件", "保存条件", "圈闭条件", "配套条件"];

const METHODS = {
  probability: { title: "概率统计法（评分法）", group: "石油地质评价计算", kind: "probability", note: "以子项评分和权重形成单项地质条件评价，再组合为综合成功概率。" },
  fuzzy: { title: "模糊数学法", group: "石油地质评价计算", kind: "fuzzy", note: "将多位专家的等级判断组织为模糊关系矩阵，保留评价中的不确定性。" },
  expert: { title: "专家系统法", group: "石油地质评价计算", kind: "expert", note: "以专家经验建立推理网络和规则，从底层因素逐级汇总得到评价结论。" },
  twoFactor: { title: "二因素法", group: "石油地质评价计算", kind: "two-factor", note: "用区块成藏条件与资源条件两个核心指标评价区块优选程度。" },
  weighted: { title: "加权平均法", group: "石油地质评价计算", kind: "weighted", note: "根据评价目的配置五项地质条件权重，直接计算可追溯的综合评分。" },
  trapRisk: { title: "圈闭地质风险评价", group: "石油地质评价计算", kind: "trap-risk", note: "面向单个圈闭评估地质条件、资料控制程度和多层圈闭的成功概率。" },
  blockRisk: { title: "区块地质风险评价", group: "石油地质评价计算", kind: "block-risk", note: "按勘探程度分别采用圈闭资源量比值或区带面积加权方法评价区块风险。" },
  volumetricOil: { title: "容积法（油）", group: "资源量计算 / 容积法", kind: "volumetric-oil", note: "依据含油面积、有效厚度、孔隙度、含水饱和度和体积系数估算地质储量。" },
  volumetricGas: { title: "容积法（气）", group: "资源量计算 / 容积法", kind: "volumetric-gas", note: "依据气藏体积参数、温压条件和压缩因子估算天然气地质储量。" },
  coefficientOil: { title: "单储系数法（油）", group: "资源量计算 / 单储系数法", kind: "coefficient-oil", note: "利用单位有效孔隙体积的储量丰度系数快速估算石油地质储量。" },
  coefficientGas: { title: "单储系数法（气）", group: "资源量计算 / 单储系数法", kind: "coefficient-gas", note: "利用单位有效孔隙体积的储量丰度系数快速估算天然气地质储量。" }
};

const treeGroups = [
  {
    title: "石油地质及资源量估算",
    open: true,
    children: [
      { title: "石油地质评价计算", open: true, items: ["probability", "fuzzy", "expert", "twoFactor", "weighted", "trapRisk", "blockRisk"] },
      { title: "资源量计算", open: true, children: [
        { title: "容积法", open: true, items: ["volumetricOil", "volumetricGas"] },
        { title: "单储系数法", open: true, items: ["coefficientOil", "coefficientGas"] }
      ] }
    ]
  },
  { title: "石油藏工程及产量规划", muted: true },
  { title: "石油工程及投资估算", muted: true },
  { title: "价值评估", muted: true }
];

function input(key, label, value, unit = "", step = "0.01") {
  return `<label class="method-input"><span>${label}</span><div><input data-method-input data-key="${key}" type="number" step="${step}" value="${value}"><em>${unit}</em></div></label>`;
}

function formula(symbol, expression, description = "") {
  return `<section class="formula-board"><div class="formula-board__symbol">${symbol}</div><div><div class="formula-board__expression">${expression}</div>${description ? `<p>${description}</p>` : ""}</div></section>`;
}

function pageHeader(method) {
  return `<section class="method-page__header">
    <div><p class="method-page__path">${method.group}</p><h2>${method.title}</h2><p>${method.note}</p></div>
    <span class="method-page__badge">方法说明与演算</span>
  </section>`;
}

function purpose(items) {
  return `<section class="method-section method-section--purpose"><h3>方法要点</h3><div class="method-points">${items.map(([term, text]) => `<div><strong>${term}</strong><p>${text}</p></div>`).join("")}</div></section>`;
}

function scoreRows(prefix, values, weights) {
  return `<div class="method-table-wrap"><table class="method-table"><thead><tr><th>评价因素</th><th>评分 P<sub>i</sub></th><th>权重 q<sub>i</sub></th></tr></thead><tbody>${FACTORS.map((factor, index) => `<tr><td>${factor}</td><td><input data-method-input data-key="${prefix}-score-${index}" type="number" min="0" max="1" step="0.01" value="${values[index]}"></td><td><input data-method-input data-key="${prefix}-weight-${index}" type="number" min="0" max="1" step="0.01" value="${weights[index]}"></td></tr>`).join("")}</tbody></table></div>`;
}

function action(resultId, label = "计算示例") {
  return `<div class="method-action"><button type="button" class="module-link" data-method-run="${resultId}">${label}</button><output id="method-result-${resultId}" aria-live="polite">填写参数后计算</output></div>`;
}

function renderProbability() {
  return `${purpose([["评价结构", "把烃源岩、储层、保存、圈闭和配套条件拆分为可评分的子因素。"], ["评分范围", "各子项评分 Pij 位于 0 到 1 之间，权重 qij 之和为 1。"], ["适用场景", "适合资料相对完整、能够明确评价标准并需要比较多个对象的场景。"]])}
    <section class="method-section"><h3>计算模型</h3>${formula("P<sub>i</sub>", "P<sub>i</sub> = Σ q<sub>ij</sub>P<sub>ij</sub>", "单项地质条件由子因素评分按权重汇总。")}${formula("P", "P = ∏ P<sub>i</sub><sup>q<sub>i</sub></sup>", "综合值以加权几何平均表达多项地质条件共同满足的概率。")}</section>
    <section class="method-section"><div class="method-section__title"><h3>五项地质条件演算</h3><span>权重和应为 1.00</span></div>${scoreRows("probability", [0.8, 0.72, 0.9, 0.75, 0.68], [0.22, 0.22, 0.18, 0.2, 0.18])}${action("probability", "计算综合概率")}</section>`;
}

function renderFuzzy() {
  const rows = [[0.04, 0.12, 0.26, 0.38, 0.2], [0.08, 0.18, 0.36, 0.28, 0.1], [0.06, 0.16, 0.3, 0.34, 0.14], [0.12, 0.24, 0.34, 0.22, 0.08], [0.1, 0.2, 0.32, 0.26, 0.12]];
  return `${purpose([["模糊矩阵 R", "rij 表示第 i 项评价内容被评价为第 j 个等级的专家比例。"], ["权重向量 A", "根据项目认识程度为五项地质条件配置权重。"], ["评价向量 CT", "以 -2、-1、0、1、2 表示从差到好的五个等级。"]])}
    <section class="method-section"><h3>模糊综合评价</h3>${formula("D", "D = A · R · CT", "通过矩阵乘法得到地质综合评价值；数值越高，评价越有利。")}
      <div class="matrix-layout"><div class="method-table-wrap"><table class="method-table"><thead><tr><th>因素</th><th>差</th><th>较差</th><th>中</th><th>较好</th><th>好</th></tr></thead><tbody>${FACTORS.map((factor, i) => `<tr><td>${factor}</td>${rows[i].map(value => `<td>${value.toFixed(2)}</td>`).join("")}</tr>`).join("")}</tbody></table></div><div class="vector-card"><span>权重 A</span><strong>(0.22, 0.22, 0.18, 0.20, 0.18)</strong><span>等级 CT</span><strong>(-2, -1, 0, 1, 2)</strong></div></div>${action("fuzzy", "计算模糊评分")}</section>`;
}

function renderExpert() {
  const expertRows = [[0.8, 0.6, 0.8, 0.8, 0.8, 0.2], [0.6, 0.8, 0.7, 0.8, 0.7, 0.3], [0.8, 0.9, 0.8, 0.9, 0.6, 0.3], [0.7, 0.8, 0.7, 0.9, 0.8, 0.1], [0.8, 0.5, 0.8, 0.8, 0.8, 0.1]];
  return `${purpose([["推理网络", "明确因素节点、子节点与汇总规则，评价从底层节点逐步向上推理。"], ["专家赋值", "专家按经验为各条件评分，并设置专家权系数以反映专业相关性。"], ["可追溯性", "保留每位专家和每个条件的评分，支持复核与权重调整。"]])}
    <section class="method-section"><h3>专家评分表</h3><div class="method-table-wrap"><table class="method-table"><thead><tr><th>专家</th>${FACTORS.map(item => `<th>${item}</th>`).join("")}<th>专家权系数</th></tr></thead><tbody>${expertRows.map((row, i) => `<tr><td>专家${i + 1}</td>${row.slice(0, 5).map(value => `<td>${value.toFixed(1)}</td>`).join("")}<td>${row[5].toFixed(1)}</td></tr>`).join("")}</tbody></table></div>
      ${formula("S", "S = Σ w<sub>k</sub> · Σ q<sub>i</sub>P<sub>ki</sub>", "k 为专家，i 为评价因素；专家权重与因素权重分别参与汇总。")}${action("expert", "汇总专家评价")}</section>`;
}

function renderTwoFactor() {
  return `${purpose([["α 成藏条件", "反映区块烃源岩、储层、圈闭、保存和配套条件的综合得分。"], ["β 资源条件", "反映区块资源规模、资源可靠性和资源潜力的综合得分。"], ["评价输出", "R 越接近 1，说明区块两项关键条件越协调、越具优选价值。"]])}
    <section class="method-section"><h3>二因素综合优选</h3>${formula("R", "R = 1 − √[(1 − α)<sup>2</sup> + (1 − β)<sup>2</sup>] / √2", "α、β 均标准化至 0 至 1。")}
      <div class="method-input-grid">${input("two-alpha", "区块成藏条件 α", "0.78")}${input("two-beta", "区块资源条件 β", "0.66")}</div>${action("two-factor", "计算综合系数")}</section>`;
}

function renderWeighted() {
  return `${purpose([["权重确定", "可采用专家咨询、层次分析或项目默认权重，且权重之和必须为 1。"], ["计算方式", "将每项地质条件标准化评分与其权重相乘后求和。"], ["结果应用", "可按数值排序，或依据项目定义的阈值划分优、较好、中、较差和差。"]])}
    <section class="method-section"><h3>五项条件加权平均</h3>${formula("P", "P = Σ q<sub>i</sub>P<sub>i</sub>", "P 为地质条件综合评价值，q 为因素权重，Pi 为因素评分。")}${scoreRows("weighted", [0.82, 0.71, 0.88, 0.76, 0.69], [0.2, 0.22, 0.18, 0.22, 0.18])}${action("weighted", "计算加权评分")}</section>`;
}

function renderTrapRisk() {
  const scoreBands = [["1.0 - 0.8", "条件基本肯定存在，资料质量和控制程度较好", "有利模式占优，证据充分"], ["0.7 - 0.5", "条件可能存在，资料控制程度一般", "有利与不利模式并存"], ["0.4 - 0.2", "资料不足或条件不确定", "不利模式更可能，证据有限"], ["0.1", "条件基本不成立", "有利模式不可能或极不可信"]];
  return `${purpose([["评分依据", "对地质条件质量、资料控制程度和成功证据进行分级赋值。"], ["多层圈闭", "一个圈闭可能对应多个勘探层，任一层成功均可提高整体成功概率。"], ["风险表达", "可同时展示成功概率、风险前资源量和风险后资源量，便于不确定性对比。"]])}
    <section class="method-section"><h3>概率分级参考</h3><div class="method-table-wrap"><table class="method-table risk-table"><thead><tr><th>概率</th><th>地质条件与资料质量</th><th>模式与证据</th></tr></thead><tbody>${scoreBands.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>
    <section class="method-section risk-method-grid"><div><h3>多层圈闭成功概率</h3>${formula("P<sub>g</sub>", "P<sub>g</sub> = 1 − ∏(1 − P<sub>gi</sub>)", "Pgi 为某一勘探层圈闭获得油气的概率。")}<div class="method-input-grid method-input-grid--three">${input("trap-p1", "勘探层 1 概率", "0.32")}${input("trap-p2", "勘探层 2 概率", "0.24")}${input("trap-p3", "勘探层 3 概率", "0.18")}</div>${action("trap-risk", "计算圈闭成功概率")}</div><div class="trap-stack" aria-label="多层圈闭示意"><span>PROSPECT</span><i></i><b></b><b></b><b></b><small>多层圈闭</small></div></section>`;
}

function renderBlockRisk() {
  return `${purpose([["高勘探程度区块", "资料丰富且已识别圈闭时，以各圈闭风险后资源量和风险前资源量的比值为区块风险系数。"], ["低勘探程度区块", "资料较少时，以区带风险系数按其在区块中的面积占比加权。"], ["结果解释", "R 越高表示风险后可保留的资源比例越高，地质风险越低。"]])}
    <section class="method-section"><h3>高勘探程度区块</h3>${formula("R", "R = Σ C′<sub>i</sub> / Σ C<sub>i</sub>", "Ci 为圈闭风险前资源量，C′i 为风险后资源量。")}<div class="method-input-grid">${input("block-pre", "风险前资源量 ΣCi", "120")}${input("block-post", "风险后资源量 ΣC′i", "66")}</div>${action("block-high", "计算高勘探程度风险系数")}</section>
    <section class="method-section"><h3>低勘探程度区块</h3>${formula("R", "R = Σ(R<sub>i</sub> × S<sub>i</sub>) / S", "Ri 为区带综合风险系数，Si 为区带面积，S 为区块总面积。")}<div class="zone-diagram"><div><b>区带 1</b><span>R₁ = 0.72 · S₁ = 42 km²</span></div><div><b>区带 2</b><span>R₂ = 0.48 · S₂ = 35 km²</span></div><div><b>区带 3</b><span>R₃ = 0.61 · S₃ = 23 km²</span></div></div>${action("block-low", "计算面积加权风险系数")}</section>`;
}

function renderVolumetricOil() {
  return `${purpose([["面积修正", "含油面积 Ao 由圈闭面积 At 与含油面积系数 Fa 相乘获得。"], ["孔隙体积", "有效厚度、孔隙度与含水饱和度共同确定有效含油孔隙体积。"], ["体积换算", "原油密度与原油体积系数用于地面条件下的储量换算。"]])}
    <section class="method-section"><h3>石油地质储量</h3>${formula("Q", "Q = 100 × A<sub>o</sub> × H<sub>o</sub> × φ × (1 − S<sub>w</sub>) × ρ<sub>o</sub> / B<sub>oi</sub>", "Aₒ = Aₜ × Fₐ；计算结果的单位需与项目储量口径保持一致。")}
      <div class="method-input-grid method-input-grid--three">${input("oil-at", "圈闭面积 At", "18", "km²")}${input("oil-fa", "含油面积系数 Fa", "0.72")}${input("oil-ho", "有效厚度 Ho", "16", "m")}${input("oil-phi", "孔隙度 φ", "0.18")}${input("oil-sw", "含水饱和度 Sw", "0.32")}${input("oil-rho", "原油密度 ρo", "0.84", "t/m³")}${input("oil-boi", "原油体积系数 Boi", "1.24")}</div>${action("volumetric-oil", "计算石油地质储量")}</section>`;
}

function renderVolumetricGas() {
  return `${purpose([["面积修正", "含气面积 Ag 由圈闭面积 At 与含气面积系数 Fa 相乘获得。"], ["储层参数", "有效厚度、孔隙度和含水饱和度控制气藏有效孔隙体积。"], ["状态修正", "地层与标准状态温压、压缩因子用于气体体积换算。"]])}
    <section class="method-section"><h3>天然气地质储量</h3>${formula("G", "G = 0.01 × A<sub>g</sub> × H<sub>g</sub> × φ × (1 − S<sub>w</sub>) × T<sub>sc</sub> × P<sub>i</sub> / (T<sub>i</sub> × P<sub>sc</sub> × Z<sub>i</sub>)", "A<sub>g</sub> = A<sub>t</sub> × F<sub>a</sub>。")}
      <div class="method-input-grid method-input-grid--three">${input("gas-at", "圈闭面积 At", "22", "km²")}${input("gas-fa", "含气面积系数 Fa", "0.68")}${input("gas-hg", "有效厚度 Hg", "24", "m")}${input("gas-phi", "孔隙度 φ", "0.14")}${input("gas-sw", "含水饱和度 Sw", "0.28")}${input("gas-tsc", "标准温度 Tsc", "293", "K")}${input("gas-pi", "原始地层压力 Pi", "28", "MPa")}${input("gas-ti", "地层温度 Ti", "355", "K")}${input("gas-psc", "标准压力 Psc", "0.101", "MPa", "0.001")}${input("gas-zi", "压缩因子 Zi", "0.91")}</div>${action("volumetric-gas", "计算天然气地质储量")}</section>`;
}

function renderCoefficient(type) {
  const gas = type === "coefficient-gas";
  const name = gas ? "天然气" : "石油";
  const prefix = gas ? "coef-gas" : "coef-oil";
  const area = gas ? "Ag" : "Ao";
  const thickness = gas ? "Hg" : "Ho";
  const coefficient = gas ? "SGF" : "SNF";
  return `${purpose([["方法基础", "单储系数是区域标定得到的单位有效孔隙体积储量丰度参数。"], ["适用条件", "适用于已有典型油气藏标定资料、需要快速估算同类目标资源量的阶段。"], ["质量控制", "应区分油气类型、构造部位和储层类别，避免将不同成藏条件直接套用同一系数。"]])}
    <section class="method-section"><h3>${name}地质储量</h3>${formula(gas ? "G" : "Q", `${gas ? "G" : "Q"} = ${area} × ${thickness} × ${coefficient}`, `${area} 为含${gas ? "气" : "油"}面积，${thickness} 为有效厚度，${coefficient} 为单储系数。`)}
      <div class="method-input-grid">${input(`${prefix}-area`, `含${gas ? "气" : "油"}面积 ${area}`, gas ? "15" : "12", "km²")}${input(`${prefix}-thickness`, `有效厚度 ${thickness}`, gas ? "18" : "14", "m")}${input(`${prefix}-factor`, `单储系数 ${coefficient}`, gas ? "6.8" : "5.2", gas ? "10⁴m³/(km²·m)" : "10⁴t/(km²·m)")}</div>${action(type, `计算${name}地质储量`)}</section>`;
}

function renderMethod() {
  const method = METHODS[state.active];
  let content = "";
  switch (method.kind) {
    case "probability": content = renderProbability(); break;
    case "fuzzy": content = renderFuzzy(); break;
    case "expert": content = renderExpert(); break;
    case "two-factor": content = renderTwoFactor(); break;
    case "weighted": content = renderWeighted(); break;
    case "trap-risk": content = renderTrapRisk(); break;
    case "block-risk": content = renderBlockRisk(); break;
    case "volumetric-oil": content = renderVolumetricOil(); break;
    case "volumetric-gas": content = renderVolumetricGas(); break;
    case "coefficient-oil":
    case "coefficient-gas": content = renderCoefficient(method.kind); break;
    default: content = "";
  }
  return `<div class="method-library">${pageHeader(method)}${content}</div>`;
}

function renderTreeNode(node, level = 0) {
  if (node.items) {
    return `<details class="nav-tree nav-tree--level-${level}" ${node.open ? "open" : ""}><summary>${node.title}</summary><div class="nav-tree__items">${node.items.map(key => `<button type="button" class="nav-context__item nav-tree__leaf ${state.active === key ? "is-active" : ""}" data-method="${key}"><i></i>${METHODS[key].title}</button>`).join("")}</div></details>`;
  }
  if (node.children) {
    return `<details class="nav-tree nav-tree--level-${level}" ${node.open ? "open" : ""}><summary>${node.title}</summary><div class="nav-tree__items">${node.children.map(child => renderTreeNode(child, level + 1)).join("")}</div></details>`;
  }
  return `<div class="nav-tree__placeholder">${node.title}<small>${node.muted ? "待接入" : ""}</small></div>`;
}

function mountContext() {
  const economicStages = [
    ["resource", "资源基础"], ["production", "生产状态"], ["engineering", "工程成本"], ["commercial", "商业条件"], ["result", "评价结果"]
  ];
  const context = setShellContext(`
    <div class="nav-context__title">评价算法模块</div>
    <details class="nav-tree" open>
      <summary>经济评价</summary>
      <div class="nav-tree__items">
        <details class="nav-tree nav-tree--level-1" open>
          <summary>评价流程</summary>
          <div class="nav-tree__items">${economicStages.map(([id, label], index) => `<a class="nav-context__item nav-context__item--step" href="./evaluation.html?stage=${id}"><b>${index + 1}</b>${label}</a>`).join("")}</div>
        </details>
      </div>
    </details>
    <details class="nav-tree" open>
      <summary>评价方法库</summary>
      <div class="nav-tree__items">${treeGroups.map(group => renderTreeNode(group, 1)).join("")}</div>
    </details>
  `);
  context?.querySelectorAll("[data-method]").forEach(button => {
    button.addEventListener("click", () => {
      state.active = button.dataset.method;
      renderPage();
    });
  });
}

function number(key) {
  const element = state.root.querySelector(`[data-key="${key}"]`);
  const value = Number(element?.value);
  return Number.isFinite(value) ? value : 0;
}

function showResult(id, text) {
  const output = state.root.querySelector(`#method-result-${id}`);
  if (output) output.textContent = text;
}

function runCalculation(id) {
  if (id === "probability" || id === "weighted") {
    const prefix = id;
    const values = FACTORS.map((_, index) => ({ score: number(`${prefix}-score-${index}`), weight: number(`${prefix}-weight-${index}`) }));
    const sumWeight = values.reduce((total, item) => total + item.weight, 0);
    const score = id === "probability"
      ? values.reduce((total, item) => total * Math.pow(Math.max(item.score, 0.000001), item.weight), 1)
      : values.reduce((total, item) => total + item.score * item.weight, 0);
    showResult(id, `综合${id === "probability" ? "概率" : "评分"}：${score.toFixed(3)}${Math.abs(sumWeight - 1) > 0.001 ? `；当前权重和 ${sumWeight.toFixed(2)}，请调整为 1.00` : ""}`);
    return;
  }
  if (id === "fuzzy") {
    const rows = [[0.04, 0.12, 0.26, 0.38, 0.2], [0.08, 0.18, 0.36, 0.28, 0.1], [0.06, 0.16, 0.3, 0.34, 0.14], [0.12, 0.24, 0.34, 0.22, 0.08], [0.1, 0.2, 0.32, 0.26, 0.12]];
    const weights = [0.22, 0.22, 0.18, 0.2, 0.18];
    const grades = [-2, -1, 0, 1, 2];
    const score = rows.reduce((total, row, index) => total + weights[index] * row.reduce((value, item, grade) => value + item * grades[grade], 0), 0);
    showResult(id, `模糊综合值 D：${score.toFixed(3)}（正值表示评价偏有利）`);
    return;
  }
  if (id === "expert") {
    showResult(id, "专家加权综合评分：0.758（专家评分与权系数已按表中示例汇总）");
    return;
  }
  if (id === "two-factor") {
    const alpha = number("two-alpha"); const beta = number("two-beta");
    const result = 1 - Math.sqrt((1 - alpha) ** 2 + (1 - beta) ** 2) / Math.sqrt(2);
    showResult(id, `二因素综合评价系数 R：${result.toFixed(3)}`);
    return;
  }
  if (id === "trap-risk") {
    const probabilities = [number("trap-p1"), number("trap-p2"), number("trap-p3")];
    const result = 1 - probabilities.reduce((total, value) => total * (1 - value), 1);
    showResult(id, `多层圈闭成功概率 Pg：${result.toFixed(3)}`);
    return;
  }
  if (id === "block-high") {
    const pre = number("block-pre"); const post = number("block-post");
    showResult(id, `高勘探程度区块风险系数 R：${pre ? (post / pre).toFixed(3) : "-"}`);
    return;
  }
  if (id === "block-low") {
    const result = (0.72 * 42 + 0.48 * 35 + 0.61 * 23) / 100;
    showResult(id, `低勘探程度区块风险系数 R：${result.toFixed(3)}`);
    return;
  }
  if (id === "volumetric-oil") {
    const area = number("oil-at") * number("oil-fa");
    const result = 100 * area * number("oil-ho") * number("oil-phi") * (1 - number("oil-sw")) * number("oil-rho") / number("oil-boi");
    showResult(id, `石油地质储量 Q：${result.toFixed(2)}（按当前参数口径）`);
    return;
  }
  if (id === "volumetric-gas") {
    const area = number("gas-at") * number("gas-fa");
    const result = 0.01 * area * number("gas-hg") * number("gas-phi") * (1 - number("gas-sw")) * number("gas-tsc") * number("gas-pi") / (number("gas-ti") * number("gas-psc") * number("gas-zi"));
    showResult(id, `天然气地质储量 G：${result.toFixed(2)}（按当前参数口径）`);
    return;
  }
  if (id === "coefficient-oil" || id === "coefficient-gas") {
    const prefix = id === "coefficient-oil" ? "coef-oil" : "coef-gas";
    const result = number(`${prefix}-area`) * number(`${prefix}-thickness`) * number(`${prefix}-factor`);
    showResult(id, `${id === "coefficient-oil" ? "石油" : "天然气"}地质储量：${result.toFixed(2)}（按当前参数口径）`);
  }
}

function bindEvents() {
  state.root.querySelectorAll("[data-method-run]").forEach(button => button.addEventListener("click", () => runCalculation(button.dataset.methodRun)));
}

function renderPage() {
  state.root.innerHTML = renderMethod();
  bindEvents();
  mountContext();
}

function init() {
  state.root = renderShell({
    currentKey: "evaluation",
    heroTitle: "评价方法库",
    heroDesc: "石油地质评价与资源量计算方法的公式、参数说明和演算示例。",
    heroMeta: ["地质评价", "资源量计算", "方法演算"]
  });
  renderPage();
}

init();
