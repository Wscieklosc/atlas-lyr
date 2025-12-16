import assert from "node:assert";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { before, after, test } from "node:test";

const PORT = 3100;
const TOKEN = "test-token";

/** Start server.js in a child process for integration checks. */
function startServer() {
  const child = spawn("node", ["server.js"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      API_TOKEN: TOKEN,
      MODEL: process.env.MODEL || "gpt-4o", // ensure existing default works
      // no SERP_API_KEY → search route will return 500 on call; not used here
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  return child;
}

/** Wait for server to log that it's ready, or fail after timeout. */
async function waitForReady(proc, timeoutMs = 8000) {
  let ready = false;
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for server")), timeoutMs);
    const handleOutput = (chunk) => {
      const text = chunk.toString();
      if (text.includes(`http://localhost:${PORT}`)) {
        ready = true;
        clearTimeout(timer);
        resolve();
      }
    };
    proc.stdout.on("data", handleOutput);
    proc.stderr.on("data", handleOutput);
    proc.on("exit", (code) => {
      if (!ready) reject(new Error(`server exited early with code ${code}`));
    });
  });
  await done;
}

let srv;

before(async () => {
  srv = startServer();
  await waitForReady(srv);
  // małe opóźnienie, aby port na pewno nasłuchiwał
  await delay(150);
});

after(() => {
  if (srv && !srv.killed) {
    srv.kill("SIGINT");
  }
});

async function get(path, opts = {}) {
  const res = await fetch(`http://localhost:${PORT}${path}`, opts);
  return res;
}

test("odrzuca żądanie bez tokena (health)", async () => {
  const res = await get("/health");
  assert.strictEqual(res.status, 401);
});

test("przyjmuje żądanie z poprawnym tokenem (health)", async () => {
  const res = await get("/health", { headers: { "x-api-token": TOKEN } });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.ok(body.time, "brak pola time");
});

test("uploads wymagają tokena", async () => {
  const res = await get("/uploads/nieistniejacy.txt");
  assert.strictEqual(res.status, 401);
});
