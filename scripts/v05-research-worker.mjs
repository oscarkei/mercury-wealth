import {createCloudResearch} from '../services/analysis/cloud/research.mjs';
import {closeFinance} from '../services/analysis/finance-client.mjs';
process.once('message',async message=>{
 const {key,args}=message;delete message.key;
 try{const run=await createCloudResearch({key})({...args,onEvent:event=>process.send?.({type:'event',event})});await new Promise((resolve,reject)=>process.send({type:'result',run},error=>error?reject(error):resolve()));}
 catch{process.send?.({type:'error',error:'Isolated research worker failed.'});}
 finally{closeFinance();process.disconnect();}
});

process.send?.({type:'ready'});
