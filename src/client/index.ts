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

  // acquireVsCodeApi
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

  // register
  socket.on('connect', () => {
    log(`register`);
    socket.emit('register', routeName);
  });

  // postMessage
  socket.on('postMessage', (message) => {
    log('received postMessage', message);
    win.postMessage(message, '*');
  });

  // update title
  let title = document.title;
  socket.on('title', (content) => {
    log('received title', content);
    title = content;
    const titleDom = document.querySelector('#title h1');
    if (titleDom) titleDom.textContent = content;
    document.title = content;
  });

  // update html
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

  // reveal
  const revealCover = document.getElementById('reveal-cover') as HTMLDivElement;
  revealCover.addEventListener('transitionend', () => {
    console.log('transitionend');
    revealCover.style.background = '';
  });
  const titleFlasher = {
    timer: undefined as NodeJS.Timer | undefined,
    start() {
      let reveal = true;
      titleFlasher.timer = setInterval(() => {
        document.title = reveal ? `[REVEAL] ${title}` : title;
        reveal = !reveal;
      }, 500);
    },
    stop() {
      if (titleFlasher.timer) {
        clearInterval(titleFlasher.timer);
        titleFlasher.timer = undefined;
        document.title = title;
      }
    },
  };
  socket.on('reveal', () => {
    if (!visible) {
      titleFlasher.start();
    }

    const flashTimes = 2;
    const intervalTime = 0.6;
    revealCover.style.transition = `background ${intervalTime / 2}s`;
    revealCover.style.display = 'block';

    for (let i = 0; i < flashTimes; i++) {
      setTimeout(() => {
        revealCover.style.background = 'rgba(0,0,0, 0.7)';
      }, i * intervalTime * 1000);
    }

    setTimeout(() => {
      revealCover.style.display = 'none';
      revealCover.style.background = '';
    }, flashTimes * intervalTime * 1000);
  });

  socket.on('disconnect', () => {
    titleFlasher.stop();
  });

  // user close
  const close = () => {
    log(`close`);
    setHtml('CLOSED');
    win.close();
    if (!options.debug) {
      window.close();
    }
  };

  // dispose from vim
  socket.on('dispose', () => {
    titleFlasher.stop();
    close();
  });

  win.focus();

  let visible = true;
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) {
      titleFlasher.stop();
    }
    socket.emit('visible', visible);
  });

  document.querySelector('#title .close')?.addEventListener('click', () => {
    socket.emit('dispose');
    close();
  });

  // TODO vim keybinding
};
