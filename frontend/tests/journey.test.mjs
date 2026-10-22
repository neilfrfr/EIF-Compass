import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
mkdirSync('.test-output',{recursive:true})
writeFileSync('.test-output/journey.js',ts.transpileModule(readFileSync('src/journey.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText)
const {REST,journeyTargets,stepToward,pathD,nearestOnPath}=await import('../.test-output/journey.js')

assert.deepEqual(journeyTargets(null),REST)
assert.deepEqual(REST,[{x:20,y:152},{x:168,y:152},{x:276,y:44},{x:530,y:44}])

const onPoint=journeyTargets({x:276,y:44})
assert.ok(onPoint.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),'no NaN when the pointer sits on a point')
assert.ok(Math.hypot(onPoint[2].x-276,onPoint[2].y-44)<1,'a point under the pointer does not move')
assert.ok(Math.hypot(onPoint[1].x-168,onPoint[1].y-152)>1,'other points bend toward the pointer')

const far=journeyTargets({x:5000,y:5000})
far.forEach((p,i)=>assert.ok(Math.hypot(p.x-REST[i].x,p.y-REST[i].y)<=28+1e-9,'offset capped at 28'))
const near=journeyTargets({x:200,y:120})
near.forEach((p,i)=>assert.ok(Math.hypot(p.x-REST[i].x,p.y-REST[i].y)<=28+1e-9))
assert.ok(journeyTargets({x:200,y:120},14).every((p,i)=>Math.hypot(p.x-REST[i].x,p.y-REST[i].y)<=14+1e-9),'ghost maxOffset')
const d=i=>Math.hypot(near[i].x-REST[i].x,near[i].y-REST[i].y)
assert.ok(d(1)>d(3),'nearer points move more')

let state={points:REST,settled:false},i=0
const target=journeyTargets({x:300,y:100})
for(;i<200&&!state.settled;i++)state=stepToward(state.points,target)
assert.equal(state.settled,true,'stepToward settles within 200 iterations')
state.points.forEach((p,j)=>assert.ok(Math.abs(p.x-target[j].x)<0.1&&Math.abs(p.y-target[j].y)<0.1))
assert.equal(stepToward(REST,REST).settled,true)
assert.equal(stepToward(REST,target).settled,false)

assert.equal(pathD(REST),'M20 152 L168 152 L276 44 L530 44')
assert.equal(pathD(REST,{x:13,y:16}),'M33 168 L181 168 L289 60 L543 60')
assert.deepEqual(nearestOnPath(REST,222),{x:222,y:98})
assert.deepEqual(nearestOnPath(REST,-50),{x:20,y:152},'clamped left')
assert.deepEqual(nearestOnPath(REST,900),{x:530,y:44},'clamped right')
assert.deepEqual(nearestOnPath(REST,168),{x:168,y:152})
console.log('PASS: journey targets, damped step, path data and nearest point')
