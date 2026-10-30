"""Own the local services, wait for readiness, and stop only processes we started."""
from pathlib import Path
import json
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.request
from local_ai_settings import PROJECT, WORKSPACE, read_settings

processes = []

def stop(_signum=None, _frame=None):
    raise KeyboardInterrupt

for sig in (signal.SIGINT, signal.SIGTERM):
    signal.signal(sig, stop)

def probe(url, token=None):
    headers = {'Authorization': 'Bearer ' + token} if token else {}
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=2) as response:
        return json.load(response)

def wait_ready(process, url, predicate, token=None):
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError('A local service stopped during startup. See the error above.')
        try:
            if predicate(probe(url, token)):
                return
        except (OSError, ValueError):
            pass
        time.sleep(.5)
    raise RuntimeError('Local service startup timed out.')

try:
    python = WORKSPACE / 'work/laya-venv/bin/python'
    if not python.exists():
        raise RuntimeError('The local Laya installation is missing.')
    settings = read_settings()
    if not settings.get('LAYA_API_KEY'):
        raise RuntimeError('Open Configure Mercury AI.command first.')
    # Fail clearly instead of opening an unrelated service or taking over its port.
    finance_enabled = bool(settings.get('FINANCE_API_KEY'))
    for port in ((8890, 8888, 3000) if finance_enabled else (8888, 3000)):
        with socket.socket() as check:
            try:
                check.bind(('127.0.0.1', port))
            except OSError:
                raise RuntimeError('Port %d is already in use. Close the previous Mercury AI Terminal window, then retry.' % port)
    total_steps = 4 if finance_enabled else 3
    step = 1
    if finance_enabled:
        finance_python = WORKSPACE / 'work/finance-venv/bin/python'
        if not finance_python.exists():
            raise RuntimeError('The local finance Python environment is missing.')
        print('Step %d/%d — starting finance calculations…' % (step, total_steps), flush=True)
        # Reuse the reviewed private settings; launching must not rewrite them.
        finance_environment = dict(os.environ, FINANCE_API_KEY=settings['FINANCE_API_KEY'], PYTHONDONTWRITEBYTECODE='1')
        finance = subprocess.Popen([str(finance_python), str(PROJECT / 'scripts/run-finance-api.py')], cwd=PROJECT, env=finance_environment, start_new_session=True)
        processes.append(finance)
        wait_ready(finance, 'http://127.0.0.1:8890/health', lambda data: data.get('service') == 'mercury-finance' and data.get('ready') is True)
        step += 1
    print('Step %d/%d — starting local Laya…' % (step, total_steps), flush=True)
    laya = subprocess.Popen([str(python), str(PROJECT / 'scripts/run-local-laya.py')], cwd=PROJECT, start_new_session=True)
    processes.append(laya)
    wait_ready(laya, 'http://127.0.0.1:8888/health', lambda data: 'multilingual' in data.get('loaded', []), settings['LAYA_API_KEY'])
    step += 1
    print('Step %d/%d — building and starting Mercury…' % (step, total_steps), flush=True)
    node = WORKSPACE / 'work/runtime/node-v24.22.1-darwin-arm64/bin/node'
    node_command = str(node) if node.exists() else 'node'
    environment = dict(os.environ, NEXT_TELEMETRY_DISABLED='1')
    # CSS/build workers spawn `node` by name, including from Finder-launched commands.
    if node.exists():
        environment['PATH'] = str(node.parent) + os.pathsep + environment.get('PATH', '')
    if os.environ.get('MERCURY_USE_EXISTING_BUILD') == '1':
        build_dir = PROJECT / os.environ.get('MERCURY_NEXT_DIST', '.next')
        if not (build_dir / 'BUILD_ID').is_file():
            raise RuntimeError('The verified production build is missing.')
    else:
        build = subprocess.Popen([node_command, 'node_modules/next/dist/bin/next', 'build', '--webpack'], cwd=PROJECT, env=environment, start_new_session=True)
        processes.append(build)
        if build.wait() != 0:
            raise RuntimeError('Mercury build failed. See the error above.')
        processes.remove(build)
    web = subprocess.Popen([node_command, 'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3000'], cwd=PROJECT, env=environment, start_new_session=True)
    processes.append(web)
    wait_ready(web, 'http://127.0.0.1:3000/api/health', lambda data: data.get('server') is True)
    step += 1
    print('Step %d/%d — opening http://127.0.0.1:3000/phone' % (step, total_steps), flush=True)
    subprocess.run(['/usr/bin/open', '-a', 'Google Chrome', 'http://127.0.0.1:3000/phone'], check=True)
    print('Keep this window open. Ctrl+C stops the Mercury services started here.', flush=True)
    while all(process.poll() is None for process in processes):
        time.sleep(1)
    raise RuntimeError('A local service stopped. Restart this launcher.')
except KeyboardInterrupt:
    print('\nStopping Mercury services…', flush=True)
except Exception as error:
    print('Could not start Mercury: ' + str(error), file=sys.stderr)
    sys.exit(1)
finally:
    for process in reversed(processes):
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
    for process in reversed(processes):
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
