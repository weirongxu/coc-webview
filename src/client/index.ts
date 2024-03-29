import { Socket, io } from 'socket.io-client';
import { ColorMode, IconPaths, ReadyContext, SocketClientEvents, SocketServerEvents, StartupOptions } from '../types';

// @ts-ignore
window.startup = async (options: StartupOptions) => {
  const { routeName } = options;
  const iframe = document.getElementById('main') as HTMLIFrameElement;

  const win = iframe.contentWindow;
  if (!win) {
    return;
  }

  function log(...args: any[]) {
    // eslint-disable-next-line no-console
    console.log(`[${routeName}][socket ${socket.id}]`, ...args);
  }

  const socket: Socket<SocketClientEvents, SocketServerEvents> = io(options.url, { autoConnect: true });

  let storedState = options.state;
  let context: ReadyContext | undefined;

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

  // ready context
  socket.on('ready', (ctx) => {
    log('ready');
    context = ctx;
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
    const titleDom = document.querySelector('#title-content');
    if (titleDom) titleDom.textContent = content;
    document.title = content;
  });

  // update iconPath
  const colorMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let systemColorMode: ColorMode = colorMediaQuery.matches ? 'dark' : 'light';
  colorMediaQuery.addEventListener('change', (e) => {
    systemColorMode = e.matches ? 'dark' : 'light';
    setIconPath(systemColorMode);
  });
  let iconPaths: IconPaths | undefined;
  const setIconPath = (mode: ColorMode) => {
    if (!iconPaths) return;

    const titleIconDom: HTMLImageElement | null = document.querySelector('#title-img');
    if (titleIconDom) titleIconDom.src = iconPaths[mode];
  };
  socket.on('iconPath', (paths) => {
    log('received iconPath', paths);
    iconPaths = paths;
    setIconPath(options.lightOrDarkMode === 'system' ? systemColorMode : options.lightOrDarkMode);
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
    log('transitionend');
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

  // file.path
  // @ts-ignore
  Object.defineProperty(win.File.prototype, 'path', {
    enumerable: false,
    get() {
      if (!context) {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const file: File = this;
      const arr = new Uint8Array(8);
      const randomInt8Arr = crypto.getRandomValues(arr);
      const randomId = Array.from(randomInt8Arr, (i8) => i8.toString(16)).join('');
      const fullpath = `${context.tmpdir}${randomId}/${file.name}`;
      socket.emit('tmpFile', fullpath, new Blob([file]) as unknown as Buffer);
      return fullpath;
    },
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

  // close webview
  document.querySelector('#title .close')?.addEventListener('click', () => {
    socket.emit('dispose');
    close();
  });

  // menu for title panel
  const menuList = document.querySelector('#title .menu-list') as HTMLUListElement;
  if (menuList) {
    menuList.innerHTML = `
      <li><a data-action="print">Print</a></li>
    `;
    menuList.addEventListener('click', (event) => {
      const link = event.target as HTMLAnchorElement;
      const action = link.dataset.action;
      switch (action) {
        case 'print':
          win.print();
          break;
      }
    });
  }

  // TODO vim keybinding
};
