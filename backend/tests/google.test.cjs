const assert=require('node:assert/strict');let cryptoTools={},calendar={};
try{cryptoTools=require('../google/crypto.cjs');calendar=require('../google/calendar.cjs')}catch{}
assert.equal(typeof cryptoTools.encrypt,'function','Google token encryption must exist');
const key=Buffer.alloc(32,7).toString('base64');const encrypted=cryptoTools.encrypt('private-refresh-token',key);
assert.ok(!encrypted.includes('private-refresh-token'));assert.equal(cryptoTools.decrypt(encrypted,key),'private-refresh-token');assert.throws(()=>cryptoTools.decrypt(encrypted,Buffer.alloc(32,8).toString('base64')));
assert.equal(calendar.stableEventId('u','requirement','r'),calendar.stableEventId('u','requirement','r'));assert.notEqual(calendar.stableEventId('u','requirement','r'),calendar.stableEventId('other','requirement','r'));
const deadline=calendar.eventPayload('requirement',{title:'Reflection',due_date:'2026-10-13'});
assert.deepEqual(deadline.start,{date:'2026-10-13'});assert.deepEqual(deadline.end,{date:'2026-10-14'});
const event=calendar.eventPayload('event',{title:'Meet',starts_at:'2026-10-13T06:00:00Z'});assert.equal(event.end.dateTime,'2026-10-13T07:00:00.000Z');assert.equal(event.start.timeZone,'Asia/Manila');assert.equal(event.attendees,undefined);
console.log('PASS: authenticated encryption, user-isolated stable IDs and exclusive all-day deadlines')
