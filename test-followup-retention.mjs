import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const path=process.argv[2] || new URL('./patches/responsive-merged/realtime-quicksilver-delegation-controller-1v5hW2XF.mjs', import.meta.url);
const source=fs.readFileSync(path,'utf8').replace(/^import .*;\n/gm,'').replace(/^export .*;$/gm,'');
const Controller=vm.runInNewContext(source+'\nOpenAIQuicksilverDelegationController',{
 buildOpenAIQuicksilverDelegationPrompt:({input})=>input,AbortController,Set,
 readErrorName:e=>e.name,extractErrorCode:()=>'',toErrorObject:x=>x
});
let release;const barrier=new Promise(r=>release=r);const delivered=[];
const runner=()=>{};runner.steer=async ({prompt})=>{delivered.push(prompt);if(delivered.length===1)await barrier;};
const c=new Controller({signal:new AbortController().signal,runAgentConsult:runner},String);
c.consultController=new AbortController();c.requesterFinalOwner={generation:1};
c.startDelegation('a','FIRST_QUESTION');await Promise.resolve();
c.startDelegation('b','SECOND_QUESTION');c.startDelegation('c','THIRD_QUESTION');
release();await c.steeringPromise;
assert.equal(delivered.length,2);
assert.ok(delivered[1].includes('SECOND_QUESTION'),'second question was overwritten');
assert.ok(delivered[1].includes('THIRD_QUESTION'));
assert.ok(delivered[1].indexOf('SECOND_QUESTION')<delivered[1].indexOf('THIRD_QUESTION'));
assert.equal(c.activeDelegationId,'c');
assert.equal(c.pendingDelegation,undefined);
c.stop(new Error('test complete'));
assert.equal(c.stopped,true);
console.log('PASS: overlapping follow-ups retained in order; latest result owner and cleanup preserved');
