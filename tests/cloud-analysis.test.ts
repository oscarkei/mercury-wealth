import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudConfig,cloudSession,cloudOwner,cloudOrigin,cloudRequest,type CloudConfig} from '../src/lib/cloud-analysis.ts';
const config:CloudConfig={base:'https://analysis.example.test',origin:'https://mercury-wealth-mu.vercel.app',token:'synthetic-service-token-000000000000000',secret:'synthetic-session-secret-0000000000000'};
const request=(cookie='')=>new Request(config.origin+'/api/session',{method:'POST',headers:{host:'mercury-wealth-mu.vercel.app',origin:config.origin,'x-mercury-client':'portal',cookie}});
test('cloud configuration requires explicit HTTPS service and separate server secrets',()=>{
 assert.equal(cloudConfig({}),null);
 const env={MERCURY_ANALYSIS_URL:config.base,MERCURY_SERVICE_TOKEN:config.token,MERCURY_SESSION_SECRET:config.secret};assert.ok(cloudConfig(env));
 assert.equal(cloudConfig({...env,MERCURY_ANALYSIS_URL:'http://localhost:3009'}),null);
 assert.equal(cloudConfig({...env,MERCURY_SESSION_SECRET:'short'}),null);
});
test('cloud session is signed, secure and rejects modified cookies and foreign origins',async()=>{
 const response=cloudSession(request(),config),cookie=response.headers.get('set-cookie')!;assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
 const token=cookie.split(';')[0];assert.ok(cloudOwner(request(token),config));assert.equal(cloudOwner(request(token+'x'),config),null);
 assert.equal(cloudOwner(request('mw_cloud=not-a-session'),config),null);
 assert.equal(cloudOrigin(new Request(config.origin,{headers:{origin:'https://other.example',host:'mercury-wealth-mu.vercel.app','x-mercury-client':'portal'}}),config),false);
 assert.ok(!(await response.text()).includes(config.token));
});
test('cloud proxy sends credentials only to configured service, never to the browser',async()=>{
 const response=await cloudRequest(config,'/v1/history','owner',{},async(url,init)=>{assert.equal(url,config.base+'/v1/history');assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer '+config.token);assert.equal(init?.redirect,'error');return Response.json({turns:[]});});
 assert.deepEqual(await response.json(),{turns:[]});assert.equal(response.headers.get('authorization'),null);
});
