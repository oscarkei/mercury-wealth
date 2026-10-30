"""Read local settings; preserve unrelated lines and credentials verbatim."""
from pathlib import Path
import json
import os
import re
import secrets
import tempfile

PROJECT = Path(__file__).resolve().parent.parent
WORKSPACE = PROJECT.parent.parent
ENV_FILE = PROJECT / '.env.local'
MODEL_NAME = 'multilingual'

def read_settings():
    values = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            match = re.match(r'^([A-Z][A-Z0-9_]*)=(.*)$', line)
            if match:
                key, value = match.groups()
                if value.startswith('"'):
                    value = json.loads(value.replace('\\$', '$'))
                elif value.startswith("'") and value.endswith("'"):
                    value = value[1:-1]
                values[key] = value
    return values

def laya_settings():
    current = read_settings()
    return {
        'ENABLE_LIVE_AI': 'true',
        'AI_ROUTER': 'laya',
        'LAYA_BASE_URL': 'http://127.0.0.1:8888',
        'LAYA_MODEL': MODEL_NAME,
        'LAYA_API_KEY': current.get('LAYA_API_KEY') or secrets.token_urlsafe(32),
        'GEMINI_MODEL': current.get('GEMINI_MODEL') or 'gemini-3.6-flash',
    }

def save_settings(updates):
    if any(not re.fullmatch(r'[A-Z][A-Z0-9_]*', k) or '\n' in v or '\r' in v for k, v in updates.items()):
        raise ValueError('Invalid setting')
    lines = ENV_FILE.read_text().splitlines() if ENV_FILE.exists() else []
    remaining = dict(updates)
    output = []
    for line in lines:
        key = line.split('=', 1)[0]
        if key in updates:
            if key in remaining:
                output.append(key + '=' + json.dumps(remaining.pop(key)).replace('$', '\\$'))
        else:
            output.append(line)
    output += [k + '=' + json.dumps(v).replace('$', '\\$') for k, v in remaining.items()]
    fd, temporary = tempfile.mkstemp(prefix='.env-setup-', dir=PROJECT)
    try:
        with os.fdopen(fd, 'w') as handle:
            handle.write('\n'.join(output) + '\n')
        os.chmod(temporary, 0o600)
        os.replace(temporary, ENV_FILE)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
