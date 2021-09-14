import { Socket, io } from 'socket.io-client';
import { SocketClientEvents, SocketServerEvents, StartupOptions } from '../types';

// @ts-ignore
window.startup = (options: StartupOptions) => {
  const { routeName } = options;
  const iframe = document.getElementById('main') as HTMLIFrameElement;

  const win = iframe.contentWindow;
  if (!win) {
    return;
  }

  function log(...args: any[]) {
    console.log(`[${routeName}][socket ${socket.id}]`, ...args);
  }

  const socket: Socket<SocketClientEvents, SocketServerEvents> = io(options.url, { autoConnect: true });

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

  socket.on('connect', () => {
    log(`register`);
    socket.emit('register', routeName);
  });

  socket.on('postMessage', (message) => {
    log('received postMessage', message);
    win.postMessage(message, '*');
  });

  const setTitle = (content: string) => {
    const titleDom = document.querySelector('#title h1');
    if (titleDom) titleDom.textContent = content;
    document.title = content;
  };

  socket.on('title', (content) => {
    log('received title', content);
    setTitle(content);
  });

  const setHtml = (content: string) => {
    win.document.open();
    win.document.write(content);
    win.document.close();
    win.focus();
  };

  socket.on('html', (content) => {
    log('received html', content);
    setHtml(content);
  });

  socket.on('reveal', () => {
    // TODO flash
  });

  const close = () => {
    log(`close`);
    setHtml('CLOSED');
    win.close();
    if (!options.debug) {
      window.close();
    }
  };

  socket.on('dispose', () => {
    close();
  });

  win.focus();

  document.addEventListener('visibilitychange', () => {
    socket.emit('visible', !document.hidden);
  });

  document.querySelector('#title .close')?.addEventListener('click', () => {
    socket.emit('dispose');
    close();
  });

  // TODO vim keybinding
};
