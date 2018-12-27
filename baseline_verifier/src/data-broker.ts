import { logger } from "@dojot/dojot-module-logger";
import request = require("request");
import { Config } from "./config";
import { HttpCallback } from "./http-callback";
import { IApiReturn } from "./types";

const TAG = { filename: "data-broker"};

/**
 * Main class responsible for DeviceManager operations
 */
class DataBroker {
    public accessToken: string;
    private config: Config;

    constructor(config: Config) {
        this.config = config;
        this.accessToken = "";
    }

    public async getSocketIoToken(): Promise<string> {
        return new Promise((resolve, reject): void => {
            logger.debug("Retrieving socketio token from DataBroker...", TAG);
            const headers: request.CoreOptions = {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
            };

            const httpCallback = new HttpCallback((data: IApiReturn) => {
                // This should be a JSON already.
                resolve(JSON.parse(data.value).token);
            }, (error: IApiReturn) => {
                reject(error.msg);
            });

            const url = `${this.config.dataBroker.uri}/socketio`;
            logger.debug(`Sending request to ${url}`, TAG);
            request.get(url, headers, httpCallback.callback.bind(httpCallback));
            logger.debug("... token retrieval request was sent", TAG);
        });
    }
}

export {
    DataBroker,
};
