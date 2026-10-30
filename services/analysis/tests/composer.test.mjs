import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function setup(){
 const nodes={'#question':{value:'intel 現在表現如何？'},'#composer':{},'#stop':{}};
 const ctx={busy:false,sends:0,stops:0,$:id=>nodes[id],send:()=>ctx.sends++,abort:{abort:()=>ctx.stops++}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('let composing=false;'),source.indexOf("document.querySelectorAll('[data-tab]').forEach(b=>b.onclick")),ctx);
 return {ctx,nodes,key:(extra={})=>nodes['#question'].onkeydown({key:'Enter',preventDefault(){},...extra})};
}
test('second Enter or form submit during research never cancels',()=>{const {ctx,nodes,key}=setup();key();assert.equal(ctx.sends,1);ctx.busy=true;key();nodes['#composer'].onsubmit({preventDefault(){}});assert.equal(ctx.sends,1);assert.equal(ctx.stops,0);nodes['#stop'].onclick();assert.equal(ctx.stops,1);});
test('IME confirmation, held Enter and Shift Enter do not submit',()=>{const {ctx,nodes,key}=setup();nodes['#question'].oncompositionstart();key();nodes['#composer'].onsubmit({preventDefault(){}});nodes['#question'].oncompositionend();key({isComposing:true});key({keyCode:229});key({repeat:true});key({shiftKey:true});assert.equal(ctx.sends,0);key();assert.equal(ctx.sends,1);});
test('send itself ignores busy submissions without aborting the request',async()=>{const ctx={busy:true,abort:{abort(){throw Error('Unexpected cancellation');}}};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function send('),source.indexOf('let composing=false;')),ctx);await vm.runInContext("send('Intel')",ctx);});
