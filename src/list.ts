import { BasicList, ListItem, ListTask, workspace } from 'coc.nvim';
import { Merge } from 'type-fest';
import { ItemData, webviewManager } from './manager';
import { cocWebviewServer, ServerRoute } from './server';
import { logger } from './util';

type Item = Merge<
  ListItem,
  {
    data: ItemData;
  }
>;

export class WebviewList extends BasicList {
  public readonly name = 'webview';
  public readonly defaultAction = 'open';
  public description = 'activated webviews';

  constructor() {
    super(workspace.nvim);

    this.addAction(
      'open',
      logger.asyncCatch(async (item: Item) => {
        const route: ServerRoute = item.data.route;
        await cocWebviewServer.openRoute(route);
      })
    );

    this.addAction(
      'close',
      logger.asyncCatch(async (item: Item) => {
        await item.data.connector.dispose();
      })
    );
  }

  async loadItems(): Promise<ListItem[] | ListTask | null | undefined> {
    return [...webviewManager.items.values()].map((item) => ({
      label: `${item.route.title} - ${item.route.routeName}`,
      data: item,
    }));
  }
}
