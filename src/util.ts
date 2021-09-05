import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import { HelperLogger } from 'coc-helper';
import { workspace } from 'coc.nvim';
import fs from 'fs';
import util from 'util';

export const config = workspace.getConfiguration('webview');

export const logger = new HelperLogger('webview');

export const readFile = util.promisify(fs.readFile);

export async function copyToClipboard(content: string) {
  await workspace.nvim.call('setreg', ['+', content]);
  await workspace.nvim.call('setreg', ['"', content]);
}

export const spawnCmdLine = (command: string, args: string[], options?: SpawnOptionsWithoutStdio) => {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(command, args, options);
    proc.on('error', (err) => {
      reject(err);
    });
    proc.on('close', resolve);
  });
};
