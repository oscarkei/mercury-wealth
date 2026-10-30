import {createHash} from 'node:crypto';
import {loadPortfolioContext,type PortfolioScope} from './portfolio-context-server.ts';
import {familySnapshotSchema} from './family-contract.ts';
import {conversationStore} from './conversation-store.ts';
import verification from './okonkwo-verification.json' with {type:'json'};
export async function loadWealthClient(scope:PortfolioScope,signal:AbortSignal,refresh=false){
 const key='client:'+createHash('sha256').update(JSON.stringify({scope,importId:verification.importId})).digest('hex');
 const store=conversationStore(),cached=refresh?undefined:store.cached(key);
 if(cached)return familySnapshotSchema.parse(cached);
 const client=await loadPortfolioContext(scope,signal);store.cache(key,client,5*60*1000);return client;
}
