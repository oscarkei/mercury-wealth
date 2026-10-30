import data from './held-fcn-data.json' with {type:'json'};
export async function rev4Positions(fetcher:typeof fetch,signal?:AbortSignal){
 const request=async(table:string,query:Record<string,string>)=>{const r=await fetcher('https://ljrnllkklsumizsxhpwu.supabase.co/rest/v1/'+table+'?'+new URLSearchParams(query),{headers:{apikey:process.env.SUPABASE_SECRET_KEY!,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(10000)])});if(!r.ok)throw Error('Snapshot extension unavailable');const rows=await r.json();if(!Array.isArray(rows))throw Error('Invalid snapshot extension');return rows;};
 const imports=await request('mercury_v1_imports',{select:'id,status,verified_records',id:'eq.'+data.extensionId});if(!imports.length||imports[0].status!=='complete')return [];
 if(imports[0].verified_records!==6)throw Error('Incomplete snapshot extension');
 const rows=await request('mercury_v1_position_valuation',{select:'*',_import_id:'eq.'+data.extensionId});if(rows.length!==2)throw Error('Incomplete snapshot extension');
 for(const expected of data.datasets.derivedPositionValuations){const actual=rows.find((r:any)=>r.id===expected.id);if(!actual||actual._source_json.quantity!==expected.quantity||actual._source_json.marketValueBase.amount!==expected.marketValueBase.amount||actual._source_json.portfolioId!==data.bookId||actual._source_json.instrumentId!==expected.instrumentId)throw Error('Snapshot extension does not reconcile');}
 return rows;
}
