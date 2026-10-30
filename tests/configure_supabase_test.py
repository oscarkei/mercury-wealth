import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

scripts = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0, str(scripts))
spec = importlib.util.spec_from_file_location('configure_supabase', scripts / 'configure-supabase.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)
import local_ai_settings as settings

class DatabaseSetupTests(unittest.TestCase):
    def test_secret_only_and_single_line(self):
        self.assertTrue(setup.valid_key('sb_secret_synthetic_only'))
        for value in ['', 'sb_publishable_fake', 'database-password', 'sb_secret_fake\nInjected', 'sb_secret_fake with space']:
            self.assertFalse(setup.valid_key(value))

    def test_assignment_and_quotes(self):
        self.assertEqual(setup.normalize_key(' export SUPABASE_SECRET_KEY="sb_secret_synthetic_only" '), 'sb_secret_synthetic_only')

    def test_existing_ai_credentials_are_preserved_and_file_private(self):
        old_project, old_file = settings.PROJECT, settings.ENV_FILE
        try:
            with tempfile.TemporaryDirectory() as directory:
                settings.PROJECT = Path(directory)
                settings.ENV_FILE = settings.PROJECT / '.env.local'
                original = '# local settings\nGEMINI_API_KEY="synthetic.gemini"\nLAYA_API_KEY="synthetic-laya"\n'
                settings.ENV_FILE.write_text(original)
                settings.save_settings({'SUPABASE_URL': setup.PROJECT_URL, 'SUPABASE_SECRET_KEY': 'sb_secret_synthetic_only'})
                self.assertTrue(settings.ENV_FILE.read_text().startswith(original))
                self.assertEqual(settings.read_settings()['SUPABASE_SECRET_KEY'], 'sb_secret_synthetic_only')
                self.assertEqual(settings.ENV_FILE.stat().st_mode & 0o777, 0o600)
        finally:
            settings.PROJECT, settings.ENV_FILE = old_project, old_file

if __name__ == '__main__':
    unittest.main()
