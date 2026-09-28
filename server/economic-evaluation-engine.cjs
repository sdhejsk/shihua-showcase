const crypto = require("crypto");
const { getEconomicDataset, recordEvaluationRun } = require("./data-access/repository.cjs");

const DEFAULT_ASSUMPTIONS = {
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
};

const STAGES = [
  { id: "resource", name: "资源基础", unit: "油气田", scoreKey: "resourceScore" },
  { id: "production", name: "生产状态", unit: "油气田", scoreKey: "productionScore" },
  { id: "engineering", name: "工程成本", unit: "油气田", scoreKey: "engineeringScore" },
  { id: "commercial", name: "商业条件", unit: "油气田", scoreKey: "commercialScore" },
  { id: "result", name: "评价结果", unit: "油气田", scoreKey: "economicIndex" }
];

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const text = String(value).trim().replace(/,/g, "");
  if (!text || text === "-") return 0;
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text && text !== "-" ? text : fallback;
}

function normalizeKey(value) {
  return cleanText(value).toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function logScore(value, reference, floor = 0) {
  const current = Math.max(0, toNumber(value));
  const base = Math.max(1, toNumber(reference));
  if (!current) return floor;
  return clamp((Math.log10(current + 1) / Math.log10(base + 1)) * 100, floor, 100);
}

function ratioScore(value, reference, floor = 0) {
  const current = Math.max(0, toNumber(value));
  const base = Math.max(1, toNumber(reference));
  if (!current) return floor;
  return clamp((current / base) * 100, floor, 100);
}

function inverseScore(value, good, bad, fallback = 65) {
  const current = toNumber(value);
  if (!current) return fallback;
  if (current <= good) return 100;
  if (current >= bad) return 15;
  return clamp(100 - ((current - good) / Math.max(1, bad - good)) * 85, 15, 100);
}

function weightedMean(pairs) {
  const totalWeight = pairs.reduce((sum, item) => sum + item.weight, 0) || 1;
  return pairs.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function splitNames(value) {
  return cleanText(value)
    .split(/[;,/|~]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function addToIndex(index, key, item) {
  const normalized = normalizeKey(key);
  if (!normalized) return;
  if (!index.has(normalized)) index.set(normalized, []);
  index.get(normalized).push(item);
}

function buildContractIndex(blocks) {
  const byBlock = new Map();
  const byBasin = new Map();
  blocks.forEach(block => {
    [block.BLOCK_NAME, block.CON_BLK_NM, block.CONTRACT].forEach(name => addToIndex(byBlock, name, block));
    splitNames(block.BAS_NAMES).forEach(name => addToIndex(byBasin, name, block));
  });
  return { byBlock, byBasin };
}

async function getDataset() {
  const dataset = await getEconomicDataset();
  return {
    ...dataset,
    contractIndex: buildContractIndex(dataset.blocks)
  };
}

function mergeAssumptions(input = {}) {
  const merged = { ...DEFAULT_ASSUMPTIONS };
  Object.entries(input || {}).forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(merged, key)) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) merged[key] = numeric;
    }
  });
  merged.discountRatePct = clamp(merged.discountRatePct, 0, 40);
  merged.geologicalRiskPct = clamp(merged.geologicalRiskPct, 0, 80);
  merged.fiscalTakePct = clamp(merged.fiscalTakePct, 0, 90);
  merged.facilityReuseCreditPct = clamp(merged.facilityReuseCreditPct, 0, 50);
  merged.evaluationYears = clamp(Math.round(merged.evaluationYears), 3, 30);
  return merged;
}

