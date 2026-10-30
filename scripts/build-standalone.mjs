import {build} from 'esbuild';
import {writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync} from 'node:fs';
mkdirSync('.ui-build',{recursive:true});
execFileSync(process.execPath,['node_modules/@tailwindcss/cli/dist/index.mjs','-i','src/app/globals.css','-o','.ui-build/globals.css','--minify'],{stdio:'inherit'});
const result=await build({entryPoints:['src/standalone.tsx'],bundle:true,write:false,outdir:'bundle',minify:true,format:'iife',platform:'browser',target:['es2020'],define:{'process.env.NODE_ENV':'"production"'},jsx:'automatic',plugins:[{name:'compiled-css',setup(b){b.onLoad({filter:/src\/app\/globals\.css$/},()=>({contents:readFileSync('.ui-build/globals.css','utf8'),loader:'css'}));}}]});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text.replace(/<\/script/gi,'<\\/script');
const css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
const notices=readFileSync("THIRD_PARTY_UI_NOTICES.txt","utf8").replaceAll("--", "—");
const html=`<!doctype html><!-- ${notices} --><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#225a4c"><title>Mercury Wealth · Interactive Client Portal</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
for(const file of ['../Review Mercury Demo.html','../Mercury Wealth Interactive Demo.html']){await writeFile(resolve(file),html);console.log('Built '+resolve(file));}

await copyFile('scripts/phone-preview.html',resolve('../Mercury Phone Demo.html'));
console.log('Built '+resolve('../Mercury Phone Demo.html'));
