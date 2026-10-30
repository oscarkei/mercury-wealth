import os,time,json,sys,pathlib
root=pathlib.Path(__file__).resolve().parent
os.environ.update({'HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1','HF_HUB_DISABLE_TELEMETRY':'1','TOKENIZERS_PARALLELISM':'false','HF_HOME':str(root/'laya-cache')})
start=time.perf_counter()
import torch,laya
import importlib.metadata
torch.set_num_threads(4)
agent=laya.load(str(pathlib.Path(os.environ['MERCURY_LAYA_MODEL_PATH'])),device='cpu',compile=False)
schema={'type':'object','properties':{
 'charts':{'type':'boolean','description':'是否適合用已有的真實歷史數據顯示走勢圖？尊重用戶不畫圖的明確要求。'},
 'comparison':{'type':'boolean','description':'是否適合將研究已有的比較資料以表格卡呈現？'},
 'transmission':{'type':'boolean','description':'是否適合將研究已有的傳導步驟以標示為推論的資訊圖呈現？'}
}}
# Warm one real inference so loading and first-call overhead are recorded separately.
agent.decide('已有價格歷史，使用者想了解市場走勢。',schema=schema,max_len=2048,head_max_len=256)
print(json.dumps({'type':'ready','startup_ms':(time.perf_counter()-start)*1000,'model':'convaiinnovations/laya-multilingual','version':importlib.metadata.version('laya'),'device':'cpu','threads':4}),flush=True)
for line in sys.stdin:
 try:
  req=json.loads(line);t=time.perf_counter();result=agent.decide(req['state'],schema=schema,return_details=True,max_len=4096,head_max_len=256)
  print(json.dumps({'id':req['id'],'values':result.values,'probabilities':result.probabilities,'answer_confidence':result.answer_confidence,'usage':result.usage,'elapsed_ms':(time.perf_counter()-t)*1000}),flush=True)
 except Exception as e:
  print(json.dumps({'id':req.get('id'),'error':type(e).__name__+': '+str(e)[:300]}),flush=True)
