import { BasicList, ListItem, ListTask, workspace } from 'coc.nvim';
import { cocWebviewServer, ServerRoute } from './server';
import { logger } from './util';

export class WebviewList extends BasicList {
  public readonly name = 'webview';
  public readonly defaultAction = 'open';
  public description = 'activated webviews';

  constructor() {
    super(workspace.nvim);

    this.addAction(
      'open',
      logger.asyncCatch(async (item) => {
        const route: ServerRoute = item.data.route;
        await cocWebviewServer.openRoute(route);
      })
    );
  }

  async loadItems(): Promise<ListItem[] | ListTask | null | undefined> {
    return [...cocWebviewServer.routes.values()].map((route) => ({
      label: `${route.title} - ${route.routeName}`,
      data: { route },
    }));
  }
}
