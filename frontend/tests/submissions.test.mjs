import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
mkdirSync('.test-output',{recursive:true})
let helpers={}
try{writeFileSync('.test-output/submissions.js',ts.transpileModule(readFileSync('src/submissions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);helpers=await import('../.test-output/submissions.js')}catch{}
assert.equal(typeof helpers.submissionCutoff,'function','submissionCutoff must exist')
const {submissionCutoff,canEditSubmission,validateAttachment}=helpers
assert.equal(submissionCutoff({due_date:'2026-10-13'}),'2026-10-13T16:00:00.000Z')
assert.equal(canEditSubmission({due_date:'2026-10-13'},null,new Date('2026-10-13T15:59:59Z')),true)
assert.equal(canEditSubmission({due_date:'2026-10-13'},null,new Date('2026-10-13T16:00:00Z')),false)
assert.equal(canEditSubmission({}, {status:'completed'},new Date()),false)
assert.equal(canEditSubmission({}, {status:'in_review'},new Date()),false)
assert.equal(submissionCutoff({due_at:'2026-10-13T10:00:00Z',due_date:'2026-10-13'}),'2026-10-13T10:00:00.000Z')
assert.equal(validateAttachment({name:'report.pdf',type:'application/pdf',size:1024}),null)
assert.ok(validateAttachment({name:'report.pdf',type:'text/html',size:1024}))
assert.ok(validateAttachment({name:'report.exe',type:'application/pdf',size:1024}))
assert.ok(validateAttachment({name:'report.pdf',type:'application/pdf',size:10485761}))
console.log('PASS: midnight/exact deadlines, approved/submitted locks, file type and size validation')
