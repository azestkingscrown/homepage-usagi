import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Worker } from "node:worker_threads";
import { encodeNumber, encodeText } from "../engine/usagi/encode.ts";
import { listYahaFiles, readYahaSource } from "./usagiRuntime.ts";

const execFilePromise = promisify(execFile);

const ROOT = process.cwd();
const AVAILABILITY_FILE = path.join(ROOT, "availability.json");
const LOG_FILE = path.join(ROOT, "server_logs.json");
const WHITELIST_FILE = path.join(ROOT, "whitelist.json");
const DDNS_FILE = path.join(ROOT, "ddns_state.json");
const UPLOADS_DIR = path.join(ROOT, "public", "uploads");
const DOCS_DIR = path.join(ROOT, "static", "docs");

const NET_INTERFACE = process.env.NET_INTERFACE?.trim() || "eth0";
const CONTAINER_NAME = process.env.MC_CONTAINER_NAME?.trim() || "minecraft-server";
const DISCORD_ID = process.env.DISCORD_OWNER_ID?.trim() || "";

interface AvailabilityRecord {
  startTime: number;
  upSeconds: number;
  totalSeconds: number;
  lastSeen?: number;
}

interface AvailabilityFile {
  oracle: AvailabilityRecord;
  gcp: AvailabilityRecord;
  tablet: AvailabilityRecord;
  mini: AvailabilityRecord;
}

interface AdminSession {
  expiresAt: number;
  ip: string;
}

const adminSessions = new Map<string, AdminSession>();
const SESSION_TTL = 30 * 60 * 1000;

let lastCpus = os.cpus();
let lastNet = { rx: 0, tx: 0, time: Date.now() };
let cachedDiscord: {
  status: string;
  username: string;
  globalName: string;
  id: string;
  avatar: string;
  avatarBase64: string;
  fetchedAt: number;
} = {
  status: "online",
  username: "azest_kingscrown",
  globalName: "Azest_Kingscrown",
  id: DISCORD_ID || "0",
  avatar: "",
  avatarBase64: "",
  fetchedAt: 0,
};

function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonSafe(filePath: string, data: unknown): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  } catch {
    // ignore disk errors in demo mode
  }
}

function getAvailability(): AvailabilityFile {
  const now = Date.now();
  const fallback: AvailabilityFile = {
    oracle: { startTime: now, upSeconds: 1, totalSeconds: 1, lastSeen: now },
    gcp: { startTime: now, upSeconds: 1, totalSeconds: 1 },
    tablet: { startTime: now, upSeconds: 1, totalSeconds: 1 },
    mini: { startTime: now, upSeconds: 1, totalSeconds: 1 },
  };
  const raw = readJsonSafe<Partial<AvailabilityFile>>(AVAILABILITY_FILE, {});
  return {
    oracle: raw.oracle || fallback.oracle,
    gcp: raw.gcp || fallback.gcp,
    tablet: raw.tablet || fallback.tablet,
    mini: raw.mini || fallback.mini,
  };
}

