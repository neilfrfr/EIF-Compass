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
  if(item){pill.style.transform=`translate(${item.offsetLeft}px,${item.offsetTop}px)`;pill.style.width=`${item.offsetWidth}px`;pill.style.height=`${item.offsetHeight}px`}
}

/** Inserts one `.row-glide` into the list and slides it to the hovered row. CSS shows it on fine pointers only; absent under reduced motion. */
export function useRowGlide(listRef:RefObject<HTMLElement|null>,rowSelector:string):void{
  const bound=useRef<{list:HTMLElement;off:()=>void}|null>(null)
  // No deps: the list may mount later (after loading, or inside a drawer), so rebind whenever the element changes.
  useEffect(()=>{
    const list=listRef.current
    if(bound.current?.list===list)return
    bound.current?.off();bound.current=null
    if(!list||reducedMotion())return
    const glide=document.createElement('span')
    glide.className='row-glide';glide.setAttribute('aria-hidden','true')
    list.prepend(glide)
    const place=(row:Element|null)=>{
      glide.style.opacity=row?'1':'0'
      if(!row)return
      const r=row.getBoundingClientRect(),l=list.getBoundingClientRect()
      glide.style.transform=`translate(${r.left-l.left-list.clientLeft+list.scrollLeft}px,${r.top-l.top-list.clientTop+list.scrollTop}px)`
      glide.style.width=`${r.width}px`;glide.style.height=`${r.height}px`
    }
    const over=(event:Event)=>{const row=(event.target as Element).closest?.(rowSelector);place(row&&list.contains(row)?row:null)}
    const leave=()=>place(null)
    list.addEventListener('pointerover',over);list.addEventListener('pointerleave',leave)
    bound.current={list,off:()=>{list.removeEventListener('pointerover',over);list.removeEventListener('pointerleave',leave);glide.remove()}}
  })
  useEffect(()=>()=>{bound.current?.off();bound.current=null},[])
}

/** Marks an id as completing for 600ms so its row can play the check + strike animation. No-op under reduced motion. */
export function useCompletionFlash():{flash(id:string):void;clear(id:string):void;isFlashing(id:string):boolean}{
  const [ids,setIds]=useState<string[]>([])
  const timers=useRef(new Map<string,number>())
  const alive=useRef(true)
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;timers.current.forEach(timer=>window.clearTimeout(timer));timers.current.clear()}},[])
  return {
    clear(id){
      window.clearTimeout(timers.current.get(id));timers.current.delete(id)
      setIds(current=>current.includes(id)?current.filter(x=>x!==id):current)
    },
    flash(id){
      if(!alive.current||reducedMotion())return
      window.clearTimeout(timers.current.get(id))
      timers.current.set(id,window.setTimeout(()=>{timers.current.delete(id);setIds(current=>current.filter(x=>x!==id))},600))
      setIds(current=>current.includes(id)?current:[...current,id])
    },
    isFlashing:id=>ids.includes(id),
  }
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
