// The existing fictional snapshot, explicitly scoped to its own immutable IDs.
import {holdings,SNAPSHOT,DEMO_DATE} from './domain.ts';
export const DEMO_FIRM='mw_demo_firm_v1';
const prefix='mw_demo_';
const banks=['Bank A','Bank B','Bank C'];
const bankId=(bank:string)=>prefix+'bank_'+banks.indexOf(bank);
const accountId=(bank:string)=>prefix+'account_'+banks.indexOf(bank);
const portfolioId=(bank:string)=>prefix+'portfolio_'+banks.indexOf(bank);
const ownerId=(owner:string)=>prefix+(owner==='Alex Chan'?'alex':'family_entity');
export type SeedRow=Record<string,string|number|null>;
export const demoSeedPlan:{table:string;rows:SeedRow[]}[]=[
 {table:'mercury_firm',rows:[{id:DEMO_FIRM,name:'Mercury fictional demo',base_currency:'USD',data_mode:'mock'}]},
 {table:'mercury_household',rows:[{id:prefix+'household',firm_id:DEMO_FIRM,name:'Chan family (fictional)'}]},
 {table:'mercury_client',rows:['Alex Chan','Family Holdings'].map(name=>({id:ownerId(name),firm_id:DEMO_FIRM,household_id:prefix+'household',name,client_type:name==='Alex Chan'?'individual':'legal_entity'}))},
 {table:'mercury_custodian',rows:banks.map(name=>({id:bankId(name),name}))},
 {table:'mercury_account',rows:banks.map(bank=>({id:accountId(bank),firm_id:DEMO_FIRM,household_id:prefix+'household',custodian_id:bankId(bank),name:bank+' demo account',base_currency:bank==='Bank B'?'HKD':'USD'}))},
 {table:'mercury_account_owner',rows:banks.map((bank,i)=>({id:prefix+'owner_'+i,firm_id:DEMO_FIRM,account_id:accountId(bank),client_id:ownerId(bank==='Bank A'?'Alex Chan':'Family Holdings'),ownership_pct:100}))},
 {table:'mercury_portfolio',rows:banks.map(bank=>({id:portfolioId(bank),firm_id:DEMO_FIRM,account_id:accountId(bank),name:bank+' demo portfolio',base_currency:'USD'}))},
 {table:'mercury_instrument',rows:holdings.map(h=>({id:prefix+'instrument_'+h.id,name:h.name,instrument_type:['H1','H3'].includes(h.id)?'fund':['H2','H4','H8'].includes(h.id)?'aggregate':h.category==='note'?'structured_product':'cash',currency:h.currency,data_mode:'mock'}))},
 {table:'mercury_position',rows:holdings.map(h=>({id:prefix+'position_'+h.id,firm_id:DEMO_FIRM,portfolio_id:portfolioId(h.bank),instrument_id:prefix+'instrument_'+h.id,quantity:null,market_value:null,market_value_currency:null,market_value_base:h.value,base_currency:'USD',valued_at:DEMO_DATE,source_snapshot:SNAPSHOT,data_mode:'mock'}))}
];
export const demoHoldingIds=holdings.map(h=>({uiId:h.id,positionId:prefix+'position_'+h.id,category:h.category}));
