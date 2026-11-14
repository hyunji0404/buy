/* Node.js 기본 모듈로 정적 화면과 Vercel API 함수를 로컬에서 확인합니다. */
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 6 * 1024 * 1024;
const API_FUNCTIONS = new Map([
  ["/api/analyze", "analyze.js"],
  ["/api/diagnose", "diagnose.js"]
]);
const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  ["/script.js", ["script.js", "text/javascript; charset=utf-8"]],
  // 페이지 제목 띠에 쓰는 배경 사진(허용 목록 방식이라 정적 파일을 하나씩 등록합니다)
  ["/assets/editorial-paper.jpg", ["assets/editorial-paper.jpg", "image/jpeg"]],
  ["/assets/footer-flatlay.jpg", ["assets/footer-flatlay.jpg", "image/jpeg"]]
]);

// 로컬 전용 환경 파일은 빈 값을 덮어쓰지 않으며 콘솔에 비밀값을 출력하지 않습니다.
loadLocalEnvironment();

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://${HOST}:${PORT}`).pathname;
  if (API_FUNCTIONS.has(pathname)) {
    await handleApi(req, res, API_FUNCTIONS.get(pathname));
    return;
  }
  serveStatic(req, res, pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`로컬 테스트 서버가 http://${HOST}:${PORT} 에서 실행 중입니다.`);
  console.log("종료하려면 Ctrl+C를 누르세요.");
});

function loadLocalEnvironment() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || match[1].startsWith("#") || process.env[match[1]] !== undefined) return;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  });
}

async function handleApi(req, res, functionFile) {
  if (req.method !== "POST") {
    res.writeHead(405, { Allow: "POST", "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "POST 요청만 사용할 수 있어요.", code: "METHOD_NOT_ALLOWED" }));
    return;
  }
  const contentType = req.headers["content-type"] || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    res.writeHead(415, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "JSON 요청만 사용할 수 있어요.", code: "INVALID_CONTENT_TYPE" }));
    return;
  }

  try {
    const body = await readJsonBody(req);
    const handler = require(path.join(ROOT, "api", functionFile));
    const functionRequest = { method: req.method, headers: req.headers, body };
    const functionResponse = createFunctionResponse(res);
    await handler(functionRequest, functionResponse);
  } catch (error) {
    const status = error.code === "BODY_TOO_LARGE" ? 413 : 400;
    const message = status === 413 ? "요청 크기가 허용 한도를 초과했어요." : "요청 본문을 읽지 못했어요.";
    if (!res.headersSent) {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: message, code: status === 413 ? "BODY_TOO_LARGE" : "INVALID_JSON" }));
    }
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    req.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        const error = new Error("요청 크기 초과");
        error.code = "BODY_TOO_LARGE";
        settled = true;
        reject(error);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("JSON 파싱 실패"));
      }
    });
    req.on("error", (error) => {
      if (!settled) reject(error);
    });
  });
}

function createFunctionResponse(res) {
  return {
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      res.setHeader(name, value);
      return this;
    },
    json(payload) {
      if (res.writableEnded) return this;
      res.writeHead(this.statusCode || 200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload));
      return this;
    }
  };
}

function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }
  const file = STATIC_FILES.get(pathname);
  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const filePath = path.resolve(ROOT, file[0]);
  if (!filePath.startsWith(`${ROOT}${path.sep}`)) {
    res.writeHead(404);
    res.end();
    return;
  }
  fs.readFile(filePath, (error, contents) => {
    if (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("파일을 읽지 못했습니다.");
      return;
    }
    res.writeHead(200, {
      "Content-Type": file[1],
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store"
    });
    res.end(req.method === "HEAD" ? undefined : contents);
  });
}

server.on("error", (error) => {
  console.error("로컬 테스트 서버를 시작하지 못했습니다.", error.message);
  process.exitCode = 1;
});
