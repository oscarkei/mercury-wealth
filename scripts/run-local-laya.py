"""Serve the pinned local checkpoint on loopback; no runtime downloads."""
import json
import os
from local_ai_settings import WORKSPACE, MODEL_NAME, read_settings

model = WORKSPACE / 'work/laya-model'
if not (model / 'model.safetensors').exists():
    raise SystemExit('Local Laya weights are missing. Complete the local installation first.')
token = read_settings().get('LAYA_API_KEY')
if not token:
    raise SystemExit('Local Laya token is missing. Run Configure Mercury AI.command first.')
os.environ.update({
    'HF_HOME': str(WORKSPACE / 'work/laya-cache'),
    'HF_HUB_OFFLINE': '1',
    'HF_HUB_DISABLE_TELEMETRY': '1',
    'TRANSFORMERS_OFFLINE': '1',
    'LAYA_HOST': '127.0.0.1',
    'LAYA_PORT': '8888',
    'LAYA_DEVICE': 'cpu',
    'LAYA_THREADS': '4',
    'LAYA_PRELOAD': '1',
    'LAYA_MODELS': MODEL_NAME,
    'LAYA_DEFAULT_MODEL': MODEL_NAME,
    'LAYA_MAX_LOADED': '1',
    'LAYA_EXTRA_MODELS': json.dumps({MODEL_NAME: str(model)}),
    'LAYA_API_KEY': token,
})
from laya.serve import main
main()
