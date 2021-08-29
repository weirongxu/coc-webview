import { Emitter } from 'coc.nvim';
import http from 'http';
import path from 'path';
import { Server as SocketServer, Socket } from 'socket.io';
import { URL } from 'url';
import { config } from './config';
import { SocketClientEvents, SocketServerEvents, StartupOptions as StartupOptions } from './types';
import { readResourceFile } from './resource';
import { logger, readFile } from './util';
import mime from 'mime-types';
import open from 'open';

export type ServerRouteParams = {
  title: string;
  routeName: string;
};

export type ServerRoute = ServerRouteParams & {
  port: number;
  host: string;
};

type ServerSocket = Socket<SocketServerEvents, SocketClientEvents>;

export class CocWebviewServer {
  private static staticRoutes: Record<string, string> = {
    'client.js': path.join(__dirname, 'client.js'),
    'client.css': path.resolve(__dirname, '../client.css'),
  };

  private instance?: http.Server;
  private wsInstance?: SocketServer;
  public readonly routes = new Map<string, ServerRoute>();
  public readonly sockets = new Map<string, ServerSocket>();
  public readonly states = new Map<string, unknown>();
  public readonly registerEmitter = new Emitter<{ routeName: string }>();
  public readonly unregisterEmitter = new Emitter<{ routeName: string }>();
  public readonly disposeEmitter = new Emitter<{ routeName: string }>();
  public readonly postMessagEmitter = new Emitter<{
    routeName: string;
    message: any;
  }>();
  public readonly setStateEmitter = new Emitter<{
    routeName: string;
    state: any;
  }>();
  public binded?: {
    host: string;
    port: number;
  };

  public async tryCreate(): Promise<{ host: string; port: number }> {
    if (!this.instance) {
      this.instance = http.createServer(async (req, res) => {
        if (req.url) {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const pathname = url.pathname;
          logger.debug(`request pathname ${pathname}`);
          if (pathname.startsWith('/resources')) {
            const resourceId = pathname.split('/').pop();
            if (resourceId) {
              const content = await readResourceFile(resourceId);
              res.writeHead(200);
              res.end(content);
              return;
            }
          }
          if (pathname.startsWith('/webview')) {
            const routeName = pathname.split('/').pop();
            logger.debug(`request routeName ${routeName}`);
            if (routeName) {
              const route = this.routes.get(routeName);
              if (route) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(this.genHtml(route, `http://${req.headers.host}`));
                return;
              }
            }
          }
          if (pathname.startsWith('/static')) {
            const filename = pathname.split('/').pop();
            if (filename && CocWebviewServer.staticRoutes.hasOwnProperty(filename)) {
              const mimeStr = mime.lookup(filename);
              const path = CocWebviewServer.staticRoutes[filename];
              const content = await readFile(path);
              res.writeHead(200, { 'Content-Type': mimeStr || undefined });
              res.end(content);
              return;
            }
          }

          res.writeHead(404);
          res.end('COC WEBVIEW NOT FOUND');
        }
      });
    }
    if (!this.wsInstance) {
      this.wsInstance = new SocketServer(this.instance);
      this.wsInstance.on('connection', (socket) => {
        socket.on('register', (routeName: string) => {
          this.sockets.set(routeName, socket);
          this.registerEmitter.fire({ routeName });

          socket.on('disconnect', () => {
            this.sockets.delete(routeName);
            this.unregisterEmitter.fire({ routeName });
          });

          socket.on('dispose', () => {
            socket.disconnect();
            this.routes.delete(routeName);
            this.disposeEmitter.fire({ routeName });
          });

          socket.on('postMessage', (message: any) => {
            this.postMessagEmitter.fire({ routeName, message });
          });

          socket.on('setState', (state: any) => {
            this.setStateEmitter.fire({ routeName, state });
            this.states.set(routeName, state);
          });
        });
      });
    }

