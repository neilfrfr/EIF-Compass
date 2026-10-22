import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { reducedMotion } from './motion'

type Props = { title: string; children: ReactNode; onClose: () => void; dirty?: boolean; busy?: boolean }

export default function DetailDrawer({ title, children, onClose, dirty = false, busy = false }: Props) {
 const keyboardEntry = useRef(typeof document !== 'undefined' && document.activeElement?.matches(':focus-visible'))
 const heading = useId()
 const panel = useRef<HTMLElement>(null)
 const keepEditing = useRef<HTMLButtonElement>(null)
 const close = useRef(onClose)
 const status = useRef({dirty,busy})
 const [discard,setDiscard] = useState(false)
 const [closing,setClosing] = useState(false)
 const leaving = useRef(false)
 useEffect(()=>{if(discard)keepEditing.current?.focus()},[discard])
 close.current = onClose
 status.current = {dirty,busy}
 function requestClose() {
  if(status.current.busy||leaving.current)return
  if(status.current.dirty)setDiscard(true)
  else leave()
 }
 // Plays the exit animation, then hands over to the parent's onClose (which unmounts and runs the cleanup below).
 function leave() {
  if(leaving.current)return
  leaving.current=true
  setClosing(true)
 }
 useLayoutEffect(()=>{
  if(!closing)return
  const running=panel.current?.getAnimations?.()??[]
  if(reducedMotion()||!running.length){close.current();return}
  let live=true
  void Promise.allSettled(running.map(animation=>animation.finished)).then(()=>{if(live)close.current()})
  return()=>{live=false}
 },[closing])
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null
  const overflow=document.body.style.overflow
  document.body.style.overflow='hidden'
  const siblings=Array.from(document.body.children).filter(node=>!node.contains(panel.current)) as HTMLElement[]
  const inert=siblings.map(node=>node.inert)
  siblings.forEach(node=>{node.inert=true})
  panel.current?.focus()
  function keydown(event:KeyboardEvent){
   if(event.key==='Escape'){event.preventDefault();requestClose()}
   if(event.key!=='Tab')return
   const controls=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')||[]).filter(node=>!node.closest('[hidden],[inert]')&&window.getComputedStyle(node).display!=='none'&&window.getComputedStyle(node).visibility!=='hidden')
   const first=controls[0],last=controls[controls.length-1]
   if(!first){event.preventDefault();panel.current?.focus()}
   else if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===panel.current)){event.preventDefault();first.focus()}
  }
  document.addEventListener('keydown',keydown)
  function beforeUnload(event:BeforeUnloadEvent){if(status.current.dirty||status.current.busy){event.preventDefault();event.returnValue=''}}
  window.addEventListener('beforeunload',beforeUnload)
  return()=>{document.removeEventListener('keydown',keydown);window.removeEventListener('beforeunload',beforeUnload);document.body.style.overflow=overflow;siblings.forEach((node,index)=>{node.inert=inert[index]});if(previous?.isConnected)previous.focus()}
 },[])
 return createPortal(<div className={`detail-overlay${closing?' is-closing':''}`} onClick={event=>{if(event.target===event.currentTarget)requestClose()}}>
  <section ref={panel} className="detail-drawer" data-keyboard={keyboardEntry.current || undefined} role="dialog" aria-modal="true" aria-labelledby={heading} tabIndex={-1}>
   <header className="detail-header"><h2 id={heading}>{title}</h2><button type="button" className="text-button" onClick={requestClose} disabled={busy} aria-label={`Close ${title}`}>Close</button></header>
   {discard&&<div className="drawer-discard" role="alert"><p>Discard unsaved changes?</p><div className="manager-actions"><button ref={keepEditing} type="button" className="primary-button" disabled={busy} onClick={()=>{setDiscard(false);panel.current?.focus()}}>Keep editing</button><button type="button" className="text-button danger-button" disabled={busy} onClick={leave}>Discard changes</button></div></div>}
   <div className="detail-body">{children}</div>
  </section>
 </div>,document.body)
}
