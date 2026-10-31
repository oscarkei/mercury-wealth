"""Offline diagnostics only: fresh process per case, never changes live workers."""
import os, sys, json, time, resource, subprocess, contextlib, io
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
case=sys.argv[1]
started=time.perf_counter()
records=[]
for k in ('OPENBLAS_NUM_THREADS','VECLIB_MAXIMUM_THREADS','OMP_NUM_THREADS'): os.environ[k]='1'
os.environ.update(MPLBACKEND='Agg',HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',TOKENIZERS_PARALLELISM='false')
cache=Path(os.environ.get('MERCURY_FINANCE_CACHE_DIR','/tmp/mercury-component-probe'))
os.environ.update(MPLCONFIGDIR=str(cache/'matplotlib'),NUMBA_CACHE_DIR=str(cache/'numba'),FINANCE_TOOLKIT_CACHE_ENABLED='0',FINANCE_TOOLKIT_CACHE_DB=str(cache/'toolkit.sqlite'))
sys.path.insert(0,str(ROOT))
def snap(label):
    row={'label':label,'elapsed_ms':round((time.perf_counter()-started)*1000)}
    peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    row['peak_rss_mib']=round(peak/(1024**2 if sys.platform=='darwin' else 1024),2)
    if sys.platform=='linux':
        for path in ('/proc/self/smaps_rollup','/proc/self/status'):
            try:
                for line in Path(path).read_text().splitlines():
                    if ':' not in line: continue
                    key,value=line.split(':',1)
                    if key in ('Rss','Pss','Anonymous','Private_Dirty','Private_Clean','VmRSS','VmHWM'):
                        row[key+'_mib']=round(int(value.strip().split()[0])/1024,2)
            except OSError: pass
        try:
            row['cgroup_current_mib']=round(int(Path('/sys/fs/cgroup/memory.current').read_text())/1024**2,2)
            stats=dict(line.split() for line in Path('/sys/fs/cgroup/memory.stat').read_text().splitlines())
            row['cgroup_breakdown_mib']={k:round(int(stats[k])/1024**2,2) for k in ('anon','file','kernel','shmem') if k in stats}
        except OSError: pass
    else:
        row['rss_mib']=round(int(subprocess.check_output(['ps','-o','rss=','-p',str(os.getpid())]))/1024,2)
    records.append(row)

snap('python_baseline')
report={'case':case,'platform':sys.platform,'snapshots':records,'provider_calls':0}
try:
    with contextlib.redirect_stdout(sys.stderr):
        if case=='laya':
            import torch
            snap('torch_imported')
            import laya
            snap('laya_imported')
            torch.set_num_threads(4)
            agent=laya.load(os.environ['MERCURY_LAYA_MODEL_PATH'],device='cpu',compile=False)
            snap('model_loaded_before_inference')
            # Use exactly the production worker schema, without starting its input loop.
            import ast
            tree=ast.parse((ROOT/'services/analysis/laya-worker.py').read_text())
            schema=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='schema' for t in n.targets))
            agent.decide('已有價格歷史，使用者想了解市場走勢。',schema=schema,max_len=2048,head_max_len=256)
            snap('after_production_warmup')
            agent.decide('The user asks for a price trend. Verified historical observations are available. Select supported UI.',schema=schema,return_details=True,max_len=4096,head_max_len=256)
            snap('after_ui_decision')
        elif case=='finance':
            import runpy
            old=sys.stdin;sys.stdin=io.StringIO('')
            try: worker=runpy.run_path(str(ROOT/'services/analysis/finance-worker.py'))
            finally: sys.stdin=old
            snap('worker_ready')
            worker['execute']('health',{})
            snap('after_package_version_check')
            import numpy,pandas
            snap('numpy_pandas_imported')
            import quantstats
            snap('quantstats_imported')
            from financetoolkit.performance import performance_model
            from financetoolkit.risk import risk_model
            snap('financetoolkit_imported')
            from datetime import date,timedelta
            import math
            points=[{'date':str(date(2025,1,1)+timedelta(days=i)),'close':100+0.1*i+math.sin(i)*0.3} for i in range(60)]
            result=worker['execute']('metrics',{'history':{'histories':[{'symbol':'OFFLINE_TEST','status':'observed','stale':False,'first_date':points[0]['date'],'last_date':points[-1]['date'],'points':points}]}})
            snap('after_60_price_metrics')
            report['calculation']={'library':result['library'],'rows':len(result['rows'])}
        else:
            import importlib
            targets={'riskfolio':'riskfolio','bt':'bt','quantstats':'quantstats','financetoolkit':'financetoolkit','openbb':'openbb'}
            module=importlib.import_module(targets[case])
            if case=='openbb': getattr(module,'obb')
            if case=='financetoolkit':
                importlib.import_module('financetoolkit.performance.performance_model')
                importlib.import_module('financetoolkit.risk.risk_model')
            snap('library_imported_fresh_process')
    report['status']='passed'
except Exception as e:
    report.update(status='failed',error=type(e).__name__+': '+str(e)[:300])
print(json.dumps(report),flush=True)
