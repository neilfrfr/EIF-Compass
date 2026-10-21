import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {join,relative} from 'node:path'

const src='src'
// Temporary: not yet migrated to tokens. Task 4 removes these from the allowlist.
const allow=new Set(['styles/tokens.css','styles.css','brand.css','interaction-effects.css','assistant.css'])
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)])
const files=walk(src).filter(f=>f.endsWith('.css')).map(f=>relative(src,f).replaceAll('\\','/')).filter(f=>!allow.has(f))
assert.ok(files.length>0,'found stylesheets to check')
const raw=/#[0-9a-fA-F]{3,8}\b|rgba?\(/
for(const f of files){
  const css=readFileSync(join(src,f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'')
  const hit=css.match(raw)
  assert.ok(!hit,`${f} uses a raw colour (${hit?.[0]}); use a var(--token) from styles/tokens.css`)
}
const tokens=readFileSync(join(src,'styles/tokens.css'),'utf8')
for(const theme of ['light','dark']){
  const block=tokens.match(new RegExp(`\\[data-theme=${theme}\\][^{]*\\{([^}]*)\\}`))
  assert.ok(block&&/--canvas\s*:/.test(block[1]),`tokens.css defines --canvas under [data-theme=${theme}]`)
}
console.log(`PASS: ${files.length} stylesheets use only theme tokens; tokens.css defines both themes`)
