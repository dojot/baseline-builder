/**
 * Interface for dojot service
 */
interface IService {
    /**
     * Service URL, such as http://device-manager:5000
     */
    uri: string;
    /**
     * If used, which REDIS instance is related to this service.
     */
    redis?: string;

}

/**
 * Main configuratin class used in this project.
 */
class Config {
    public dataBroker: IService;
    public iotAgentMqtt: IService;
    public auth: IService;
    public deviceManager: IService;
    public history: IService;
    public socketIoTimeout: number;

    constructor(dataBroker: IService,
                iotAgentMqtt: IService,
                auth: IService,
                deviceManager: IService,
                history: IService,
                sioTimeout: number) {
        this.dataBroker = dataBroker;
        this.iotAgentMqtt = iotAgentMqtt;
        this.auth = auth;
        this.deviceManager = deviceManager;
        this.history = history;
        this.socketIoTimeout = sioTimeout;
    }
}

export {
    Config,
    IService,
};
