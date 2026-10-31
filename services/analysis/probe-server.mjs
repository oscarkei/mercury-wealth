// Stage-one deployment probe only. No keys, external providers, portfolio or conversation data.
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
let result={status:'loading',provider_calls:0};
const child=spawn(process.execPath,['scripts/probe-analysis-resources.mjs'],{cwd:fileURLToPath(new URL('../..',import.meta.url)),stdio:['ignore','pipe','inherit']});
let output='';
child.stdout.on('data',chunk=>{output+=chunk;if(output.length>1000000)child.kill();});
child.on('error',()=>{result={status:'failed',error:'Probe process failed to start.',provider_calls:0};});
child.on('exit',code=>{try{result=JSON.parse(output.trim().split('\n').at(-1));}catch{result={status:'failed',error:'No valid worker report.',provider_calls:0};}console.log(JSON.stringify({stage:'resource-probe',status:result.status,exit_code:code}));});
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');if(req.method!=='GET'||!['/','/healthz'].includes(req.url)){res.writeHead(404);res.end('{}');return;}res.end(JSON.stringify(req.url==='/healthz'?{status:result.status,probe_only:true}:result));});
server.listen(Number(process.env.PORT||8080),'0.0.0.0');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{child.kill();server.close(()=>process.exit(0));});
