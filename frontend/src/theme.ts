export type Theme='light'|'dark'
const KEY='eif-theme'
const COLORS:Record<Theme,string>={light:'#245862',dark:'#061416'}

export function readTheme():Theme{
  try{const v=localStorage.getItem(KEY);if(v==='light'||v==='dark')return v}catch{}
  try{return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{return 'light'}
}

export function applyTheme(t:Theme):void{
  const root=document.documentElement
  root.dataset.theme=t
  root.style.colorScheme=t
  document.querySelector('meta[name=theme-color]')?.setAttribute('content',COLORS[t])
}

export function setTheme(t:Theme,origin?:{x:number;y:number}):void{
  try{localStorage.setItem(KEY,t)}catch{}
  const root=document.documentElement
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches
  if(!origin||reduce||!document.startViewTransition)return applyTheme(t)
  const {x,y}=origin
  root.style.setProperty('--tx',x+'px')
  root.style.setProperty('--ty',y+'px')
  root.style.setProperty('--tr',Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y))+'px')
  root.classList.add('vt-theme')
  document.startViewTransition(()=>applyTheme(t)).finished.finally(()=>root.classList.remove('vt-theme'))
}

export function toggleTheme(origin?:{x:number;y:number}):void{
  setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',origin)
}
