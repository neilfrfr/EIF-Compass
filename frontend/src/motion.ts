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
  // Placement has no deps: the nav can mount after the first render (once the profile loads), and the style writes are idempotent.
  useLayoutEffect(()=>{
    const nav=container.current
    if(!nav)return
    placePill(nav.querySelector(activeSelector),nav.querySelector('.nav-pill'))
    if(lastActive.current!==activeSelector){lastActive.current=activeSelector;placePill(null,nav.querySelector('.nav-hover-pill'))}
  })
  // Listeners are delegated from document so they bind once per active item, whenever the nav mounts.
  useEffect(()=>{
    const over=(event:PointerEvent)=>{
      const nav=container.current,hover=nav?.querySelector<HTMLElement>('.nav-hover-pill')
      if(!nav||!hover)return
      const item=nav.contains(event.target as Node)?(event.target as Element).closest<HTMLElement>('.nav-item'):null
      if(item||!nav.contains(event.target as Node))placePill(item&&!item.matches(activeSelector)?item:null,hover)
    }
    const resize=()=>{const nav=container.current;if(nav)placePill(nav.querySelector(activeSelector),nav.querySelector('.nav-pill'))}
    document.addEventListener('pointerover',over)
    window.addEventListener('resize',resize)
    return()=>{document.removeEventListener('pointerover',over);window.removeEventListener('resize',resize)}
  },[container,activeSelector])
}

export function placePill(item:HTMLElement|null,pill:HTMLElement|null){
  if(!pill)return
  pill.style.opacity=item?'1':'0'
  if(item){pill.style.transform=`translateY(${item.offsetTop}px)`;pill.style.height=`${item.offsetHeight}px`}
}

/** Last arrival delay (6 x 70ms + 80ms) plus the 700ms rise. */
const ENTRY_MS=80+6*70+700

/** On key change the old page leaves for 160ms (`key` still holds the old value), then the new one enters; the class clears once arrival ends so data refreshes never replay it. */
export function usePageTransition(key:string):{className:string;key:string}{
  const [state,setState]=useState(()=>({key,className:reducedMotion()?'':'page-entering'}))
  useEffect(()=>{
    if(key===state.key&&state.className!=='page-leaving')return
    if(reducedMotion()){setState({key,className:''});return}
    setState(current=>({...current,className:'page-leaving'}))
    const timer=window.setTimeout(()=>setState({key,className:'page-entering'}),160)
    return()=>window.clearTimeout(timer)
  },[key])
  useEffect(()=>{
    if(state.className!=='page-entering')return
    const timer=window.setTimeout(()=>setState(current=>current.className==='page-entering'?{...current,className:''}:current),ENTRY_MS)
    return()=>window.clearTimeout(timer)
  },[state])
  return reducedMotion()?{key,className:''}:state
}
