/**
 * This use case is intended to test:
 *  - Publishing a message via MQTT
 *  - Checking whether it can be accessed via History service.
 *
 * In order to do that, it:
 *  - Performs login (gets an access token).
 *  - Creates a template with a single attribute.
 *  - Creates a device using that template.
 *  - Publishes a single message via MQTT.
 *  - Retrieves it from History service.
 *
 * This is executed for both admin tenant and a arbitrary one.
 *
 * The following alternative paths are considered:
 *  - Using "admin" tenant;
 *    - Publishing messages from devices that do exist;
 *    - Publishing messages from devices that doesn't exist in current tenant;
 *
 * These tests consider that all other services are working correctly.
 */

import { logger } from "@dojot/dojot-module-logger";
import { connect as mqttConnect } from "mqtt";
import * as util from "util";
import { IUser } from "../auth";
import { Config } from "../config";
import { DeviceManager, IDevice, ITemplate } from "../device-manager";
import { History } from "../history";
import { UseCase } from "./generic-use-case";

const TAG = { filename: "mqtt-publishing" };

class PublishingHistoryUseCase extends UseCase {
    private deviceManager: DeviceManager;

    constructor(config: Config) {
        super(config);
        this.deviceManager = new DeviceManager(this.config);
    }

    public getName(): string {
        return "MQTT - history use case";
    }

    public async runTest() {
        logger.debug("Running test for admin...", TAG);
        logger.debug("Retrieving an access token for admin...", TAG);
        await this.doLogin("admin", "admin");
        logger.debug("... successfully retrieved an access token for admin.", TAG);
        logger.debug("Running [mqtt publish, get history] test for admin...", TAG);
        await this.runPublishHistory("admin", "admin");
        logger.debug("... successfully ran [mqtt publish, get history] test for admin.", TAG);

        const username = "user_" + Math.round(Math.random() * 100);
        const service = "ten_" + Math.round(Math.random() * 100);
        logger.debug(`Creating new user ${username}...`, TAG);
        const user: IUser = {
            email: `${username}@test.com`,
            name: "User Mqtt Publishing Test",
            profile: "user",
            service,
            username,
        };
        const userId = await this.auth.createUser(user, this.tokens.admin);
        logger.debug(`... new user ${username} was created.`, TAG);
        logger.debug(`User ID is ${userId}`, TAG);

        logger.debug(`Retrieving token for ${username}...`, TAG);
        logger.debug(`... successfully retrieved an access token for ${username}`, TAG);
        await this.doLogin(username, "temppwd");
        logger.debug(`Running [mqtt publish, get history] test for ${username}...`, TAG);
        await this.runPublishHistory(service, username);
        logger.debug(`... successfully ran [mqtt publish, get history] test for ${username}.`, TAG);
    }

    protected async runPublishHistory(tenant: string, username: string) {
        const template: ITemplate = {
            attrs: [
                {
                    label: "attr-1",
                    type: "dynamic",
                    value_type: "string",
                },
            ],
            label: "sample-template",
        };
        this.deviceManager.accessToken = this.tokens[username];
        const createdTemplate = await this.deviceManager.createTemplate(template);
        if (createdTemplate.id === undefined) {
            return Promise.reject(`${TAG.filename} Could not create a template.`);
        }

        const device: IDevice = {
            label: "device-1",
            templates: [createdTemplate.id],
        };
        const createdDevice = await this.deviceManager.createDevice(device);
        if (createdDevice.id === undefined) {
            return Promise.reject(`${TAG.filename} Could not create a device.`);
        }
        const deviceId = createdDevice.id;

        logger.debug(`Connecting to MQTT broker ${this.config.iotAgentMqtt.uri}...`, TAG);
        const mqttClient = mqttConnect(this.config.iotAgentMqtt.uri);
        logger.debug(`... succesffullly connected MQTT client.`, TAG);
        logger.debug(`Sending MQTT messasge to ${this.config.iotAgentMqtt.uri}`, TAG);
        logger.debug(`Topic is /${tenant}/${deviceId}/attrs`, TAG);
        await new Promise((resolve, reject) => {
            mqttClient.on("connect", () => {
              resolve();
            });
            mqttClient.on("error", () => {
                reject();
            });
        });

        mqttClient.publish(`/${tenant}/${deviceId}/attrs`, `{"attr-1" : "this is a test"}`);

        const historicalData = await new Promise((resolve, reject) => {
            logger.debug("Trying to retrieve data from history service", TAG);
            logger.debug("Creating history handler...", TAG);
            const history = new History(this.config);
            history.accessToken = this.tokens[username];
            logger.debug("... history handler created and configured.", TAG);

            let counter = 0;
            const retrieveHistory = (): void => {
                logger.debug("Retrieving historical data...", TAG);
                history.getHistoryData(deviceId, {attr: "attr-1", lastN: 3}).then((data: any) => {
                    logger.debug(`Got data: ${data}`, TAG);
                    logger.debug("... historical data was retrieved.", TAG);
                    resolve(data);
                    return;
                }).catch((error: any) => {
                    logger.warn(`Could not retrieve historical data: ${util.inspect(error)}`, TAG);
                    counter++;
                    if (counter === 4) {
                        logger.error("History service do not have this information.", TAG);
                        reject(`${TAG.filename} Could not retrieve historical data for device.`);
                        return;
                    }
                    logger.debug("Trying again in 3 seconds.", TAG);
                    setTimeout(retrieveHistory, 3000);
                });
            };
            retrieveHistory();
        });

        // Data checks
        if (historicalData instanceof Array) {
            const { attr, value, device_id } = historicalData[0];
            if (attr !== "attr-1" || value !== "this is a test" || device_id !== deviceId) {
                return Promise.reject(`${TAG.filename} Historical data doesn't match input data.`);
            }
        }

        return Promise.resolve();
    }
}

export { PublishingHistoryUseCase };
