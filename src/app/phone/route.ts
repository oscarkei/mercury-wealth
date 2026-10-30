import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
export const runtime='nodejs';
export async function GET(){const html=(await readFile(join(process.cwd(),'scripts/phone-preview.html'),'utf8')).replaceAll('Mercury Wealth Interactive Demo.html','/mobile');return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});}
