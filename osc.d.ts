declare module 'osc' {
    import { EventEmitter } from 'events';
  
    export interface OSCMessage {
      address: string;
      args?: any[];
    }
  
    export class UDPPort extends EventEmitter {
      constructor(options?: {
        localAddress?: string;
        localPort?: number;
        remoteAddress?: string;
        remotePort?: number;
      });
  
      open(): void;
      close(): void;
      send(message: OSCMessage): void;
    }
  }
  