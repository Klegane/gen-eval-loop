const os = require("node:os");
const path = require("node:path");
const { mkdtemp, readFile, rm } = require("node:fs/promises");

async function createTempRepoRoot(prefix) {
  return mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function cleanup(dir) {
  return rm(dir, { recursive: true, force: true });
}

module.exports = { createTempRepoRoot, readJson, cleanup };
