import { Disposable, Emitter, Event, Uri, window } from 'coc.nvim';
import { Webview, WebviewOptions, WebviewPanel, WebviewPanelOnDidChangeViewStateEvent } from './api.types';
import { webviewManager } from './manager';
import { asWebviewUri } from './resource';
import { cocWebviewServer, ServerConnector } from './server';
import { logger } from './util';

type WebviewPanelOpenOptions = {
  openURL: boolean;
  routeName: string;
};

class CocWebview implements Webview {
  public readonly onDidReceiveMessage: Event<any>;
  public readonly cspSource: string;

  constructor(
    private readonly connector: ServerConnector,
    public host: string,
    public port: number,
    public options: WebviewOptions,
  ) {
    const onDidReceiveMessageEmitter = new Emitter();
    connector.events.on('postMessage', (msg) => {
      onDidReceiveMessageEmitter.fire(msg);
    });
    this.onDidReceiveMessage = onDidReceiveMessageEmitter.event;
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
    return asWebviewUri(localResource, { host: this.host, port: this.port });
  }
}

class CocWebviewPanel implements WebviewPanel {
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

  private disposables: Disposable[] = [];

  static async create(
    viewType: string,
    title: string,
    openOptions: WebviewPanelOpenOptions,
    options: WebviewOptions = {},
  ) {
    const { routeName } = openOptions;
    const { route, connector } = await cocWebviewServer.add({
      routeName,
      title,
    });
    logger.info(`added routeName ${routeName}`);
    if (openOptions.openURL) {
      cocWebviewServer.openRoute(route);
    }
    window.showMessage(`Launched webview panel ${routeName}`);
    const panel = new CocWebviewPanel(connector, route.host, route.port, viewType, title, routeName, options);

    webviewManager.add({
      panel,
      route,
      connector,
    });

    return panel;
  }

  private constructor(
    private readonly connector: ServerConnector,
    host: string,
    port: number,
    public readonly viewType: string,
    title: string,
    public routeName: string,
    public readonly options: WebviewOptions = {},
  ) {
    this.active = false;
    this.visible = false;
    this.disposables.push(
      this.connector.events.on('register', () => {
        this.active = true;
        this.visible = true;
      }),
      this.connector.events.on('unregister', (socketsCount) => {
        if (socketsCount <= 0) {
          this.active = false;
          this.visible = false;
        }
      }),
      this.connector.events.on('visible', (visible) => {
        this.visible = visible;
      }),
    );

    this.title = title;
    this.webview = new CocWebview(this.connector, host, port, options ?? {});

    const onDidChangeViewStateEmitter = new Emitter<WebviewPanelOnDidChangeViewStateEvent>();
    this.onDidChangeViewState = onDidChangeViewStateEmitter.event;
    this.disposables.push(
      onDidChangeViewStateEmitter,
      this.connector.events.on('setState', () => {
        onDidChangeViewStateEmitter.fire({ webviewPanel: this });
      }),
    );

    const onDidDisposeEmitter = new Emitter<void>();
    this.onDidDispose = onDidDisposeEmitter.event;
    this.disposables.push(
      onDidDisposeEmitter,
      this.connector.events.on('dispose', () => {
        onDidDisposeEmitter.fire();
      }),
    );
  }

  async reveal(options: { openURL: boolean }) {
    await this.connector.reveal(options);
  }

  /**
   * Title for the panel
   */
  set title(content: string) {
    this.connector.setTitle(content).catch(logger.error);
  }

  /**
   * Icon for the panel shown in UI.
   */
  set iconPath(uri: Uri | { light: Uri; dark: Uri }) {
    if (Uri.isUri(uri)) {
      uri = {
        light: uri,
        dark: uri,
      };
    }
    const uriOptions = {
      host: this.webview.host,
      port: this.webview.port,
    };
    const light = asWebviewUri(uri.light, uriOptions);
    const dark = asWebviewUri(uri.dark, uriOptions);
    this.connector
      .setIconPath({
        light: light.toString(true),
        dark: dark.toString(true),
      })
      .catch(logger.error);
  }

  dispose() {
    this.connector.dispose();
  }
}

export async function createWebviewPanel(
  viewType: string,
  title: string,
  openOptions: WebviewPanelOpenOptions,
  options?: WebviewOptions,
): Promise<WebviewPanel> {
  return CocWebviewPanel.create(viewType, title, openOptions, options);
}
