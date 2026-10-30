"""Launch one calculation worker with a private key and workspace-local caches."""
import os
import secrets
import socket
import sys
from local_ai_settings import PROJECT,WORKSPACE,read_settings,save_settings

for name in ('OPENBLAS_NUM_THREADS','VECLIB_MAXIMUM_THREADS','OMP_NUM_THREADS'):
    os.environ[name]='1'
os.environ['MPLBACKEND']='Agg'
os.environ['MPLCONFIGDIR']=str(WORKSPACE/'work/finance-cache/matplotlib')
os.environ['FINANCE_TOOLKIT_CACHE_ENABLED']='0'
os.environ['FINANCE_TOOLKIT_CACHE_DB']=str(WORKSPACE/'work/finance-cache/toolkit.sqlite')
os.environ['NUMBA_CACHE_DIR']=str(WORKSPACE/'work/finance-cache/numba')
sys.path.insert(0,str(PROJECT))

def configure():
    values=read_settings()
    key=values.get('FINANCE_API_KEY') or secrets.token_urlsafe(36)
    save_settings({'FINANCE_API_KEY':key,'FINANCE_BASE_URL':'http://127.0.0.1:8890'})
    return key

if __name__=='__main__':
    key=os.environ.get('FINANCE_API_KEY') or configure()
    if '--configure-only' in sys.argv:
        print('Finance API configured privately. Existing AI/database settings preserved.')
    else:
        import uvicorn
        from finance_service.api import create_app
        from finance_service.research import warm_runtime
        for name in ('FRED_API_KEY',):
            value=read_settings().get(name)
            if value:os.environ[name]=value
        print('Warming OpenBB and Riskfolio (one calculation worker)…',flush=True)
        warm_runtime()
        print('Mercury Finance API: http://127.0.0.1:8890 · one worker · TWR + strategy + research tools',flush=True)
        uvicorn.run(create_app(key),host='127.0.0.1',port=8890,workers=1,limit_concurrency=8,timeout_keep_alive=5,access_log=False)
