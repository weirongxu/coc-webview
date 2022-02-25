import { Disposable, ExtensionContext, listManager } from 'coc.nvim';
import { WebviewList } from './list';
import { webviewManager } from './manager';
import { ResourceUri } from './resource';
import { cocWebviewServer } from './server';
import { config, logger, openUri } from './util';
import { createWebviewPanel } from './webview';
export * from './api.types';

const webviewAPI = {
  createWebviewPanel,
  util: {
    openUri,
    ResourceUri,
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
