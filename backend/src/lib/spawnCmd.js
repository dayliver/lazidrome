import { spawn } from 'node:child_process';

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ cwd?: string, timeoutMs?: number }} opts
 * @returns {Promise<{ stdout: string, stderr: string, code: number }>}
 */
export function spawnCmd(cmd, args, opts = {}) {
  const { cwd, timeoutMs = 600_000 } = opts;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });

    const timer = timeoutMs > 0
      ? setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error(`Command timed out after ${timeoutMs}ms: ${cmd}`));
        }, timeoutMs)
      : null;

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}
