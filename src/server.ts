import assert from 'assert';
import { HelperEventEmitter } from 'coc-helper';
import { Disposable, Uri, workspace } from 'coc.nvim';
import http from 'http';
import mime from 'mime-types';
import path from 'path';
import { Server as SocketServer, Socket } from 'socket.io';
import { URL } from 'url';
import { ResourceUri, updateRoutes } from './resource';
import {
  Arguments,
  ColorStrategy,
  IconPaths,
  LightOrDarkMode,
  ServerConnectorEvents,
  SocketClientEvents,
  SocketServerEvents,
  StartupOptions,
} from './types';
import { config, logger, openUri, readFile } from './util';

export type ServerRouteParams = {
  title: string;
  routeName: string;
  localResourceRoots?: Uri[];
};

export type ServerBinded = {
  port: number;
  host: string;
};

export type ServerRoute = ServerRouteParams & ServerBinded;

type ServerSocket = Socket<SocketServerEvents, SocketClientEvents>;

export function baseHost(binded: ServerBinded) {
  return `${binded.host}:${binded.port}`;
}

class SocketManager {
  public readonly sockets = new Map<string, Map<string, ServerSocket>>();

  register(routeName: string, socket: Socket) {
    let sockets = this.sockets.get(routeName);
    if (!sockets) {
      sockets = new Map();
      this.sockets.set(routeName, sockets);
    }
    sockets.set(socket.id, socket);
    return sockets.size;
  }

  unregisterAll(routeName: string) {
    this.sockets.delete(routeName);
    return 0;
  }

  unregister(routeName: string, socket: Socket) {
    const sockets = this.sockets.get(routeName);
    if (sockets) {
      sockets.delete(socket.id);
      return sockets.size;
    }
    return 0;
  }

  get(routeName: string) {
    return this.sockets.get(routeName);
  }
}

class CocWebviewServer implements Disposable {
  private static staticRoutes: Record<string, string> = {
    'client.js': path.join(__dirname, 'client.js'),
    'client.css': path.resolve(__dirname, '../client.css'),
  };

  public debug = false;
  private instance?: http.Server;
  private wsInstance?: SocketServer;
  public readonly routes = new Map<string, ServerRoute>();
  public readonly sockets = new SocketManager();
  public readonly states = new Map<string, unknown>();
  public readonly connectors = new Map<string, ServerConnector>();
  public binded?: ServerBinded;

  public async tryCreate(): Promise<ServerBinded> {
    if (!this.instance) {
      this.instance = http.createServer(
        logger.asyncCatch(async (req, res) => {
          try {
            assert(this.binded, 'CocWebviewServer binded is undefined');
            const rendered = await this.bindRoutes(req, res, this.binded);
            if (!rendered) {
              res.writeHead(404);
              res.end('COC WEBVIEW NOT FOUND');
            }
          } catch (e) {
            res.writeHead(500);
            res.end(`COC WEBVIEW ERROR ${(e as Error).message}`);
          }
        }),
      );
    }
    if (!this.wsInstance) {
      this.wsInstance = new SocketServer(this.instance);
      this.wsInstance.on('connection', (socket) => {
        this.bindWs(socket);
      });
    }

    if (!this.binded) {
      return this.tryStart(this.instance);
    } else {
      return this.binded;
    }
  }

  private async bindRoutes(req: http.IncomingMessage, res: http.ServerResponse, binded: ServerBinded) {
    if (!req.url) {
      return false;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    logger.debug(`request pathname ${pathname}`);
    const resourceUri = ResourceUri.parse(url, binded);
    if (resourceUri.isResource) {
      if (resourceUri.forbidden) {
        res.writeHead(403);
        res.end('COC WEBVIEW FORBIDDEN');
        return true;
      }
      const fsPath = resourceUri.localPath;
      if (!fsPath) {
        return false;
      }
      const content = await resourceUri.readFile();
      if (!content) {
        return false;
      }
      const filename = path.basename(resourceUri.localPath);
      const mimeStr = mime.lookup(filename);
      res.writeHead(200, {
        'Content-Type': mimeStr || undefined,
        'Access-Control-Allow-Origin': `http://${baseHost(binded)}`,
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      });
      res.end(content);
      return true;
    } else if (pathname.startsWith('/webview')) {
      const routeName = pathname.split('/').pop();
      logger.debug(`request routeName ${routeName}`);
      if (routeName) {
        const route = this.routes.get(routeName);
        if (route) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(await this.genHtml(route, `http://${req.headers.host}`));
          return true;
        }
      }
    } else if (pathname.startsWith('/static')) {
      const filename = pathname.split('/').pop();
      if (filename && Object.prototype.hasOwnProperty.call(CocWebviewServer.staticRoutes, filename)) {
        const mimeStr = mime.lookup(filename);
        const path = CocWebviewServer.staticRoutes[filename];
        const content = await readFile(path);
        res.writeHead(200, { 'Content-Type': mimeStr || undefined });
        res.end(content);
        return true;
      }
    }
    return false;
  }

