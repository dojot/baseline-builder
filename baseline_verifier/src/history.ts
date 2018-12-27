import { logger } from "@dojot/dojot-module-logger";
import request = require("request");
import { Config } from "./config";
import { DeviceId } from "./device-manager";
import { HttpCallback } from "./http-callback";
import { IApiReturn } from "./types";

const TAG = { filename: "history"};

/**
 * Main class responsible for History operations
 */
class History {
    public accessToken: string;
    private config: Config;

    constructor(config: Config) {
        this.config = config;
        this.accessToken = "";
    }

    public async getHistoryData(deviceId: DeviceId, qs: any) {
        return new Promise((resolve, reject): void => {
            logger.debug("Send historical data request to History...", TAG);
            const headers: request.CoreOptions = {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
                qs,
            };

            const httpCallback = new HttpCallback((data: IApiReturn) => {
                resolve(data.value);
            }, (error: IApiReturn) => {
                reject(error);
            });

            logger.debug(`Sending request to ${this.config.history.uri}/device/${deviceId}/history`, TAG);
            request.get(`${this.config.history.uri}/device/${deviceId}/history`, headers,
                httpCallback.callback.bind(httpCallback));
            logger.debug("... historical data request was sent", TAG);
        });
    }
}

export {
    History,
};