function getFieldNumbers(row) {
  const oilRecoverable = toNumber(row["Oil Recoverable Pp Mmbbl"]);
  const gasRecoverableMmscf = toNumber(row["Gas Recoverable Pp Mmscf"]);
  const condRecoverable = toNumber(row["Cond Recoverable Pp Mmbbl"]);
  const totalRecoverable = toNumber(row["Tot Recoverable Pp Mmboe"]) || oilRecoverable + gasRecoverableMmscf / 6000 + condRecoverable;
  const oilRemaining = toNumber(row["Oil Remaining Pp Mmbbl"]);
  const gasRemainingMmscf = toNumber(row["Gas Remaining Pp Mmscf"]);
  const condRemaining = toNumber(row["Cond Remaining Pp Mmbbl"]);
  const reportedRemaining = toNumber(row["Tot Remaining Pp Mmboe"]);
  const cumulativeMmboe = toNumber(row["Cumul Tot Prod Mmboe"]);
  const totalRemaining = reportedRemaining || oilRemaining + gasRemainingMmscf / 6000 + condRemaining || Math.max(0, totalRecoverable - cumulativeMmboe);
  const totalInPlace = toNumber(row["Tot In Place Pp Mmboe"]);
  const latestGasRaw = toNumber(row["Latest Annual Gas Prod Tscf"]);
  const annualOilMmboe = toNumber(row["Latest Annual Oil Prod Bbl"]) / 1000000;
  const annualGasMmboe = latestGasRaw > 1000 ? latestGasRaw / 6000000 : latestGasRaw * 166.667;
  const annualCondMmboe = toNumber(row["Latest Annual Cond Prod Bbl"]) / 1000000;

  return {
    oilRecoverable,
    gasRecoverableMmscf,
    condRecoverable,
    totalRecoverable,
    oilRemaining,
    gasRemainingMmscf,
    condRemaining,
    totalRemaining,
    cumulativeMmboe,
    totalInPlace,
    recoveryFactorPct: totalInPlace ? (totalRecoverable / totalInPlace) * 100 : 0,
    annualBoeMm: annualOilMmboe + annualGasMmboe + annualCondMmboe,
    porosityPct: toNumber(row["Porosity Max Val Pct"]),
    permeabilityMd: toNumber(row["Permeab Max Val Md"]),
    waterDepthMeter: toNumber(row["Water Depth Max Val Meter"]),
    wells: toNumber(row["Numb Wells"]),
    producers: toNumber(row["Numb Producers"]),
    activeProducers: toNumber(row["Numb Act Producers"]),
    oilProducers: toNumber(row["Numb Oil Producers"]),
    gasProducers: toNumber(row["Numb Gas Producers"]),
    dryWells: toNumber(row["Numb Dry Wells"]),
    showWells: toNumber(row["Numb Shows Wells"]),
    reservoirs: toNumber(row["Numb Reservoirs"]),
    fieldSqkm: toNumber(row["Field Sqkm"])
  };
}

function statusFactor(status) {
  const text = normalizeKey(status);
  if (/prod/.test(text)) return 0.96;
  if (/develop/.test(text)) return 0.84;
  if (/improved/.test(text)) return 0.9;
  if (/apprais/.test(text)) return 0.7;
  if (/discover/.test(text)) return 0.62;
  if (/shut/.test(text)) return 0.45;
  if (/abandon/.test(text)) return 0.24;
  return 0.5;
}

function reserveConfidence(row) {
  const text = [
    row["Oil Reserve Data Srce"],
    row["Gas Reserve Data Srce"],
    row["Cond Reserve Data Srce"]
  ].map(normalizeKey).join(" ");
  if (/operator/.test(text)) return 0.9;
  if (/within 25/.test(text)) return 0.8;
  if (/estimate/.test(text)) return 0.66;
  if (/poor/.test(text)) return 0.45;
  return 0.58;
}

function baseCostPerBoe(row, n, assumptions) {
  const area = normalizeKey(row["Ons Offshore"]);
  const terrain = normalizeKey(row.Terrain);
  if (/onshore/.test(area)) return assumptions.onshoreCostUsdPerBoe;
  if (/shelf|shallow/.test(terrain) || (n.waterDepthMeter && n.waterDepthMeter <= 200)) return assumptions.shelfCostUsdPerBoe;
  if (/deep/.test(terrain) || n.waterDepthMeter >= 700) return assumptions.deepwaterCostUsdPerBoe;
  if (/offshore/.test(area)) return Math.round((assumptions.shelfCostUsdPerBoe + assumptions.deepwaterCostUsdPerBoe) / 2);
  return Math.round((assumptions.onshoreCostUsdPerBoe + assumptions.shelfCostUsdPerBoe) / 2);
}

function contractIdentity(contract) {
  return normalizeKey(contract.BLOCK_NAME || contract.CON_BLK_NM || contract.CONTRACT)
    || normalizeKey(`${contract.OPERATOR}-${contract.BAS_NAMES}-${contract.CON_STATUS}`);
}

