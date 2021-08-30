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
  url: string;
  routeName: string;
  initState: any;
};
