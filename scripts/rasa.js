import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RASA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../rasa');
const VENV = path.join(RASA_DIR, '.venv');
const win = process.platform === 'win32';
const bin = (name) => path.join(VENV, win ? 'Scripts' : 'bin', win ? `${name}.exe` : name);

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: RASA_DIR, stdio: 'inherit' });
  if (r.error) {
    console.error(`Could not start ${cmd}: ${r.error.message}`);
    process.exit(1);
  }
  if (r.status) process.exit(r.status);
}

function requireInstall() {
  if (!existsSync(bin('rasa'))) {
    console.error('Rasa is not installed yet. Run: npm run rasa:install');
    process.exit(1);
  }
}

const task = process.argv[2] ?? 'run';

if (task === 'install') {
  const python = win ? 'python' : 'python3';
  const v = spawnSync(python, ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { encoding: 'utf8' });
  const [major, minor] = (v.stdout ?? '').trim().split('.').map(Number);
  if (major !== 3 || minor < 8 || minor > 10) {
    console.error(`Rasa needs Python 3.8, 3.9 or 3.10 (found ${v.stdout?.trim() || 'none'}). Install Python 3.10 and try again.`);
    process.exit(1);
  }
  if (!existsSync(VENV)) run(python, ['-m', 'venv', '.venv']);
  run(bin('python'), ['-m', 'pip', 'install', '--upgrade', 'pip<24.1']);
  run(bin('pip'), ['install', 'rasa~=3.6.0']);
  console.log('\nRasa installed. Next: npm run rasa:train');
} else if (task === 'train') {
  requireInstall();
  run(bin('rasa'), ['train', 'nlu', '--config', 'config.yml', '--nlu', 'data', '--out', 'models']);
} else if (task === 'run') {
  requireInstall();
  const models = existsSync(path.join(RASA_DIR, 'models')) ? readdirSync(path.join(RASA_DIR, 'models')).filter((f) => f.endsWith('.tar.gz')) : [];
  if (!models.length) {
    console.error('No trained model yet. Run: npm run rasa:train');
    process.exit(1);
  }
  run(bin('rasa'), ['run', '--enable-api', '--port', '5005', '--model', 'models']);
} else {
  console.error(`Unknown task "${task}". Use install, train or leave it out to run.`);
  process.exit(1);
}
