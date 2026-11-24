const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const axios = require("axios");

function loadClient(search = "") {
  const source = fs.readFileSync(path.join(__dirname, "../src/api/client.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  let replacement;
  vm.runInNewContext(compiled, {
    module, exports: module.exports, require, URLSearchParams,
    window: {
      location: { search, pathname: "/student/profile", hash: "#coding" },
      history: { replaceState: (_state, _title, url) => { replacement = url; } },
    },
    document: { title: "LMS" },
  });
  return { ...module.exports, replacement };
}

function response(config, data = {}) {
  return { status: 200, statusText: "OK", data, headers: {}, config };
}

function unauthorized(config) {
  return new axios.AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, {}, {
    status: 401, statusText: "Unauthorized", data: {}, headers: {}, config,
  });
}

test("session probes refresh an expired access cookie", async () => {
  const { api } = loadClient();
  let refreshed = false;
  let refreshCount = 0;
  api.defaults.adapter = async (config) => {
    if (config.url === "/auth/refresh") {
      refreshed = true;
      refreshCount++;
      return response(config);
    }
    if (!refreshed) throw unauthorized(config);
    return response(config, { id: "student" });
  };
  assert.equal((await api.get("/auth/me")).data.id, "student");
  assert.equal(refreshCount, 1);
});

test("concurrent expired requests share a single refresh", async () => {
  const { api } = loadClient();
  let refreshed = false;
  let refreshCount = 0;
  api.defaults.adapter = async (config) => {
    if (config.url === "/auth/refresh") {
      refreshCount++;
      await new Promise((resolve) => setImmediate(resolve));
      refreshed = true;
      return response(config);
    }
    if (!refreshed) throw unauthorized(config);
    return response(config);
  };
  await Promise.all([api.get("/student/dashboard"), api.get("/student/profile"), api.get("/auth/me")]);
  assert.equal(refreshCount, 1);
});

test("anonymous session probes reject without redirect loops", async () => {
  const { api, setUnauthorizedHandler } = loadClient();
  let redirects = 0;
  setUnauthorizedHandler(() => redirects++);
  api.defaults.adapter = async (config) => { throw unauthorized(config); };
  await assert.rejects(api.get("/auth/me"));
  assert.equal(redirects, 0);
});

test("invalid login credentials do not trigger refresh", async () => {
  const { api } = loadClient();
  const requests = [];
  api.defaults.adapter = async (config) => {
    requests.push(config.url);
    throw unauthorized(config);
  };
  await assert.rejects(api.post("/auth/login", { email: "a@example.com", password: "wrong" }));
  assert.deepEqual(requests, ["/auth/login"]);
});

test("Excel uploads retain their multipart body", async () => {
  const { api } = loadClient();
  const form = new FormData();
  form.append("file", new Blob(["workbook"]), "students.xlsx");
  let uploaded;
  api.defaults.adapter = async (config) => {
    uploaded = config;
    return response(config);
  };
  await api.post("/admin/imports/preview", form);
  assert.equal(uploaded.data, form);
  assert.notEqual(uploaded.headers.getContentType(), "application/json");
});

test("validation errors display the field and reason", () => {
  const { errorMessage } = loadClient();
  const error = new axios.AxiosError("Invalid", undefined, {}, {}, {
    data: { detail: [{ loc: ["body", "roll_number"], msg: "Field required" }] },
  });
  assert.equal(errorMessage(error), "roll_number — Field required");
});

test("removing sandbox token preserves other URL filters", () => {
  const client = loadClient("?sandbox_token=private&tab=leetcode");
  assert.equal(client.replacement, "/student/profile?tab=leetcode#coding");
});
