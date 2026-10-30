import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisStage,StageFailure,type StageProgress} from '../src/lib/analysis-stage.ts';
import {publicProviderError} from '../src/lib/assistant-server.ts';

test('a stuck tool is bounded, attributed and cannot emit late completion',async()=>{
 const events:StageProgress[]=[],signal=new AbortController().signal;
 let release:(value:string)=>void=()=>{};
 let operationSignal:AbortSignal|undefined;
 const pending=analysisStage({stage:'research_data',service:'Finance tools',timeout_ms:15},signal,e=>events.push(e),s=>{
  operationSignal=s;return new Promise<string>(resolve=>{release=resolve;});
 });
 await assert.rejects(pending,error=>{
  assert.ok(error instanceof StageFailure);
  const result=publicProviderError(error,signal);
  assert.equal(result.code,'TIMEOUT');assert.equal(result.service,'Finance tools');
  assert.doesNotMatch(result.message,/Gemini/);return true;
 });
 assert.equal(operationSignal?.aborted,true);
 release('late result');await Promise.resolve();
 assert.deepEqual(events.map(e=>e.status),['started','failed']);
});
test('already cancelled calls never start the tool or claim a Gemini failure',async()=>{
 const controller=new AbortController();controller.abort();let called=false;
 await assert.rejects(()=>analysisStage({stage:'composition',service:'Laya',timeout_ms:20},controller.signal,()=>{},async()=>{called=true;return 'value';}));
 assert.equal(called,false);
 assert.doesNotMatch(publicProviderError(new DOMException('timeout','TimeoutError'),new AbortController().signal).message,/Gemini|25/);
});
test('SDK timeouts carry Laya attribution rather than a generic invalid-answer failure',()=>{
 const error=new Error('private SDK details');error.name='APITimeoutError';
 const result=publicProviderError(new StageFailure({stage:'composition',service:'Laya',timeout_ms:10000,elapsed_ms:10003},error),new AbortController().signal);
 assert.equal(result.code,'TIMEOUT');assert.equal(result.service,'Laya');assert.doesNotMatch(result.message,/Gemini|private/);
});
