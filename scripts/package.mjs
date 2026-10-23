import {
  readdirSync,
  mkdirSync,
  mkdtempSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { resolve, join, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = fileURLToPath(new URL("../", import.meta.url)),
  dist = join(root, "dist");
execFileSync(process.execPath, [join(root, "dsh-pet/scripts/prepack-check.js")], {stdio:"inherit"});
mkdirSync(dist, { recursive: true });
const staging = mkdtempSync(join(dist, "stage-")),
  target = join(staging, "desktop-pet");
try {
const roots = [
  "README.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "package.json",
  "plugin.json",
  "mcp.json",
  ".mcp.json",
  ".codex-plugin",
  "start-pet.cmd",
  "stop-pet.cmd",
  "dsh-pet",
  "docs",
  "art-source",
  "scripts",
  "test",
];
const files = [];
function visit(rel) {
  const full = join(root, rel);
  if (["node_modules", ".qa", ".git", "dist"].includes(rel.split("/").at(-1)))
    return;
  const statEntries = readdirSync(dirname(full), { withFileTypes: true }),
    entry = statEntries.find((e) => e.name === rel.split("/").at(-1));
  if (entry?.isSymbolicLink())
    throw Error("Symlink cannot be packaged: " + rel);
  if (entry?.isDirectory())
    for (const child of readdirSync(full)) visit(rel + "/" + child);
  else {
    if (/\.log$/.test(rel) || rel === "dsh-pet/bridge/local.json") return;
    files.push(rel);
  }
}
roots.forEach(visit);
for (const file of files) {
  const to = join(target, file);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(join(root, file), to);
}
const version = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
).version;
const archive = resolve(dist, "desktop-pet-" + version + ".tar.gz");
execFileSync("tar", ["-czf", archive, "-C", staging, "desktop-pet"], {
  stdio: "inherit",
});
const entries = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" })
  .trim()
  .split(/\r?\n/);
if (
  entries.some(
    (p) => /(^|\/)(node_modules|\.qa|\.git)(\/|$)/.test(p) || p.includes(".."),
  )
)
  throw Error("Unexpected archive content");
if (
  !entries.includes("desktop-pet/plugin.json") ||
  !entries.includes("desktop-pet/dsh-pet/lib/standalone.js")
)
  throw Error("Missing runtime");
const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
writeFileSync(
  archive + ".sha256",
  digest + "  " + archive.split(/[\\/]/).at(-1) + "\n",
);
writeFileSync(
  archive + ".files.json",
  JSON.stringify(files.sort(), null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      archive,
      files: files.length,
      bytes: readFileSync(archive).length,
      sha256: digest,
    },
    null,
    2,
  ),
);
} finally {
  if (!resolve(staging).startsWith(resolve(dist) + sep + 'stage-')) throw Error('Unexpected package staging path');
  rmSync(staging, {recursive:true,force:true});
}
