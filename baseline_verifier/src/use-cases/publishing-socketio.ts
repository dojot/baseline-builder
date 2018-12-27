/**
 * This use case is intended to test:
 *  - Publishing a message via MQTT
 *  - Checking whether it is received via SocketIO connection.
 *
 * In order to do that, it:
 *  - Performs login (gets an access token).
 *  - Creates a template with a single attribute.
 *  - Creates a device using that template.
 *  - Start listening messages via SocketIO.
 *  - Publishes a single message via MQTT.
 *  - Checks whether the message was received or not.
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
import { DataBroker } from "../data-broker";
import { DeviceManager, IDevice, ITemplate } from "../device-manager";
import { SocketIoClient } from "../socketio-client";
import * as tools from "../tools";
import { UseCase } from "./generic-use-case";

const TAG = { filename: "mqtt-socketio" };

class MqttSocketIoUseCase extends UseCase {
    private deviceManager: DeviceManager;
    private timeout: number;
    private socketIo: SocketIoClient;
    constructor(config: Config) {
        super(config);
        this.timeout = config.socketIoTimeout;
        this.deviceManager = new DeviceManager(this.config);
        this.socketIo = new SocketIoClient(this.config.dataBroker.uri, 10);
    }

    public getName(): string {
        return "MQTT - socket io use case";
    }

    public async runTest() {
        logger.debug("Running test for admin...", TAG);
        logger.debug("Retrieving an access token for admin...", TAG);
        await this.doLogin("admin", "admin");
        logger.debug("... successfully retrieved an access token for admin.", TAG);
        logger.debug("Running [mqtt publish, get history] test for admin...", TAG);
        await this.runPublishSocketIo("admin", "admin");
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
        await this.runPublishSocketIo(service, username);
        logger.debug(`... successfully ran [mqtt publish, get history] test for ${username}.`, TAG);
    }

    protected async runPublishSocketIo(tenant: string, username: string) {

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
            return Promise.reject("could not create template");
        }

        const device: IDevice = {
            label: "device-1",
            templates: [createdTemplate.id],
        };
        const createdDevice = await this.deviceManager.createDevice(device);
        if (createdDevice.id === undefined) {
            return Promise.reject("could not create the device");
        }
        const deviceid = createdDevice.id;

        // Create socket io connection
        const dataBroker = new DataBroker(this.config);
        dataBroker.accessToken = this.tokens[username];
        const socketIoToken = await dataBroker.getSocketIoToken();
        this.socketIo.connect(socketIoToken);
        const expectedMessage = {
            attrs: {
                attr: "this is a test",
            },
            metadata: {
                deviceid,
                tenant,
            },
        };
        const receivalPromise = new Promise<string>((resolve, reject): void => {
            this.socketIo.onMessage((data: any) => {
                logger.debug("Removing timestamp from received message...", TAG);
                // This must also be considered. It is not now because of bugs.
                const {timestamp, ... others} = data;
                logger.debug(`Received data: ${util.inspect(others)}`, TAG);
                logger.debug(`Expecting ${util.inspect(expectedMessage)}`, TAG);
                if (tools.matches(others, expectedMessage)) {
                    resolve();
                } else {
                    reject(`${TAG.filename} Received a message different than expected.`);
                }
                this.socketIo.stop();
                return;
            });
            setTimeout(() => {
                reject(`${TAG.filename} No message received within ${this.timeout}ms`);
                this.socketIo.stop();
                return;
            }, this.timeout);
        });
        this.socketIo.start();

        // Send a message via mqtt
        logger.debug(`Connecting to MQTT broker ${this.config.iotAgentMqtt.uri}...`, TAG);
        const mqttClient = mqttConnect(this.config.iotAgentMqtt.uri);
        logger.debug(`... succesffullly connected MQTT client.`, TAG);
        logger.debug(`Sending MQTT messasge to ${this.config.iotAgentMqtt.uri}`, TAG);
        logger.debug(`Topic is /${tenant}/${deviceid}/attrs`, TAG);
        await new Promise((resolve, reject) => {
            mqttClient.on("connect", () => {
              resolve();
            });
            mqttClient.on("error", () => {
                reject();
            });
        });

        mqttClient.publish(`/${tenant}/${deviceid}/attrs`, `{"attr" : "this is a test"}`);

        // Check whether message was received via socketio
        return receivalPromise;
    }
}

export { MqttSocketIoUseCase };
