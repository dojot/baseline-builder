import { logger } from "@dojot/dojot-module-logger";
import * as sio from "socket.io-client";

const TAG = { filename: "socketio" };

class SocketIoClient {
  /** Server to connect */
  protected server: string;

  /** Interval between reconnections */
  protected autoReconnectInterval: number;

  /** Callback invoked when a message is received */
  protected onMessageCb?: (data: any) => void;

  private socketIo?: SocketIOClient.Socket;

  /**
   * Constructor
   * @param server The server that this websocket client will connect to
   * @param autoReconnectInterval Interval between reconnections
   */
  constructor(server: string, autoReconnectInterval: number, token?: string) {
    this.server = server;
    this.autoReconnectInterval = autoReconnectInterval;
    this.onMessageCb = undefined;
    if (token === undefined) {
      logger.debug("SocketIO was created, but it was not yet connected.", TAG);
    } else {
      this.connect(token);
      logger.debug("SocketIO was created and connected.", TAG);
    }
  }

  public connect(token: string): void {
    logger.debug(
      `Creating connection to server: ${this.server}, using token ${token}`, TAG);
    const query: SocketIOClient.ConnectOpts = {
      query: {
        token,
      },
      transports: ["polling"],
    };
    this.socketIo = sio.connect(this.server, query);
  }

  /**
   * Set the callback for received messages
   * @param onMessage The callback to be invoked when a message is received
   */
  public onMessage(onMessage: (data: any) => void) {
    this.onMessageCb = onMessage;
  }

  /**
   * Start the websocket handling
   */
  public start() {
    if (this.socketIo === undefined) {
      logger.warn("SocketIO is not yet connected. Aborting connection start.", TAG);
      return;
    }

    this.socketIo.on("all", (data: any) => {
      logger.debug("Received message", TAG);
      if (this.onMessageCb) {
        this.onMessageCb(data);
      } else {
        logger.debug("No message callback was set.", TAG);
      }
    });

    this.socketIo.on("close", (code: number) => {
      switch (code) {
        case 1000: // CLOSE_NORMAL
          logger.debug("WebSocket: closed", TAG);
          break;
        default:
          // Abnormal closure
          this.reconnect();
          break;
      }
    });

    this.socketIo.on("error", (event: any) => {
      switch (event.code) {
        case "ECONNREFUSED":
          this.reconnect();
          break;
        default:
          logger.debug("Error ws connection: " + event, TAG);
          break;
      }
    });
  }

  public stop() {
    if (this.socketIo === undefined) {
      logger.warn("SocketIO is not yet connected. Aborting connection shutdown.", TAG);
      return;
    }
    this.socketIo.disconnect();
    this.socketIo.removeAllListeners();
  }

  /**
   * Reconnect the websocket, if any error occured previously.
   */
  public reconnect() {
    logger.debug(
      `WebSocketClient: retry in ${this.autoReconnectInterval}ms`, TAG);
    if (this.socketIo) {
      this.socketIo.removeAllListeners();
      setTimeout(() => {
        logger.debug("Reconnecting...", TAG);
        this.start();
      }, this.autoReconnectInterval);
    }
  }
}

export { SocketIoClient };
