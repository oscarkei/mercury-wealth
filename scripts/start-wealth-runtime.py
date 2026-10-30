"""Launch the updated local demo; reuse existing finance service, own only children started here."""
from pathlib import Path
import errno
import json
import os
import shutil
import signal
import socket
import subprocess
import time
import urllib.request
from local_ai_settings import PROJECT, WORKSPACE, read_settings

APP_VERSION = '0.4.0-rev4'
DIST_DIR = '.next-wealth-rev4-theme-blur'
RUNTIME_WORK = (PROJECT / 'node_modules').resolve().parent.parent
children = []
port = int(os.environ.get('MERCURY_WEALTH_PORT', '3001'))

def health(url):
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return json.load(response)
    except (OSError, ValueError):
        return {}

def ready(process, url, predicate):
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError('A service stopped during startup.')
        if predicate(health(url)):
            return
        time.sleep(.5)
    raise RuntimeError('Service startup timed out.')

def stop(_signal, _frame):
    raise KeyboardInterrupt

signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)
try:
    current = health('http://127.0.0.1:%d/api/health' % port)
    if current.get('wealth', {}).get('application') == APP_VERSION:
        print('Mercury Wealth v%s is already running on port %d.' % (APP_VERSION, port), flush=True)
        subprocess.run(['/usr/bin/open', 'http://127.0.0.1:%d/phone#chat' % port], check=False)
        raise SystemExit(0)
    if current.get('server'):
        raise RuntimeError('An older Mercury instance is using this port. Press Ctrl+C in its Terminal window, then run this launcher again.')
    with socket.socket() as check:
        # Match Node's address reuse: a stopped server may leave TIME_WAIT
        # connections even when no process is listening on this port.
        check.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            check.bind(('127.0.0.1', port))
        except OSError as error:
            if error.errno == errno.EADDRINUSE:
                raise RuntimeError('Port %d is in use by another running service. Stop that service or set MERCURY_WEALTH_PORT to a free port.' % port) from None
            raise
    settings = read_settings()
    if not (settings.get('DEEPSEEK_API_KEY') or os.environ.get('DEEPSEEK_API_KEY')):
        raise RuntimeError('Set a local DeepSeek API key before starting.')
    finance = health('http://127.0.0.1:8890/health')
    if finance.get('service') != 'mercury-finance' or not finance.get('ready'):
        python = RUNTIME_WORK / 'finance-venv/bin/python'
        if not python.exists():
            raise RuntimeError('The finance runtime is missing.')
        environment = dict(os.environ, FINANCE_API_KEY=settings.get('FINANCE_API_KEY', ''), PYTHONDONTWRITEBYTECODE='1')
        process = subprocess.Popen([str(python), str(PROJECT/'scripts/run-finance-api.py')], cwd=PROJECT, env=environment, start_new_session=True)
        children.append(process)
        ready(process, 'http://127.0.0.1:8890/health', lambda data: data.get('service') == 'mercury-finance' and data.get('ready'))
    bundled = RUNTIME_WORK / 'runtime/node-v24.22.1-darwin-arm64/bin/node'
    node = str(bundled) if bundled.exists() else shutil.which('node')
    if not node:
        raise RuntimeError('Node 24 or newer is required.')
    environment = dict(os.environ, PATH=str(Path(node).parent)+os.pathsep+os.environ.get('PATH', ''), NEXT_TELEMETRY_DISABLED='1', MERCURY_NEXT_DIST=DIST_DIR)
    subprocess.run([node, 'scripts/sync-wealth-skills.mjs'], cwd=PROJECT, env=environment, check=True)
    build_id = PROJECT/DIST_DIR/'BUILD_ID'
    source_files = [p for folder in ('src', 'wealth-skills') for p in (PROJECT/folder).rglob('*') if p.is_file()]
    if not build_id.exists() or any(p.stat().st_mtime > build_id.stat().st_mtime for p in source_files):
        subprocess.run([node, 'node_modules/next/dist/bin/next', 'build', '--webpack'], cwd=PROJECT, env=environment, check=True)
    process = subprocess.Popen([node, 'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', str(port)], cwd=PROJECT, env=environment, start_new_session=True)
    children.append(process)
    ready(process, 'http://127.0.0.1:%d/api/health' % port, lambda data: data.get('wealth', {}).get('application') == APP_VERSION)
    url = 'http://127.0.0.1:%d/phone#chat' % port
    print('Mercury Wealth v%s with Wealth Skills: %s' % (APP_VERSION, url), flush=True)
    subprocess.run(['/usr/bin/open', url], check=False)
    print('Keep this window open. Ctrl+C stops only the services started here.', flush=True)
    while process.poll() is None:
        time.sleep(1)
except KeyboardInterrupt:
    print('Stopping this Mercury instance.', flush=True)
except RuntimeError as error:
    print('Mercury could not start: %s' % error, flush=True)
    raise SystemExit(1)
finally:
    for child in reversed(children):
        if child.poll() is None:
            os.killpg(child.pid, signal.SIGTERM)
    for child in reversed(children):
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
