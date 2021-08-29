import { ExtensionContext, listManager } from 'coc.nvim';
import { WebviewList } from './list';
export * from './api.types';
import { createWebviewPanel } from './webview';

const webviewAPI = {
  createWebviewPanel,
};

export type WebviewAPI = typeof webviewAPI;

export function activate(context: ExtensionContext): WebviewAPI {
  context.subscriptions.push(listManager.registerList(new WebviewList()));
  return webviewAPI;
}
