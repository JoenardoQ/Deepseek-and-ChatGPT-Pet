// Presence is independent of installed plugins and MCP session count.
import scenes from '../assets/pets/duo/actions.json' with { type: 'json' };
export const ACTIONS = scenes.map((scene) => scene.id);
export class Duets {
  constructor({ now = Date.now, mode = 'auto', persist = () => {}, catalog = scenes } = {}) {
    this.now = now;
    this.catalog = catalog;
    this.persist = persist;
    this.mode = ['auto', 'off', ...catalog.map((s) => s.id)].includes(mode) ? mode : 'auto';
    this.startedAt = null;
    this.pair = '';
  }
  set(mode) {
    if (!['auto', 'off', ...this.catalog.map((s) => s.id)].includes(mode)) throw Error('Invalid duet action');
    this.persist(mode);
    this.mode = mode;
    this.startedAt = null;
  }
  snapshot(sources, control) {
    sources.current();
    const online = sources.connected(),
      dsh = online.get('dsh'),
      gpt = online.get('chatgpt');
    const pair = [dsh?.character, gpt?.character].sort().join('|');
    if (pair !== this.pair) {
      this.pair = pair;
      this.startedAt = null;
    }
    const available = this.catalog.filter((s) => [...s.participants].sort().join('|') === pair);
    const selected =
      this.mode === 'auto' || this.mode === 'off' ? available : available.filter((s) => s.id === this.mode);
    const eligible = !!(
      dsh &&
      gpt &&
      control.visible &&
      control.desktop &&
      dsh.desktop !== false &&
      gpt.desktop !== false &&
      selected.length
    );
    const active = eligible && this.mode !== 'off';
    if (!active) this.startedAt = null;
    else if (this.startedAt === null) this.startedAt = this.now();
    let action = null;
    if (active) {
      let elapsed = (this.now() - this.startedAt) % selected.reduce((sum, s) => sum + s.durationMs, 0);
      action = selected.find((s) => {
        if (elapsed < s.durationMs) return true;
        elapsed -= s.durationMs;
        return false;
      }).id;
    }
    const participant = (p) =>
      p
        ? { character: p.character, build: p.build || null, desktop: p.desktop !== false, error: p.error || null }
        : null;
    return {
      participants: { dsh: participant(dsh), chatgpt: participant(gpt) },
      active,
      eligible,
      mode: this.mode,
      action,
      owner: 'chatgpt',
      startedAt: this.startedAt,
      reason: eligible
        ? null
        : !dsh
          ? 'DSH 桌宠尚未连接，请开启桌面显示。'
          : !gpt
            ? '独立桌宠尚未连接，请开启桌宠。'
            : !selected.length
              ? '当前角色组合尚未提供所选双人场景。'
              : '请开启双方的桌面显示。',
    };
  }
}
