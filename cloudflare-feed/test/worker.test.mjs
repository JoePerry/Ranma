import test from "node:test";
import assert from "node:assert/strict";

import worker, { handleRequest } from "../src/index.js";

const BASE = "https://octgn-multi-game-feed.example.workers.dev";
const RANMA_KEY =
  "packages/ranma/05ce00ff-544c-5fc1-81ca-387b109116d4.0.2.5.nupkg";
const EPIC_KEY =
  "packages/epic-battles-online/336cc7ef-c808-5f75-a22e-0171564da1e3.0.9.0.3.nupkg";

function mockR2(entries) {
  const values = new Map(Object.entries(entries));
  const object = (key) => {
    const body = values.get(key);
    if (body === undefined) return null;
    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
    return {
      body: bytes,
      size: bytes.byteLength,
      httpEtag: '"test-etag"',
      writeHttpMetadata(headers) {
        headers.set("content-type", key.endsWith(".json") ? "application/json" : "application/octet-stream");
      },
    };
  };
  return {
    async get(key, options) {
      const value = object(key);
      if (value && options?.range) value.range = { offset: 0, length: value.size };
      return value;
    },
    async head(key) {
      const value = object(key);
      if (value) delete value.body;
      return value;
    },
  };
}

const ENV = {
  OCTGN_DATA: mockR2({
    [RANMA_KEY]: "ranma-package",
    [EPIC_KEY]: "epic-package",
    "games/ranma/manifest.json": '{"game":"ranma"}',
  }),
};

test("serves a NuGet V2 service document", async () => {
  const response = await worker.fetch(new Request(`${BASE}/`), ENV);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/xml/);
  assert.match(body, /<collection href="Packages">/);
});

test("lists both games in one feed", async () => {
  const response = await handleRequest(new Request(`${BASE}/Packages`), ENV);
  const body = await response.text();

  assert.equal((body.match(/<entry>/g) || []).length, 2);
  assert.match(body, /<d:Title>Ranma Card Game<\/d:Title>/);
  assert.match(body, /<d:Version>0\.2\.5<\/d:Version>/);
  assert.match(body, /<d:Title>Epic Battles Online<\/d:Title>/);
  assert.match(body, /<d:Version>0\.9\.0\.3<\/d:Version>/);
  assert.doesNotMatch(body, /drive\.google|dropbox|raw\.githubusercontent/);
});

test("filters packages by game ID", async () => {
  const url = `${BASE}/FindPackagesById()?id='05ce00ff-544c-5fc1-81ca-387b109116d4'`;
  const body = await (await handleRequest(new Request(url), ENV)).text();

  assert.equal((body.match(/<entry>/g) || []).length, 1);
  assert.match(body, /Ranma Card Game/);
  assert.doesNotMatch(body, /Epic Battles Online/);
});

test("searches across both game catalogs", async () => {
  const body = await (
    await handleRequest(new Request(`${BASE}/Search()?searchTerm='Tekken'`), ENV)
  ).text();

  assert.equal((body.match(/<entry>/g) || []).length, 1);
  assert.match(body, /Epic Battles Online/);
});

test("streams an R2-backed OCTGN package", async () => {
  const path =
    "Packages(Id='336cc7ef-c808-5f75-a22e-0171564da1e3',Version='0.9.0.3')/$value";
  const response = await handleRequest(new Request(`${BASE}/${path}`), ENV);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/zip");
  assert.equal(await response.text(), "epic-package");
});

test("only returns partial content for explicit range requests", async () => {
  const path =
    "Packages(Id='336cc7ef-c808-5f75-a22e-0171564da1e3',Version='0.9.0.3')/$value";
  const full = await handleRequest(new Request(`${BASE}/${path}`), ENV);
  const partial = await handleRequest(
    new Request(`${BASE}/${path}`, { headers: { Range: "bytes=0-3" } }),
    ENV,
  );

  assert.equal(full.status, 200);
  assert.equal(partial.status, 206);
});

test("serves R2-backed image manifests and images", async () => {
  const response = await handleRequest(
    new Request(`${BASE}/assets/ranma/manifest.json`),
    ENV,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.equal(await response.text(), '{"game":"ranma"}');
});

test("returns 404 for an object not present in R2", async () => {
  const response = await handleRequest(
    new Request(`${BASE}/assets/ranma/images/missing.jpg`),
    ENV,
  );
  assert.equal(response.status, 404);
});