  private bindWs(socket: Socket) {
    socket.on('register', (routeName: string) => {
      const msgPrefix = `[${routeName}][socket ${socket.id}] `;
      const logDebug = (content: string) => {
        logger.debug(`${msgPrefix}${content}`);
      };
      const showMessage = (content: string) => {
        if (this.debug) {
          logger.info(`${msgPrefix}${content}`);
        }
      };

      const socketsCount = this.sockets.register(routeName, socket);
      this.emitConnector(routeName, 'register', socketsCount);
      showMessage(`connect count(${socketsCount})`);

      socket.on('disconnect', () => {
        showMessage(`disconnect count(${socketsCount})`);
        this.sockets.unregister(routeName, socket);
        this.emitConnector(routeName, 'unregister', socketsCount);
      });

      socket.on('dispose', () => {
        const sockets = this.sockets.get(routeName);
        if (sockets) {
          for (const [, s] of sockets) {
            if (s === socket) {
              continue;
            }
            s.emit('dispose');
          }
        }

        this.removeAndDispose(routeName);
      });

      socket.on('postMessage', (message) => {
        logDebug(`client postMessage ${JSON.stringify(message)}`);
        this.emitConnector(routeName, 'postMessage', message);
      });

      socket.on('setState', (state) => {
        logDebug(`client setState ${JSON.stringify(state)}`);
        this.emitConnector(routeName, 'setState', state);
        this.states.set(routeName, state);
      });

      socket.on('visible', (visible: boolean) => {
        logDebug(`client visible(${visible})`);
        this.emitConnector(routeName, 'visible', visible);
      });
    });
  }

  private async tryStart(server: http.Server): Promise<ServerBinded> {
    const host = 'localhost';
    const minPort = config.get<number>('minPort')!;
    const maxPort = config.get<number>('maxPort')!;

    const listenServer = (port: number) => {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          resolve(undefined);
          server.off('error', reject);
        });
      });
    };

    let port: number;
    for (port = minPort; port <= maxPort; port++) {
      try {
        await listenServer(port);
        break;
      } catch (e) {
        if (e instanceof Error && 'code' in e) {
          if ((e as { code: string }).code === 'EADDRINUSE') {
            logger.info(`Port ${port} is in use, trying another one...`);
            continue;
          }
        }
        throw e;
      }
    }

    if (port > maxPort) {
      throw new Error(`All IP addresses are used up (${minPort}~${maxPort})`);
    }

    logger.info(`Server started at ${port}`);
    this.binded = { host, port };
    return this.binded;
  }

  dispose() {
    this.instance?.close();
    this.instance = undefined;
    this.wsInstance?.close();
    this.wsInstance = undefined;
  }

  private async genHtml(route: ServerRoute, url: string): Promise<string> {
    const state = this.states.get(route.routeName);
    const primaryColors = config.get<{
      dark: string;
      light: string;
    }>('primaryColors')!;

    let cssDynamicBefore = '';
    let cssDynamicAfter = '';

    // title panel
    const titlePanelEnabled = config.get<boolean>('titlePanel.enabled');
    if (!titlePanelEnabled) {
      cssDynamicAfter += `#title { display: none }`;
    }

    // color
    const colorStrategy = config.get<ColorStrategy>('colorStrategy')!;
    let lightOrDarkMode: LightOrDarkMode = 'system';
    if (colorStrategy === 'vim-background') {
      const backgroundOption = await workspace.nvim.getOption('background');
      if (backgroundOption === 'dark') {
        cssDynamicBefore += `:root { --primary-color: ${primaryColors.dark}; }`;
        lightOrDarkMode = 'dark';
      } else if (backgroundOption === 'light') {
        cssDynamicBefore += `:root { --primary-color: ${primaryColors.light}; }`;
        lightOrDarkMode = 'light';
      }
    } else if (colorStrategy === 'system') {
      cssDynamicBefore += `
        @media (prefers-color-scheme: light) {
          :root { --primary-color: ${primaryColors.light}; }
        }
        @media (prefers-color-scheme: dark) {
          :root { --primary-color: ${primaryColors.dark}; }
        }
      `;
      lightOrDarkMode = 'system';
    } else if (colorStrategy === 'dark') {
      cssDynamicBefore += `:root { --primary-color: ${primaryColors.dark}; }`;
      lightOrDarkMode = 'dark';
    } else if (colorStrategy === 'light') {
      cssDynamicBefore += `:root { --primary-color: ${primaryColors.light}; }`;
      lightOrDarkMode = 'light';
    }

    const startupOptions: StartupOptions = {
      debug: this.debug,
      primaryColors,
      url,
      routeName: route.routeName,
      state,
      lightOrDarkMode,
    };

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${route.title}</title>
        <style type="text/css">
          :root { --primary-color: #2288ff; }
          ${cssDynamicBefore}
        </style>
        <link rel="stylesheet" type="text/css" href="${url}/static/client.css" />
        <style type="text/css">
          ${cssDynamicAfter}
        </style>
      </head>
      <body>
        <div id="title">
          <div class="menu">
            <span class="button">☰</span>
            <ul class="menu-list"></ul>
          </div>
          <h1>
            <img id="title-img"></img>
            <span id="title-content">${route.title}</span>
          </h1>
          <a class="close">×</a>
        </div>
        <div id="reveal-cover" style="display: none;"></div>
        <iframe id="main" frameBorder="0"></iframe>
        <script type="module">
          import '${url}/static/client.js';
          window.startup(
            ${JSON.stringify(startupOptions)},
          );
        </script>
      </body>
      </html>
    `;
  }

  getUrl(route: ServerRoute) {
    return `http://${baseHost(route)}/webview/${route.routeName}`;
  }

  public async add(routeParams: ServerRouteParams) {
    const binded = await this.tryCreate();
    const route: ServerRoute = {
      ...routeParams,
      host: binded.host,
      port: binded.port,
    };
    this.routes.set(routeParams.routeName, route);
    updateRoutes(this.routes);
    return {
      connector: this.createConnector(routeParams.routeName),
      route,
    };
  }

  private emitConnector<R extends keyof ServerConnectorEvents>(
    routeName: string,
    event: R,
    ...args: Arguments<ServerConnectorEvents[R]>
  ) {
    const connector = this.connectors.get(routeName);
    if (connector) {
      connector.events.fire(event, ...args).catch(logger.error);
    }
  }
  private createConnector(routeName: string) {
    const connector = new ServerConnector(this, routeName);
    this.connectors.set(routeName, connector);
    return connector;
  }

  /**
   * Open route in browser or CLI
   */
  public openRoute(route: ServerRoute) {
    openUri(this.getUrl(route));
  }

  /**
   * Open route in browser or CLI
   */
  public openByRouteName(routeName: string) {
    const route = this.routes.get(routeName);
    if (!route) {
      return;
    }
    this.openRoute(route);
  }

  public removeAndDispose(routeName: string) {
    this.emitConnector(routeName, 'dispose');
    this.sockets.unregisterAll(routeName);
    this.routes.delete(routeName);
    updateRoutes(this.routes);
  }
}

