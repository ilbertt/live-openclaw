import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=n=>fs.readFileSync(new URL(n,import.meta.url),'utf8');
const source=read('../responsive-merged/realtime-quicksilver-delegation-controller-1v5hW2XF.mjs');
const method=source.slice(source.indexOf('\tasync runDelegation('),source.indexOf('\n\tconsumeBackendControl('));
for(const scenario of ['pending','cancelled','stopped']) {
 let messages=[]; let resolve; const pending=new Promise(r=>resolve=r);
 const run=vm.runInNewContext('({'+method+'}).runDelegation',{boundOpenAIQuicksilverDelegationResult:x=>x});
 const signal={aborted:scenario==='cancelled'};
 const self={options:{handleDelegationInput:true,runAgentConsult:()=>pending},sendSessionContext:x=>messages.push(x),revokeRequesterFinal:()=>{},stopped:scenario==='stopped'};
 const done=run.call(self,{prompt:'weather'},1,signal);
 assert.equal(messages.length,scenario==='pending'?1:0);
 self.stopped=true;resolve({text:'result'});await done;
 assert.equal(messages.length,scenario==='pending'?1:0);
 console.log(scenario+': immediate acknowledgement, no timer passed');
}
const shared=read('../responsive-merged/agent-run-control-shared-DXVEJ-0Y.mjs');
const start=shared.indexOf('function buildRealtimeVoiceAgentConsultPrompt(');
const end=shared.indexOf('\n/**',start);
const build=vm.runInNewContext('('+shared.slice(start,end)+')',{parseRealtimeVoiceAgentConsultArgs:x=>x});
const base={userLabel:'User',surface:'a browser Talk session',transcript:[{role:'user',text:'OLD TELEGRAM HISTORY'}]};
const live='<realtime_delegation><input>weather</input><transcript_delta>current voice</transcript_delta></realtime_delegation>';
const result=build({...base,args:{question:live}});
assert.ok(result.includes(live));assert.ok(!result.includes('OLD TELEGRAM HISTORY'));
assert.ok(build({...base,args:{question:'legacy'}}).includes('OLD TELEGRAM HISTORY'));
console.log('live context de-duplication and legacy fallback passed');

assert.ok(!build({...base,args:{question:"Voice-session control contract: instructions\n\n"+live}}).includes("OLD TELEGRAM HISTORY"));
console.log("prefixed close-contract context de-duplication passed");
