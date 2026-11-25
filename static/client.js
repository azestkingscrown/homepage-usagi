/* Lightweight client controller for homepage-usagi (all rendering & APIs run in .yaha) */
(() => {
  const THEME_KEY = "azest_theme";
  const html = document.documentElement;

  function applyTheme(mode) {
    const resolved =
      mode === "dark"
        ? "dark"
        : mode === "light"
          ? "light"
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    html.classList.toggle("dark", resolved === "dark");
    const labelEl = document.getElementById("theme-label");
    if (labelEl) labelEl.textContent = mode.toUpperCase();
  }

  let currentTheme = localStorage.getItem(THEME_KEY) || "system";
  applyTheme(currentTheme);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (currentTheme === "system") applyTheme("system");
  });

  document.querySelectorAll("[data-action='toggle-theme']").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentTheme = currentTheme === "system" ? "light" : currentTheme === "light" ? "dark" : "system";
      localStorage.setItem(THEME_KEY, currentTheme);
      applyTheme(currentTheme);
    });
  });

  document.querySelectorAll("[data-action='toggle-lang']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("data-next-lang") || "en";
      document.cookie = `azest_lang=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
      window.location.reload();
    });
  });

  const drawer = document.getElementById("mobile-drawer");
  document.querySelectorAll("[data-action='open-drawer']").forEach((btn) => {
    btn.addEventListener("click", () => drawer?.classList.add("open"));
  });
  document.querySelectorAll("[data-action='close-drawer']").forEach((btn) => {
    btn.addEventListener("click", () => drawer?.classList.remove("open"));
  });

  // Render Usagi execution trace badge injected by Node bridge from .yaha execution
  const traceScript = document.getElementById("usagi-trace-json");
  const traceBox = document.getElementById("usagi-trace-text");
  if (traceScript && traceBox) {
    try {
      const trace = JSON.parse(traceScript.textContent || "{}");
      const mods = Array.isArray(trace.modules) ? trace.modules.join(" → ") : "";
      const effs = Array.isArray(trace.effects) && trace.effects.length ? ` · effects: [${trace.effects.join(", ")}]` : "";
      traceBox.textContent = `🐰 ${mods}${effs} (${trace.usagiMs} ms)`;
    } catch {
      // ignore
    }
  }

  // Escape helper
  function esc(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ── Live Server Status Widget (/ and /minecraft) ────────────────────────────
  const statusContainer = document.getElementById("server-status-grid");
  if (statusContainer) {
    const refreshStatus = async () => {
      try {
        const res = await fetch("/api/status");
        const json = await res.json();
        if (!Array.isArray(json.servers)) return;
        statusContainer.innerHTML = json.servers
          .map((s) => {
            if (s.error) {
              return `<div class="card">
                <div class="card-header">
                  <strong>${esc(s.name)}</strong>
                  <span class="badge badge-red">${esc(s.error)}</span>
                </div>
                <p class="sub font-mono">Availability: ${esc(s.availability || "100.00")}%</p>
              </div>`;
            }
            const memPct = Number.parseFloat(s.memory?.percentage || "0");
            const zPct = Number.parseFloat(s.zram?.percentage || "0");
            const cpus = Array.isArray(s.cpus) ? s.cpus : [];
            const avg = cpus.length ? (cpus.reduce((a, c) => a + Number.parseFloat(c.usage || "0"), 0) / cpus.length).toFixed(1) : "0.0";
            return `<div class="card">
              <div class="card-header">
                <div style="display:flex;align-items:center;gap:0.5rem">
                  <span style="width:8px;height:8px;border-radius:9999px;background:#10b981;display:inline-block"></span>
                  <strong>${esc(s.name)}</strong>
                </div>
                <span class="badge badge-emerald">${esc(s.availability || "100.00")}%</span>
              </div>
              <div style="margin-bottom:0.9rem">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:0.35rem">
                  <span>CPU (${cpus.length} cores)</span>
                  <strong class="font-mono">Avg ${avg}%</strong>
                </div>
                <div class="grid-2" style="gap:0.4rem 0.75rem">
                  ${cpus
                    .map((c) => {
                      const p = Number.parseFloat(c.usage || "0");
                      const cls = p >= 90 ? "danger" : p >= 75 ? "warn" : "";
                      return `<div style="display:flex;align-items:center;gap:0.4rem;font-size:0.72rem" class="font-mono">
                        <span style="width:1rem;color:var(--text-muted)">${esc(c.id)}</span>
                        <div class="bar-track" style="flex:1"><div class="bar-fill ${cls}" style="width:${p}%"></div></div>
                        <span style="width:2.6rem;text-align:right">${esc(c.usage)}%</span>
                      </div>`;
                    })
                    .join("")}
                </div>
              </div>
              <div class="grid-2" style="gap:0.65rem">
                <div style="padding:0.65rem;border-radius:0.375rem;background:var(--bg-subtle)">
                  <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:0.3rem">
                    <span>RAM</span><strong class="font-mono">${esc(s.memory?.percentage)}%</strong>
                  </div>
                  <div class="bar-track"><div class="bar-fill ${memPct >= 90 ? "danger" : memPct >= 75 ? "warn" : ""}" style="width:${memPct}%"></div></div>
                  <div class="font-mono" style="font-size:0.7rem;color:var(--text-muted);margin-top:0.3rem">${esc(s.memory?.usedGB)}G / ${esc(s.memory?.totalGB)}G</div>
                </div>
                <div style="padding:0.65rem;border-radius:0.375rem;background:var(--bg-subtle)">
                  <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:0.3rem">
                    <span>ZRAM</span><strong class="font-mono">${esc(s.zram?.percentage)}%</strong>
                  </div>
                  <div class="bar-track"><div class="bar-fill neutral" style="width:${zPct}%"></div></div>
                  <div class="font-mono" style="font-size:0.7rem;color:var(--text-muted);margin-top:0.3rem">${esc(s.zram?.usedGB)}G / ${esc(s.zram?.totalGB)}G</div>
                </div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:0.75rem;padding-top:0.6rem;border-top:1px solid var(--border-subtle);font-size:0.72rem;color:var(--text-muted)" class="font-mono">
                <span>↓ ${esc(s.network?.down)} · ↑ ${esc(s.network?.up)}</span>
                <span>⏱ ${esc(s.uptime)}</span>
              </div>
            </div>`;
          })
          .join("");
      } catch {
        // ignore transient errors
      }
    };
    void refreshStatus();
    setInterval(() => void refreshStatus(), 2000);
  }

  // ── Discord Presence Widget (/) ────────────────────────────────────────────
  const discordBox = document.getElementById("discord-presence-card");
  if (discordBox) {
    const refreshDiscord = async () => {
      try {
        const res = await fetch("/api/discord");
        const json = await res.json();
        if (!json.success || !json.data) return;
        const d = json.data;
        const st = d.discord_status || "offline";
        const badgeCls = st === "online" ? "badge-emerald" : st === "idle" ? "badge-amber" : st === "dnd" ? "badge-red" : "";
        const u = d.discord_user || {};
        discordBox.innerHTML = `
          <div class="card-header">
            <span style="font-size:0.75rem;font-weight:600;text-transform:uppercase;color:var(--text-muted)">Discord Presence</span>
            <span class="badge ${badgeCls}">${esc(st.toUpperCase())}</span>
          </div>
          <div style="display:flex;align-items:center;gap:0.85rem">
            <div style="width:3rem;height:3rem;border-radius:9999px;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">
              ${esc((u.global_name || u.username || "AK").slice(0, 2).toUpperCase())}
            </div>
            <div>
              <div style="font-weight:700">${esc(u.global_name || u.username)}</div>
              <div class="font-mono" style="font-size:0.75rem;color:var(--text-muted)">@${esc(u.username)}</div>
            </div>
          </div>
          <div style="margin-top:0.9rem">
            <img src="/api/discord-status?lang=${esc(document.documentElement.lang || "ko")}&theme=${html.classList.contains("dark") ? "dark" : "light"}" alt="Discord Status SVG" style="width:100%;max-width:340px;border-radius:0.5rem"/>
          </div>`;
      } catch {
        // ignore
      }
    };
    void refreshDiscord();
  }

  // ── Minecraft Page (/minecraft) ────────────────────────────────────────────
  const mcPanel = document.getElementById("minecraft-panel");
  if (mcPanel) {
    const mcStatusEl = document.getElementById("mc-status-text");
    const refreshMc = async () => {
      try {
        const res = await fetch("/api/server");
        const json = await res.json();
        if (mcStatusEl) mcStatusEl.textContent = `${json.status || "offline"} (${json.health || "none"})`;
      } catch {
        if (mcStatusEl) mcStatusEl.textContent = "error";
      }
    };
    void refreshMc();
    setInterval(() => void refreshMc(), 3000);
    mcPanel.querySelectorAll("[data-mc-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const action = btn.getAttribute("data-mc-action");
        const res = await fetch("/api/server", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const json = await res.json();
        alert(json.message || "OK");
        void refreshMc();
      });
    });
  }

  // ── DDNS Page (/ddns) ──────────────────────────────────────────────────────
  const ddnsRoot = document.getElementById("ddns-root");
  if (ddnsRoot) {
    const listEl = document.getElementById("ddns-list");
    const ipEl = document.getElementById("ddns-client-ip");
    const tokEl = document.getElementById("ddns-token");
    const loadDdns = async () => {
      const res = await fetch("/api/ddns");
      const json = await res.json();
      if (ipEl) ipEl.textContent = json.clientIp || "-";
      if (tokEl) tokEl.textContent = json.authToken || "-";
      if (listEl && Array.isArray(json.domains)) {
        listEl.innerHTML = json.domains
          .map(
            (d) => `<tr>
              <td class="font-mono">${esc(d.domain)}</td>
              <td>${esc(d.label)}</td>
              <td><span class="badge">${esc(d.os)}</span></td>
              <td class="font-mono">${esc(d.currentIp)}</td>
              <td style="text-align:right">
                <button class="btn" data-ddns-sync="${esc(d.domain)}">IP 동기화</button>
                <button class="btn btn-danger" data-ddns-del="${esc(d.domain)}">삭제</button>
              </td>
            </tr>`,
          )
          .join("");
        listEl.querySelectorAll("[data-ddns-sync]").forEach((b) =>
          b.addEventListener("click", async () => {
            await fetch("/api/ddns", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "update", domain: b.getAttribute("data-ddns-sync") }),
            });
            void loadDdns();
          }),
        );
        listEl.querySelectorAll("[data-ddns-del]").forEach((b) =>
          b.addEventListener("click", async () => {
            await fetch("/api/ddns", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "delete", domain: b.getAttribute("data-ddns-del") }),
            });
            void loadDdns();
          }),
        );
      }
    };
    document.getElementById("ddns-add-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const domain = document.getElementById("ddns-new-domain")?.value || "";
      const label = document.getElementById("ddns-new-label")?.value || "";
      await fetch("/api/ddns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", domain, label }),
      });
      void loadDdns();
    });
    void loadDdns();
  }

  // ── Admin & Hosting OTP Pages (/admin, /hosting) ───────────────────────────
  const adminRoot = document.getElementById("admin-root");
  const hostingRoot = document.getElementById("hosting-root");
  let adminToken = "";

  async function doOtpLogin(otpInputId, onAuthed) {
    const otp = document.getElementById(otpInputId)?.value || "";
    const res = await fetch("/api/server", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", otpToken: otp }),
    });
    const json = await res.json();
    if (!res.ok || !json.token) {
      alert(json.message || "인증 실패");
      return;
    }
    adminToken = json.token;
    onAuthed();
  }

  if (adminRoot) {
    const authBox = document.getElementById("admin-auth-box");
    const panelBox = document.getElementById("admin-panel-box");
    const wlBody = document.getElementById("admin-whitelist-body");
    const logsBody = document.getElementById("admin-logs-body");

    const loadAdminData = async () => {
      const [wlRes, logRes] = await Promise.all([
        fetch("/api/server", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "getWhitelist", token: adminToken }) }),
        fetch("/api/server", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "getLogs", token: adminToken }) }),
      ]);
      const wl = await wlRes.json();
      const lg = await logRes.json();
      if (wlBody) {
        wlBody.innerHTML = (wl.whitelist || []).length
          ? wl.whitelist
              .map(
                (item) => `<tr><td class="font-mono">${esc(item.id)}</td><td>${esc(item.name)}</td><td style="text-align:right"><button class="btn btn-danger" data-rm-wl="${esc(item.id)}">삭제</button></td></tr>`,
              )
              .join("")
          : `<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">등록된 화이트리스트가 없습니다.</td></tr>`;
        wlBody.querySelectorAll("[data-rm-wl]").forEach((b) =>
          b.addEventListener("click", async () => {
            await fetch("/api/server", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "removeWhitelist", token: adminToken, targetId: b.getAttribute("data-rm-wl") }),
            });
            void loadAdminData();
          }),
        );
      }
      if (logsBody) {
        logsBody.innerHTML = (lg.logs || []).length
          ? lg.logs.map((l) => `<tr><td class="font-mono">${esc(l.time)}</td><td>${esc(l.action)}</td><td>${esc(l.user)}</td></tr>`).join("")
          : `<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">기록이 없습니다.</td></tr>`;
      }
    };

    document.getElementById("admin-login-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      void doOtpLogin("admin-otp-input", () => {
        if (authBox) authBox.style.display = "none";
        if (panelBox) panelBox.style.display = "block";
        void loadAdminData();
      });
    });

    document.getElementById("admin-add-wl-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("wl-new-id")?.value || "";
      const name = document.getElementById("wl-new-name")?.value || "";
      const r = await fetch("/api/server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addWhitelist", token: adminToken, whitelistItem: { id, name } }),
      });
      const j = await r.json();
      if (!r.ok) alert(j.message || "추가 실패");
      else void loadAdminData();
    });
  }

  if (hostingRoot) {
    const authBox = document.getElementById("hosting-auth-box");
    const panelBox = document.getElementById("hosting-panel-box");
    const grid = document.getElementById("hosting-images-grid");

    const loadImages = async () => {
      const res = await fetch("/api/images", { headers: { "x-session-token": adminToken } });
      const json = await res.json();
      if (!grid) return;
      const imgs = json.images || [];
      grid.innerHTML = imgs.length
        ? imgs
            .map(
              (img) => `<div class="card" style="padding:0.75rem">
                <img src="${esc(img.url)}" alt="${esc(img.name)}" style="width:100%;height:140px;object-fit:cover;border-radius:0.375rem"/>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem;font-size:0.75rem">
                  <a href="${esc(img.url)}" target="_blank" class="font-mono" style="overflow:hidden;text-overflow:ellipsis">${esc(img.name)}</a>
                  <button class="btn btn-danger" style="padding:0.25rem 0.5rem;font-size:0.72rem" data-del-img="${esc(img.name)}">삭제</button>
                </div>
              </div>`,
            )
            .join("")
        : `<p class="sub">업로드된 이미지가 없습니다.</p>`;
      grid.querySelectorAll("[data-del-img]").forEach((b) =>
        b.addEventListener("click", async () => {
          await fetch("/api/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-session-token": adminToken },
            body: JSON.stringify({ op: "delete", filename: b.getAttribute("data-del-img") }),
          });
          void loadImages();
        }),
      );
    };

    document.getElementById("hosting-login-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      void doOtpLogin("hosting-otp-input", () => {
        if (authBox) authBox.style.display = "none";
        if (panelBox) panelBox.style.display = "block";
        void loadImages();
      });
    });

    document.getElementById("hosting-upload-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("hosting-file-input");
      if (!input?.files?.length) return;
      const fd = new FormData();
      fd.append("file", input.files[0]);
      await fetch("/api/upload", { method: "POST", headers: { "x-session-token": adminToken }, body: fd });
      input.value = "";
      void loadImages();
    });
  }

  // ── Usagi-lang Playground & Source Inspector (/playground) ─────────────────
  const pgRoot = document.getElementById("usagi-playground");
  if (pgRoot) {
    const codeEl = document.getElementById("pg-code");
    const stdinEl = document.getElementById("pg-stdin");
    const outEl = document.getElementById("pg-output");
    const metaEl = document.getElementById("pg-meta");
    const sourceSelect = document.getElementById("pg-source-select");
    const sourceView = document.getElementById("pg-source-view");

    const PRESETS = {
      twice: `우라-야하! 하아! 우 우라\n푸루야 우- 우- 우라\n하아?\n\n우라-야하! 하아아! 우\n푸루야 푸릿 우 야하!!!\n하아아?\n\n미이이야하 하아- 하아아 야하!!!!!!!!!!\n미이이야하 하아- 우라-야하! 우 하! 푸루야 푸리리릿 우 우 하? 야하!!!`,
      fib: `우라-야하! 하아! 우 우라 우라라\n푸루 우 야하 푸루야 우라\n푸루야 하아- 푸리릿 우 야하! 우라라 푸릿 우라 우라라\n하아?\n\n미이이야하 하아- 푸리리릿 야하!!!! 야하!!!!! 야하 야하!`,
      primes: `우라-야하! 하아! 우 우라\n푸루루루 푸리리릿 우라 우라 우 푸루야 야하!\n푸루 푸리리리리릿 우 우라 야하 푸루야 야하\n푸루야 하아- 우 푸릿 우라 야하!\n하아?\n\n미야아아 우 후응 야하!\n미이이야하 야아앗 우라-야하! 우라 하! 푸루야 하아- 우라 야하!! 하? 유후후후후 야하!! 푸리리릿 야하!!!!! 야하!!!!!!!!!!`,
      pipeline: `우라-야하! 하아! 우 우라\n푸루야 푸릿 우 우라\n하아?\n\n우라-야하! 하아아! 우 우라\n푸루야 푸리리릿 우 우라\n하아아?\n\n미야아아 우 후응 하아 야하!!!!!!!!!!\n미이이야하 야앗 후으응 우 후응 하아아 야하!! 유후후후후 야하! 야하!!!!!`,
      echo: `우라-야하! 하아! 우\n미야아아 우라 야푸\n푸루 우라 이야하! 푸루야 우\n푸루야 하아- 유후 우라 우\n하아?\n\n미이이이이야하 하아- 우이`,
    };

    const runCode = async () => {
      if (!codeEl || !outEl) return;
      outEl.textContent = "실행 중... (우라-야하!)";
      const res = await fetch("/api/usagi/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "run", code: codeEl.value, stdin: stdinEl?.value || "" }),
      });
      const json = await res.json();
      const warns = (json.warnings || []).map((w) => `[경고] ${w.message}`).join("\n");
      if (json.ok) {
        outEl.textContent = (warns ? warns + "\n\n" : "") + (json.output || "(출력 없음)");
        if (metaEl) metaEl.textContent = `완료 · ${json.ms} ms · 경고 ${(json.warnings || []).length}개`;
      } else {
        outEl.textContent = (json.output ? json.output + "\n\n" : "") + (warns ? warns + "\n" : "") + (json.error || "오류");
        if (metaEl) metaEl.textContent = `오류 · ${json.ms || 0} ms`;
      }
    };

    document.getElementById("pg-run-btn")?.addEventListener("click", () => void runCode());
    codeEl?.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void runCode();
      }
    });

    pgRoot.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-preset");
        if (key && PRESETS[key] && codeEl) {
          codeEl.value = PRESETS[key];
          if (key === "echo" && stdinEl) stdinEl.value = "우라-야하! Hello from Usagi!";
          void runCode();
        }
      });
    });

    document.getElementById("pg-encode-btn")?.addEventListener("click", async () => {
      const txt = document.getElementById("pg-encode-input")?.value || "";
      const res = await fetch("/api/usagi/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "encode_text", code: txt }),
      });
      const json = await res.json();
      if (json.ok && codeEl) {
        codeEl.value = json.output;
        void runCode();
      }
    });

    const loadSourceFile = async (file) => {
      if (!sourceView) return;
      const url = file ? `/api/usagi/source?file=${encodeURIComponent(file)}` : "/api/usagi/source";
      const res = await fetch(url);
      const json = await res.json();
      if (Array.isArray(json.files) && sourceSelect && sourceSelect.options.length === 0) {
        for (const f of json.files) {
          const opt = document.createElement("option");
          opt.value = f;
          opt.textContent = `app/${f}`;
          sourceSelect.appendChild(opt);
        }
        if (json.files.includes("router.yaha")) {
          sourceSelect.value = "router.yaha";
          void loadSourceFile("router.yaha");
          return;
        }
      }
      if (typeof json.source === "string") {
        sourceView.textContent = json.source;
      }
    };

    sourceSelect?.addEventListener("change", () => void loadSourceFile(sourceSelect.value));
    void loadSourceFile("");
    void runCode();
  }
})();
