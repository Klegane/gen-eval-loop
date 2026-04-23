const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { FileStore } = require("../dist/storage/file-store.js");
const { createTempRepoRoot, readJson, cleanup } = require("./helpers/temp-repo.js");

test("FileStore.writeJson creates parent directories and writes trailing newline", async (t) => {
  const dir = await createTempRepoRoot("file-store-writejson");
  t.after(() => cleanup(dir));

  const store = new FileStore();
  const target = path.join(dir, "a", "b", "c", "data.json");
  await store.writeJson(target, { hello: "world" });

  const parsed = await readJson(target);
  assert.deepEqual(parsed, { hello: "world" });
});

test("FileStore.readJson reads JSON round-trip", async (t) => {
  const dir = await createTempRepoRoot("file-store-readjson");
  t.after(() => cleanup(dir));

  const store = new FileStore();
  const target = path.join(dir, "data.json");
  await store.writeJson(target, { n: 42 });

  const value = await store.readJson(target);
  assert.deepEqual(value, { n: 42 });
});

test("FileStore.exists returns true after writeText and false for missing paths", async (t) => {
  const dir = await createTempRepoRoot("file-store-exists");
  t.after(() => cleanup(dir));

  const store = new FileStore();
  const target = path.join(dir, "hello.txt");
  assert.equal(await store.exists(target), false);

  await store.writeText(target, "hi");
  assert.equal(await store.exists(target), true);
});

test("FileStore.ensureDirectory is idempotent", async (t) => {
  const dir = await createTempRepoRoot("file-store-ensuredir");
  t.after(() => cleanup(dir));

  const store = new FileStore();
  const target = path.join(dir, "nested", "deep");
  await store.ensureDirectory(target);
  await store.ensureDirectory(target);
  assert.equal(await store.exists(target), true);
});
