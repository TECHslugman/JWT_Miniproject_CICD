// api/tests/login.tokens.test.js
// Minimal e2e test: start the real server (index.js), hit HTTP, assert JWTs.

const { spawn } = require("child_process");

// Use Node 20's global fetch; if running older Node locally, `npm i -D undici` and:
// const { fetch } = require("undici");

const TEST_PORT = 5001;
const BASE = `http://localhost:${TEST_PORT}`;

const waitForHttp = async (url, ms = 180000) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.status >= 200 && res.status < 600) return;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

let apiProc;

beforeAll(async () => {
  // Inherit CI env (includes JWT secrets); override PORT for the test server.
  const env = { ...process.env, PORT: String(TEST_PORT) };
  apiProc = spawn("node", ["index.js"], {
    cwd: __dirname + "/..",
    env,
    stdio: "pipe",
  });

  apiProc.stdout.on("data", d => process.stdout.write(`[api] ${d}`));
  apiProc.stderr.on("data", d => process.stderr.write(`[api] ${d}`));

  // Wait for server to accept HTTP (no health route required)
  await waitForHttp(`${BASE}/`);
}, 180000);

afterAll(async () => {
  if (apiProc && !apiProc.killed) {
    apiProc.kill("SIGTERM");
  }
});

test("login returns JWT access and refresh tokens", async () => {
  // Register (idempotent)
  await fetch(`${BASE}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "ciuser", password: "cipass", isAdmin: false }),
  });

  // Login
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "ciuser", password: "cipass" }),
  });
  expect(res.ok).toBe(true);
  const body = await res.json();

  // Very simple JWT shape check: base64url.base64url.signature
  const jwtRe = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;

  expect(typeof body.accessToken).toBe("string");
  expect(jwtRe.test(body.accessToken)).toBe(true);

  expect(typeof body.refreshToken).toBe("string");
  expect(jwtRe.test(body.refreshToken)).toBe(true);
}, 180000);
