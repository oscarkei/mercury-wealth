"""Launch Mercury using a process-only DeepSeek API key."""
import getpass
import os
import sys
from pathlib import Path
key = getpass.getpass('DeepSeek API key (input is hidden): ').strip()
if not key:
    print('No key entered. Mercury was not started.')
    raise SystemExit(1)
os.environ['DEEPSEEK_API_KEY'] = key
script = Path(__file__).resolve().parent / 'start-wealth-runtime.py'
os.execv(sys.executable, [sys.executable, str(script)])
