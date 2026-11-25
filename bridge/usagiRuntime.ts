import fs from "node:fs";
import path from "node:path";
import { Session } from "../engine/usagi/interpreter.ts";
import { UsagiError } from "../engine/usagi/error.ts";

const APP_DIR = path.resolve(process.cwd(), "app");
const STD_FILE = path.join(APP_DIR, "std.yaha");

const sourceCache = new Map<string, { mtimeMs: number; content: string }>();

function readYahaFile(filePath: string): string {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(APP_DIR + path.sep) && resolved !== APP_DIR) {
    throw new Error(`Forbidden .yaha path: ${filePath}`);
  }
  const stat = fs.statSync(resolved);
  const cached = sourceCache.get(resolved);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.content;
  }
  const content = fs.readFileSync(resolved, "utf8");
  sourceCache.set(resolved, { mtimeMs: stat.mtimeMs, content });
  return content;
}

export function listYahaFiles(): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".yaha")) {
        results.push(path.relative(APP_DIR, full).replaceAll("\\", "/"));
      }
    }
  };
  walk(APP_DIR);
  return results.sort();
}

export function readYahaSource(relPath: string): string | null {
  const normalized = path.posix.normalize(relPath.replaceAll("\\", "/")).replace(/^\/+/, "");
  if (!normalized.endsWith(".yaha") || normalized.includes("..")) return null;
  const full = path.resolve(APP_DIR, normalized);
  if (!full.startsWith(APP_DIR + path.sep)) return null;
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

export interface UsagiRunResult {
  output: string;
  warnings: string[];
  durationMs: number;
}

export function runYahaModule(relModulePath: string, stdinText: string, includeStd = true): UsagiRunResult {
  const start = performance.now();
  const modulePath = path.join(APP_DIR, relModulePath);
  const moduleCode = readYahaFile(modulePath);
  const source = includeStd ? `${readYahaFile(STD_FILE)}\n${moduleCode}` : moduleCode;

  const codepoints: number[] = [];
  for (const ch of stdinText) {
    codepoints.push(ch.codePointAt(0)!);
  }
  let readIdx = 0;

  let output = "";
  const warnings: string[] = [];

  const session = new Session({
    write: (text: string) => {
      output += text;
    },
    read: () => (readIdx < codepoints.length ? codepoints[readIdx++] : -1),
    warn: (w) => {
      warnings.push(w.message);
    },
  });

  try {
    session.run(source);
  } catch (err) {
    if (err instanceof UsagiError) {
      throw new Error(`[${relModulePath}] ${err.message}`);
    }
    throw err;
  }

  return {
    output,
    warnings,
    durationMs: performance.now() - start,
  };
}
