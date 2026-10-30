"""Start Mercury with a Qwen key for this process only; never save or echo it."""
import getpass
import os
import re
import sys
from pathlib import Path

script = Path(__file__).resolve().parent / 'start-wealth-runtime.py'
print('Choose the region where your Model Studio API key was created:')
print('1. Hong Kong    2. Singapore')
region = input('Region [1/2]: ').strip()
if region not in ('1', '2'):
    print('Please choose 1 or 2. Mercury was not started.')
    raise SystemExit(1)
region_id = 'cn-hongkong' if region == '1' else 'ap-southeast-1'
key = getpass.getpass('Qwen API key (input is hidden): ').strip()
if not key:
    print('No key entered. Mercury was not started.')
    raise SystemExit(1)
os.environ['DASHSCOPE_API_KEY'] = key
print('Enter the workspace ID for the selected region (for example llm-xxxx).')
if region == '2':
    print('For Singapore only, press Enter to use the legacy Singapore endpoint.')
workspace = input('Workspace ID: ').strip()
if workspace:
    if not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?', workspace):
        print('Invalid workspace ID. Mercury was not started.')
        raise SystemExit(1)
    os.environ['QWEN_BASE_URL'] = 'https://' + workspace + '.' + region_id + '.maas.aliyuncs.com/compatible-mode/v1'
elif region == '1':
    print('Hong Kong requires a workspace ID. Mercury was not started.')
    raise SystemExit(1)
else:
    os.environ.pop('QWEN_BASE_URL', None)
os.execv(sys.executable, [sys.executable, str(script)])
