import secrets
from threading import BoundedSemaphore
from fastapi import FastAPI,Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from .twr import ENGINE_VERSION,TwrRequest,calculate_twr
from .strategies import StrategyRequest,compare_strategies
from .research import HistoryRequest,OptimizeRequest,market_history,optimize_allocation,TOOL_CATALOG

MAX_BODY=262144
RESEARCH_GATE=BoundedSemaphore(1)

def create_app(api_key: str):
    if not api_key or len(api_key)<32:
        raise RuntimeError('A private finance API key of at least 32 characters is required.')
    app=FastAPI(title='Mercury Finance API',version='1.0.0',docs_url=None,redoc_url=None,openapi_url=None)
    app.add_middleware(TrustedHostMiddleware,allowed_hosts=['127.0.0.1','localhost'])

    @app.middleware('http')
    async def protect(request:Request,call_next):
        if request.url.path.startswith('/v1/'):
            actual=request.headers.get('authorization','').encode()
            if not secrets.compare_digest(actual,('Bearer '+api_key).encode()):
                return JSONResponse({'error':'Unauthorized.'},status_code=401,headers={'WWW-Authenticate':'Bearer'})
            size=request.headers.get('content-length')
            if size is None or not size.isdigit():
                return JSONResponse({'error':'A valid Content-Length is required.'},status_code=411)
            if int(size)>MAX_BODY:
                return JSONResponse({'error':'Calculation input is too large.'},status_code=413)
        response=await call_next(request)
        response.headers['Cache-Control']='no-store'
        response.headers['X-Content-Type-Options']='nosniff'
        return response

    @app.exception_handler(RequestValidationError)
    async def invalid(_request,error):
        issues=[{'path':'.'.join(map(str,e['loc'])),'message':e['msg'][:200]} for e in error.errors()[:12]]
        return JSONResponse({'error':'Invalid calculation input.','issues':issues},status_code=422)

    @app.get('/health')
    def health():
        return {'ready':True,'service':'mercury-finance','engine':ENGINE_VERSION,'capabilities':['twr','strategy_backtest','market_history','optimize_allocation'],'worker_policy':'single'}

    @app.post('/v1/twr')
    def twr(body:TwrRequest):
        try:return calculate_twr(body)
        except ValueError as error:return JSONResponse({'error':str(error)},status_code=422)

    @app.post('/v1/strategy/backtest')
    def strategy(body:StrategyRequest):
        try:return compare_strategies(body)
        except ValueError as error:return JSONResponse({'error':str(error)},status_code=422)

    @app.post('/v1/market/history')
    def history(body:HistoryRequest):
        if not RESEARCH_GATE.acquire(blocking=False):return JSONResponse({'error':'Another research calculation is running. Retry shortly.'},status_code=429)
        try:return market_history(body)
        finally:RESEARCH_GATE.release()

    @app.post('/v1/portfolio/optimize')
    def optimize(body:OptimizeRequest):
        if not RESEARCH_GATE.acquire(blocking=False):return JSONResponse({'error':'Another research calculation is running. Retry shortly.'},status_code=429)
        try:
            try:return optimize_allocation(body)
            except ValueError as error:return JSONResponse({'error':str(error)},status_code=422)
        finally:RESEARCH_GATE.release()

    @app.post('/v1/tools/catalog')
    def catalog():
        return {'version':'mercury-tools-1.0.0','tools':TOOL_CATALOG}

    return app
