import fs from "node:fs";
import path from "node:path";
import { encodeList } from "../engine/usagi/encode.ts";

const S = (str: string) => encodeList(str).replaceAll("\n", " ");
const fn = (n: number, suffix: string) => "하" + "아".repeat(n) + suffix;

function emitChunkedText(text: string): string {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const slice = text.slice(i, i + 100);
    chunks.push(`미이이이이야하 ${S(slice)}`);
    i += 100;
  }
  return chunks.join("\n");
}

function writeYaha(rel: string, content: string) {
  const full = path.join(process.cwd(), "app", rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.trimStart() + "\n", "utf8");
}

type Locale = "ko" | "en";

interface PageShellOpts {
  activePath: string;
  titleKo: string;
  titleEn: string;
  showFooter?: boolean;
}

function buildShellHead(opts: PageShellOpts, locale: Locale): string {
  const isKo = locale === "ko";
  const title = isKo ? opts.titleKo : opts.titleEn;
  const nextLang = isKo ? "en" : "ko";
  const nextLangLabel = isKo ? "EN" : "KO";
  const desc = isKo
    ? "아제스트의 개인 워크스페이스 및 서버 인프라 대시보드 (우사기랭 구동)"
    : "Azest's Personal Workspace & Infra Dashboard (Powered by fp-usagi)";

  const navCore = [
    { href: "/", label: "Overview" },
    { href: "/playground", label: isKo ? "🐰 우사기랭 플레이그라운드" : "🐰 Usagi Playground", tag: ".yaha" },
    { href: "/chzzk-bot-guide", label: isKo ? "치지직 봇 가이드" : "Chzzk Bot Guide" },
    { href: "/chzzk-bot-update", label: isKo ? "업데이트 내역" : "Changelog" },
    { href: "/technical-info", label: isKo ? "기술 문서" : "Technical Docs" },
  ];

  const navSvc = [
    { href: "/ddns", label: isKo ? "DDNS 관리" : "DDNS Manager", tag: "DNS" },
    { href: "/minecraft", label: isKo ? "Minecraft 제어" : "Minecraft Control", tag: "Docker" },
    { href: "/hosting", label: "File Hosting", tag: "OTP" },
    { href: "/admin", label: isKo ? "Admin 대시보드" : "Admin Dashboard", tag: "OTP" },
  ];

  const renderNavItems = (items: { href: string; label: string; tag?: string }[]) =>
    items
      .map(
        (it) =>
          `<li><a class="nav-item${opts.activePath === it.href ? " active" : ""}" href="${it.href}"><span>${it.label}</span>${it.tag ? `<span class="nav-tag">${it.tag}</span>` : ""}</a></li>`,
      )
      .join("");

  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${desc}" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <nav class="sidebar-desktop" aria-label="Primary Sidebar">
    <div class="sidebar-top">
      <a class="brand-link" href="/">
        <span class="brand-badge">AK</span>
        <div style="min-width:0">
          <p class="brand-title">Azest_Kingscrown</p>
          <p class="brand-sub">fp-usagi Edition</p>
        </div>
      </a>
      <div style="display:flex;gap:0.25rem">
        <button type="button" class="icon-btn" data-action="toggle-lang" data-next-lang="${nextLang}" title="Switch Language">${nextLangLabel}</button>
        <button type="button" class="icon-btn" data-action="toggle-theme" id="theme-label" title="Toggle Theme">SYSTEM</button>
      </div>
    </div>

    <div class="nav-group">
      <span class="nav-label">Workspace</span>
      <ul class="nav-list">${renderNavItems(navCore)}</ul>
    </div>

    <div class="nav-group">
      <span class="nav-label">Services &amp; Admin</span>
      <ul class="nav-list">${renderNavItems(navSvc)}</ul>
    </div>

    <div class="sidebar-foot">
      <div>🐰 Powered by <strong>fp-usagi</strong> (.yaha)</div>
      <div style="margin-top:0.25rem"><a href="https://github.com/usagi-lang/fp-usagi" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">usagi-lang/fp-usagi</a></div>
    </div>
  </nav>

  <header class="mobile-header">
    <a class="brand-link" href="/" style="flex:0 1 auto">
      <span class="brand-badge">AK</span>
      <div>
        <p class="brand-title">Azest_Kingscrown</p>
        <p class="brand-sub">fp-usagi Edition</p>
      </div>
    </a>
    <div style="display:flex;gap:0.35rem;align-items:center">
      <button type="button" class="icon-btn" data-action="toggle-lang" data-next-lang="${nextLang}">${nextLangLabel}</button>
      <button type="button" class="icon-btn" data-action="toggle-theme">THEME</button>
      <button type="button" class="icon-btn" data-action="open-drawer">☰</button>
    </div>
  </header>

  <div class="mobile-drawer" id="mobile-drawer">
    <div class="mobile-drawer-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <strong>Azest_Kingscrown</strong>
        <button type="button" class="icon-btn" data-action="close-drawer">✕</button>
      </div>
      <div class="nav-group">
        <span class="nav-label">Workspace</span>
        <ul class="nav-list">${renderNavItems(navCore)}</ul>
      </div>
      <div class="nav-group">
        <span class="nav-label">Services &amp; Admin</span>
        <ul class="nav-list">${renderNavItems(navSvc)}</ul>
      </div>
    </div>
  </div>

  <div class="main-shell">
    <main class="main-container">
      <div class="stack">
        <div class="usagi-trace">
          <span id="usagi-trace-text" class="font-mono">🐰 Executed directly by fp-usagi (.yaha)</span>
          <a href="/playground" style="font-weight:600;text-decoration:underline">${isKo ? ".yaha 소스 보기 / 실행 →" : "Inspect / Run .yaha →"}</a>
        </div>
`;
}

function buildShellFoot(opts: PageShellOpts, locale: Locale): string {
  const isKo = locale === "ko";
  const footer =
    opts.showFooter === false
      ? ""
      : `<footer class="site-footer">
    <div class="footer-inner">
      <span class="sub" style="margin:0">© 2026 Azest_Kingscrown · Entirely rendered in <strong>fp-usagi (.yaha)</strong></span>
      <div class="btn-row">
        <a class="btn" href="/playground">🐰 Playground</a>
        <a class="btn" href="https://github.com/usagi-lang/fp-usagi" target="_blank" rel="noopener noreferrer">fp-usagi GitHub</a>
      </div>
    </div>
  </footer>`;

  return `      </div>
    </main>
    ${footer}
  </div>
  <!--USAGI_TRACE_DATA-->
  <script src="/client.js"></script>
</body>
</html>`;
}

function buildPageYaha(
  relPath: string,
  opts: PageShellOpts,
  bodyKo: string,
  bodyEn: string,
  status = 200,
): void {
  const htmlKo = `${buildShellHead(opts, "ko")}${bodyKo}${buildShellFoot(opts, "ko")}`;
  const htmlEn = `${buildShellHead(opts, "en")}${bodyEn}${buildShellFoot(opts, "en")}`;

  writeYaha(
    relPath,
    `# ============================================================================
# app/${relPath} — Bilingual Page Module (KO / EN)
# ============================================================================
미야아아 우 ${fn(5, "-")}       # method
미야아아 우라 ${fn(5, "-")}     # locale

미이이이이야하 ${S(`HTTP\n${status}\ntext/html; charset=utf-8\n`)}

푸루 우라 ${S("ko")} 하!
${emitChunkedText(htmlKo)}
하?

푸루 우라 ${S("en")} 하!
${emitChunkedText(htmlEn)}
하?
`,
  );
}

// 1. app/pages/home.yaha
buildPageYaha(
  "pages/home.yaha",
  {
    activePath: "/",
    titleKo: "Azest_Kingscrown | 우사기랭 워크스페이스",
    titleEn: "Azest_Kingscrown | Usagi-lang Workspace",
  },
  `<div class="page-head">
    <div>
      <h1 class="h1">Overview</h1>
      <p class="sub">개인 워크스페이스, 인프라 모니터링 및 서비스 대시보드 · 우사기랭(.yaha)으로 전면 재구축</p>
    </div>
    <span class="badge badge-indigo">🐰 Powered by fp-usagi</span>
  </div>

  <section class="grid-12">
    <div class="card col-8" style="display:flex;flex-direction:column;justify-content:space-between;gap:1.25rem">
      <div>
        <span class="badge badge-indigo">WELCOME · YAHA!</span>
        <h2 class="h1" style="margin-top:0.65rem">안녕하세요. 아제스트 입니다.</h2>
        <p class="sub" style="margin-top:0.6rem;line-height:1.7">
          이 홈페이지는 <strong>SvelteKit을 완전히 제거하고</strong>, 라우팅·모니터링 계산·SVG 생성·HTML 렌더링까지
          지인이 만든 <strong>우사기랭(fp-usagi) <code>.yaha</code></strong> 코드로 직접 구동되는 실험적 대시보드입니다.
        </p>
      </div>
      <div class="btn-row">
        <a class="btn btn-primary" href="/playground">🐰 우사기랭 플레이그라운드</a>
        <a class="btn" href="/chzzk-bot-guide">치지직 봇 가이드</a>
        <a class="btn" href="/chzzk-bot-update">업데이트 내역</a>
        <a class="btn" href="https://github.com/usagi-lang/fp-usagi" target="_blank" rel="noopener noreferrer">fp-usagi ↗</a>
      </div>
    </div>
    <div class="card col-4" id="discord-presence-card">
      <p class="sub">Discord 상태 불러오는 중...</p>
    </div>
  </section>

  <section class="stack" style="gap:0.9rem">
    <div class="page-head">
      <div style="display:flex;align-items:center;gap:0.6rem">
        <h2 class="h2">Server Status</h2>
        <span class="badge badge-emerald">Real-time · .yaha computed</span>
      </div>
      <a href="/minecraft" style="font-size:0.8rem;color:var(--accent-text);font-weight:600">Minecraft 제어 패널 →</a>
    </div>
    <div class="grid-2" id="server-status-grid">
      <div class="card"><p class="sub">서버 상태 수집 중...</p></div>
    </div>
  </section>

  <section class="card">
    <div class="card-header">
      <h2 class="h2">Architecture (Approach A: Usagi CGI / Effect Bridge)</h2>
      <span class="badge badge-indigo">0 Runtime Dependencies</span>
    </div>
    <p class="sub" style="margin:0;line-height:1.7">
      Node.js는 최소한의 HTTP/OS Effect Bridge만 수행하며, 모든 경로 분기(<code>router.yaha</code>),
      가동률(%) 고정소수점 연산 및 JSON 조립(<code>api/status.yaha</code>), Discord SVG 배지 렌더링(<code>api/discord.yaha</code>),
      전체 웹 페이지 HTML 출력(<code>pages/*.yaha</code>)은 요청마다 실제 <code>fp-usagi</code> 인터프리터가 실행합니다.
    </p>
  </section>`,
  `<div class="page-head">
    <div>
      <h1 class="h1">Overview</h1>
      <p class="sub">Personal Workspace, Infrastructure Monitoring &amp; Services · Rebuilt with fp-usagi (.yaha)</p>
    </div>
    <span class="badge badge-indigo">🐰 Powered by fp-usagi</span>
  </div>

  <section class="grid-12">
    <div class="card col-8" style="display:flex;flex-direction:column;justify-content:space-between;gap:1.25rem">
      <div>
        <span class="badge badge-indigo">WELCOME · YAHA!</span>
        <h2 class="h1" style="margin-top:0.65rem">Hello, I'm Azest.</h2>
        <p class="sub" style="margin-top:0.6rem;line-height:1.7">
          This homepage has been rebuilt <strong>without SvelteKit</strong>: routing, availability math,
          SVG badge generation, and HTML page rendering are all executed live by <strong>fp-usagi (<code>.yaha</code>)</strong>!
        </p>
      </div>
      <div class="btn-row">
        <a class="btn btn-primary" href="/playground">🐰 Usagi Playground</a>
        <a class="btn" href="/chzzk-bot-guide">Chzzk Bot Guide</a>
        <a class="btn" href="/chzzk-bot-update">Changelog</a>
        <a class="btn" href="https://github.com/usagi-lang/fp-usagi" target="_blank" rel="noopener noreferrer">fp-usagi ↗</a>
      </div>
    </div>
    <div class="card col-4" id="discord-presence-card">
      <p class="sub">Loading Discord presence...</p>
    </div>
  </section>

  <section class="stack" style="gap:0.9rem">
    <div class="page-head">
      <div style="display:flex;align-items:center;gap:0.6rem">
        <h2 class="h2">Server Status</h2>
        <span class="badge badge-emerald">Real-time · .yaha computed</span>
      </div>
      <a href="/minecraft" style="font-size:0.8rem;color:var(--accent-text);font-weight:600">Minecraft Control Panel →</a>
    </div>
    <div class="grid-2" id="server-status-grid">
      <div class="card"><p class="sub">Loading server status...</p></div>
    </div>
  </section>

  <section class="card">
    <div class="card-header">
      <h2 class="h2">Architecture (Approach A: Usagi CGI / Effect Bridge)</h2>
      <span class="badge badge-indigo">0 Runtime Dependencies</span>
    </div>
    <p class="sub" style="margin:0;line-height:1.7">
      Node.js acts strictly as a thin HTTP/OS effect bridge, while routing (<code>router.yaha</code>),
      fixed-point uptime/availability math (<code>api/status.yaha</code>), SVG generation (<code>api/discord.yaha</code>),
      and HTML rendering (<code>pages/*.yaha</code>) execute live inside <code>fp-usagi</code>.
    </p>
  </section>`,
);

// 2. app/pages/playground.yaha — Live Usagi Playground + .yaha Source Inspector!
buildPageYaha(
  "pages/playground.yaha",
  {
    activePath: "/playground",
    titleKo: "우사기랭 플레이그라운드 & 소스 뷰어 | Azest_Kingscrown",
    titleEn: "Usagi-lang Playground & Source Inspector | Azest_Kingscrown",
  },
  `<div class="page-head">
    <div>
      <h1 class="h1">🐰 우사기랭 플레이그라운드</h1>
      <p class="sub">브라우저에서 우사기랭(.yaha)을 바로 실행하고, 이 웹사이트를 돌리는 실제 .yaha 소스 코드도 확인해 보세요.</p>
    </div>
    <span class="badge badge-indigo">fp-usagi v0.6.0</span>
  </div>

  <div id="usagi-playground" class="stack">
    <div class="card">
      <div class="card-header">
        <strong>에디터 &amp; 실행 (Ctrl/⌘ + Enter)</strong>
        <div class="btn-row">
          <button type="button" class="btn" data-preset="twice">고차 함수</button>
          <button type="button" class="btn" data-preset="fib">피보나치</button>
          <button type="button" class="btn" data-preset="primes">소수 1..50</button>
          <button type="button" class="btn" data-preset="pipeline">파이프</button>
          <button type="button" class="btn" data-preset="echo">입력 Echo</button>
          <button type="button" class="btn btn-primary" id="pg-run-btn">▶ 실행</button>
        </div>
      </div>

      <div class="grid-2">
        <div style="display:flex;flex-direction:column;gap:0.75rem">
          <textarea id="pg-code" class="textarea" rows="13">우라-야하! 하아! 우 우라
푸루야 우- 우- 우라
하아?

우라-야하! 하아아! 우
푸루야 푸릿 우 야하!!!
하아아?

미이이야하 하아- 하아아 야하!!!!!!!!!!
미이이야하 하아- 우라-야하! 우 하! 푸루야 푸리리릿 우 우 하? 야하!!!</textarea>
          <div>
            <label for="pg-stdin" class="sub" style="display:block;margin-bottom:0.25rem">표준 입력 (야푸)</label>
            <input id="pg-stdin" class="input font-mono" placeholder="여기에 입력을 적으면 야푸로 읽습니다..." />
          </div>
          <div style="display:flex;gap:0.5rem">
            <input id="pg-encode-input" class="input" placeholder="글을 우사기랭 출력 코드로 변환..." value="우라-야하! Hello Usagi!" />
            <button type="button" class="btn" id="pg-encode-btn" style="white-space:nowrap">글 인코드</button>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:0.5rem">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong style="font-size:0.875rem">실행 결과</strong>
            <span id="pg-meta" class="font-mono sub" style="margin:0">대기 중</span>
          </div>
          <pre id="pg-output" class="code-block" style="flex:1;min-height:260px;white-space:pre-wrap"></pre>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <strong>이 홈페이지를 구동하는 실제 .yaha 소스 코드</strong>
          <p class="sub" style="margin:0"><code>app/</code> 폴더 안의 파일들을 선택해 직접 열람할 수 있습니다.</p>
        </div>
        <select id="pg-source-select" class="select" style="width:auto;min-width:220px"></select>
      </div>
      <pre id="pg-source-view" class="code-block" style="max-height:420px;overflow:auto"></pre>
    </div>
  </div>`,
  `<div class="page-head">
    <div>
      <h1 class="h1">🐰 Usagi-lang Playground</h1>
      <p class="sub">Run Usagi-lang (.yaha) code live and inspect the actual .yaha source files powering this website.</p>
    </div>
    <span class="badge badge-indigo">fp-usagi v0.6.0</span>
  </div>

  <div id="usagi-playground" class="stack">
    <div class="card">
      <div class="card-header">
        <strong>Editor &amp; Runner (Ctrl/⌘ + Enter)</strong>
        <div class="btn-row">
          <button type="button" class="btn" data-preset="twice">Twice</button>
          <button type="button" class="btn" data-preset="fib">Fibonacci</button>
          <button type="button" class="btn" data-preset="primes">Primes</button>
          <button type="button" class="btn" data-preset="pipeline">Pipeline</button>
          <button type="button" class="btn" data-preset="echo">Echo</button>
          <button type="button" class="btn btn-primary" id="pg-run-btn">▶ Run</button>
        </div>
      </div>

      <div class="grid-2">
        <div style="display:flex;flex-direction:column;gap:0.75rem">
          <textarea id="pg-code" class="textarea" rows="13">우라-야하! 하아! 우 우라
푸루야 우- 우- 우라
하아?

우라-야하! 하아아! 우
푸루야 푸릿 우 야하!!!
하아아?

미이이야하 하아- 하아아 야하!!!!!!!!!!
미이이야하 하아- 우라-야하! 우 하! 푸루야 푸리리릿 우 우 하? 야하!!!</textarea>
          <div>
            <label for="pg-stdin" class="sub" style="display:block;margin-bottom:0.25rem">Standard Input (야푸)</label>
            <input id="pg-stdin" class="input font-mono" placeholder="Input read by 야푸..." />
          </div>
          <div style="display:flex;gap:0.5rem">
            <input id="pg-encode-input" class="input" placeholder="Encode text into Usagi-lang..." value="우라-야하! Hello Usagi!" />
            <button type="button" class="btn" id="pg-encode-btn" style="white-space:nowrap">Encode Text</button>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:0.5rem">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong style="font-size:0.875rem">Output</strong>
            <span id="pg-meta" class="font-mono sub" style="margin:0">Ready</span>
          </div>
          <pre id="pg-output" class="code-block" style="flex:1;min-height:260px;white-space:pre-wrap"></pre>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <strong>Live .yaha Source Code Powering This Website</strong>
          <p class="sub" style="margin:0">Browse any file inside <code>app/</code>.</p>
        </div>
        <select id="pg-source-select" class="select" style="width:auto;min-width:220px"></select>
      </div>
      <pre id="pg-source-view" class="code-block" style="max-height:420px;overflow:auto"></pre>
    </div>
  </div>`,
);

// 3. app/pages/update.yaha
buildPageYaha(
  "pages/update.yaha",
  {
    activePath: "/chzzk-bot-update",
    titleKo: "치지직 디스코드 봇 업데이트 내역 | Azest_Kingscrown",
    titleEn: "Chzzk Discord Bot Changelog | Azest_Kingscrown",
  },
  `<div class="page-head">
    <div>
      <div class="btn-row"><span class="badge badge-indigo">Changelog</span><span class="badge badge-emerald">Discord Verified App</span></div>
      <h1 class="h1" style="margin-top:0.5rem">치지직 디스코드 봇 업데이트 내역</h1>
      <p class="sub">아키텍처 개편, 인프라 확장 및 커스텀 알림 기능 패치 노트</p>
    </div>
    <a class="btn" href="/chzzk-bot-guide">전체 가이드</a>
  </div>

  <div class="card">
    <div class="card-header"><strong>20샤드 내부 샤딩 &amp; Dynamic Failover 아키텍처 개편</strong><span class="badge">2026.06.29</span></div>
    <ul style="margin:0;padding-left:1.25rem;color:var(--text-body)">
      <li><strong>무정지 고정 20샤드 가동:</strong> 20개 샤드(0~19번)를 영구 고정 운영하여 최대 20,000~50,000대 서버 확장 대응</li>
      <li><strong>초절전형 단일 프로세스 내부 샤딩:</strong> GCP 955MB 저사양에서도 약 80MB대 메모리로 20샤드 구동</li>
      <li><strong>SQLite WAL 모드 도입:</strong> 다중 샤드 동시 쓰기에도 파일 락 충돌 없는 비동기 큐잉 적용</li>
    </ul>
  </div>

  <div class="card">
    <div class="card-header"><strong>커스텀 알림 &amp; 선택 등록</strong><span class="badge badge-indigo">Feature</span></div>
    <p class="sub" style="margin-top:0"><code>/알림메시지설정</code> 명령어로 스트리머별·알림 종류별(방송시작/커뮤니티) 멘션과 문구를 자유롭게 지정할 수 있습니다.</p>
    <pre class="code-block">/알림메시지설정 스트리머:강소연 종류:방송시작 멘션역할:@everyone 메시지: 드디어 {streamer}님이 방송을 켰습니다!</pre>
  </div>`,
  `<div class="page-head">
    <div>
      <div class="btn-row"><span class="badge badge-indigo">Changelog</span><span class="badge badge-emerald">Discord Verified App</span></div>
      <h1 class="h1" style="margin-top:0.5rem">Chzzk Discord Bot Changelog</h1>
      <p class="sub">Architecture overhaul, global proxy expansion &amp; custom notification patch notes</p>
    </div>
    <a class="btn" href="/chzzk-bot-guide">Full Guide</a>
  </div>

  <div class="card">
    <div class="card-header"><strong>20-Shard Internal Sharding &amp; Dynamic Failover Overhaul</strong><span class="badge">2026.06.29</span></div>
    <ul style="margin:0;padding-left:1.25rem;color:var(--text-body)">
      <li><strong>Zero-Downtime Fixed 20 Shards:</strong> Scales seamlessly up to 20,000–50,000 Discord servers.</li>
      <li><strong>Ultra-Low-Memory Sharding:</strong> Operates all 20 shards smoothly within ~80MB RAM.</li>
      <li><strong>SQLite WAL Mode:</strong> Eliminates lock contention under concurrent multi-shard writes.</li>
    </ul>
  </div>

  <div class="card">
    <div class="card-header"><strong>Custom Alerts &amp; Selective Subscriptions</strong><span class="badge badge-indigo">Feature</span></div>
    <p class="sub" style="margin-top:0">Customize mention targets and alert templates per streamer with <code>/알림메시지설정</code>.</p>
    <pre class="code-block">/알림메시지설정 스트리머:강소연 종류:방송시작 멘션역할:@everyone 메시지: {streamer} is now live!</pre>
  </div>`,
);

// 4. app/pages/minecraft.yaha
buildPageYaha(
  "pages/minecraft.yaha",
  {
    activePath: "/minecraft",
    titleKo: "마인크래프트 서버 대시보드 | Azest_Kingscrown",
    titleEn: "Minecraft Server Dashboard | Azest_Kingscrown",
  },
  `<div class="page-head">
    <div>
      <h1 class="h1">마인크래프트 서버 대시보드</h1>
      <p class="sub">Docker 컨테이너 상태 모니터링 및 원격 시작/종료 제어 (API: <code>api/server.yaha</code>)</p>
    </div>
    <a class="btn" href="/admin">관리자 로그 확인</a>
  </div>

  <div id="minecraft-panel" class="grid-2">
    <div class="card">
      <div class="card-header"><strong>컨테이너 상태</strong><span class="badge">3s polling</span></div>
      <p class="h2 font-mono" id="mc-status-text">확인 중...</p>
    </div>
    <div class="card">
      <div class="card-header"><strong>서버 제어</strong><span class="badge badge-indigo">Docker Bridge</span></div>
      <div class="btn-row">
        <button type="button" class="btn btn-success" data-mc-action="start">서버 켜기</button>
        <button type="button" class="btn btn-danger" data-mc-action="stop">서버 끄기</button>
      </div>
    </div>
  </div>

  <div class="grid-2" id="server-status-grid"></div>`,
  `<div class="page-head">
    <div>
      <h1 class="h1">Minecraft Server Dashboard</h1>
      <p class="sub">Docker container status &amp; remote start/stop control (API: <code>api/server.yaha</code>)</p>
    </div>
    <a class="btn" href="/admin">View Admin Logs</a>
  </div>

  <div id="minecraft-panel" class="grid-2">
    <div class="card">
      <div class="card-header"><strong>Container Status</strong><span class="badge">3s polling</span></div>
      <p class="h2 font-mono" id="mc-status-text">Checking...</p>
    </div>
    <div class="card">
      <div class="card-header"><strong>Server Controls</strong><span class="badge badge-indigo">Docker Bridge</span></div>
      <div class="btn-row">
        <button type="button" class="btn btn-success" data-mc-action="start">Start Server</button>
        <button type="button" class="btn btn-danger" data-mc-action="stop">Stop Server</button>
      </div>
    </div>
  </div>

  <div class="grid-2" id="server-status-grid"></div>`,
);

// 5. app/pages/ddns.yaha
buildPageYaha(
  "pages/ddns.yaha",
  {
    activePath: "/ddns",
    titleKo: "DDNS 관리 | Azest_Kingscrown",
    titleEn: "DDNS Manager | Azest_Kingscrown",
  },
  `<div class="page-head">
    <div>
      <h1 class="h1">Cloudflare DDNS 관리</h1>
      <p class="sub">기기별 DNS A 레코드 동적 관리 (API: <code>api/ddns.yaha</code>)</p>
    </div>
    <span class="badge badge-indigo">Your IP: <span id="ddns-client-ip" class="font-mono">-</span></span>
  </div>

  <div id="ddns-root" class="stack">
    <div class="card">
      <div class="card-header"><strong>새 기기 등록</strong><span class="font-mono sub" style="margin:0">Token: <span id="ddns-token">-</span></span></div>
      <form id="ddns-add-form" class="btn-row">
        <input id="ddns-new-domain" class="input" style="max-width:240px" placeholder="서브도메인 (예: nas)" required />
        <input id="ddns-new-label" class="input" style="max-width:220px" placeholder="기기 이름 (예: Home NAS)" />
        <button type="submit" class="btn btn-primary">추가</button>
      </form>
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>도메인</th><th>기기명</th><th>OS</th><th>현재 IP</th><th style="text-align:right">작업</th></tr></thead>
        <tbody id="ddns-list"></tbody>
      </table>
    </div>
  </div>`,
  `<div class="page-head">
    <div>
      <h1 class="h1">Cloudflare DDNS Manager</h1>
      <p class="sub">Dynamic DNS A record management (API: <code>api/ddns.yaha</code>)</p>
    </div>
    <span class="badge badge-indigo">Your IP: <span id="ddns-client-ip" class="font-mono">-</span></span>
  </div>

  <div id="ddns-root" class="stack">
    <div class="card">
      <div class="card-header"><strong>Add Device</strong><span class="font-mono sub" style="margin:0">Token: <span id="ddns-token">-</span></span></div>
      <form id="ddns-add-form" class="btn-row">
        <input id="ddns-new-domain" class="input" style="max-width:240px" placeholder="Subdomain (e.g. nas)" required />
        <input id="ddns-new-label" class="input" style="max-width:220px" placeholder="Device label" />
        <button type="submit" class="btn btn-primary">Add</button>
      </form>
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Domain</th><th>Label</th><th>OS</th><th>Current IP</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody id="ddns-list"></tbody>
      </table>
    </div>
  </div>`,
);

// 6. app/pages/hosting.yaha
buildPageYaha(
  "pages/hosting.yaha",
  {
    activePath: "/hosting",
    titleKo: "Private File Hosting | Azest_Kingscrown",
    titleEn: "Private File Hosting | Azest_Kingscrown",
  },
  `<div class="page-head">
    <div>
      <h1 class="h1">Private File Hosting</h1>
      <p class="sub">관리자 OTP 인증 기반 파일 업로드 및 호스팅 (데모 기본 OTP: <code>000000</code>)</p>
    </div>
  </div>

  <div id="hosting-root" class="stack">
    <div id="hosting-auth-box" class="card" style="max-width:420px">
      <div class="card-header"><strong>관리자 OTP 인증</strong><span class="badge">OTP</span></div>
      <form id="hosting-login-form" class="stack" style="gap:0.75rem">
        <input id="hosting-otp-input" class="input font-mono" maxlength="6" placeholder="000000" style="text-align:center;font-size:1.15rem;letter-spacing:0.3em" />
        <button type="submit" class="btn btn-primary">인증 및 입장</button>
      </form>
    </div>

    <div id="hosting-panel-box" class="stack" style="display:none">
      <div class="card">
        <form id="hosting-upload-form" class="btn-row">
          <input id="hosting-file-input" type="file" accept="image/*" class="input" style="max-width:340px" />
          <button type="submit" class="btn btn-primary">업로드</button>
        </form>
      </div>
      <div id="hosting-images-grid" class="grid-3"></div>
    </div>
  </div>`,
  `<div class="page-head">
    <div>
      <h1 class="h1">Private File Hosting</h1>
      <p class="sub">Admin OTP authenticated file hosting (Demo default OTP: <code>000000</code>)</p>
    </div>
  </div>

  <div id="hosting-root" class="stack">
    <div id="hosting-auth-box" class="card" style="max-width:420px">
      <div class="card-header"><strong>Admin OTP Auth</strong><span class="badge">OTP</span></div>
      <form id="hosting-login-form" class="stack" style="gap:0.75rem">
        <input id="hosting-otp-input" class="input font-mono" maxlength="6" placeholder="000000" style="text-align:center;font-size:1.15rem;letter-spacing:0.3em" />
        <button type="submit" class="btn btn-primary">Sign In</button>
      </form>
    </div>

    <div id="hosting-panel-box" class="stack" style="display:none">
      <div class="card">
        <form id="hosting-upload-form" class="btn-row">
          <input id="hosting-file-input" type="file" accept="image/*" class="input" style="max-width:340px" />
          <button type="submit" class="btn btn-primary">Upload</button>
        </form>
      </div>
      <div id="hosting-images-grid" class="grid-3"></div>
    </div>
  </div>`,
);

// 7. app/pages/admin.yaha
buildPageYaha(
  "pages/admin.yaha",
  {
    activePath: "/admin",
    titleKo: "관리자 대시보드 | Azest_Kingscrown",
    titleEn: "Admin Dashboard | Azest_Kingscrown",
    showFooter: false,
  },
  `<div class="page-head">
    <div>
      <h1 class="h1">마인크래프트 관리자 대시보드</h1>
      <p class="sub">Discord 화이트리스트 및 서버 제어 이력 관리 (데모 기본 OTP: <code>000000</code>)</p>
    </div>
    <a class="btn" href="/minecraft">제어 페이지</a>
  </div>

  <div id="admin-root" class="stack">
    <div id="admin-auth-box" class="card" style="max-width:420px">
      <div class="card-header"><strong>Google OTP 인증</strong><span class="badge">Admin</span></div>
      <form id="admin-login-form" class="stack" style="gap:0.75rem">
        <input id="admin-otp-input" class="input font-mono" maxlength="6" placeholder="000000" style="text-align:center;font-size:1.15rem;letter-spacing:0.3em" />
        <button type="submit" class="btn btn-primary">인증 확인</button>
      </form>
    </div>

    <div id="admin-panel-box" class="stack" style="display:none">
      <div class="card">
        <div class="card-header"><strong>Discord 화이트리스트</strong></div>
        <form id="admin-add-wl-form" class="btn-row" style="margin-bottom:1rem">
          <input id="wl-new-id" class="input font-mono" style="max-width:240px" placeholder="디스코드 ID (17~19자리)" />
          <input id="wl-new-name" class="input" style="max-width:200px" placeholder="사용자명" />
          <button type="submit" class="btn btn-primary">추가</button>
        </form>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Discord ID</th><th>이름</th><th style="text-align:right">작업</th></tr></thead>
            <tbody id="admin-whitelist-body"></tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><strong>최근 제어 기록</strong></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>시간</th><th>작업</th><th>사용자</th></tr></thead>
            <tbody id="admin-logs-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`,
  `<div class="page-head">
    <div>
      <h1 class="h1">Admin Console</h1>
      <p class="sub">Discord whitelist &amp; server control logs (Demo default OTP: <code>000000</code>)</p>
    </div>
    <a class="btn" href="/minecraft">Control Panel</a>
  </div>

  <div id="admin-root" class="stack">
    <div id="admin-auth-box" class="card" style="max-width:420px">
      <div class="card-header"><strong>Google OTP Auth</strong><span class="badge">Admin</span></div>
      <form id="admin-login-form" class="stack" style="gap:0.75rem">
        <input id="admin-otp-input" class="input font-mono" maxlength="6" placeholder="000000" style="text-align:center;font-size:1.15rem;letter-spacing:0.3em" />
        <button type="submit" class="btn btn-primary">Verify</button>
      </form>
    </div>

    <div id="admin-panel-box" class="stack" style="display:none">
      <div class="card">
        <div class="card-header"><strong>Discord Whitelist</strong></div>
        <form id="admin-add-wl-form" class="btn-row" style="margin-bottom:1rem">
          <input id="wl-new-id" class="input font-mono" style="max-width:240px" placeholder="Discord ID (17-19 digits)" />
          <input id="wl-new-name" class="input" style="max-width:200px" placeholder="Display name" />
          <button type="submit" class="btn btn-primary">Add</button>
        </form>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Discord ID</th><th>Name</th><th style="text-align:right">Action</th></tr></thead>
            <tbody id="admin-whitelist-body"></tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><strong>Recent Control Logs</strong></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Action</th><th>User</th></tr></thead>
            <tbody id="admin-logs-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`,
);

// 8. app/pages/unauthorized.yaha (also handles 404 for unknown paths!)
buildPageYaha(
  "pages/unauthorized.yaha",
  {
    activePath: "/unauthorized",
    titleKo: "페이지를 찾을 수 없거나 접근 권한 없음 | Azest_Kingscrown",
    titleEn: "Not Found or Access Denied | Azest_Kingscrown",
  },
  `<div class="card" style="max-width:34rem;margin:2rem auto;text-align:center">
    <span class="badge badge-red">404 / 403</span>
    <h1 class="h1" style="margin-top:0.75rem">하아? 하아? 여긴 우사기가 못 찾는 곳이야</h1>
    <p class="sub" style="margin-top:0.5rem">요청하신 페이지가 없거나 접근 권한이 없습니다.</p>
    <div class="btn-row" style="justify-content:center;margin-top:1.25rem">
      <a class="btn btn-primary" href="/">메인으로 이동</a>
      <a class="btn" href="/playground">🐰 우사기랭 플레이그라운드</a>
    </div>
  </div>`,
  `<div class="card" style="max-width:34rem;margin:2rem auto;text-align:center">
    <span class="badge badge-red">404 / 403</span>
    <h1 class="h1" style="margin-top:0.75rem">Page Not Found or Access Denied</h1>
    <p class="sub" style="margin-top:0.5rem">The requested route does not exist or requires authorization.</p>
    <div class="btn-row" style="justify-content:center;margin-top:1.25rem">
      <a class="btn btn-primary" href="/">Go to Overview</a>
      <a class="btn" href="/playground">🐰 Usagi Playground</a>
    </div>
  </div>`,
  404,
);

// 9. app/pages/doc.yaha — Streams static/docs/*.html via Effect Bridge!
writeYaha(
  "pages/doc.yaha",
  `# ============================================================================
# app/pages/doc.yaha — Bilingual Static Docs Loader (/chzzk-bot-guide, /technical-info)
# ============================================================================
미야아아 우 ${fn(5, "-")}       # method
미야아아 우라 ${fn(5, "-")}     # locale
미야아아 우라라 ${fn(5, "-")}   # host
미야아아 우라라라 ${fn(5, "-")} # path
미야아아 우라라라라 ${fn(5, "-")} # query
미야아아 우라라라라라 ${fn(5, "-")} # clientIp
미야아아 우라라라라라라 ${fn(5, "-")} # hasEffect

푸루 우라라라라라라 ${S("0")} 하!
  미야아아 우라라라라라라라 푸루 우라라라 ${S("/chzzk-bot-guide")}
    푸루 우라 ${S("ko")} ${S("chzzk-bot-guide.html")} ${S("chzzk-bot-guide.en.html")}
    푸루 우라 ${S("ko")} ${S("technical-info.html")} ${S("technical-info.en.html")}
  미이이이이야하 ${S("EFFECT\nread_doc\n")}
  미이이이이야하 우라라라라라라라
하?

푸루 우라라라라라라 ${S("1")} 하!
  미이이이이야하 ${S("HTTP\n200\ntext/html; charset=utf-8\n")}
  미이이이이야하 ${fn(7, "-")}
하?
`,
);

console.log("Generated all 9 app/pages/*.yaha modules!");
