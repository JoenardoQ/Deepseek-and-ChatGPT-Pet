import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
process.env.PET_DATA_DIR = mkdtempSync(
  join(tmpdir(), "desktop-pet-coordinator-"),
);
const { createBridge } = await import("../dsh-pet/bridge/server.mjs");
const { Sources, Controls } = await import("../dsh-pet/bridge/state.mjs");
const { Duets } = await import("../dsh-pet/bridge/duets.mjs");
test("independent host presence activates and releases a static duo scene", () => {
  let now = 0;
  const sources = new Sources(() => now),
    duets = new Duets({ now: () => now });
  const control = { visible: true, desktop: true };
  sources.touch("chatgpt", { character: "chatgpt", desktop: true });
  assert.equal(duets.snapshot(sources, control).active, false);
  sources.touch("dsh", { character: "fish", desktop: true });
  assert.equal(duets.snapshot(sources, control).active, true);
  now = 6001;
  assert.equal(duets.snapshot(sources, control).active, false);
  sources.touch("dsh", { character: "whale", desktop: true });
  sources.touch("chatgpt", { character: "chatgpt", desktop: true });
  assert.equal(duets.snapshot(sources, control).active, false);
});
test("multiple sessions preserve the active worker and expiry returns to idle", () => {
  let now = 0;
  const c = new Controls(() => now),
    a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  c.apply({
    source: "chatgpt",
    action: "wake",
    state: "working",
    sessionId: a,
  });
  c.apply({ source: "chatgpt", action: "wake", state: "idle", sessionId: b });
  assert.equal(c.snapshot().state, "working");
  c.apply({ source: "chatgpt", action: "hide", sessionId: b });
  assert.equal(c.snapshot().visible, true);
  now = 10001;
  assert.equal(c.snapshot().visible, false);
  assert.throws(
    () => c.apply({ source: "chatgpt", action: "wake", screen: true }),
    /Unknown/,
  );
});
test("duet eligibility is driven by scene participants and per-scene duration", () => {
  let now = 0;
  const sources = new Sources(() => now),
    control = { visible: true, desktop: true };
  const duets = new Duets({
    now: () => now,
    catalog: [
      { id: "a", participants: ["whale", "new-pet"], durationMs: 500 },
      { id: "b", participants: ["new-pet", "whale"], durationMs: 1000 },
    ],
  });
  sources.touch("dsh", { character: "whale", desktop: true });
  sources.touch("chatgpt", { character: "new-pet", desktop: true });
  assert.equal(duets.snapshot(sources, control).action, "a");
  now = 600;
  assert.equal(duets.snapshot(sources, control).action, "b");
  now = 1600;
  assert.equal(duets.snapshot(sources, control).action, "a");
  duets.set("off");
  assert.equal(duets.snapshot(sources, control).active, false);
});
test("HTTP contract supports desktop only, rejects device routes and hostile requests", async () => {
  const server = createBridge({ launch: false });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  const post = (route, value, headers = {}) =>
    fetch(base + route, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pet-Client": "1",
        ...headers,
      },
      body: JSON.stringify(value),
    });
  try {
    const r = await post("/event", {
      source: "chatgpt",
      action: "wake",
      state: "thinking",
    });
    assert.equal(r.status, 200);
    const state = await r.json();
    assert.equal(state.service, "desktop-pet");
    assert.equal(state.control.state, "thinking");
    assert.ok(!("output" in state));
    for (const route of ["/device/takeover", "/device/connection", "/frame"])
      assert.equal((await post(route, {})).status, 404);
    assert.equal(
      (
        await post(
          "/event",
          { source: "chatgpt", action: "wake" },
          { Origin: "https://other.example" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await post("/presence", {
          source: "dsh",
          character: "../../secret",
          desktop: true,
        })
      ).status,
      400,
    );
    const presence = (source) =>
      post("/presence", {
        source,
        character: source === "dsh" ? "fish" : "chatgpt",
        desktop: true,
        instanceId: source,
        build: "2.0.1",
        error: null,
      });
    await presence("dsh");
    const pair = await (await presence("chatgpt")).json();
    assert.equal(pair.duet.active, true);
    await post("/duet", { mode: "off" });
    assert.equal(
      (await (await fetch(base + "/state")).json()).duet.active,
      false,
    );
    await post("/pet/close", {});
    assert.equal(
      (await (await fetch(base + "/state")).json()).control.visible,
      false,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
