"""Credential-format regression tests use synthetic values only; no API calls."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

scripts = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0, str(scripts))
spec = importlib.util.spec_from_file_location('configure_ai', scripts / 'configure-ai.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)
import local_ai_settings as settings

class KeySetupTests(unittest.TestCase):
    def test_new_laya_configuration_defaults_to_gemini_36(self):
        old_file = settings.ENV_FILE
        try:
            with tempfile.TemporaryDirectory() as directory:
                settings.ENV_FILE = Path(directory) / '.env.local'
                self.assertEqual(settings.laya_settings()['GEMINI_MODEL'], 'gemini-3.6-flash')
        finally:
            settings.ENV_FILE = old_file

    def test_opaque_auth_key_with_periods_and_legacy_key(self):
        for key in ['AQ.' + 'synthetic_' * 40 + '.end', 'AIza' + 'synthetic_' * 4]:
            self.assertTrue(setup.safe_key_input(key))

    def test_multiline_and_control_text_rejected(self):
        for key in ['AQ.fake\nheader', 'AQ.fake\rheader', 'AQ. fake', 'AQ.fake\x00', 'AQ.fake\u200b', 'x' * 8193]:
            self.assertFalse(setup.safe_key_input(key))

    def test_quoted_assignment_normalization(self):
        self.assertEqual(setup.normalize_key(' export GEMINI_API_KEY="AQ.synthetic.value" '), 'AQ.synthetic.value')

    def test_long_auth_key_saved_exactly_without_changing_other_settings(self):
        old_project, old_file = settings.PROJECT, settings.ENV_FILE
        try:
            with tempfile.TemporaryDirectory() as directory:
                settings.PROJECT = Path(directory)
                settings.ENV_FILE = settings.PROJECT / '.env.local'
                settings.ENV_FILE.write_text('AI_ROUTER="laya"\n')
                key = 'AQ.' + 'synthetic_' * 40 + '.end'
                settings.save_settings({'GEMINI_API_KEY': key})
                self.assertEqual(settings.read_settings()['GEMINI_API_KEY'], key)
                self.assertEqual(settings.read_settings()['AI_ROUTER'], 'laya')
                self.assertEqual(settings.ENV_FILE.stat().st_mode & 0o777, 0o600)
        finally:
            settings.PROJECT, settings.ENV_FILE = old_project, old_file

if __name__ == '__main__':
    unittest.main()
