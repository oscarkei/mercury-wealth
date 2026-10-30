export function MercuryMark({size=24}:{size?:number}){
 return <svg className="mercury-monogram" width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M3 5h7l6 15 6-15h7v22h-6V13l-5.5 14h-3L9 13v14H3z"/></svg>;
}
export function MercuryWordmark(){return <span className="mercury-wordmark"><img className="wordmark-light" src="/brand/mercury-black.png" alt="Mercury" width="1463" height="335"/><img className="wordmark-dark" src="/brand/mercury-white.png" alt="Mercury" width="1463" height="335"/></span>;}