function uniqueContracts(contracts) {
  const seen = new Set();
  return contracts.filter(contract => {
    const key = contractIdentity(contract);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchContracts(row, contractIndex) {
  const blocks = splitNames(row["Cur Contract Block Names"]);
  const byBlock = uniqueContracts(blocks.flatMap(name => contractIndex.byBlock.get(normalizeKey(name)) || []));
  if (byBlock.length) return { contracts: byBlock.slice(0, 6), matchQuality: 1, basis: "合同区块精确匹配" };
  const country = normalizeKey(row["Country Names"]);
  const byBasin = (contractIndex.byBasin.get(normalizeKey(row["Basin Name"])) || [])
    .filter(contract => !country || !normalizeKey(contract.COUNTRY) || normalizeKey(contract.COUNTRY) === country);
  const unique = uniqueContracts(byBasin);
  if (unique.length) return { contracts: unique.slice(0, 6), matchQuality: 0.65, basis: "盆地回退匹配" };
  return { contracts: [], matchQuality: 0.3, basis: "未匹配" };
}

function contractStatusScore(status) {
  const text = normalizeKey(status);
  if (/suspend/.test(text)) return 0.28;
  if (/expired|relinq|termin|abandon/.test(text)) return 0.22;
  if (/evaluation|stud/.test(text)) return 0.48;
  if (/surface exploration/.test(text)) return 0.58;
  if (/drilling/.test(text)) return 0.64;
  if (/explorat.*prod|prod.*explorat/.test(text)) return 0.78;
  if (/develop/.test(text)) return 0.84;
  if (/production|producing/.test(text)) return 0.92;
  if (/apprais|award/.test(text)) return 0.72;
  if (/explorat/.test(text)) return 0.66;
  if (/available|open/.test(text)) return 0.54;
  return 0.5;
}

function operatorAlignmentScore(fieldOperator, contractOperator) {
  const field = normalizeKey(fieldOperator);
  const contract = normalizeKey(contractOperator);
  if (!field && !contract) return 0.45;
  if (!field || !contract) return 0.55;
  if (field === contract || field.includes(contract) || contract.includes(field)) return 0.98;
  return 0.68;
}

function expiryScore(year) {
  if (!year) return null;
  // Use the actual contractual horizon continuously; wide buckets made many
  // otherwise distinct production contracts receive exactly the same score.
  return clamp(0.5 + (year - 2025) * 0.01, 0.3, 0.9);
}

function contractExpiryYear(contract) {
  const directYear = toNumber(contract.EXP_DT_YR);
  if (directYear >= 2000 && directYear <= 2100) return directYear;
  const candidates = [
    contract.EXPSCHDTTX,
    contract.EXP_DT_TX,
    contract.END_DT_TXT,
    contract.EEXP_SCHDT,
    contract.EEXP_DTTX
  ];
  for (const candidate of candidates) {
    const match = cleanText(candidate).match(/(?:19|20)\d{2}/);
    if (match) {
      const year = Number(match[0]);
      // 1899 is the source system's empty-date sentinel, not a contractual expiry.
      if (year >= 2000 && year <= 2100) return year;
    }
  }
  return 0;
}

function contractTermsScore(contract) {
  const type = normalizeKey(`${contract.CON_TYPE || ""} ${contract.GN_CNT_TY || ""} ${contract.RT_TYPE || ""}`);
  if (/oil mining lease|lease/.test(type)) return 0.88;
  if (/concession/.test(type)) return 0.84;
  if (/production sharing|prod sharing|psc/.test(type)) return 0.74;
  if (/service/.test(type)) return 0.66;
  if (/exploration/.test(type)) return 0.62;
  return 0.58;
}

function contractAvailabilityScore(contract) {
  const available = normalizeKey(contract.AVAILABLE);
  if (available === "y" || available === "yes") return 0.86;
  if (available === "n" || available === "no") return 0.48;
  return 0.64;
}

function contractFactor(contracts, row, matchQuality) {
  if (!contracts.length) return { factor: 0.42, dataCompleteness: 0, statusScore: 0.5 };
  const scores = contracts.map(contract => {
    const status = normalizeKey(contract.CON_STATUS || contract.BLK_STATUS);
    const expiryYear = contractExpiryYear(contract);
    const statusValue = contractStatusScore(status);
    const operatorValue = operatorAlignmentScore(row["Cur Operator Names"] || row["Cur Operator Acronyms"], contract.OPERATOR);
    const groupValue = operatorAlignmentScore(row["Cur Group Names"], contract.GROUP || contract.GRP_NAME);
    const fieldStatusValue = statusFactor(row["Prod Status"]);
    const expiryValue = expiryScore(expiryYear);
    const termsValue = contractTermsScore(contract);
    const availabilityValue = contractAvailabilityScore(contract);
    const evidence = [
      { value: statusValue, weight: 0.35 },
      { value: operatorValue, weight: 0.17 },
      { value: groupValue, weight: 0.07 },
      { value: fieldStatusValue, weight: 0.14 },
      { value: termsValue, weight: 0.14 },
      { value: availabilityValue, weight: 0.05 },
      ...(expiryValue === null ? [] : [{ value: expiryValue, weight: 0.08 }])
    ];
    const dataCompleteness = [Boolean(status), Boolean(cleanText(contract.OPERATOR)), Boolean(expiryYear)]
      .filter(Boolean).length / 3;
    const factor = weightedMean(evidence) * (0.82 + dataCompleteness * 0.18) * (0.88 + matchQuality * 0.12);
    return { factor, dataCompleteness, statusScore: statusValue };
  });
  return {
    factor: scores.reduce((sum, score) => sum + score.factor, 0) / scores.length,
    dataCompleteness: scores.reduce((sum, score) => sum + score.dataCompleteness, 0) / scores.length,
    statusScore: scores.reduce((sum, score) => sum + score.statusScore, 0) / scores.length
  };
}

function annuityFactor(ratePct, years) {
  const rate = Math.max(0, ratePct) / 100;
  if (!rate) return years;
  return (1 - ((1 + rate) ** -years)) / rate;
}

function fieldLabel(row, n, stage) {
  if (stage === "resource") {
    if (n.totalRemaining >= 100) return "资源基础强";
    if (n.totalRemaining >= 20) return "资源可复核";
    return "资源规模有限";
  }
  if (stage === "production") {
    if (/prod/i.test(row["Prod Status"]) && n.activeProducers) return "生产支撑强";
    if (n.producers || n.wells) return "具备井证据";
    return "生产证据弱";
  }
  if (stage === "engineering") {
    if (/onshore/i.test(row["Ons Offshore"])) return "工程条件较好";
    if (n.waterDepthMeter >= 700) return "深水成本敏感";
    return "工程条件中等";
  }
  if (stage === "commercial") return "商业条件待核";
  return "进入经济复核";
}

function evaluateField(row, dataset, assumptions) {
  const n = getFieldNumbers(row);
  const remaining = n.totalRemaining;
  const contractMatch = matchContracts(row, dataset.contractIndex);
  const contracts = contractMatch.contracts;
  const commercialAssessment = contractFactor(contracts, row, contractMatch.matchQuality);
  const confidence = reserveConfidence(row);
  const status = cleanText(row["Prod Status"], "Unknown");
  const statusReadiness = statusFactor(status);
  const producerRatio = n.wells ? n.producers / n.wells : 0;
  const activeProducerRatio = n.producers ? n.activeProducers / n.producers : 0;
  const successRatio = n.wells ? (n.producers + n.showWells) / n.wells : 0;
  const depletionRatio = n.totalRecoverable ? clamp(n.cumulativeMmboe / n.totalRecoverable, 0, 1.3) : 0;
  const baseCost = baseCostPerBoe(row, n, assumptions);
  const waterSurcharge = n.waterDepthMeter > 200 ? (n.waterDepthMeter - 200) * 0.012 : 0;
  const complexityMultiplier = 1
    + Math.min(0.28, Math.max(0, n.reservoirs - 3) * 0.035)
    + (n.fieldSqkm > 200 ? 0.08 : 0);
  const stageMultiplier = /prod/i.test(status) ? 0.58 : /develop/i.test(status) ? 0.78 : /apprais/i.test(status) ? 0.92 : /shut/i.test(status) ? 0.7 : 1;
  const reuseCredit = (n.producers || n.activeProducers) ? assumptions.facilityReuseCreditPct / 100 : 0;
  const costPerBoe = Math.max(4, (baseCost + waterSurcharge) * complexityMultiplier * stageMultiplier * (1 - reuseCredit));
  const capexMM = remaining * costPerBoe;
  const annualBoe = n.annualBoeMm || Math.min(Math.max(remaining / assumptions.evaluationYears, 0), Math.max(remaining * 0.16, 0.2));
  const annualOpexMM = annualBoe * assumptions.opexUsdPerBoe;
  const commercialFactorValue = commercialAssessment.factor;
  const fiscalFactor = 1 - assumptions.fiscalTakePct / 100;
  const geologicalRiskFactor = 1 - assumptions.geologicalRiskPct / 100;
  const oilRevenueMM = n.oilRemaining * assumptions.oilPriceUsdPerBbl;
  const gasRevenueMM = n.gasRemainingMmscf * assumptions.gasPriceUsdPerMcf / 1000;
  const condRevenueMM = n.condRemaining * assumptions.oilPriceUsdPerBbl;
  const grossRevenueMM = oilRevenueMM + gasRevenueMM + condRevenueMM || remaining * assumptions.boeRevenueUsdPerBoe;
  const annualRevenueMM = annualBoe * assumptions.boeRevenueUsdPerBoe;
  const pvCashflowMM = (annualRevenueMM * fiscalFactor - annualOpexMM) * annuityFactor(assumptions.discountRatePct, assumptions.evaluationYears);
  const residualRevenueMM = Math.max(0, grossRevenueMM - annualRevenueMM * assumptions.evaluationYears) * 0.28;
  const riskedRevenueMM = (pvCashflowMM + residualRevenueMM) * confidence * commercialFactorValue * geologicalRiskFactor;
  const abandonmentMM = Math.max(0, n.wells) * (/offshore/i.test(row["Ons Offshore"]) ? 1.8 : 0.45);
  const npvProxyMM = riskedRevenueMM - capexMM - abandonmentMM;
  const marginPct = grossRevenueMM ? (npvProxyMM / grossRevenueMM) * 100 : 0;

  const resourceScore = weightedMean([
    { value: logScore(remaining, 500, 12), weight: 0.46 },
    { value: logScore(n.totalRecoverable, 900, 10), weight: 0.2 },
    { value: ratioScore(n.recoveryFactorPct, 45, 20), weight: 0.12 },
    { value: confidence * 100, weight: 0.14 },
    { value: ratioScore(n.reservoirs, 8, 18), weight: 0.08 }
  ]);
  const productionScore = weightedMean([
    { value: statusReadiness * 100, weight: 0.38 },
    { value: ratioScore(producerRatio * 100, 65, 10), weight: 0.22 },
    { value: ratioScore(activeProducerRatio * 100, 75, 8), weight: 0.16 },
    { value: logScore(annualBoe, 40, 8), weight: 0.14 },
    { value: clamp(100 - depletionRatio * 85, 8, 100), weight: 0.1 }
  ]);
  const engineeringScore = weightedMean([
    { value: inverseScore(costPerBoe, 12, 58, 58), weight: 0.45 },
    { value: inverseScore(n.waterDepthMeter, 120, 1800, 68), weight: 0.24 },
    { value: ratioScore(successRatio * 100, 55, 18), weight: 0.16 },
    { value: clamp(100 - Math.max(0, n.reservoirs - 2) * 5, 35, 100), weight: 0.15 }
  ]);
  const commercialScore = weightedMean([
    { value: commercialFactorValue * 100, weight: 0.52 },
    { value: commercialAssessment.statusScore * 100, weight: 0.16 },
    { value: contractMatch.matchQuality * 100, weight: 0.16 },
    { value: commercialAssessment.dataCompleteness * 100, weight: 0.1 },
    { value: cleanText(row["Cur Operator Names"]) ? 82 : 42, weight: 0.06 }
  ]);
  const valueScore = weightedMean([
    { value: logScore(Math.max(0, npvProxyMM) + remaining * 8, 9000, 4), weight: 0.46 },
    { value: clamp(marginPct + 50, 0, 100), weight: 0.26 },
    { value: ratioScore(riskedRevenueMM, 6000, 6), weight: 0.16 },
    { value: inverseScore(assumptions.discountRatePct, 8, 22, 70), weight: 0.12 }
  ]);
  const economicIndex = weightedMean([
    { value: resourceScore, weight: 0.2 },
    { value: productionScore, weight: 0.18 },
    { value: engineeringScore, weight: 0.18 },
    { value: commercialScore, weight: 0.16 },
    { value: valueScore, weight: 0.28 }
  ]);

  return {
    id: cleanText(row["Field Id"]) || normalizeKey(`${row["Country Names"]}-${row["Field Name"]}`),
    name: cleanText(row["Field Name"], "Unknown Field"),
    country: cleanText(row["Country Names"], "-"),
    basin: cleanText(row["Basin Name"], "-"),
    block: cleanText(row["Cur Contract Block Names"], "-"),
    operator: cleanText(row["Cur Operator Names"] || row["Cur Operator Acronyms"], "-"),
    status,
    hydrocarbon: cleanText(row["Hc Type"] || row["General Hc Type"], "-"),
    terrain: cleanText(row.Terrain || row["Ons Offshore"], "-"),
    labels: {
      resource: fieldLabel(row, n, "resource"),
      production: fieldLabel(row, n, "production"),
      engineering: fieldLabel(row, n, "engineering"),
      commercial: fieldLabel(row, n, "commercial")
    },
    metrics: {
      remainingMmboe: round(remaining, 2),
      recoverableMmboe: round(n.totalRecoverable, 2),
      cumulativeMmboe: round(n.cumulativeMmboe, 2),
      annualBoeMm: round(annualBoe, 2),
      recoveryFactorPct: round(n.recoveryFactorPct, 1),
      depletionRatioPct: round(depletionRatio * 100, 1),
      waterDepthMeter: round(n.waterDepthMeter, 0),
      wells: round(n.wells, 0),
      producers: round(n.producers, 0),
      activeProducers: round(n.activeProducers, 0),
      showWells: round(n.showWells, 0),
      dryWells: round(n.dryWells, 0),
      reservoirs: round(n.reservoirs, 0),
      fieldSqkm: round(n.fieldSqkm, 2)
    },
    economics: {
      grossRevenueMM: round(grossRevenueMM, 0),
      riskedRevenueMM: round(riskedRevenueMM, 0),
      developmentCostMM: round(capexMM, 0),
      annualOpexMM: round(annualOpexMM, 1),
      abandonmentMM: round(abandonmentMM, 1),
      npvProxyMM: round(npvProxyMM, 0),
      marginPct: round(marginPct, 1),
      costPerBoe: round(costPerBoe, 1),
      commercialFactor: round(commercialFactorValue, 2),
      commercialMatchQuality: round(contractMatch.matchQuality, 2),
      commercialDataCompleteness: round(commercialAssessment.dataCompleteness, 2),
      commercialMatchBasis: contractMatch.basis,
      reserveConfidence: round(confidence, 2)
    },
    scores: {
      resourceScore: round(resourceScore, 1),
      productionScore: round(productionScore, 1),
      engineeringScore: round(engineeringScore, 1),
      commercialScore: round(commercialScore, 1),
      valueScore: round(valueScore, 1),
      economicIndex: round(economicIndex, 1)
    },
    contracts: contracts.map(contract => ({
      block: cleanText(contract.BLOCK_NAME || contract.CON_BLK_NM || contract.CONTRACT, "-"),
      status: cleanText(contract.CON_STATUS || contract.BLK_STATUS, "-"),
      operator: cleanText(contract.OPERATOR, "-"),
      expiryYear: contractExpiryYear(contract) || null,
      areaSqkm: round(toNumber(contract.BLK_SQKM), 1),
      waterDepthMeter: round(toNumber(contract.MAX_WD_MT || contract.MED_WD_MT), 0)
    })),
    drivers: [
      `剩余可采 ${round(remaining, 1)} MMboe，年产量代理 ${round(annualBoe, 1)} MMboe`,
      `成本 ${round(costPerBoe, 1)} USD/boe，净现值代理 ${round(npvProxyMM, 0)} MMUSD`,
      `井证据：总井 ${round(n.wells, 0)}，生产井 ${round(n.producers, 0)}，活动生产井 ${round(n.activeProducers, 0)}`,
      contracts.length
        ? `${contractMatch.basis} ${contracts.length} 项，合同数据完整度 ${round(commercialAssessment.dataCompleteness * 100, 0)}%`
        : "未匹配到合同区块服务记录"
    ]
  };
}

function passesFilters(row, filters = {}) {
  const keyword = normalizeKey(filters.keyword);
  const country = cleanText(filters.country);
  const basin = cleanText(filters.basin);
  const status = cleanText(filters.status);
  const hydrocarbon = cleanText(filters.hydrocarbon);
  const minRemaining = toNumber(filters.minRemainingMmboe);
  const maxWaterDepth = toNumber(filters.maxWaterDepthMeter);
  const values = [
    row.name,
    row.country,
    row.basin,
    row.block,
    row.operator,
    row.status,
    row.hydrocarbon
  ].map(normalizeKey).join(" ");

  return (!keyword || values.includes(keyword))
    && (!country || country === "全部国家" || row.country === country)
    && (!basin || basin === "全部盆地" || row.basin === basin)
    && (!status || status === "全部状态" || row.status === status)
    && (!hydrocarbon || hydrocarbon === "全部油气类型" || row.hydrocarbon === hydrocarbon)
    && (!minRemaining || row.metrics.remainingMmboe >= minRemaining)
    && (!maxWaterDepth || !row.metrics.waterDepthMeter || row.metrics.waterDepthMeter <= maxWaterDepth);
}

function grade(row) {
  if (row.economics.npvProxyMM >= 500 && row.scores.economicIndex >= 72) return "优先复核";
  if (row.economics.npvProxyMM >= 0 && row.scores.economicIndex >= 58) return "进入参数复核";
  if (row.metrics.remainingMmboe >= 10 && row.scores.resourceScore >= 45) return "观察";
  return "暂缓";
}

function pickStageRows(rows, stageId) {
  const stage = STAGES.find(item => item.id === stageId) || STAGES[STAGES.length - 1];
  return rows
    .map(row => ({ ...row, grade: stage.id === "result" ? grade(row) : row.labels[stage.id] || grade(row), stageScore: row.scores[stage.scoreKey] }))
    .sort((a, b) => (b.stageScore || 0) - (a.stageScore || 0));
}

function summarize(rows) {
  const totalRemaining = rows.reduce((sum, row) => sum + row.metrics.remainingMmboe, 0);
  const totalNpv = rows.reduce((sum, row) => sum + row.economics.npvProxyMM, 0);
  const positive = rows.filter(row => row.economics.npvProxyMM >= 0).length;
  const priority = rows.filter(row => grade(row) === "优先复核").length;
  const avgIndex = rows.length ? rows.reduce((sum, row) => sum + row.scores.economicIndex, 0) / rows.length : 0;
  return {
    candidates: rows.length,
    positive,
    priority,
    totalRemainingMmboe: round(totalRemaining, 1),
    totalNpvProxyMM: round(totalNpv, 0),
    avgEconomicIndex: round(avgIndex, 1)
  };
}

function average(rows, selector) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + toNumber(selector(row)), 0) / rows.length;
}

function summarizeStage(rows, stageId) {
  if (stageId === "resource") {
    return {
      cards: [
        { label: "候选油气田", value: rows.length },
        { label: "资源基础较强", value: rows.filter(row => row.scores.resourceScore >= 75).length },
        { label: "剩余可采合计", value: round(rows.reduce((sum, row) => sum + row.metrics.remainingMmboe, 0), 1), unit: "MMboe" },
        { label: "平均资源指数", value: round(average(rows, row => row.scores.resourceScore), 1) },
        { label: "平均采收率", value: round(average(rows, row => row.metrics.recoveryFactorPct), 1), unit: "%" }
      ]
    };
  }
  if (stageId === "production") {
    return {
      cards: [
        { label: "候选油气田", value: rows.length },
        { label: "有活动生产井", value: rows.filter(row => row.metrics.activeProducers > 0).length },
        { label: "年产量代理合计", value: round(rows.reduce((sum, row) => sum + row.metrics.annualBoeMm, 0), 1), unit: "MMboe" },
        { label: "生产井合计", value: round(rows.reduce((sum, row) => sum + row.metrics.producers, 0), 0) },
        { label: "平均生产指数", value: round(average(rows, row => row.scores.productionScore), 1) }
      ]
    };
  }
  if (stageId === "engineering") {
    return {
      cards: [
        { label: "候选油气田", value: rows.length },
        { label: "低成本对象", value: rows.filter(row => row.economics.costPerBoe <= 20).length },
        { label: "平均单位成本", value: round(average(rows, row => row.economics.costPerBoe), 1), unit: "USD/boe" },
        { label: "开发投资合计", value: round(rows.reduce((sum, row) => sum + row.economics.developmentCostMM, 0), 0), unit: "MMUSD" },
        { label: "平均工程指数", value: round(average(rows, row => row.scores.engineeringScore), 1) }
      ]
    };
  }
  if (stageId === "commercial") {
    return {
      cards: [
        { label: "候选油气田", value: rows.length },
        { label: "匹配合同区块", value: rows.filter(row => row.contracts.length > 0).length },
        { label: "平均商业系数", value: round(average(rows, row => row.economics.commercialFactor), 2), digits: 2 },
        { label: "有作业者记录", value: rows.filter(row => row.operator && row.operator !== "-").length },
        { label: "平均商业指数", value: round(average(rows, row => row.scores.commercialScore), 1) }
      ]
    };
  }
  const totalNpv = rows.reduce((sum, row) => sum + row.economics.npvProxyMM, 0);
  return {
    cards: [
      { label: "候选油气田", value: rows.length },
      { label: "NPV为正", value: rows.filter(row => row.economics.npvProxyMM >= 0).length },
      { label: "优先复核", value: rows.filter(row => grade(row) === "优先复核").length },
      { label: "NPV代理合计", value: round(totalNpv, 0), unit: "MMUSD" },
      { label: "平均经济指数", value: round(average(rows, row => row.scores.economicIndex), 1) }
    ]
  };
}

function stageDrivers(row, stageId) {
  if (stageId === "resource") {
    return [
      `剩余可采 ${round(row.metrics.remainingMmboe, 1)} MMboe`,
      `总可采 ${round(row.metrics.recoverableMmboe, 1)} MMboe`,
      `采收率 ${round(row.metrics.recoveryFactorPct, 1)}%`,
      `储量可信度系数 ${round(row.economics.reserveConfidence, 2)}`
    ];
  }
  if (stageId === "production") {
    return [
      `生产状态 ${row.status}`,
      `年产量代理 ${round(row.metrics.annualBoeMm, 2)} MMboe`,
      `总井 ${round(row.metrics.wells, 0)}，生产井 ${round(row.metrics.producers, 0)}，活动生产井 ${round(row.metrics.activeProducers, 0)}`,
      `采出程度 ${round(row.metrics.depletionRatioPct, 1)}%`
    ];
  }
  if (stageId === "engineering") {
    return [
      `作业环境 ${row.terrain}`,
      `最大水深 ${round(row.metrics.waterDepthMeter, 0)} m`,
      `单位开发成本 ${round(row.economics.costPerBoe, 1)} USD/boe`,
      `开发投资代理 ${round(row.economics.developmentCostMM, 0)} MMUSD`
    ];
  }
  if (stageId === "commercial") {
    return [
      `合同区块 ${row.block}`,
      `作业者 ${row.operator}`,
      `匹配合同区块 ${row.contracts.length} 项`,
      `商业条件系数 ${round(row.economics.commercialFactor, 2)}`
    ];
  }
  return row.drivers;
}

function toStageRow(row, stageId) {
  const base = {
    id: row.id,
    name: row.name,
    country: row.country,
    basin: row.basin,
    block: row.block,
    operator: row.operator,
    status: row.status,
    hydrocarbon: row.hydrocarbon,
    grade: row.grade,
    stageScore: row.stageScore,
    metrics: row.metrics,
    economics: row.economics,
    scores: row.scores,
    drivers: stageDrivers(row, stageId),
    contracts: row.contracts
  };
  if (stageId === "resource") {
    base.stageMetrics = {
      remainingMmboe: row.metrics.remainingMmboe,
      recoverableMmboe: row.metrics.recoverableMmboe,
      recoveryFactorPct: row.metrics.recoveryFactorPct,
      reserveConfidence: row.economics.reserveConfidence
    };
  } else if (stageId === "production") {
    base.stageMetrics = {
      annualBoeMm: row.metrics.annualBoeMm,
      wells: row.metrics.wells,
      producers: row.metrics.producers,
      activeProducers: row.metrics.activeProducers,
      depletionRatioPct: row.metrics.depletionRatioPct
    };
  } else if (stageId === "engineering") {
    base.stageMetrics = {
      costPerBoe: row.economics.costPerBoe,
      developmentCostMM: row.economics.developmentCostMM,
      waterDepthMeter: row.metrics.waterDepthMeter,
      reservoirs: row.metrics.reservoirs,
      terrain: row.terrain
    };
  } else if (stageId === "commercial") {
    base.stageMetrics = {
      commercialFactor: row.economics.commercialFactor,
      contracts: row.contracts.length,
      block: row.block,
      operator: row.operator,
      matchQuality: row.economics.commercialMatchQuality,
      dataCompleteness: row.economics.commercialDataCompleteness,
      matchBasis: row.economics.commercialMatchBasis
    };
  } else {
    base.stageMetrics = {
      economicIndex: row.scores.economicIndex,
      npvProxyMM: row.economics.npvProxyMM,
      marginPct: row.economics.marginPct,
      grossRevenueMM: row.economics.grossRevenueMM,
      developmentCostMM: row.economics.developmentCostMM
    };
  }
  return base;
}

async function getConfig() {
  const dataset = await getDataset();
  return {
    stages: STAGES,
    defaultAssumptions: DEFAULT_ASSUMPTIONS,
    options: dataset.options,
    sourceSummary: dataset.sourceSummary,
    warnings: dataset.warnings
  };
}

async function runEconomicEvaluation(payload = {}) {
  const dataset = await getDataset();
  const assumptions = mergeAssumptions(payload.assumptions);
  const stageId = STAGES.some(stage => stage.id === payload.stage) ? payload.stage : "result";
  const pageSize = clamp(Number(payload.pageSize || payload.filters?.pageSize || 20), 5, 100);
  const page = Math.max(1, Number(payload.page || payload.filters?.page || 1) || 1);
  const evaluated = dataset.fields.map(row => evaluateField(row, dataset, assumptions));
  const filtered = evaluated.filter(row => passesFilters(row, payload.filters));
  const staged = pickStageRows(filtered, stageId);
  const totalPages = Math.max(1, Math.ceil(staged.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = staged.slice((safePage - 1) * pageSize, safePage * pageSize).map(row => toStageRow(row, stageId));
  const response = {
    stage: STAGES.find(item => item.id === stageId),
    assumptions,
    summary: summarize(staged),
    stageSummary: summarizeStage(staged, stageId),
    pagination: {
      page: safePage,
      pageSize,
      total: staged.length,
      totalPages
    },
    rows,
    warnings: dataset.warnings
  };
  await recordEvaluationRun({
    id: crypto.randomUUID(),
    modelKey: "africa-field-economic-evaluation",
    assumptions,
    filters: payload.filters || {},
    resultSummary: {
      stage: stageId,
      summary: response.summary,
      stageSummary: response.stageSummary,
      pagination: response.pagination
    }
  });
  return response;
}

module.exports = {
  getConfig,
  runEconomicEvaluation
};
