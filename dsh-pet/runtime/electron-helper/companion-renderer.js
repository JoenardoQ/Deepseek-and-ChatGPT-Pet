// Poll only semantic host state. Static poses need no frame export loop.
(() => {
  if(!window.companionBridge)return;
  let revision=-1,stateKey='',sequence=1000000;
  async function tick(){
    try{
      const pet=sprites[0];if(!pet)return;
      const reply=await window.companionBridge.presence({petId:pet.pet?.id,character:pet.character,error:null});
      window.__petHost=reply;pet.applyDuet(reply.duet);
      if(reply.control){
        const control=reply.control;
        const key=control.state+'\0'+control.message;
        if(key!==stateKey){
          const wasSleeping=stateKey.startsWith('sleeping\0');stateKey=key;revision=control.revision;
          pet.onWorkTick({state:['idle','sleeping'].includes(control.state)?null:control.state,task:control.message||null},++sequence);
          if(control.state==='sleeping')pet.switchTo('原地小憩沉眠',false);
          else if(wasSleeping&&control.state==='idle')pet.playIdle();
        }
      }
    }catch(error){window.__petHost={...window.__petHost,error:error.message};}
    finally{setTimeout(tick,1000);}
  }
  void tick();
})();
