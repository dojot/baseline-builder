/**
 * This is a generic class to be extended by use cases.
 */
import { logger } from "@dojot/dojot-module-logger";
import { Auth } from "../auth";
import { Config } from "../config";

const TAG = { filename: "generic-usecase" };

class UseCase {
    protected auth: Auth;
    protected config: Config;

    // Map of access tokens used in a particular use case.
    protected tokens: {
      [tenant: string]: string;
    };

    constructor(config: Config) {
        this.config = config;
        this.tokens = {};
        this.auth = new Auth(this.config);
    }

    public getName(): string {
        return "Generic use-case.";
    }

    public async doLogin(username: string, password: string) {
        if (!(username in this.tokens)) {
            this.tokens[username] = await this.auth.getToken(username, password);
        }
        logger.debug(`Got token for ${username}: ${this.tokens[username]}`, TAG);
    }

    public async runTest() {
        logger.error("Not implemented", TAG);
        throw Error("Not implemented.");
    }
}

export {
    UseCase,
};
