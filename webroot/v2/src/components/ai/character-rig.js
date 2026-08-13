const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function mountCharacterRig(stage){
  if(!stage) return {setSpeaking(){},destroy(){}};
  const rig=stage.querySelector('[data-character-rig]');
  if(!rig) return {setSpeaking(){},destroy(){}};

  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,disposed=false,targetX=0,targetY=0,currentX=0,currentY=0;

  const point=(event)=>{
    const rect=stage.getBoundingClientRect();
    targetX=clamp(((event.clientX-rect.left)/rect.width-.5)*2,-1,1);
    targetY=clamp(((event.clientY-rect.top)/rect.height-.5)*2,-1,1);
    rig.classList.add('is-engaged');
  };
  const rest=()=>{targetX=0;targetY=0;rig.classList.remove('is-engaged')};
  const animate=()=>{
    if(disposed) return;
    if(!reduced.matches&&document.visibilityState==='visible'){
      currentX+=(targetX-currentX)*.075;
      currentY+=(targetY-currentY)*.075;
      rig.style.setProperty('--look-x',currentX.toFixed(3));
      rig.style.setProperty('--look-y',currentY.toFixed(3));
    }
    frame=requestAnimationFrame(animate);
  };
  stage.addEventListener('pointermove',point,{passive:true});
  stage.addEventListener('pointerleave',rest,{passive:true});
  stage.addEventListener('pointerdown',point,{passive:true});
  frame=requestAnimationFrame(animate);

  return {
    setSpeaking(active){rig.classList.toggle('is-speaking',Boolean(active))},
    destroy(){
      disposed=true;cancelAnimationFrame(frame);
      stage.removeEventListener('pointermove',point);
      stage.removeEventListener('pointerleave',rest);
      stage.removeEventListener('pointerdown',point);
    }
  };
}
