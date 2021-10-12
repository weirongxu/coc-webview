import { Emitter } from 'coc.nvim';

export type Arguments<F extends (arg: any) => any> = F extends (...args: infer Args) => any ? Args : never;

export type EmitterArg<E> = E extends Emitter<infer A> ? A : never;

export interface SocketServerEvents {
  register: (pathname: string) => void;
  dispose: () => void;
  postMessage: (message: any) => void;
  setState: (state: any) => void;
  visible: (visible: boolean) => void;
}

export interface SocketClientEvents {
  title: (content: string) => void;
  iconPath: (paths: IconPaths) => void;
  html: (content: string) => void;
  postMessage: (message: any) => void;
  reveal: () => void;
  dispose: () => void;
}

export interface ServerConnectorEvents {
  register: (socketsCount: number) => void;
  unregister: (socketsCount: number) => void;
  dispose: () => void;
  postMessage: (message: any) => void;
  setState: (state: any) => void;
  visible: (visible: boolean) => void;
}

export type StartupOptions = {
  debug: boolean;
  primaryColors: {
    dark: string;
    light: string;
  };
  url: string;
  routeName: string;
  state: any;
  lightOrDarkMode: LightOrDarkMode;
};

export type IconPaths = { light: string; dark: string };

export type ColorMode = 'dark' | 'light';

export type LightOrDarkMode = ColorMode | 'system';

export type ColorStrategy = 'vim-background' | 'system' | ColorMode;
