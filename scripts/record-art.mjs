// Re-run only after intentionally replacing final art assets.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
const hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const files = [
  "chatgpt/images/core.png",
  "chatgpt/images/daily.png",
  "chatgpt/images/activity.png",
  "duo/images/scenes.png",
];
const prompts = {
  actionPlan: "art-source/action-plan.json",
  duo: "art-source/duo-prompt.txt",
  cleanup: "art-source/cleanup-prompt.txt",
};
writeFileSync(
  "art-source/generation.json",
  JSON.stringify(
    {
      schema: 1,
      date: "2026-10-23",
      tool: "built-in image_gen",
      method:
        "Action taxonomy, per-sheet prompts, four transparent still atlases, one cleanup pass; no video or GIF encoding.",
      prompts,
      review: {
        technical:
          "32 cells checked in browser on light and dark backgrounds and in native Electron. See validation notes.",
        aesthetic:
          "Not user-approved. Remaining fine edge artifacts may need further art review.",
      },
      outputs: files.map((f) => {
        const path = "dsh-pet/assets/pets/" + f,
          b = readFileSync(path);
        return {
          path,
          sha256: hash(path),
          width: b.readUInt32BE(16),
          height: b.readUInt32BE(20),
          columns: 4,
          rows: 2,
        };
      }),
    },
    null,
    2,
  ) + "\n",
);
const upstream = ["fish", "whale"].flatMap((id) =>
  readdirSync("dsh-pet/assets/pets/" + id + "/webm")
    .filter((f) => f.endsWith(".webm"))
    .map((f) => {
      const path = "dsh-pet/assets/pets/" + id + "/webm/" + f;
      return { path, sha256: hash(path) };
    }),
);
writeFileSync(
  "art-source/upstream-media.json",
  JSON.stringify(
    {
      sourceRepository: "JoenardoQ/Deepseek-and-ChatGPT-Pet-and-JonsboAIO",
      sourceCommit: "73c2178892b4840b78e8b373f29e171872a93e24",
      files: upstream,
    },
    null,
    2,
  ) + "\n",
);
