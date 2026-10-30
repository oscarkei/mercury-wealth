"""Hidden local Supabase credential entry and read-only connectivity verification."""
import json
import os
import re
import subprocess
import sys
from getpass import getpass
from pathlib import Path
from local_ai_settings import read_settings, save_settings, WORKSPACE, PROJECT

PROJECT_REF = 'ljrnllkklsumizsxhpwu'
PROJECT_URL = 'https://' + PROJECT_REF + '.supabase.co'
WINDOW = '--window' in sys.argv

def dialog(message, entry=False):
    script = 'tell application "System Events"\nactivate\ndisplay dialog ' + json.dumps(message)
    script += ' with title "Mercury Database Setup"'
    script += ' default answer "" with hidden answer buttons {"Cancel", "Save"} default button "Save"\ntext returned of result' if entry else ' buttons {"OK"} default button "OK"'
    result = subprocess.run(['/usr/bin/osascript', '-e', script + '\nend tell'], capture_output=True, text=True)
    if result.returncode:
        raise KeyboardInterrupt
    return result.stdout.rstrip('\n') if entry else None

def normalize_key(raw):
    value = raw.strip()
    value = re.sub(r'^(?:export\s+)?SUPABASE_SECRET_KEY\s*=\s*', '', value)
    if len(value)>1 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1].strip()
    return value

def valid_key(key):
    return bool(re.fullmatch(r'sb_secret_[A-Za-z0-9_-]{1,2048}', key))

def verify(settings):
    node = WORKSPACE / 'work/runtime/node-v24.22.1-darwin-arm64/bin/node'
    env = dict(os.environ)
    env.update({k: settings.get(k, '') for k in ['SUPABASE_URL', 'SUPABASE_SECRET_KEY']})
    try:
        result = subprocess.run([str(node), str(PROJECT / 'scripts/verify-supabase.mjs')], env=env, capture_output=True, text=True, timeout=30)
        return json.loads(result.stdout)
    except (OSError, subprocess.TimeoutExpired, ValueError):
        return {'status':'verification_failed','message':'Verification did not finish. Your saved configuration was not removed. Run setup again.'}

def main():
    current = read_settings()
    if '--check' not in sys.argv:
        prompt = 'Project: ' + PROJECT_REF + '\n\nPaste the secret key from Supabase Settings > API Keys (sb_secret_...).\n\nThis is NOT your database password or publishable key. Input is hidden. Leave blank to verify a previously saved key.'
        while True:
            raw = dialog(prompt, True) if WINDOW else getpass(prompt + '\nSecret key (hidden): ')
            key = normalize_key(raw)
            if not key and current.get('SUPABASE_SECRET_KEY'):
                key = current['SUPABASE_SECRET_KEY']
            if valid_key(key):
                break
            prompt = 'Nothing saved. Copy the full sb_secret_... key from this project\'s API Keys page. Do not paste a database password or sb_publishable_... key.'
            if not WINDOW:
                print(prompt)
        save_settings({'SUPABASE_URL': PROJECT_URL, 'SUPABASE_SECRET_KEY': key})
        current = read_settings()
    result = verify(current)
    # A status-only file; no credentials, payloads, client data or raw provider errors.
    report = WORKSPACE / 'outputs/Mercury Supabase Connection Status.json'
    report.write_text(json.dumps(result, indent=2) + '\n')
    message = result['message']
    print(message)
    if WINDOW:
        dialog(message)
    elif '--check' not in sys.argv:
        input('Press Return to close.')

if __name__ == '__main__':
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print('Setup closed. Existing saved settings are preserved.')
