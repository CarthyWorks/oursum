declare module 'electrobun/bun' {
  type RPCRequestMap = Record<string, { params: unknown; response: unknown }>;
  type RPCMessageMap = Record<string, unknown>;

  type RPCSchemaLike = {
    bun: { requests: RPCRequestMap; messages: RPCMessageMap };
    webview: { requests: RPCRequestMap; messages: RPCMessageMap };
  };

  type RequestHandlerMap<T extends RPCRequestMap> = Partial<{
    [K in keyof T]: (params: T[K]['params']) => T[K]['response'] | Promise<T[K]['response']>;
  }>;

  type MessageHandlerMap<T extends RPCMessageMap> = Partial<{
    [K in keyof T]: (params: T[K]) => void | Promise<void>;
  }>;

  export interface BrowserWindowOptions {
    title: string;
    url: string;
    rpc?: unknown;
    frame?: {
      width?: number;
      height?: number;
      x?: number;
      y?: number;
    };
    titleBarStyle?: string;
  }

  export class BrowserWindow {
    static getById(id: string | number): BrowserWindow | undefined;

    id: string | number;

    constructor(options: BrowserWindowOptions);

    on(event: 'close', handler: () => void): void;
    close(): void;
    focus(): void;
    isMinimized(): boolean;
    unminimize(): void;
    isMaximized(): boolean;
    maximize(): void;
    unmaximize(): void;
  }

  export class BrowserView {
    static defineRPC<Schema extends RPCSchemaLike>(config: {
      handlers: {
        requests: RequestHandlerMap<Schema['bun']['requests']>;
        messages: MessageHandlerMap<Schema['bun']['messages']>;
      };
      maxRequestTime?: number;
    }): unknown;
  }

  export const Utils: {
    openFileDialog(options: {
      canChooseDirectory?: boolean;
      canChooseFiles?: boolean;
      allowsMultipleSelection?: boolean;
    }): Promise<string[]>;
    openPath(path: string): boolean;
    quit(): void;
  };

  export const ApplicationMenu: {
    on(event: 'application-menu-clicked', handler: (event: unknown) => void): void;
    setApplicationMenu(menu: unknown[]): void;
  };

  export const Updater: {
    localInfo: {
      channel(): Promise<string>;
    };
  };
}