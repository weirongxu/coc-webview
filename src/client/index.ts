import { Socket, io } from 'socket.io-client';
import { SocketClientEvents, SocketServerEvents, StartupOptions } from '../types';

// @ts-ignore
window.startup = (options: StartupOptions) => {
  const socket: Socket<SocketClientEvents, SocketServerEvents> = io(options.url, { autoConnect: true });
  const iframe = document.getElementById('main') as HTMLIFrameElement;

  const win = iframe.contentWindow;
  console.log('register', options.routeName);
  socket.emit('register', options.routeName);

  if (win) {
    let storedState = options.initState;

    win.focus();

    // @ts-ignore
    win.acquireVsCodeApi = () => {
      return {
        getState() {
          return storedState;
        },
        setState(state: any) {
          console.log('setState', state);
          storedState = state;
          socket.emit('setState', state);
        },
        postMessage(message: any) {
          console.log('postMessage', message);
          socket.emit('postMessage', message);
        },
      };
    };

    const setHtml = (content: string) => {
      win.document.open();
      win.document.write(content);
      win.document.close();
    };

    document.querySelector('#title .close')?.addEventListener('click', () => {
      console.log('close');
      setHtml('CLOSED');
      socket.emit('dispose');
    });

    socket.on('postMessage', (message) => {
      console.log('received postMessage', message);
      win.postMessage(message, '*');
    });

    socket.on('html', (content) => {
      console.log('received html', content);
      setHtml(content);
    });

    socket.on('reveal', () => {
      // TODO flash
    });

    // TODO vim keybinding
  }
};
