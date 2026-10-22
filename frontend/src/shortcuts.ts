import type {View} from './data'

export function isTypingTarget(el:EventTarget|null):boolean{
  if(!el||!(el as Element).closest)return false
  const e=el as HTMLElement
  return !!(e.closest('input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=dialog],dialog[open]')||e.isContentEditable)
}

export function createGoShortcut(map:Record<string,View>,go:(v:View)=>void,timeoutMs=900):(e:KeyboardEvent)=>void{
  let armedAt=0
  return e=>{
    if(e.ctrlKey||e.altKey||e.metaKey||isTypingTarget(e.target)||globalThis.document?.querySelector('.detail-overlay'))return
    const key=e.key?.toLowerCase()??''
    const armed=armedAt>0&&Date.now()-armedAt<=timeoutMs
    armedAt=0
    if(armed&&Object.hasOwn(map,key)){go(map[key]);return}
    if(key==='g')armedAt=Date.now()
  }
}
