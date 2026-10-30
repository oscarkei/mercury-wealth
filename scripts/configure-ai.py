"""Private key entry. Credentials never appear in arguments, logs or chat."""
from getpass import getpass
import re
import subprocess
import sys
from local_ai_settings import read_settings, save_settings, laya_settings

WINDOW = '--window' in sys.argv

def dialog(message, entry=False):
    # Only fixed explanatory text is passed to AppleScript. The hidden key is
    # captured in memory, never passed as a command argument or echoed.
    import json
    script = 'tell application "System Events"\nactivate\n'
    script += 'display dialog ' + json.dumps(message) + ' with title "Mercury AI Setup - AQ supported"'
    if entry:
        script += ' default answer "" with hidden answer buttons {"Cancel", "Save"} default button "Save"\ntext returned of result'
    else:
        script += ' buttons {"OK"} default button "OK"'
    script += '\nend tell'
    result = subprocess.run(['/usr/bin/osascript', '-e', script], capture_output=True, text=True)
    if result.returncode:
        raise KeyboardInterrupt
    return result.stdout.rstrip('\n') if entry else None

def normalize_key(value):
    value = value.strip().strip('\u200b\ufeff\u200e\u200f').strip()
    value = re.sub(r'^(?:export\s+)?(?:GEMINI_API_KEY|GOOGLE_API_KEY)\s*=\s*', '', value)
    for left, right in [('"', '"'), ("'", "'"), ('“', '”'), ('‘', '’'), ('`', '`')]:
        if value.startswith(left) and value.endswith(right):
            value = value[len(left):-len(right)].strip()
            break
    return value

def safe_key_input(value):
    # Google keys are opaque credentials. AQ auth keys can contain periods and
    # exceed the legacy length. Only enforce safe single-line header storage;
    # Google, not a local prefix/shape regex, determines credential validity.
    return len(value) <= 8192 and all('!' <= character <= '~' for character in value)

def main():
    print('Mercury AI — local Laya + Gemini (AQ auth keys supported)')
    message = 'Paste your full Google AI Studio API key.\nNew AQ auth keys and older AIza keys are accepted.\nThe value is hidden and saved only on this Mac.'
    while True:
        raw = dialog(message, entry=True) if WINDOW else getpass('Gemini API key (hidden): ')
        key = normalize_key(raw)
        if safe_key_input(key):
            break
        message = 'Nothing saved. The pasted text contains whitespace, non-printable characters, or exceeds 8192 characters. Copy only the full API key, then try again. AQ keys are supported.'
        if not WINDOW:
            print(message)
    if not key and not read_settings().get('GEMINI_API_KEY'):
        message = 'No key entered. Nothing saved. Run setup again when you have copied your API key.'
    else:
        settings = laya_settings()
        if key:
            settings['GEMINI_API_KEY'] = key
        save_settings(settings)
        message = 'Saved privately on this Mac.\nOpen Start Mercury AI.command next.\nSaving does not yet verify the key with Google.'
    print(message)
    if WINDOW:
        dialog(message)
    else:
        input('Press Return to close.')

if __name__ == '__main__':
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print('\nSetup closed. No additional changes saved.')