function formatSpeed(bps: number): string {
  if (!Number.isFinite(bps) || bps < 0) return "0.0 KB/s";
  if (bps > 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bps / 1024).toFixed(1)} KB/s`;
}

export function gatherSystemMetricsRaw(): string {
  const cpus = os.cpus();
  const cpuUsages = cpus.map((cpu, idx) => {
    const prev = lastCpus[idx] || cpu;
    const idle = cpu.times.idle - prev.times.idle;
    const total =
      Object.values(cpu.times).reduce((a, b) => a + b, 0) -
      Object.values(prev.times).reduce((a, b) => a + b, 0);
    const pct = total > 0 ? Math.max(0, Math.min(100, ((total - idle) / total) * 100)) : 0;
    return `${idx}:${pct.toFixed(1)}`;
  });
  lastCpus = cpus;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const toGB = (b: number) => (b / 1024 ** 3).toFixed(2);
  const memPct = totalMem > 0 ? ((usedMem / totalMem) * 100).toFixed(1) : "0.0";

  let zUsed = "0.00";
  let zTotal = "0.00";
  let zPct = "0.0";
  try {
    const meminfo = fs.readFileSync("/proc/meminfo", "utf8");
    const getVal = (k: string) => {
      const m = new RegExp(`${k}:\\s+(\\d+)`).exec(meminfo);
      return m ? Number.parseInt(m[1], 10) * 1024 : 0;
    };
    const sTotal = getVal("SwapTotal");
    const sFree = getVal("SwapFree");
    const sUsed = Math.max(0, sTotal - sFree);
    if (sTotal > 0) {
      zTotal = toGB(sTotal);
      zUsed = toGB(sUsed);
      zPct = ((sUsed / sTotal) * 100).toFixed(1);
    }
  } catch {
    // /proc/meminfo unavailable
  }

  let down = "0.0 KB/s";
  let up = "0.0 KB/s";
  try {
    const netDev = fs.readFileSync("/proc/net/dev", "utf8");
    const line = netDev.split("\n").find((l) => l.includes(`${NET_INTERFACE}:`));
    if (line) {
      const cols = line.trim().split(/\s+/);
      const rx = Number.parseInt(cols[1], 10);
      const tx = Number.parseInt(cols[9], 10);
      const now = Date.now();
      const dt = (now - lastNet.time) / 1000;
      if (lastNet.rx > 0 && dt > 0) {
        down = formatSpeed((rx - lastNet.rx) / dt);
        up = formatSpeed((tx - lastNet.tx) / dt);
      }
      lastNet = { rx, tx, time: now };
    }
  } catch {
    // /proc/net/dev unavailable
  }

  const av = getAvailability();
  const uptimeSec = Math.floor(os.uptime());

  // Tab-separated payload so .yaha can easily split and compute percentages/formatting!
  return [
    `Main Server`,
    cpuUsages.join(","),
    toGB(usedMem),
    toGB(totalMem),
    memPct,
    zUsed,
    zTotal,
    zPct,
    down,
    up,
    String(uptimeSec),
    String(av.oracle.upSeconds),
    String(av.oracle.totalSeconds),
    String(av.mini.upSeconds),
    String(av.mini.totalSeconds),
    String(av.tablet.upSeconds),
    String(av.tablet.totalSeconds),
    String(av.gcp.upSeconds),
    String(av.gcp.totalSeconds),
    os.arch(),
  ].join("\t");
}

async function fetchDiscordStatusRaw(): Promise<string> {
  const now = Date.now();
  if (DISCORD_ID && now - cachedDiscord.fetchedAt >= 10_000) {
    try {
      const res = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          success?: boolean;
          data?: {
            discord_status?: string;
            discord_user?: {
              id?: string;
              username?: string;
              global_name?: string;
              avatar?: string | null;
            };
          };
        };
        if (json.success && json.data) {
          const u = json.data.discord_user;
          cachedDiscord = {
            status: json.data.discord_status || "offline",
            username: u?.username || cachedDiscord.username,
            globalName: u?.global_name || u?.username || cachedDiscord.globalName,
            id: u?.id || DISCORD_ID,
            avatar: u?.avatar || "",
            avatarBase64: cachedDiscord.avatarBase64,
            fetchedAt: now,
          };
          if (u?.avatar && u?.id) {
            try {
              const avRes = await fetch(
                `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`,
                { signal: AbortSignal.timeout(2500) },
              );
              if (avRes.ok) {
                const buf = Buffer.from(await avRes.arrayBuffer());
                const ct = avRes.headers.get("content-type") || "image/png";
                cachedDiscord.avatarBase64 = `data:${ct};base64,${buf.toString("base64")}`;
              }
            } catch {
              // keep previous avatar
            }
          }
        }
      }
    } catch {
      // fallback to cache
    }
  }

  return [
    cachedDiscord.status,
    cachedDiscord.username,
    cachedDiscord.globalName,
    cachedDiscord.id,
    cachedDiscord.avatar,
    cachedDiscord.avatarBase64,
  ].join("\t");
}

function decodeBase32(secret: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function verifyTotp(token: string, secret: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  const key = decodeBase32(secret);
  if (key.length === 0) return false;
  const counter = Math.floor(Date.now() / 30000);
  for (let offset = -1; offset <= 1; offset++) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter + offset));
    const hmac = crypto.createHmac("sha1", key).update(buf).digest();
    const pos = hmac[hmac.length - 1] & 0x0f;
    const code =
      (((hmac[pos] & 0x7f) << 24) |
        ((hmac[pos + 1] & 0xff) << 16) |
        ((hmac[pos + 2] & 0xff) << 8) |
        (hmac[pos + 3] & 0xff)) %
      1_000_000;
    if (String(code).padStart(6, "0") === token) return true;
  }
  return false;
}

function validateAdminSession(token: string, ip: string): boolean {
  if (!token) return false;
  const entry = adminSessions.get(token);
  if (!entry || entry.expiresAt < Date.now() || entry.ip !== ip) return false;
  return true;
}

async function handleDockerStatus(): Promise<string> {
  try {
    const { stdout } = await execFilePromise("docker", [
      "inspect",
      "-f",
      "{{.State.Status}} {{.State.Health.Status}}",
      CONTAINER_NAME,
    ]);
    const [status, health] = stdout.trim().split(" ");
    return `${status || "offline"}\t${health || "none"}`;
  } catch {
    return "offline\tnone";
  }
}

async function handleServerEffect(payload: string, clientIp: string): Promise<string> {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return JSON.stringify({ error: true, status: 400, message: "Invalid JSON" });
  }

  const action = String(body.action || "");
  if (action === "login") {
    const otp = String(body.otpToken || "");
    const secret = process.env.ADMIN_OTP_SECRET?.trim() || "";
    const valid = secret ? verifyTotp(otp, secret) : otp === "000000";
    if (!valid) {
      return JSON.stringify({
        ok: false,
        status: 401,
        message: secret
          ? "OTP 코드가 일치하지 않습니다."
          : "데모 모드에서는 000000 또는 ADMIN_OTP_SECRET 설정 후 OTP를 입력하세요.",
      });
    }
    const token = crypto.randomBytes(24).toString("hex");
    adminSessions.set(token, { expiresAt: Date.now() + SESSION_TTL, ip: clientIp });
    return JSON.stringify({ ok: true, status: 200, token, role: "admin" });
  }

  if (action === "logout") {
    const token = String(body.token || "");
    adminSessions.delete(token);
    return JSON.stringify({ ok: true, status: 200, message: "로그아웃 되었습니다." });
  }

  if (action === "start" || action === "stop") {
    const logs = readJsonSafe<{ action: string; user: string; time: string }[]>(LOG_FILE, []);
    try {
      await execFilePromise("docker", [action, CONTAINER_NAME]);
      logs.unshift({
        action: action === "start" ? "서버 켜기" : "서버 끄기",
        user: "Usagi Admin",
        time: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
      });
      writeJsonSafe(LOG_FILE, logs.slice(0, 20));
      return JSON.stringify({
        ok: true,
        status: 200,
        message: action === "start" ? "서버 시작 명령을 전달했습니다." : "서버가 꺼졌습니다.",
      });
    } catch {
      return JSON.stringify({
        ok: false,
        status: 503,
        message: `Docker 컨테이너(${CONTAINER_NAME})에 연결할 수 없습니다.`,
      });
    }
  }

  const token = String(body.token || "");
  if (!validateAdminSession(token, clientIp)) {
    return JSON.stringify({ ok: false, status: 401, message: "Unauthorized" });
  }

  if (action === "getLogs") {
    return JSON.stringify({ ok: true, status: 200, logs: readJsonSafe(LOG_FILE, []) });
  }
  if (action === "getWhitelist") {
    return JSON.stringify({ ok: true, status: 200, whitelist: readJsonSafe(WHITELIST_FILE, []) });
  }
  if (action === "addWhitelist") {
    const item = (body.whitelistItem || {}) as { id?: string; name?: string };
    const id = String(item.id || "").trim();
    const name = String(item.name || "").trim();
    if (!/^\d{17,19}$/.test(id) || !name) {
      return JSON.stringify({ ok: false, status: 400, message: "17~19자리 ID와 이름을 입력하세요." });
    }
    const list = readJsonSafe<{ id: string; name: string }[]>(WHITELIST_FILE, []);
    if (!list.some((x) => x.id === id)) list.push({ id, name });
    writeJsonSafe(WHITELIST_FILE, list);
    return JSON.stringify({ ok: true, status: 200, whitelist: list });
  }
  if (action === "removeWhitelist") {
    const targetId = String(body.targetId || "").trim();
    const list = readJsonSafe<{ id: string; name: string }[]>(WHITELIST_FILE, []).filter(
      (x) => x.id !== targetId,
    );
    writeJsonSafe(WHITELIST_FILE, list);
    return JSON.stringify({ ok: true, status: 200, whitelist: list });
  }

  return JSON.stringify({ ok: false, status: 400, message: "Invalid action" });
}

function handleDdnsEffect(payload: string, clientIp: string): string {
  const defaultDomain = process.env.DDNS_ROOT_DOMAIN?.trim() || "usagi.example.com";
  const state = readJsonSafe<{
    domains: { domain: string; label: string; os: string; currentIp: string; updatedAt: string }[];
    token: string;
  }>(DDNS_FILE, {
    domains: [
      {
        domain: `home.${defaultDomain}`,
        label: "Main Workstation",
        os: "linux",
        currentIp: clientIp,
        updatedAt: new Date().toISOString(),
      },
    ],
    token: process.env.DDNS_SECRET_TOKEN?.trim() || "usagi-ddns-demo-token",
  });

  if (!payload || payload === "GET") {
    return JSON.stringify({
      success: true,
      clientIp,
      authToken: state.token,
      domains: state.domains.map((d) => ({
        ...d,
        isIpMatching: d.currentIp === clientIp,
      })),
    });
  }

  try {
    const req = JSON.parse(payload) as {
      action?: string;
      domain?: string;
      label?: string;
      os?: string;
      ip?: string;
    };
    if (req.action === "update") {
      const target = req.domain || state.domains[0]?.domain;
      const newIp = req.ip || clientIp;
      for (const d of state.domains) {
        if (d.domain === target) {
          d.currentIp = newIp;
          d.updatedAt = new Date().toISOString();
        }
      }
      writeJsonSafe(DDNS_FILE, state);
      return JSON.stringify({ success: true, domain: target, ip: newIp });
    }
    if (req.action === "create" && req.domain) {
      const clean = req.domain.toLowerCase().replace(/[^a-z0-9.-]/g, "");
      const full = clean.includes(".") ? clean : `${clean}.${defaultDomain}`;
      if (!state.domains.some((d) => d.domain === full)) {
        state.domains.push({
          domain: full,
          label: req.label || "New Device",
          os: req.os === "windows" ? "windows" : "linux",
          currentIp: clientIp,
          updatedAt: new Date().toISOString(),
        });
        writeJsonSafe(DDNS_FILE, state);
      }
      return JSON.stringify({ success: true, domains: state.domains });
    }
    if (req.action === "delete" && req.domain) {
      state.domains = state.domains.filter((d) => d.domain !== req.domain);
      writeJsonSafe(DDNS_FILE, state);
      return JSON.stringify({ success: true, domains: state.domains });
    }
    if (req.action === "regenerate_token") {
      state.token = crypto.randomBytes(16).toString("hex");
      writeJsonSafe(DDNS_FILE, state);
      return JSON.stringify({ success: true, token: state.token });
    }
  } catch {
    // ignore
  }
  return JSON.stringify({ success: false, message: "Invalid DDNS request" });
}

function handleHostingEffect(payload: string, clientIp: string, tokenHeader: string): string {
  if (!validateAdminSession(tokenHeader, clientIp)) {
    return JSON.stringify({ ok: false, status: 401, error: "인증이 필요합니다." });
  }
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const allowedExt = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
  if (payload === "list") {
    const files = fs
      .readdirSync(UPLOADS_DIR)
      .filter((f) => !f.startsWith(".") && allowedExt.has(path.extname(f).toLowerCase()))
      .map((f) => {
        const st = fs.statSync(path.join(UPLOADS_DIR, f));
        return { name: f, url: `/uploads/${f}`, size: st.size, mtime: st.mtime.toISOString() };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
    return JSON.stringify({ ok: true, status: 200, images: files });
  }

  try {
    const req = JSON.parse(payload) as { op?: string; filename?: string };
    if (req.op === "delete" && req.filename) {
      const safe = path.basename(req.filename);
      const target = path.join(UPLOADS_DIR, safe);
      if (fs.existsSync(target) && safe !== ".gitkeep") {
        fs.unlinkSync(target);
      }
      return JSON.stringify({ ok: true, status: 200 });
    }
  } catch {
    // ignore
  }
  return JSON.stringify({ ok: false, status: 400, error: "Unsupported hosting operation" });
}

function runUsagiSandboxed(code: string, stdin: string): Promise<string> {
  return new Promise((resolve) => {
    const workerCode = `
      import { parentPort, workerData } from 'node:worker_threads';
      import { Session } from '${path.resolve(ROOT, "engine/usagi/interpreter.ts")}';
      import { UsagiError } from '${path.resolve(ROOT, "engine/usagi/error.ts")}';
      const { code, stdin } = workerData;
      const chars = [...stdin].map(c => c.codePointAt(0));
      let idx = 0;
      let out = '';
      const warnings = [];
      const MAX_OUT = 200000;
      const t0 = performance.now();
      try {
        const s = new Session({
          write: (t) => {
            if (out.length + t.length > MAX_OUT) throw new UsagiError('출력이 너무 길어 (20만 글자 제한)');
            out += t;
          },
          read: () => idx < chars.length ? chars[idx++] : -1,
          warn: (w) => warnings.push(w),
        });
        s.run(code);
        parentPort.postMessage({ ok: true, output: out, warnings, ms: +(performance.now() - t0).toFixed(2) });
      } catch (err) {
        parentPort.postMessage({
          ok: false,
          output: out,
          warnings,
          error: err instanceof Error ? err.message : String(err),
          pos: err?.pos ?? null,
          ms: +(performance.now() - t0).toFixed(2),
        });
      }
    `;
    const worker = new Worker(workerCode, {
      eval: true,
      workerData: { code, stdin },
      resourceLimits: { stackSizeMb: 64 },
    });
    const timer = setTimeout(() => {
      void worker.terminate();
      resolve(
        JSON.stringify({
          ok: false,
          output: "",
          warnings: [],
          error: "하아? 하아? 실행 시간이 3초를 넘었어",
          ms: 3000,
        }),
      );
    }, 3000);
    worker.once("message", (msg) => {
      clearTimeout(timer);
      resolve(JSON.stringify(msg));
    });
    worker.once("error", (err) => {
      clearTimeout(timer);
      resolve(JSON.stringify({ ok: false, output: "", warnings: [], error: err.message, ms: 0 }));
    });
  });
}

export async function executeEffect(
  name: string,
  payload: string,
  ctx: { clientIp: string; headers: Record<string, string> },
): Promise<string> {
  switch (name) {
    case "sys_metrics":
      return gatherSystemMetricsRaw();
    case "lanyard":
      return await fetchDiscordStatusRaw();
    case "docker_status":
      return await handleDockerStatus();
    case "server_action":
      return await handleServerEffect(payload, ctx.clientIp);
    case "ddns":
      return handleDdnsEffect(payload, ctx.clientIp);
    case "hosting":
      return handleHostingEffect(payload, ctx.clientIp, ctx.headers["x-session-token"] || "");
    case "read_doc": {
      const safe = path.basename(payload.trim());
      const full = path.join(DOCS_DIR, safe);
      if (fs.existsSync(full)) return fs.readFileSync(full, "utf8");
      return "<h1>Document Not Found</h1>";
    }
    case "usagi_eval": {
      try {
        const parsed = JSON.parse(payload) as { mode?: string; code?: string; stdin?: string };
        if (parsed.mode === "encode_num") {
          const val = String(parsed.code || "0").trim();
          if (!/^-?\d+$/.test(val)) {
            return JSON.stringify({ ok: false, error: "정수를 입력하세요." });
          }
          return JSON.stringify({ ok: true, output: encodeNumber(BigInt(val)) });
        }
        if (parsed.mode === "encode_text") {
          return JSON.stringify({ ok: true, output: encodeText(String(parsed.code || "")) });
        }
        return await runUsagiSandboxed(String(parsed.code || ""), String(parsed.stdin || ""));
      } catch {
        return JSON.stringify({ ok: false, error: "잘못된 요청입니다." });
      }
    }
    case "usagi_source": {
      const target = payload.trim();
      if (!target || target === "list") {
        return JSON.stringify({ files: listYahaFiles() });
      }
      const source = readYahaSource(target);
      if (source === null) return JSON.stringify({ error: "Not found" });
      return JSON.stringify({ file: target, source, files: listYahaFiles() });
    }
    default:
      return "";
  }
}

export function isValidAdminToken(token: string, ip: string): boolean {
  return validateAdminSession(token, ip);
}
