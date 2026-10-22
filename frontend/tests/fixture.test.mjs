import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
mkdirSync('.test-output',{recursive:true})
writeFileSync('.test-output/fixture.js',ts.transpileModule(readFileSync('src/dev/fixture.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText)
const {createFixtureClient}=await import('../.test-output/fixture.js')
const intern=createFixtureClient('intern')
const {data:tasks}=await intern.from('tasks').select('*').eq('assignee_id','a')
assert.ok(tasks.length>=2)
await intern.from('tasks').update({status:'completed'}).eq('id',tasks[0].id)
assert.equal((await intern.from('tasks').select('*').eq('id',tasks[0].id).maybeSingle()).data.status,'completed')
assert.equal((await intern.auth.getSession()).data.session.user.id,'a')
assert.equal((await createFixtureClient('lead').auth.getSession()).data.session.user.id,'l')
assert.equal((await intern.from('profiles').select('display_name,role,team_name,cohort_id').eq('id','a').maybeSingle()).data.display_name,'Ana Reyes')
console.log('fixture tests passed')
assert.ok((await intern.from('profiles').select('display_name')).data.some(p=>p.display_name.length===40))
assert.ok((await intern.from('tasks').select('title')).data.some(t=>t.title.length===80))
console.log('fixture lengths ok')
