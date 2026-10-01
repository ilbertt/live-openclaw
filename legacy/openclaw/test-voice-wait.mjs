import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('./delegation-controller.patched.mjs',import.meta.url),'utf8');
const method=source.slice(source.indexOf('\tasync runDelegation('),source.indexOf('\n\tappendRequesterFinal('));
for(const scenario of ['quick','slow','cancelled','superseded']) {
 let timer, cleared=false, messages=[]; let resolve;
 const pending=new Promise(r=>resolve=r);
 const context={setTimeout:(fn,ms)=>{assert.equal(ms,5000);timer=fn;return 1},clearTimeout:()=>{cleared=true},boundOpenAIQuicksilverDelegationResult:x=>x};
 const run=vm.runInNewContext('({'+method+'}).runDelegation',context);
 const signal={aborted:false};
 const self={options:{handleDelegationInput:true,runAgentConsult:()=>pending},requesterFinalOwner:{generation:1},sendSessionContext:x=>messages.push(x),revokeRequesterFinal:()=>{},stopped:false};
 const done=run.call(self,{prompt:'test'},1,signal);
 assert.equal(messages.length,0);
 if(scenario==='slow') {timer();assert.equal(messages.length,1)}
 if(scenario==='cancelled'){signal.aborted=true;timer();assert.equal(messages.length,0)}
 if(scenario==='superseded'){self.requesterFinalOwner={generation:2};timer();assert.equal(messages.length,0)}
 self.stopped=true;resolve({text:'result'});await done;assert.ok(cleared);
 console.log(scenario+': passed');
}
