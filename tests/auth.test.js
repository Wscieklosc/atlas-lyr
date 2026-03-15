import assert from "node:assert";
import { createRequire } from "node:module";
import { test } from "node:test";

const TOKEN = "test-token";

const require = createRequire(import.meta.url);
process.env.API_TOKEN = TOKEN;
const { requireToken } = require("../server.js");

function makeReq({ headerToken = "", queryToken = "" } = {}) {
  return {
    get(name) {
      if (name === "x-api-token") return headerToken;
      return "";
    },
    query: { token: queryToken }
  };
}

function makeRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    }
  };
}

test("odrzuca żądanie bez tokena", () => {
  const req = makeReq();
  const res = makeRes();
  let calledNext = false;

  requireToken(req, res, () => {
    calledNext = true;
  });

  assert.strictEqual(calledNext, false);
  assert.strictEqual(res.statusCode, 401);
});

test("przyjmuje żądanie z poprawnym tokenem", () => {
  const req = makeReq({ headerToken: TOKEN });
  const res = makeRes();
  let calledNext = false;

  requireToken(req, res, () => {
    calledNext = true;
  });

  assert.strictEqual(calledNext, true);
  assert.strictEqual(res.statusCode, 200);
});

test("odrzuca żądanie z błędnym tokenem", () => {
  const req = makeReq({ headerToken: "wrong-token" });
  const res = makeRes();
  let calledNext = false;

  requireToken(req, res, () => {
    calledNext = true;
  });

  assert.strictEqual(calledNext, false);
  assert.strictEqual(res.statusCode, 401);
});

test("odrzuca token podany tylko w query string", () => {
  const req = makeReq({ queryToken: TOKEN });
  const res = makeRes();
  let calledNext = false;

  requireToken(req, res, () => {
    calledNext = true;
  });

  assert.strictEqual(calledNext, false);
  assert.strictEqual(res.statusCode, 401);
});
