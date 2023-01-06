import { Disposable, ExtensionContext, listManager } from 'coc.nvim';
import { WebviewList } from './list';
import { webviewManager } from './manager';
import { ResourceUri } from './resource';
import { cocWebviewServer } from './server';
import { config, logger, openExternalUri } from './util';
import { createWebviewPanel } from './webview';
export * from './api.types';

/**
 * @example
 * ```
 * const resourceUri = parseResourceUri(hrefFromWebview)
 * const escapedPath: string = await workspace.nvim.call('fnameescape', [
 *   resourceUri.localPath,
 * ]);
 * nvim.command(`vsplit ${escapedPath}`);
 * ```
 */
function parseResourceUri(url: string): ResourceUri | undefined {
  if (!cocWebviewServer.binded) return;
  return ResourceUri.parse(url, cocWebviewServer.binded);
}

const webviewAPI = {
  createWebviewPanel,
  util: {
    /**
     * @deprecated
     */
    openUri: openExternalUri,
    openExternalUri,
    ResourceUri,
    parseResourceUri,
  },
};

export type WebviewAPI = typeof webviewAPI;

export function activate(context: ExtensionContext): WebviewAPI {
  const debug = config().get<boolean>('debug')!;
  logger.level = debug ? 'debug' : 'info';
  cocWebviewServer.debug = debug;

  context.subscriptions.push(
    listManager.registerList(new WebviewList()),
    Disposable.create(() => {
      webviewManager.disposeAll();
    }),
    cocWebviewServer,
  );

  return webviewAPI;
}
