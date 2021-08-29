import { Emitter, Event, Uri, window } from 'coc.nvim';
import { asWebviewUri } from './resource';
import { cocWebviewServer, ServerConnector } from './server';
import { Webview, WebviewOptions, WebviewPanel, WebviewPanelOnDidChangeViewStateEvent } from './api.types';
import { logger } from './util';

type WebviewPanelOpenOptions = {
  openURL: boolean;
  routeName: string;
};

class CocWebview implements Webview {
  readonly onDidReceiveMessage: Event<any>;

  readonly cspSource: string;

  constructor(
    private readonly connector: ServerConnector,
    private host: string,
    private port: number,
    public options: WebviewOptions
  ) {
    this.onDidReceiveMessage = connector.postMessageEmitter.event;
    // TODO
    this.cspSource = '';
  }

  set html(content: string) {
    this.connector.setHtml(content).catch(logger.error);
  }

  async postMessage(message: any) {
    return this.connector.postMessage(message);
  }

  asWebviewUri(localResource: Uri): Uri {
    if (
      !this.options.localResourceRoots ||
      !this.options.localResourceRoots.some((root) => localResource.toString().startsWith(root.toString()))
    ) {
      throw new Error(
        'asWebviewUri: The resource cannot be created because the localResource is not inside the localResourceRoots'
      );
    }
    return asWebviewUri(localResource, { host: this.host, port: this.port });
  }
}

class CocWebviewPanel implements WebviewPanel {
  /**
   * Icon for the panel shown in UI.
   */
  public iconPath?: Uri | { light: Uri; dark: Uri };

  /**
   * {@link Webview `Webview`} belonging to the panel.
   */
  public readonly webview: CocWebview;

  /**
   * Whether the panel is active (focused by the user).
   */
  public active: boolean;

  /**
   * Whether the panel is visible.
   */
  public visible: boolean;

  /**
   * Fired when the panel's view state changes.
   */
  public readonly onDidChangeViewState: Event<WebviewPanelOnDidChangeViewStateEvent>;

  /**
   * Fired when the panel is disposed.
   *
   * This may be because the user closed the panel or because `.dispose()` was
   * called on it.
   *
   * Trying to use the panel after it has been disposed throws an exception.
   */
  public readonly onDidDispose: Event<void>;

  static async create(
    viewType: string,
    title: string,
    openOptions: WebviewPanelOpenOptions,
    options: WebviewOptions = {}
  ) {
    const { routeName } = openOptions;
    const { route, connector } = await cocWebviewServer.add({
      routeName,
      title,
    });
    logger.info(`added routeName ${routeName}`);
    if (openOptions.openURL) {
      await cocWebviewServer.openRoute(route);
    }
    window.showMessage(`Launched webview panel ${routeName}`);
    return new CocWebviewPanel(connector, route.host, route.port, viewType, title, routeName, options);
  }

  private constructor(
    private readonly connector: ServerConnector,
    host: string,
    port: number,
    public readonly viewType: string,
    public title: string,
    public routeName: string,
    public readonly options: WebviewOptions = {}
  ) {
    this.active = false;
    this.visible = false;
    this.connector.registerEmitter.event(() => {
      this.active = true;
      this.visible = true;
    });
    this.connector.unregisterEmitter.event(() => {
      this.active = false;
      this.visible = false;
    });

    this.webview = new CocWebview(this.connector, host, port, options ?? {});

    const onDidChangeViewStateEmitter = new Emitter<WebviewPanelOnDidChangeViewStateEvent>();
    this.onDidChangeViewState = onDidChangeViewStateEmitter.event;
    this.connector.setStateEmitter.event(() => {
      onDidChangeViewStateEmitter.fire({ webviewPanel: this });
    });

    this.onDidDispose = this.connector.disposeEmitter.event;
  }

  async reveal(options: { openURL: boolean }) {
    await this.connector.reveal(options);
  }

  dispose() {}
}

export async function createWebviewPanel(
  viewType: string,
  title: string,
  openOptions: WebviewPanelOpenOptions,
  options?: WebviewOptions
): Promise<WebviewPanel> {
  return CocWebviewPanel.create(viewType, title, openOptions, options);
}
