import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { createRequire } from "node:module";
import { createPreview } from "./preview.mjs";
const require = createRequire(
  new URL("../dsh-pet/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const server = createPreview();
server.listen(0, "127.0.0.1");
await once(server, "listening");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PET_TEST_BROWSER
    ? { executablePath: process.env.PET_TEST_BROWSER }
    : {}),
});
try {
  const page = await browser.newPage({
    viewport: { width: 1760, height: 1220 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.status() + " " + r.url());
  });
  await page.goto("http://127.0.0.1:" + server.address().port);
  assert.equal(await page.evaluate(() => window.renderReady), 32);
  const check = await page.evaluate(async () => {
    const nonempty = window.players.map((p) => {
      const data = p.canvas.getContext("2d").getImageData(0, 0, 640, 360).data;
      let opaque = 0,
        clear = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 220) opaque++;
        if (data[i] === 0) clear++;
      }
      return { ready: p.ready, opaque, clear };
    });
    const p = window.players[0],
      first = p.canvas.toDataURL();
    await new Promise((r) => setTimeout(r, 120));
    const stable = first === p.canvas.toDataURL();
    let ended = 0;
    await p.play(
      "/dsh-pet/assets/pets/chatgpt/images/core.png",
      true,
      () => ended++,
      { columns: 4, rows: 2, index: 2 },
      100,
    );
    await new Promise((r) => setTimeout(r, 150));
    const oneShot = ended;
    await p.play(
      "/dsh-pet/assets/pets/chatgpt/images/core.png",
      true,
      () => ended++,
      { columns: 4, rows: 2, index: 0 },
      100,
    );
    p.stop();
    await new Promise((r) => setTimeout(r, 150));
    const stopped = ended === oneShot && !p.ready;
    await p.play(
      "/dsh-pet/assets/pets/chatgpt/images/core.png",
      false,
      () => ended++,
      { columns: 4, rows: 2, index: 0 },
      100,
    );
    p.finishLoop();
    await new Promise((r) => setTimeout(r, 150));
    const finished = ended === oneShot + 1;
    const pending = p.play(
      "/dsh-pet/assets/pets/chatgpt/images/core.png",
      false,
      () => ended++,
      { columns: 4, rows: 2, index: 0 },
      100,
    );
    p.finishLoop();
    await pending;
    await new Promise((r) => setTimeout(r, 150));
    return {
      nonempty,
      stable,
      oneShot,
      stopped,
      finished,
      finishDuringLoad: ended === oneShot + 2,
    };
  });
  assert.ok(
    check.nonempty.every((p) => p.ready && p.opaque > 10000 && p.clear > 10000),
  );
  assert.ok(check.stable);
  assert.equal(check.oneShot, 1);
  assert.ok(check.stopped);
  assert.ok(check.finished);
  assert.ok(check.finishDuringLoad);
  assert.deepEqual(errors, []);
  mkdirSync(".qa", { recursive: true });
  await page.screenshot({ path: ".qa/gallery-light.png", fullPage: true });
  await page.click("button");
  await page.screenshot({ path: ".qa/gallery-dark.png", fullPage: true });
  writeFileSync(".qa/render-results.json", JSON.stringify(check, null, 2));
  console.log(
    "PASS: 32 transparent poses; static pixels, one-shot completion, cancellation and loop release; zero page/network errors.",
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
