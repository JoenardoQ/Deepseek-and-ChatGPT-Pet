// Action design is saved before any image is generated. This is production provenance,
// not a runtime dependency. Runtime manifests use the same stable action IDs.
import { mkdirSync, writeFileSync } from "node:fs";
const groups = [
  [
    "core",
    [
      [
        "idle",
        "端庄待机",
        "基础",
        "Standing relaxed, hands gently resting in front, soft attentive smile.",
      ],
      [
        "blink",
        "俏皮眨眼",
        "基础",
        "Standing with one eye closed in a playful wink, one hand near cheek.",
      ],
      [
        "wave",
        "挥手问候",
        "互动",
        "Raising one open hand in a friendly wave, looking at the viewer.",
      ],
      [
        "shy",
        "被夸害羞",
        "互动",
        "Blushing, looking slightly aside, shyly holding the edge of one sleeve.",
      ],
      [
        "thinking",
        "认真思考",
        "工作",
        "One finger on chin, eyes thoughtfully looking upward, a small blue assistant orb nearby.",
      ],
      [
        "working",
        "专心工作",
        "工作",
        "Typing with both hands on a small floating lavender laptop, focused expression.",
      ],
      [
        "success",
        "完成庆祝",
        "工作",
        "Small victory V sign, proud warm smile, tail lifted happily.",
      ],
      [
        "error",
        "遇到困难",
        "工作",
        "One hand touching forehead, apologetic worried face, wings gently drooping.",
      ],
    ],
  ],
  [
    "daily",
    [
      [
        "waiting",
        "等待确认",
        "工作",
        "Holding a small clipboard toward the viewer, open palm requesting a decision.",
      ],
      [
        "review",
        "核对结果",
        "工作",
        "Inspecting a notebook with a quill, carefully checking a completed list with no readable text.",
      ],
      [
        "balance",
        "检查用量",
        "工作",
        "Holding a small open coin purse and thoughtfully counting a few glowing tokens.",
      ],
      [
        "sleeping",
        "蜷尾小憩",
        "生活",
        "Sitting asleep with knees together, hands on knees, tail curled gently around feet.",
      ],
      [
        "wake",
        "睡醒揉眼",
        "生活",
        "Sitting upright and rubbing one eye with a loose fist, sleepy smile.",
      ],
      [
        "stretch",
        "放松伸展",
        "生活",
        "Standing and stretching both arms above head, eyes gently closed, wings partly stretched.",
      ],
      [
        "tea",
        "捧杯喝茶",
        "生活",
        "Standing holding a porcelain teacup with both hands near lips, relaxed expression.",
      ],
      [
        "snack",
        "偷吃点心",
        "生活",
        "Holding a little cookie near mouth, slightly puffed cheeks and a caught-in-the-act smile.",
      ],
    ],
  ],
  [
    "activity",
    [
      [
        "reading",
        "安静阅读",
        "生活",
        "Reading an open book held with both hands, absorbed calm expression.",
      ],
      [
        "garden",
        "照看花草",
        "生活",
        "Kneeling beside a small flowerpot and tilting a watering can, focused gentle smile.",
      ],
      [
        "bow",
        "提裙行礼",
        "互动",
        "Holding both sides of the long skirt, knees slightly bent in an elegant curtsey.",
      ],
      [
        "walk",
        "轻步散步",
        "移动",
        "Full-body walking pose in three-quarter view, one foot forward, arms relaxed.",
      ],
      [
        "run",
        "轻快小跑",
        "移动",
        "Full-body running pose with bent arms and one knee raised, skirt and hair following naturally.",
      ],
      [
        "drag",
        "被提起反应",
        "互动",
        "Surprised airborne pose, feet off the ground, arms spread slightly for balance, eyes wide.",
      ],
      [
        "magic",
        "掌心星光",
        "生活",
        "Holding both palms open with a small blue glowing assistant orb above them, delighted expression.",
      ],
      [
        "play",
        "休闲游戏",
        "生活",
        "Holding a game controller with both hands, focused playful grin.",
      ],
    ],
  ],
];
const identity =
  "The reference image is character identity and costume reference. Preserve the SAME adult anime dragon princess: long silver-white hair, ivory horns, lavender eyes, pale lavender wings and long purple tail, the exact same elegant WHITE AND PALE LAVENDER ROSE GOWN, rose hair ornaments and flowing sleeves. No maid costume, no new outfit, no nudity. Clean polished anime illustration with crisp contours, soft cel shading, expressive face and natural hands.";
const layout =
  "Create ONE production sprite ATLAS PNG with a genuinely transparent alpha background, wide canvas, EXACTLY 4 columns by 2 rows of equal square cells, eight full-body poses. Read order left to right, top to bottom. Each character is centered inside its own cell, entire head, horns, wings, tail, props and feet visible, at least 10% empty transparent margin on every side of each cell. No part may cross cell boundaries. Consistent scale across cells. No grid lines, labels, letters, captions, floor, scenery, cast shadows, checkerboard or colored background. These are eight independent STILL poses, not motion interpolation frames.";
mkdirSync("art-source", { recursive: true });
const sheets = groups.map(([id, entries]) => ({
  id,
  file: id + ".png",
  columns: 4,
  rows: 2,
  actions: entries.map(([id, label, category, pose], index) => ({
    id,
    label,
    category,
    index,
    pose,
  })),
  prompt:
    identity +
    "\n" +
    layout +
    "\n" +
    entries.map((a, i) => `Cell ${i + 1}: ${a[3]}`).join("\n"),
}));
writeFileSync(
  "art-source/action-plan.json",
  JSON.stringify(
    {
      schema: 1,
      method: "built-in image_gen",
      reference: "references/reference-1.jpg",
      sourceBehavior: [
        "fish: 106 upstream WebM actions, click/drag/move/work/usage pools",
        "whale: 8 semantic WebM states using the shared interaction engine",
      ],
      sheets,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "docs/chatgpt-actions.md",
  "# ChatGPT 静态动作设计\n\n先归纳动作类型，再确定姿态 prompt，最后生成透明 PNG 图集。每格是一张独立姿态，不插帧，不播放 GIF 或视频。\n\n| 类型 | ID | 动作 | 姿态 prompt |\n|---|---|---|---|\n" +
    sheets
      .flatMap((s) =>
        s.actions.map(
          (a) => `| ${a.category} | ${a.id} | ${a.label} | ${a.pose} |`,
        ),
      )
      .join("\n") +
    "\n\n完整共用身份约束、图集排版和每次生成 prompt 见 `art-source/action-plan.json`。原版 106 个细分动作按语义映射到这 24 个姿态，未声称 106 张独立新画。两个 DeepSeek 角色的原媒体保持不变。\n",
);
console.log("Saved 24 action definitions and 3 atlas prompts.");
