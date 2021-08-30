import { BasicList, ListItem, ListTask, workspace } from 'coc.nvim';
import { WebviewPanel } from '.';
import { cocWebviewServer, ServerConnector, ServerRoute } from './server';
import { logger } from './util';
import { Merge } from 'type-fest';

type ItemData = {
  panel: WebviewPanel;
  route: ServerRoute;
  connector: ServerConnector;
};

type Item = Merge<
  ListItem,
  {
    data: ItemData;
  }
>;

export class WebviewList extends BasicList {
  public static readonly items: Set<ItemData> = new Set();
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
      'dispose',
      logger.asyncCatch(async (item: Item) => {
        await item.data.connector.dispose();
      })
    );
  }

  async loadItems(): Promise<ListItem[] | ListTask | null | undefined> {
    return [...WebviewList.items.values()].map((item) => ({
      label: `${item.route.title} - ${item.route.routeName}`,
      data: item,
    }));
  }
}
