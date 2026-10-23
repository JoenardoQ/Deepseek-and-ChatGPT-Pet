// Local, read-only atlas review. Run after npm run build.
import http from "node:http";
import { readFileSync } from "node:fs";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>桌宠动作预览</title>
<style>body{font:15px system-ui;background:#edf1f6;color:#24283a;margin:30px}h1{font-size:28px}.grid{display:grid;grid-template-columns:repeat(8,1fr);gap:12px}.pose{position:relative;aspect-ratio:16/12;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px #24344a12}.pose canvas{top:0!important;height:auto!important;aspect-ratio:16/9}.label{position:absolute;bottom:8px;width:100%;text-align:center;font-size:13px}p{color:#58647c}.dark .pose{background:#263246}.dark .label{color:white}button{padding:8px 18px;cursor:pointer}</style>
<h1>ChatGPT 娘 · 静态动作与双人场景</h1><p>24 个独立姿态 · 8 个双人场景 · 点击卡片播放该姿态 4 秒；图像本身保持静止。</p><button onclick="document.body.classList.toggle('dark')">切换深色底</button><h2>单人动作</h2><div id="single" class="grid"></div><h2>双人场景</h2><div id="duo" class="grid"></div>
<script src="/dsh-pet/runtime/electron-helper/shared-core.js"></script><script>
window.renderReady=(async()=>{const S=window.PetShared;const scenes=await(await fetch('/dsh-pet/assets/pets/duo/actions.json')).json();
window.players=[];for(const [group,pack,actions]of [['single','chatgpt',S.getPetPack('chatgpt').actions],['duo','duo',scenes]]){
for(const action of actions){const el=document.createElement('div');el.className='pose';el.dataset.action=action.id;document.getElementById(group).append(el);
const player=new S.ImagePosePlayer(el);window.players.push(player);const label=document.createElement('div');label.className='label';label.textContent=action.label;el.append(label);
const play=()=>player.play('/dsh-pet/assets/pets/'+pack+'/'+action.file,false,()=>{},action.cell,action.durationMs);el.onclick=play;await play();}}
return window.players.length;})();</script></html>`;
export function createPreview() {
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      const file = resolve(root, "." + decodeURIComponent(url.pathname));
      if (
        !file.startsWith(resolve(root, "dsh-pet") + sep) ||
        ![".png", ".webm", ".js", ".json"].includes(extname(file))
      )
        throw Error("Not found");
      const type = {
        ".png": "image/png",
        ".webm": "video/webm",
        ".js": "text/javascript",
        ".json": "application/json",
      }[extname(file)];
      res.writeHead(200, { "Content-Type": type });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  createPreview().listen(19430, "127.0.0.1", () =>
    console.log("Preview: http://127.0.0.1:19430"),
  );
}
