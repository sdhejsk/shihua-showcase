const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const root = __dirname;
const sourceDataRoot = path.resolve("D:\\shihua_data");
const port = Number(process.env.PORT || 5173);
const igsTarget = {
  protocol: "http:",
  hostname: "localhost",
  port: 8089
};
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel"
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

http.createServer((req, res) => {
  if ((req.url || "").startsWith("/igs/")) {
    proxyIgs(req, res);
    return;
  }

  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath.startsWith("/source-data/")) {
    const relativePath = urlPath.replace(/^\/source-data\/?/, "");
    const target = path.resolve(path.join(sourceDataRoot, relativePath));
    if (target !== sourceDataRoot && !target.startsWith(sourceDataRoot + path.sep)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    sendFile(target, res);
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