    if (!this.binded) {
      return this.tryStart(this.instance);
    } else {
      return this.binded;
    }
  }

  async tryStart(server: http.Server): Promise<{ host: string; port: number }> {
    const host = config.get<string>('host')!;
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
          } else {
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

  private genHtml(route: ServerRoute, url: string): string {
    const state = this.states.get(route.routeName);
    const startupOptions: StartupOptions = {
      url,
      routeName: route.routeName,
      initState: state,
    };
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${route.title}</title>
        <link rel="stylesheet" type="text/css" href="${url}/static/client.css" />
      </head>
      <body>
        <div id="title">
          <h1>${route.title}</h1>
          <a class="close">close</a>
        </div>
        <iframe id="main" frameBorder="0"></iframe>
        <script type="module">
          import '${url}/static/client.js'
          window.startup(
            ${JSON.stringify(startupOptions)},
          );
        </script>
      </body>
      </html>
    `;
  }

  private genUrl(route: ServerRoute) {
    return `http://${route.host}:${route.port}/webview/${route.routeName}`;
  }

  public async add(routeParams: ServerRouteParams) {
    const binded = await this.tryCreate();
    const route = {
      ...routeParams,
      host: binded.host,
      port: binded.port,
    };
    this.routes.set(routeParams.routeName, route);
    return {
      connector: this.sender(routeParams.routeName),
      route,
    };
  }

  public sender(routeName: string) {
    return new ServerConnector(this, routeName);
  }

  /**
   * Open route in browser or CLI
   */
  public async openRoute(route: ServerRoute) {
    await open(this.genUrl(route));
  }

  /**
   * Open route in browser or CLI
   */
  public async openByRouteName(routeName: string) {
    const route = this.routes.get(routeName);
    if (!route) {
      return;
    }
    await open(this.genUrl(route));
  }
}

export class ServerConnector {
  public readonly registerEmitter = new Emitter<void>();
  public readonly unregisterEmitter = new Emitter<void>();
  public readonly disposeEmitter = new Emitter<void>();
  public readonly postMessageEmitter = new Emitter<any>();
  public readonly setStateEmitter = new Emitter<any>();

  constructor(private server: CocWebviewServer, private routeName: string) {
    this.server.registerEmitter.event(({ routeName }) => {
      if (routeName === this.routeName) {
        this.registerEmitter.fire();
      }
    });

    this.server.unregisterEmitter.event(({ routeName }) => {
      if (routeName === this.routeName) {
        this.unregisterEmitter.fire();
      }
    });

    this.server.disposeEmitter.event(({ routeName }) => {
      if (routeName === this.routeName) {
        this.disposeEmitter.fire();
      }
    });

    this.server.postMessagEmitter.event(({ routeName, message }) => {
      if (routeName === this.routeName) {
        this.postMessageEmitter.fire(message);
      }
    });

    this.server.setStateEmitter.event(({ routeName, state }) => {
      if (routeName === this.routeName) {
        this.setStateEmitter.fire(state);
      }
    });
  }

  async waitSocket<T>(run: (socket: ServerSocket) => T): Promise<T> {
    const socket = this.server.sockets.get(this.routeName);
    if (socket) {
      return run(socket);
    } else {
      return new Promise((resolve) => {
        this.registerEmitter.event(() => {
          const socket = this.server.sockets.get(this.routeName);
          resolve(run(socket!));
        });
      });
    }
  }

  async setHtml(content: string) {
    await this.waitSocket((socket) => {
      socket.emit('html', content);
    });
  }

  async postMessage(message: any): Promise<boolean> {
    return this.waitSocket((socket) => socket.emit('postMessage', message));
  }

  async reveal(options: { openURL: boolean }): Promise<boolean> {
    if (options.openURL) {
      await this.server.openByRouteName(this.routeName);
    }
    return this.waitSocket((socket) => socket.emit('reveal'));
  }
}

export const cocWebviewServer = new CocWebviewServer();
