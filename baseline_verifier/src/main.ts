import { logger } from "@dojot/dojot-module-logger";
import { Config, IService } from "./config";
import { PublishingHistoryUseCase } from "./use-cases/publishing-history";
import { MqttSocketIoUseCase } from "./use-cases/publishing-socketio";

const TAG = { filename: "main" };

async function main() {
    const dataBroker: IService = {
        uri: `http://${process.env.DATA_BROKER_HOST}`,
    };

    const mqttIotAgent: IService = {
        uri: `mqtt://${process.env.IOTAGENT_MQTT_HOST}`,
    };

    const authService: IService = {
        uri: `http://${process.env.AUTH_HOST}:5000`,
    };

    const deviceManagerService: IService = {
        uri: `http://${process.env.DEVICE_MANAGER_HOST}:5000`,
    };
    const history: IService = {
        uri: `http://${process.env.HISTORY_HOST}:8000`,
    };

    const config = new Config(dataBroker,
        mqttIotAgent,
        authService,
        deviceManagerService,
        history,
        5000);

    const tests = [
        (new PublishingHistoryUseCase(config)),
        (new MqttSocketIoUseCase(config)),
    ];

    for (const p of tests) {
        logger.info(`Running test ${p.getName()}`, TAG);
        await p.runTest();
    }
}

main().then(() => {
    logger.debug("All tests ran successfully.", TAG);
    process.exit(0);
}).catch((error: string) => {
    logger.warn("Not all tests ran successfully", TAG);
    logger.warn(`Error message is: ${error}`, TAG);
    process.exit(1);
});
