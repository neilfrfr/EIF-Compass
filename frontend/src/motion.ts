import {useEffect,useLayoutEffect,useRef,useState,type RefObject} from 'react'

export function reducedMotion():boolean{
  try{return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true}catch{return false}
}

/** Ease-out quartic count from the last shown value to `target`. Instant under reduced motion. */
export function useCountUp(target:number|null,{delay=0,duration=1100}:{delay?:number;duration?:number}={}):number|null{
  const [value,setValue]=useState<number|null>(()=>target===null||reducedMotion()?target:0)
  const shown=useRef(value)
  useEffect(()=>{
    if(target===null||reducedMotion()){shown.current=target;setValue(target);return}
    const from=shown.current??0
    let start:number|undefined,frame=0
    const tick=(now:number)=>{
      start??=now+delay
      const p=Math.min(1,Math.max(0,(now-start)/duration))
      const next=p===1?target:Math.round(from+(target-from)*(1-(1-p)**4))
      shown.current=next;setValue(next)
      if(p<1)frame=window.requestAnimationFrame(tick)
    }
    frame=window.requestAnimationFrame(tick)
    return()=>window.cancelAnimationFrame(frame)
  },[target])
  return target===null||reducedMotion()?target:value
}

/** Slides `.nav-pill` to the item matching `activeSelector` and `.nav-hover-pill` to the hovered `.nav-item`. */
export function useSlidingIndicator(container:RefObject<HTMLElement|null>,activeSelector:string):void{
  const lastActive=useRef('')
  // No deps: the container can mount after the first render (e.g. once the profile loads); placing is idempotent.
  useLayoutEffect(()=>{
    const nav=container.current
    if(!nav)return
    const pill=nav.querySelector<HTMLElement>('.nav-pill'),hover=nav.querySelector<HTMLElement>('.nav-hover-pill')
    const place=(item:HTMLElement|null,target:HTMLElement|null)=>{
      if(!target)return
      target.style.opacity=item?'1':'0'
      if(item){target.style.transform=`translateY(${item.offsetTop}px)`;target.style.height=`${item.offsetHeight}px`}
    }
    const sync=()=>place(nav.querySelector<HTMLElement>(activeSelector),pill)
    const over=(event:PointerEvent)=>{
      const item=(event.target as Element).closest<HTMLElement>('.nav-item')
      if(item)place(item.matches(activeSelector)?null:item,hover)
    }
    const leave=()=>place(null,hover)
    sync()
    if(lastActive.current!==activeSelector){lastActive.current=activeSelector;leave()}
    nav.addEventListener('pointerover',over)
    nav.addEventListener('pointerleave',leave)
    window.addEventListener('resize',sync)
    return()=>{nav.removeEventListener('pointerover',over);nav.removeEventListener('pointerleave',leave);window.removeEventListener('resize',sync)}
  })
}

/** On key change the old page leaves for 160ms (`key` still holds the old value), then the new one enters. */
export function usePageTransition(key:string):{className:string;key:string}{
  const [state,setState]=useState(()=>({key,className:reducedMotion()?'':'page-entering'}))
  useEffect(()=>{
    if(key===state.key&&state.className!=='page-leaving')return
    if(reducedMotion()){setState({key,className:''});return}
    setState(current=>({...current,className:'page-leaving'}))
    const timer=window.setTimeout(()=>setState({key,className:'page-entering'}),160)
    return()=>window.clearTimeout(timer)
  },[key])
  return reducedMotion()?{key,className:''}:state
}
