import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createConversationCloser } from './src/web/conversation-close.js';
let time=0, closes=0;
const closer=createConversationCloser({now:()=>time,close:()=>closes++});
closer.request('one');closer.sample(0);time=2000;closer.sample(.2);assert.equal(closes,0);
time=2200;closer.sample(0);time=3300;closer.sample(0);assert.equal(closes,1);
assert.equal(closer.request('one'),false);
closer.request('two');closer.sample(0);closer.cancel();time+=4000;closer.sample(0);assert.equal(closes,1);
closer.request('three');closer.sample(NaN);time+=16000;closer.sample(NaN);assert.equal(closer.pending,false);assert.equal(closes,1);
closer.request('four');closer.sample(0);time+=1500;closer.output();time+=500;closer.sample(0);assert.equal(closes,1);
time+=1500;closer.sample(0);assert.equal(closes,2);
closer.reset();assert.equal(closer.request('one'),true);closer.reset();
const root='/usr/lib/node_modules/openclaw/dist/';
const dir=await mkdtemp(join(tmpdir(),'friday-close-test-'));
try {
 const source=await readFile('patches/responsive-merged/realtime-quicksilver-delegation-controller-1v5hW2XF.mjs','utf8');
 await writeFile(join(dir,'controller.mjs'),source.replaceAll('"./','"'+pathToFileURL(root).href));
 const {t:Controller}=await import(pathToFileURL(join(dir,'controller.mjs')));
 const controls=[],messages=[];let normal=0,consults=0;
 const socket={readyState:1,send:text=>messages.push(JSON.parse(text))};
 const ctrl=new Controller({signal:new AbortController().signal,runAgentConsult:()=>{consults++;},getSocket:()=>socket,
  onConversationControl:c=>controls.push(c),handleDelegationInput:()=>{normal++;return 'control'},logger:{warn:()=>{}},onFatalError:e=>{throw e;}},String);
 const delegate=(id,text)=>ctrl.handleFrame(JSON.stringify({type:'delegation.created',item:{type:'delegation',target:'client',id,content:[{type:'input_text',text}]}}),false);
 delegate('a','{"tool":"end_conversation"}');delegate('a','{"tool":"end_conversation"}');
 assert.equal(controls.length,1);assert.equal(consults,0);assert.equal(messages.length,1);
 for(const [i,text] of ['ciao','bye','close the conversation','{"tool":"end_conversation","extra":1}','["end_conversation"]','{"tool":"other"}','```json\n{"tool":"end_conversation"}\n```'].entries())delegate('bad'+i,text);
 assert.equal(controls.length,1);assert.equal(normal,7);
 ctrl.handleFrame(JSON.stringify({type:'turn.done',turn:{role:'user',transcript:'{"tool":"end_conversation"}'}}),false);
 assert.equal(controls.length,1);
 ctrl.stop(new Error('test done'));delegate('stopped','{"tool":"end_conversation"}');assert.equal(controls.length,1);
 for (const streaming of [false,true]) {
  const out=[],wire=[];
  const runner=async ({prompt,requesterFinal})=>{
   assert.ok(prompt.includes('Voice-session control contract:'));
   const text='{"tool":"end_conversation"}';
   if(streaming) requesterFinal.append(text);
   return {text};
  };
  const sock={readyState:1,send:t=>wire.push(JSON.parse(t))};
  const fallback=new Controller({signal:new AbortController().signal,runAgentConsult:runner,getSocket:()=>sock,
   onConversationControl:c=>out.push(c),logger:{warn:()=>{}},onFatalError:e=>{throw e;}},String);
  fallback.startDelegation('fallback-'+streaming,'Termina la conversazione');
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(out.length,1);
  assert.equal(wire.some(m=>m.channel==='speakable' && JSON.stringify(m).includes('end_conversation')),false);
  fallback.stop(new Error('done'));
  assert.equal(fallback.appendRequesterFinal(1,'{"tool":"end_conversation"}'),false);
 }
 console.log('PASS: backend close fallback via final callback and returned result; deduplicated; never spoken; stopped callback rejected.');
 console.log('PASS: structured provider control, deduplication, no transcript matching, no agent consult, playback drain, interruption, timeout, teardown.');
} finally {await rm(dir,{recursive:true,force:true});}
