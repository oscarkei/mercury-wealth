import {connectionStatus} from '../../../lib/assistant-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(connectionStatus(),{headers:{'Cache-Control':'no-store'}});}
