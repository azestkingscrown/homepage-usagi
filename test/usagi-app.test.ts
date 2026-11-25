import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { handleHttpRequest } from "../bridge/http.ts";

let server: http.Server;
let baseUrl = "";

before(async () => {
  server = http.createServer((req, res) => {
    void handleHttpRequest(req, res);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("homepage-usagi end-to-end (.yaha + Effect Bridge)", () => {
  it("renders Korean and English overview pages via fp-usagi", async () => {
    const koRes = await fetch(`${baseUrl}/`, { headers: { "Accept-Language": "ko-KR,ko;q=0.9" } });
    assert.equal(koRes.status, 200);
    assert.match(koRes.headers.get("x-usagi-modules") || "", /app\/router\.yaha.*app\/pages\/home\.yaha/);
    const koHtml = await koRes.text();
    assert.match(koHtml, /<html lang="ko">/);
    assert.match(koHtml, /안녕하세요\. 아제스트 입니다\./);

    const enRes = await fetch(`${baseUrl}/`, { headers: { Cookie: "azest_lang=en", "Accept-Language": "ko" } });
    assert.equal(enRes.status, 200);
    const enHtml = await enRes.text();
    assert.match(enHtml, /<html lang="en">/);
    assert.match(enHtml, /Hello, I'm Azest\./);
  });

  it("blocks hidden dot paths and rewrites chzzk. subdomain via router.yaha", async () => {
    const dotRes = await fetch(`${baseUrl}/.env`);
    assert.equal(dotRes.status, 404);

    // Use node:http directly to send a custom Host header cleanly
    const subBody = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const url = new URL(baseUrl);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: "/update",
          headers: { Host: "chzzk.example.com", Cookie: "azest_lang=ko" },
        },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => resolve({ status: res.statusCode || 0, body: data }));
        },
      );
      req.on("error", reject);
      req.end();
    });
    assert.equal(subBody.status, 200);
    assert.match(subBody.body, /치지직 디스코드 봇 업데이트 내역/);
  });

  it("serves all core HTML routes and static assets", async () => {
    for (const path of ["/playground", "/chzzk-bot-update", "/chzzk-bot-guide", "/technical-info", "/minecraft", "/ddns", "/hosting", "/admin"]) {
      const r = await fetch(`${baseUrl}${path}`);
      assert.equal(r.status, 200, `${path} should return 200`);
      const text = await r.text();
      assert.ok(text.length > 500, `${path} HTML should be non-empty`);
    }

    const notFound = await fetch(`${baseUrl}/does-not-exist`);
    assert.equal(notFound.status, 404);

    const css = await fetch(`${baseUrl}/styles.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type") || "", /text\/css/);

    const js = await fetch(`${baseUrl}/client.js`);
    assert.equal(js.status, 200);
    assert.match(js.headers.get("content-type") || "", /javascript/);
  });

  it("serves /ip, /api/status, /api/discord, /api/discord-status, /api/server, /api/ddns via .yaha", async () => {
    const ipRes = await fetch(`${baseUrl}/ip`);
    assert.equal(ipRes.status, 200);
    assert.equal((await ipRes.text()).trim(), "127.0.0.1");

    const statusRes = await fetch(`${baseUrl}/api/status`);
    assert.equal(statusRes.status, 200);
    const statusJson = (await statusRes.json()) as { servers: { name: string; availability: string }[] };
    assert.ok(Array.isArray(statusJson.servers) && statusJson.servers.length >= 1);
    assert.equal(statusJson.servers[0].name, "Main Server");
    assert.match(statusJson.servers[0].availability, /^\d+\.\d{2}$/);

    const discordRes = await fetch(`${baseUrl}/api/discord`);
    assert.equal(discordRes.status, 200);
    const discordJson = (await discordRes.json()) as { success: boolean; data: { discord_status: string } };
    assert.equal(discordJson.success, true);

    const svgRes = await fetch(`${baseUrl}/api/discord-status?lang=ko&theme=dark`);
    assert.equal(svgRes.status, 200);
    assert.match(svgRes.headers.get("content-type") || "", /image\/svg\+xml/);
    const svgText = await svgRes.text();
    assert.match(svgText, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);

    const serverRes = await fetch(`${baseUrl}/api/server`);
    assert.equal(serverRes.status, 200);
    const serverJson = (await serverRes.json()) as { status: string; health: string };
    assert.ok("status" in serverJson && "health" in serverJson);

    const ddnsRes = await fetch(`${baseUrl}/api/ddns/myip`);
    assert.equal(ddnsRes.status, 200);
    assert.equal(((await ddnsRes.json()) as { ip: string }).ip, "127.0.0.1");
  });

  it("executes user .yaha code and inspects app/*.yaha sources via /api/usagi/*", async () => {
    const srcListRes = await fetch(`${baseUrl}/api/usagi/source`);
    assert.equal(srcListRes.status, 200);
    const srcList = (await srcListRes.json()) as { files: string[] };
    assert.ok(srcList.files.includes("router.yaha"));
    assert.ok(srcList.files.includes("api/status.yaha"));

    const srcFileRes = await fetch(`${baseUrl}/api/usagi/source?file=router.yaha`);
    assert.equal(srcFileRes.status, 200);
    const srcFile = (await srcFileRes.json()) as { file: string; source: string };
    assert.equal(srcFile.file, "router.yaha");
    assert.match(srcFile.source, /우라-야하!/);

    const runRes = await fetch(`${baseUrl}/api/usagi/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "run",
        code: "미이이야하 푸릿 야하!!! 야하!!!!",
        stdin: "",
      }),
    });
    assert.equal(runRes.status, 200);
    const runJson = (await runRes.json()) as { ok: boolean; output: string };
    assert.equal(runJson.ok, true);
    assert.equal(runJson.output.trim(), "7");

    const badRes = await fetch(`${baseUrl}/api/usagi/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "run",
        code: "미이이야하 우라라",
        stdin: "",
      }),
    });
    assert.equal(badRes.status, 200);
    const badJson = (await badRes.json()) as { ok: boolean; error: string };
    assert.equal(badJson.ok, false);
    assert.match(badJson.error, /하아\? 하아\?/);
  });
});
