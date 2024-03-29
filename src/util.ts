import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import { HelperLogger } from 'coc-helper';
import { Uri, workspace } from 'coc.nvim';
import open from 'open';
import { URL } from 'url';

export const config = () => workspace.getConfiguration('webview');

export const logger = new HelperLogger('webview');

export const isURL = (uri: string) => {
  try {
    new URL(uri);
    return true;
  } catch (_) {
    return false;
  }
};

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

function openInBrowser(url: string): void {
  const openCommand = config().get<string>('openCommand');
  if (openCommand === 'nodejs:module') {
    open(url).catch(logger.error);
  } else if (openCommand) {
    spawnCmdLine(openCommand.replace(new RegExp('%u', 'g'), url), [], {
      shell: true,
      detached: true,
    }).catch(logger.error);
  }
}

export function openExternalUri(fsPathOrURL: string): void {
  if (fsPathOrURL.startsWith('file://')) {
    const u = Uri.parse(fsPathOrURL).fsPath;
    if (u !== fsPathOrURL) {
      return openExternalUri(Uri.parse(fsPathOrURL).fsPath);
    }
  }
  if (isURL(fsPathOrURL)) {
    openInBrowser(fsPathOrURL);
  } else {
    open(fsPathOrURL).catch(logger.error);
  }
}
