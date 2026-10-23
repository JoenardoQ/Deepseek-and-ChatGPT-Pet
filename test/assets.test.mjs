import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
test("published ChatGPT and paired poses are static PNG resources with reproducible hashes", () => {
  const manifest = json("dsh-pet/assets/pets/chatgpt/pet.json"),
    scenes = json("dsh-pet/assets/pets/duo/actions.json");
  assert.equal(manifest.actions.length, 24);
  assert.equal(scenes.length, 8);
  for (const [pack, list] of [
    ["chatgpt", manifest.actions],
    ["duo", scenes],
  ])
    for (const action of list) {
      assert.equal(action.kind, "image");
      assert.match(action.file, /^images\/.*\.png$/);
      const b = readFileSync("dsh-pet/assets/pets/" + pack + "/" + action.file);
      assert.equal(b.toString("hex", 0, 8), "89504e470d0a1a0a");
      assert.equal(b[25], 6, "RGBA PNG");
      assert.equal(
        b.readUInt32BE(16) / b.readUInt32BE(20),
        action.cell.columns / action.cell.rows,
      );
    }
  for (const entry of json("art-source/generation.json").outputs)
    assert.equal(hash(entry.path), entry.sha256);
});
test("DeepSeek original action media remain byte for byte unchanged", () => {
  const manifest = json("art-source/upstream-media.json");
  assert.equal(manifest.files.length, 114);
  for (const file of manifest.files)
    assert.equal(hash(file.path), file.sha256, file.path);
});
test("desktop publish tree contains no screen implementation or legacy ChatGPT animation", () => {
  function walk(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.name === "node_modules"
        ? []
        : e.isDirectory()
          ? walk(join(dir, e.name))
          : [join(dir, e.name).replaceAll("\\", "/")],
    );
  }
  const runtime = walk("dsh-pet");
  assert.ok(
    !runtime.some((p) =>
      /jonsbo|msdisplay|\.py$|gif-player|\/device-worker|\/windows-bootstrap/.test(
        p,
      ),
    ),
  );
  assert.ok(
    !runtime.some((p) =>
      /assets\/pets\/(chatgpt|duo)\/.*\.(gif|webm|mp4|mov)$/i.test(p),
    ),
  );
  for (const p of ["plugin.json", ".codex-plugin/plugin.json"]) {
    const manifest = json(p);
    assert.equal(manifest.name, "desktop-pet");
    assert.equal(manifest.version, "2.0.0");
  }
  assert.equal(
    json("package.json").bin["dsh-pet-standalone"],
    "dsh-pet/lib/standalone.js",
  );
});
