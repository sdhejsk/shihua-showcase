const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const {
  getConfig: getEconomicEvaluationConfig,
  runEconomicEvaluation
} = require("./server/economic-evaluation-engine.cjs");
const { healthcheck } = require("./server/data-access/database.cjs");
const {
  getAfricaIndex,
  getDocumentAsset,
  getPlatformState,
  getSpatialLayer,
  getSpatialLayerSummary
} = require("./server/data-access/repository.cjs");
const { getObjectStream } = require("./server/data-access/object-store.cjs");

const root = __dirname;
const port = Number(process.env.PORT || 5173);
// Kept only until the PostGIS migration has completed and been accepted.
const migrationFallbackEnabled = process.env.MIGRATION_FALLBACK !== "false";
const igsTarget = {
  protocol: "http:",
  hostname: "localhost",
  port: 8089
};
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel"
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (!text) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res) {
  const requestUrl = new URL(req.url || "/", "http://localhost");
  const urlPath = decodeURIComponent(requestUrl.pathname);
  try {
    if (req.method === "GET" && urlPath === "/api/health") {
      sendJson(res, 200, { status: "ok", database: await healthcheck() });
      return true;
    }

    if (req.method === "GET" && urlPath === "/api/platform-state") {
      sendJson(res, 200, await getPlatformState());
      return true;
    }

    if (req.method === "GET" && urlPath === "/api/africa/index") {
      sendJson(res, 200, await getAfricaIndex());
      return true;
    }

    if (req.method === "GET" && urlPath === "/api/spatial/summary") {
      sendJson(res, 200, await getSpatialLayerSummary());
      return true;
    }

    const spatialMatch = urlPath.match(/^\/api\/spatial\/(basins|contract_blocks|fields|wells)$/);
    if (req.method === "GET" && spatialMatch) {
      sendJson(res, 200, await getSpatialLayer(spatialMatch[1], {
        country: requestUrl.searchParams.get("country") || "",
        basin: requestUrl.searchParams.get("basin") || "",
        keyword: requestUrl.searchParams.get("keyword") || "",
        limit: requestUrl.searchParams.get("limit") || "",
        offset: requestUrl.searchParams.get("offset") || "",
        mode: requestUrl.searchParams.get("mode") || "",
        bbox: requestUrl.searchParams.get("bbox") || ""
      }));
      return true;
    }

    const documentMatch = urlPath.match(/^\/api\/documents\/(\d+)\/download$/);
    if (req.method === "GET" && documentMatch) {
      const asset = await getDocumentAsset(Number(documentMatch[1]));
      if (!asset || asset.storage_status !== "uploaded" || !asset.object_key) {
        sendJson(res, 404, { message: "Document is not available in object storage" });
        return true;
      }
      const stream = await getObjectStream(asset.object_key);
      res.writeHead(200, {
        "Content-Type": asset.media_type || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.file_name)}`,
        "Cache-Control": "private, no-store"
      });
      stream.on("error", error => {
        if (!res.headersSent) sendJson(res, 502, { message: "Object storage read error", detail: error.message });
        else res.destroy(error);
      });
      stream.pipe(res);
      return true;
    }

    if (req.method === "GET" && urlPath === "/api/evaluation/economic/config") {
      sendJson(res, 200, await getEconomicEvaluationConfig());
      return true;
    }

    if (req.method === "POST" && urlPath === "/api/evaluation/economic/run") {
      const body = await readJsonBody(req);
      sendJson(res, 200, await runEconomicEvaluation(body));
      return true;
    }
  } catch (error) {
    const unavailable = ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "3D000", "28000", "28P01"].includes(error.code)
      || String(error.code || "").startsWith("08");
    sendJson(res, unavailable ? 503 : 500, {
      message: unavailable ? "Database service is unavailable" : "Data API error",
      detail: error.message
    });
    return true;
  }

  return false;
}

function proxyIgs(req, res) {
  const targetUrl = new URL(req.url, `${igsTarget.protocol}//${igsTarget.hostname}:${igsTarget.port}`);

  const proxyReq = http.request({
    protocol: igsTarget.protocol,
    hostname: igsTarget.hostname,
    port: igsTarget.port,
    path: `${targetUrl.pathname}${targetUrl.search}`,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${igsTarget.hostname}:${igsTarget.port}`
    }
  }, proxyRes => {
    const chunks = [];
    proxyRes.on("data", chunk => {
      chunks.push(chunk);
    });
    proxyRes.on("end", () => {
      const body = Buffer.concat(chunks);
      const headers = {
        ...proxyRes.headers
      };
      res.writeHead(proxyRes.statusCode || 502, headers);
      res.end(body);
    });
  });

  proxyReq.setTimeout(180000, () => {
    proxyReq.destroy(new Error("IGServer proxy timeout"));
  });

  proxyReq.on("error", error => {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ message: "IGServer proxy error", detail: error.message }));
  });

  req.pipe(proxyReq);
}

function sendFile(target, res) {
  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(target)] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    res.end(data);
  });
}

http.createServer(async (req, res) => {
  if ((req.url || "").startsWith("/api/")) {
    if (await handleApi(req, res)) return;
  }

  if ((req.url || "").startsWith("/igs/")) {
    proxyIgs(req, res);
    return;
  }

  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (!migrationFallbackEnabled && (urlPath.startsWith("/source-data/") || urlPath.startsWith("/data/"))) {
    sendJson(res, 410, { message: "Static source data has been retired. Use the database API." });
    return;
  }

  const target = path.resolve(path.join(root, urlPath === "/" ? "frontend/index.html" : urlPath));
  if (target !== root && !target.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  sendFile(target, res);
}).listen(port, () => {
  console.log(`Demo server running at http://localhost:${port}/frontend/index.html`);
});


