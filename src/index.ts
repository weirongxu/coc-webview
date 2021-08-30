import { ExtensionContext, listManager } from 'coc.nvim';
import { config } from './config';
import { WebviewList } from './list';
import { logger } from './util';
export * from './api.types';
import { createWebviewPanel } from './webview';

const webviewAPI = {
  createWebviewPanel,
};

export type WebviewAPI = typeof webviewAPI;

export function activate(context: ExtensionContext): WebviewAPI {
  const debug = config.get<boolean>('debug');
  logger.level = debug ? 'debug' : 'info';

  context.subscriptions.push(listManager.registerList(new WebviewList()));
  return webviewAPI;
}
