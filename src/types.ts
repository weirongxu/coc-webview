export type SocketServerEvents = {
  register: (pathname: string) => void;
  dispose: () => void;
  postMessage: (message: any) => void;
  setState: (state: any) => void;
};

export type SocketClientEvents = {
  html: (content: string) => void;
  postMessage: (message: any) => void;
  reveal: () => void;
  dispose: () => void;
};

export type StartupOptions = {
  debug: boolean;
  primaryColors: {
    dark: string;
    light: string;
  };
  url: string;
  routeName: string;
  state: any;
};

export type ColorStrategy = 'vim-background' | 'system' | 'dark' | 'light';
