import {useEffect,useRef,useState} from 'react'

export type PaletteItem={label:string;hint?:string;run:()=>void}

export default function CommandPalette({items}:{items:PaletteItem[]}){
  const [open,setOpen]=useState(false)
  const [query,setQuery]=useState('')
  const [index,setIndex]=useState(0)
  const dialog=useRef<HTMLDialogElement>(null)
  const previous=useRef<HTMLElement|null>(null)
  const matches=items.filter(i=>i.label.toLowerCase().includes(query.trim().toLowerCase()))
  const active=matches.length?Math.min(index,matches.length-1):-1

  useEffect(()=>{
    const show=()=>{previous.current=document.activeElement as HTMLElement|null;setQuery('');setIndex(0);setOpen(true)}
    const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();show()}}
    window.addEventListener('keydown',key)
    window.addEventListener('eif:palette',show)
    return()=>{window.removeEventListener('keydown',key);window.removeEventListener('eif:palette',show)}
  },[])

  useEffect(()=>{const d=dialog.current;if(open&&d&&!d.open)d.showModal()},[open])

  function close(){
    const d=dialog.current
    if(d?.open)d.close()
    setOpen(false)
    previous.current?.focus?.()
    previous.current=null
  }
  function run(item:PaletteItem){close();item.run()}

  function onKeyDown(e:React.KeyboardEvent){
    if(!matches.length)return
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault()
      setIndex((active+(e.key==='ArrowDown'?1:matches.length-1))%matches.length)
    }else if(e.key==='Enter'){e.preventDefault();run(matches[active])}
  }

  return <dialog ref={dialog} className="palette" aria-label="Command palette"
    onClose={()=>{if(open)close()}}
    onClick={e=>{if(e.target===e.currentTarget)close()}}>
    {open&&<div className="palette-card">
      <input className="palette-input" role="combobox" aria-label="Search commands" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={active>=0?`palette-opt-${active}`:undefined} aria-autocomplete="list" placeholder="Type a command or search…" autoComplete="off" autoFocus value={query} onChange={e=>{setQuery(e.target.value);setIndex(0)}} onKeyDown={onKeyDown}/>
      <ul id="palette-list" role="listbox" aria-label="Commands">
        {matches.map((item,i)=><li key={item.label} id={`palette-opt-${i}`} role="option" aria-selected={i===active} onMouseMove={()=>setIndex(i)} onClick={()=>run(item)}><span>{item.label}</span>{item.hint&&<kbd aria-hidden="true">{item.hint}</kbd>}</li>)}
      </ul>
      {!matches.length&&<p className="palette-empty" role="status">No matches</p>}
    </div>}
  </dialog>
}
