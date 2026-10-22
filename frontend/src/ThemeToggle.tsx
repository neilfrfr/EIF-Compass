import {useEffect,useState} from 'react'
import {applyTheme,readTheme,toggleTheme,type Theme} from './theme'

const current=():Theme=>document.documentElement.dataset.theme==='dark'?'dark':document.documentElement.dataset.theme==='light'?'light':readTheme()

export default function ThemeToggle(){
  const [theme,setLocal]=useState<Theme>(current)
  useEffect(()=>{
    const sync=()=>setLocal(document.documentElement.dataset.theme==='dark'?'dark':'light')
    applyTheme(theme)
    const observer=new MutationObserver(sync)
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']})
    const onStorage=(e:StorageEvent)=>{if(e.key===null||e.key==='eif-theme')applyTheme(readTheme())}
    window.addEventListener('storage',onStorage)
    return()=>{observer.disconnect();window.removeEventListener('storage',onStorage)}
  },[])
  return <button type="button" className="theme-toggle" aria-label="Dark mode" aria-pressed={theme==='dark'} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();toggleTheme({x:r.left+r.width/2,y:r.top+r.height/2})}}>
    <span className="theme-thumb" aria-hidden="true"/>
    <span className="theme-icon theme-sun" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></span>
    <span className="theme-icon theme-moon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z"/></svg></span>
  </button>
}
