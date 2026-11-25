import fs from "node:fs";
import type http from "node:http";
import path from "node:path";
import { executeEffect, isValidAdminToken } from "./effects.ts";
import { runYahaModule } from "./usagiRuntime.ts";

const ROOT = process.cwd();
const STATIC_DIR = path.join(ROOT, "static");
const UPLOADS_DIR = path.join(ROOT, "public", "uploads");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".yaha": "text/plain; charset=utf-8",
};

const ALLOWED_PROXY_HOSTS = new Set([
  "github-readme-stats-fast.vercel.app",
  "streak-stats.demolab.com",
  "tokscale.ai",
]);

function extractClientIp(req: http.IncomingMessage): string {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.trim()) return cf.trim();
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) return xff.split(",")[0].trim();
  return req.socket.remoteAddress?.replace(/^::ffff:/, "") || "127.0.0.1";
}

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function readRequestBody(req: http.IncomingMessage, maxBytes = 100 * 1024 * 1024): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendStaticFile(res: http.ServerResponse, filePath: string, isUpload = false): boolean {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return false;
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": isUpload ? "public, max-age=3600" : "no-cache",
  };
  if (isUpload) {
    headers["Content-Disposition"] = "inline";
    headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'";
  }
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
  return true;
}

async function handleImageProxy(res: http.ServerResponse, url: URL): Promise<void> {
  const rawUrl = url.searchParams.get("url") || "";
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" || !ALLOWED_PROXY_HOSTS.has(parsed.hostname)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden proxy target");
      return;
    }
    const upstream = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "homepage-usagi/2.0" },
    });
    const ct = upstream.headers.get("content-type") || "image/svg+xml";
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      "Content-Type": ct,
      "Cache-Control": "public, max-age=300",
    });
    res.end(buf);
  } catch {
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="120" viewBox="0 0 420 120"><rect width="420" height="120" rx="8" fill="#1a1b27"/><text x="210" y="64" text-anchor="middle" fill="#a9b1d6" font-family="sans-serif" font-size="13">Stats preview offline (demo mode)</text></svg>`;
    res.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8" });
    res.end(fallbackSvg);
  }
}

async function handleBinaryUpload(req: http.IncomingMessage, res: http.ServerResponse, clientIp: string): Promise<void> {
  const token = String(req.headers["x-session-token"] || "");
  if (!isValidAdminToken(token, clientIp)) {
    res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "인증이 필요합니다." }));
    return;
  }
  try {
    const body = await readRequestBody(req, 95 * 1024 * 1024);
    const ct = String(req.headers["content-type"] || "");
    const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ct);
    if (!boundaryMatch) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Multipart boundary missing" }));
      return;
    }
    const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`;
    const raw = body.toString("latin1");
    const parts = raw.split(boundary).slice(1, -1);
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const uploaded: string[] = [];
    for (const part of parts) {
      const headerEnd = part.indexOf("\r\n\r\n");
      if (headerEnd === -1) continue;
      const headerText = part.slice(0, headerEnd);
      const nameMatch = /filename="([^"]+)"/i.exec(headerText);
      if (!nameMatch) continue;
      const ext = path.extname(path.basename(nameMatch[1])).toLowerCase();
      if (![".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) continue;
      const contentLatin1 = part.slice(headerEnd + 4, part.endsWith("\r\n") ? -2 : undefined);
      const safeName = `usagi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, safeName), Buffer.from(contentLatin1, "latin1"));
      uploaded.push(`/uploads/${safeName}`);
    }
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ success: true, files: uploaded }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Upload failed" }));
  }
}

function splitOutputLines(raw: string): { lines: string[]; rest: string } {
  const firstNl = raw.indexOf("\n");
  if (firstNl === -1) return { lines: [raw], rest: "" };
  const secondNl = raw.indexOf("\n", firstNl + 1);
  if (secondNl === -1) return { lines: [raw.slice(0, firstNl), raw.slice(firstNl + 1)], rest: "" };
  const thirdNl = raw.indexOf("\n", secondNl + 1);
  if (thirdNl === -1) {
    return {
      lines: [raw.slice(0, firstNl), raw.slice(firstNl + 1, secondNl), raw.slice(secondNl + 1)],
      rest: "",
    };
  }
  return {
    lines: [
      raw.slice(0, firstNl),
      raw.slice(firstNl + 1, secondNl),
      raw.slice(secondNl + 1, thirdNl),
    ],
    rest: raw.slice(thirdNl + 1),
  };
}

export async function handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const host = String(req.headers.host || "localhost:3000");
  const url = new URL(req.url || "/", `http://${host}`);
  const pathname = url.pathname;
  const method = (req.method || "GET").toUpperCase();
  const clientIp = extractClientIp(req);

  // Fast-path binary/static files
  if (pathname.startsWith("/uploads/")) {
    const safeName = path.basename(decodeURIComponent(pathname));
    if (safeName !== ".gitkeep" && sendStaticFile(res, path.join(UPLOADS_DIR, safeName), true)) return;
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  if (
    pathname === "/styles.css" ||
    pathname === "/client.js" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/docs/")
  ) {
    const rel = pathname.replace(/^\/+/, "");
    const resolved = path.resolve(STATIC_DIR, rel);
    if (resolved.startsWith(STATIC_DIR + path.sep) && sendStaticFile(res, resolved)) return;
  }

  if (pathname === "/api/proxy-image") {
    await handleImageProxy(res, url);
    return;
  }

  if (pathname === "/api/upload" && method === "POST") {
    await handleBinaryUpload(req, res, clientIp);
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const acceptLang = String(req.headers["accept-language"] || "");
  const rawBody =
    method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE"
      ? (await readRequestBody(req, 1024 * 1024)).toString("utf8")
      : "";

  const modulesRan: string[] = [];
  const effectsRan: string[] = [];
  let totalUsagiMs = 0;

  try {
    // 1. Run app/router.yaha
    const routerStdin = [
      method,
      host.toLowerCase(),
      pathname,
      url.search.replace(/^\?/, ""),
      cookies.azest_lang || "",
      acceptLang,
      clientIp,
      "",
    ].join("\n");

    const routeRes = runYahaModule("router.yaha", routerStdin, true);
    modulesRan.push("app/router.yaha");
    totalUsagiMs += routeRes.durationMs;

    const routerLines = routeRes.output.split("\n");
    const directive = routerLines[0]?.trim();

    if (directive === "HTTP") {
      const status = Number.parseInt(routerLines[1] || "200", 10) || 200;
      const contentType = routerLines[2] || "text/plain; charset=utf-8";
      const body = routerLines.slice(3).join("\n");
      res.writeHead(status, {
        "Content-Type": contentType,
        "X-Powered-By": "fp-usagi (Usagi-lang)",
        "X-Usagi-Modules": modulesRan.join(", "),
        "X-Usagi-Time-Ms": totalUsagiMs.toFixed(2),
      });
      res.end(body);
      return;
    }

    if (directive !== "DISPATCH") {
      throw new Error(`Invalid router directive: ${routeRes.output.slice(0, 120)}`);
    }

    const targetModule = routerLines[1]?.trim() || "pages/unauthorized.yaha";
    const locale = routerLines[2]?.trim() || "ko";
    const resolvedPath = routerLines[3]?.trim() || pathname;

    // 2. Effect Trampoline loop (up to 4 hops)
    let hasEffect = "0";
    let effectResult = "";
    let finalStatus = 200;
    let finalType = "text/html; charset=utf-8";
    let finalBody = "";

    const headerMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "string") headerMap[k.toLowerCase()] = v;
    }

    for (let hop = 0; hop < 4; hop++) {
      const moduleStdin = [
        method,
        locale,
        host,
        resolvedPath,
        url.search.replace(/^\?/, ""),
        clientIp,
        hasEffect,
        hasEffect === "1" ? effectResult : rawBody,
      ].join("\n");

      const modRes = runYahaModule(targetModule, moduleStdin, true);
      if (!modulesRan.includes(`app/${targetModule}`)) {
        modulesRan.push(`app/${targetModule}`);
      }
      totalUsagiMs += modRes.durationMs;

      if (modRes.output.startsWith("EFFECT\n")) {
        const parts = modRes.output.split("\n");
        const effectName = parts[1]?.trim() || "";
        const effectPayload = parts.slice(2).join("\n");
        effectsRan.push(effectName);
        effectResult = await executeEffect(effectName, effectPayload, {
          clientIp,
          headers: headerMap,
        });
        hasEffect = "1";
        continue;
      }

      if (modRes.output.startsWith("HTTP\n")) {
        const { lines, rest } = splitOutputLines(modRes.output);
        finalStatus = Number.parseInt(lines[1]?.trim() || "200", 10) || 200;
        finalType = lines[2]?.trim() || "text/html; charset=utf-8";
        finalBody = rest;
        break;
      }

      throw new Error(`Unexpected module output from ${targetModule}: ${modRes.output.slice(0, 120)}`);
    }

    if (finalType.includes("text/html")) {
      const traceSummary = JSON.stringify({
        modules: modulesRan,
        effects: effectsRan,
        usagiMs: Number(totalUsagiMs.toFixed(2)),
        locale,
        path: resolvedPath,
      });
      finalBody = finalBody.replace(
        "<!--USAGI_TRACE_DATA-->",
        `<script id="usagi-trace-json" type="application/json">${traceSummary.replaceAll("<", "\\u003c")}</script>`,
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": finalType,
      "X-Powered-By": "fp-usagi (Usagi-lang v0.6.0)",
      "X-Usagi-Modules": modulesRan.join(", "),
      "X-Usagi-Time-Ms": totalUsagiMs.toFixed(2),
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };
    if (effectsRan.length > 0) {
      headers["X-Usagi-Effects"] = effectsRan.join(", ");
    }
    if (finalType.includes("text/html")) {
      headers["Vary"] = "Accept-Language, Cookie";
      headers["Content-Security-Policy"] =
        "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://cdn.discordapp.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";
    } else if (finalType.includes("application/json")) {
      headers["Cache-Control"] = "no-store";
    }

    res.writeHead(finalStatus, headers);
    res.end(finalBody);
  } catch (err) {
    console.error("Usagi Bridge Error:", err);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Usagi Bridge Error: ${err instanceof Error ? err.message : String(err)}`);
  }
}
