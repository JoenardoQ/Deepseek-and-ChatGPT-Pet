// Native host adapter: heartbeat and menu IPC, independent of output devices.
const {app,ipcMain,BrowserWindow}=require('electron');
const path=require('node:path'),{pathToFileURL}=require('node:url'),{mkdirSync,existsSync}=require('node:fs');
const root=path.resolve(__dirname,'../..');
const source=process.env.PET_HOST_SOURCE==='chatgpt'?'chatgpt':'dsh';
const dataDir=require('../../bridge/user-paths.cjs').resolveDataDir();
const profile=path.join(dataDir,'electron-'+source);mkdirSync(profile,{recursive:true});app.setPath('userData',profile);
let client,runtime;
async function request(route,value){
  runtime ||= await import(pathToFileURL(path.join(root,'bridge/runtime.mjs')).href);
  client ||= await import(pathToFileURL(path.join(root,'bridge/client.mjs')).href);
  await client.ensureBridge();
  const response=await fetch(runtime.base+route,{method:'POST',headers:{'Content-Type':'application/json','X-Pet-Client':'1'},body:JSON.stringify(value),signal:AbortSignal.timeout(4000)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Companion request failed');return result;
}
function valid(event){return BrowserWindow.fromWebContents(event.sender)&&event.sender.getURL().startsWith('file:');}
ipcMain.handle('companion:presence',async(event,payload)=>{
  if(!valid(event)||typeof payload?.character!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(payload.character)||
      !existsSync(path.join(root,'assets/pets',payload.character,'pet.json')))return {source,error:'Invalid presence'};
  const win=BrowserWindow.fromWebContents(event.sender);
  try{
    const status=await request('/presence',{source,character:payload.character,desktop:true,instanceId:process.pid+':'+String(payload.petId||'main'),build:require('../../package.json').version,error:payload.error?String(payload.error).slice(0,300):null});
    if((source==='chatgpt'&&status.control?.desktop===false)||(status.duet?.active&&status.duet.owner!==source))win.hide();
    else if(!win.isVisible())win.showInactive();
    return {...status,source,control:source==='chatgpt'?status.control:undefined};
  }catch(error){
    if(!win.isVisible())win.showInactive();
    return {source,error:error.message,duet:{active:false}};
  }
});
ipcMain.handle('companion:duet',async(event,mode)=>{
  if(!valid(event)||typeof mode!=='string')return {error:'Invalid request'};
  try{return await request('/duet',{mode});}catch(error){return {error:error.message};}
});
ipcMain.handle('companion:shutdown',async event=>{
  if(!valid(event)||source!=='chatgpt')return {error:'Please close the pet in its host settings.'};
  try{return await request('/pet/close',{});}catch(error){return {error:error.message};}
});
