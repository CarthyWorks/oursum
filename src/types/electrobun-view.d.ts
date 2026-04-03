declare module 'electrobun/view' {
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

  type RequestClient<T extends RPCRequestMap> = {
    [K in keyof T]: (params: T[K]['params']) => Promise<T[K]['response']>;
  };

  type MessageClient<T extends RPCMessageMap> = {
    [K in keyof T]: (params: T[K]) => void;
  };

  export class Electroview {
    static defineRPC<Schema extends RPCSchemaLike>(config: {
      maxRequestTime?: number;
      handlers: {
        requests: RequestHandlerMap<Schema['webview']['requests']>;
        messages: MessageHandlerMap<Schema['webview']['messages']>;
      };
    }): {
      request: RequestClient<Schema['bun']['requests']>;
      send: MessageClient<Schema['bun']['messages']>;
    };

    constructor(options: { rpc: unknown });
  }
}