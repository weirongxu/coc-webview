import { Socket, io } from 'socket.io-client';
import { SocketClientEvents, SocketServerEvents, StartupOptions } from '../types';

// @ts-ignore
window.startup = (options: StartupOptions) => {
  const { routeName } = options;
  const socket: Socket<SocketClientEvents, SocketServerEvents> = io(options.url, { autoConnect: true });
  const iframe = document.getElementById('main') as HTMLIFrameElement;

  const win = iframe.contentWindow;

  function log(...args: any[]) {
    console.log(`[${routeName}][socket ${socket.id}]`, ...args);
  }

  socket.on('connect', () => {
    log(`register`);
    socket.emit('register', routeName);
  });

  if (win) {
    let storedState = options.state;

    // @ts-ignore
    win.acquireVsCodeApi = () => {
      return {
        getState() {
          return storedState;
        },
        setState(state: any) {
          log('setState', state);
          storedState = state;
          socket.emit('setState', state);
        },
        postMessage(message: any) {
          log('postMessage', message);
          socket.emit('postMessage', message);
        },
      };
    };

    win.focus();

    const setTitle = (content: string) => {
      const titleDom = document.querySelector('#title h1');
      if (titleDom) titleDom.textContent = content;
      document.title = content;
    };

    const setHtml = (content: string) => {
      win.document.open();
      win.document.write(content);
      win.document.close();
      win.focus();
    };

    const close = () => {
      log(`close`);
      setHtml('CLOSED');
      win.close();
      if (!options.debug) {
        window.close();
      }
    };

    document.querySelector('#title .close')?.addEventListener('click', () => {
      socket.emit('dispose');
      close();
    });

    socket.on('postMessage', (message) => {
      log('received postMessage', message);
      win.postMessage(message, '*');
    });

    socket.on('title', (content) => {
      log('received title', content);
      setTitle(content);
    });

    socket.on('html', (content) => {
      log('received html', content);
      setHtml(content);
    });

    socket.on('reveal', () => {
      // TODO flash
    });

    socket.on('dispose', () => {
      close();
    });

    // TODO vim keybinding
  }
};