export class ServerConnector {
  public readonly events = new HelperEventEmitter<ServerConnectorEvents>(logger);

  constructor(private server: CocWebviewServer, public readonly routeName: string) {}

  async waitSocket<T>(run: (socket: ServerSocket) => T): Promise<T[]> {
    const sockets = this.server.sockets.get(this.routeName);
    function runSockets(sockets: Map<string, ServerSocket>) {
      const results: T[] = [];
      for (const [, socket] of sockets) {
        results.push(run(socket));
      }
      return results;
    }
    if (sockets) {
      return runSockets(sockets);
    } else {
      return new Promise<T[]>((resolve) => {
        this.events.once('register', () => {
          const sockets = this.server.sockets.get(this.routeName);
          if (sockets) {
            resolve(runSockets(sockets));
          }
        });
      });
    }
  }

  async setIconPath(uris: IconPaths) {
    await this.waitSocket((socket) => {
      logger.debug(`[${this.routeName}][socket ${socket.id}] server setIconPath`);
      socket.emit('iconPath', uris);
    });
  }

  async setTitle(content: string) {
    await this.waitSocket((socket) => {
      logger.debug(`[${this.routeName}][socket ${socket.id}] server setTitle`);
      socket.emit('title', content);
    });
  }

  async setHtml(content: string) {
    await this.waitSocket((socket) => {
      logger.debug(`[${this.routeName}][socket ${socket.id}] server setHtml`);
      socket.emit('html', content);
    });
  }

  async postMessage(message: any): Promise<boolean> {
    const results = await this.waitSocket((socket) => {
      logger.debug(`[${this.routeName}][socket ${socket.id}] server postMessage ${JSON.stringify(message)}`);
      return socket.emit('postMessage', message);
    });
    return results.every((r) => r);
  }

  async reveal(options: { openURL: boolean }): Promise<boolean> {
    if (options.openURL) {
      this.server.openByRouteName(this.routeName);
    }
    const results = await this.waitSocket((socket) => {
      logger.debug(`[${this.routeName}][socket ${socket.id}] server reveal`);
      return socket.emit('reveal');
    });
    return results.every((r) => r);
  }

  async disposeSockets() {}

  dispose() {
    this.waitSocket((socket) => {
      logger.debug(`[${this.routeName}][socket ${socket.id}] server dispose`);
      return socket.emit('dispose');
    }).catch(logger.error);
    cocWebviewServer.removeAndDispose(this.routeName);
  }
}

export const cocWebviewServer = new CocWebviewServer();
