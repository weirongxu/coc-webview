import { HelperLogger } from 'coc-helper';
import { workspace } from 'coc.nvim';
import fs from 'fs';
import util from 'util';

export const logger = new HelperLogger('webview');

export const readFile = util.promisify(fs.readFile);

export async function copyToClipboard(content: string) {
  await workspace.nvim.call('setreg', ['+', content]);
  await workspace.nvim.call('setreg', ['"', content]);
}
