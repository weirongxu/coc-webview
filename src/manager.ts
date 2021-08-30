import { WebviewPanel } from './api.types';
import { ServerConnector, ServerRoute } from './server';

export type ItemData = {
  panel: WebviewPanel;
  route: ServerRoute;
  connector: ServerConnector;
};

class WebviewManager {
  public readonly items: Set<ItemData> = new Set();

  add(item: ItemData) {
    this.items.add(item);
    item.panel.onDidDispose(() => {
      this.items.delete(item);
    });
  }

  disposeAll() {
    for (const item of this.items) {
      item.panel.dispose();
    }
  }
}

export const webviewManager = new WebviewManager();
