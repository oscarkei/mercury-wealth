'use client';
export async function clientAPI(input:unknown){
 const headers={'x-mercury-client':'portal'};await fetch('/api/session',{method:'POST',headers});
 const form=input instanceof FormData;
 const response=await fetch('/api/client',{method:'POST',headers:form?headers:{...headers,'Content-Type':'application/json'},body:form?input:JSON.stringify(input)});
 const body=await response.json();if(!response.ok)throw Error(body.error||'REQUEST_FAILED');return body;
}
