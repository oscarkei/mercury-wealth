import {readFile,writeFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('../wealth-skills/manifest.json',import.meta.url),'utf8'));
const root=new URL('../wealth-skills/',import.meta.url);
const skills=Object.fromEntries(await Promise.all(manifest.skills.map(async s=>[s.id,await readFile(new URL(s.path,root),'utf8')])));
const policy=await readFile(new URL('shared/analyst-policy.md',root),'utf8');
const target=new URL('../src/lib/wealth-skill-content.ts',import.meta.url);
const generated='// Generated from wealth-skills; no client credentials or portfolio data.\nexport const sharedPolicy='+JSON.stringify(policy)+';\nexport const skillCatalog='+JSON.stringify(manifest.skills.map(({id,description})=>({id,description})))+';\nexport const skillContent='+JSON.stringify(skills)+';\n';
const previous=await readFile(target,'utf8').catch(()=>null);
if(previous!==generated)await writeFile(target,generated);
