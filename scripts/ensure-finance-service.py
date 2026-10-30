"""Start the local research worker when needed, retaining existing private settings."""
import os,subprocess,time,urllib.request,json
from local_ai_settings import PROJECT,read_settings

def ensure_finance_service():
    def ready():
        try:
            with urllib.request.urlopen('http://127.0.0.1:8890/health',timeout=2) as response:
                body=json.load(response)
            return body.get('ready') is True and body.get('service')=='mercury-finance'
        except (OSError,ValueError):return False
    if ready():return
    settings=read_settings()
    if not settings.get('FINANCE_API_KEY'):raise RuntimeError('The existing research-service credential is missing.')
    root=(PROJECT/'node_modules').resolve().parent.parent
    python=root/'finance-venv/bin/python'
    if not python.is_file():raise RuntimeError('The market research runtime is missing.')
    environment=dict(os.environ,FINANCE_API_KEY=settings['FINANCE_API_KEY'],PYTHONDONTWRITEBYTECODE='1')
    worker=subprocess.Popen([str(python),str(PROJECT/'scripts/run-finance-api.py')],cwd=PROJECT,env=environment,start_new_session=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    deadline=time.monotonic()+120
    while time.monotonic()<deadline:
        if ready():return
        if worker.poll() is not None:raise RuntimeError('The market research service could not start.')
        time.sleep(.5)
    worker.terminate()
    raise RuntimeError('The market research service did not become ready in time.')
if __name__=='__main__':
    ensure_finance_service()
    print('Mercury market research service is ready.')
