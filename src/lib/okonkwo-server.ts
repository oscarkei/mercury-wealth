// UI and Chat share the same database-backed read model.
import {loadPortfolioContext} from './portfolio-context-server.ts';
export async function loadOkonkwo(fetcher:typeof fetch=fetch){return loadPortfolioContext({household:'hh_okonkwo',bank:'all',book:'all'},undefined,fetcher);}
