import { logger } from "@dojot/dojot-module-logger";
import request = require("request");
import { Config } from "./config";
import { HttpCallback } from "./http-callback";
import { IApiReturn } from "./types";

const TAG = { filename: "device-manager"};

type DeviceId = string;
type TemplateId = string;

interface ICommonAttribute {
    label: string;
    type: string;
    value_type: string;
    id?: DeviceId;
    static_value?: string;
    created?: string;
    template_id?: string;
}

interface ITemplate {
    label: string;
    attrs: ICommonAttribute[];
    id?: TemplateId;
}

interface IDevice {
    templates: TemplateId[];
    label: string;
    attrs?: ICommonAttribute[];
    id?: DeviceId;
}

/**
 * Main class responsible for DeviceManager operations
 */
class DeviceManager {
    public accessToken: string;
    private config: Config;

    constructor(config: Config) {
        this.config = config;
        this.accessToken = "";
    }

    public createTemplate(template: ITemplate): Promise<ITemplate> {
        return new Promise((resolve, reject): void => {
            logger.debug("Sending template creation request to DeviceManager...", TAG);
            const headers: request.CoreOptions = {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
                json: template,
            };

            const httpCallback = new HttpCallback((data: IApiReturn) => {
                resolve(data.value.template);
            }, (error: IApiReturn) => {
                reject(error.msg);
            });

            logger.debug(`Sending request to ${this.config.deviceManager.uri}/template`, TAG);
            request.post(`${this.config.deviceManager.uri}/template`, headers,
                    httpCallback.callback.bind(httpCallback));
            logger.debug("... template creation request was sent", TAG);
        });
    }

    public createDevice(device: IDevice): Promise<IDevice> {
        return new Promise((resolve, reject): void => {
            logger.debug("Sending device creation request to DeviceManager...", TAG);
            const headers: request.CoreOptions = {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
                json: device,
            };

            const httpCallback = new HttpCallback((data: IApiReturn) => {
                resolve(data.value.devices[0]);
            }, (error: IApiReturn) => {
                reject(error.msg);
            });

            logger.debug(`Sending request to ${this.config.deviceManager.uri}/device`, TAG);
            request.post(`${this.config.deviceManager.uri}/device`, headers,
                    httpCallback.callback.bind(httpCallback));
            logger.debug("... device creation request was sent", TAG);
        });
    }
}

export {
    DeviceId,
    DeviceManager,
    ICommonAttribute,
    IDevice,
    ITemplate,
    TemplateId,
};
