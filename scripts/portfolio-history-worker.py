import sys,json,contextlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
with contextlib.redirect_stdout(sys.stderr):
 from finance_service.research import market_history,HistoryRequest
 request=json.load(sys.stdin)
 result=market_history(HistoryRequest(**request))
print(json.dumps(result,allow_nan=False))
