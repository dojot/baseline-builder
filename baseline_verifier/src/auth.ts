import { logger } from "@dojot/dojot-module-logger";
import * as request from "request";
import { Config } from "./config";
import { HttpCallback } from "./http-callback";
import { IApiReturn } from "./types";

const TAG = { filename: "auth" };

type UserId = string;

interface IUser {
    username: string;
    service: string;
    email: string;
    name: string;
    profile: string;
}

/**
 * Class responsible for all authentication procedures in dojot.
 */
class Auth {
    private config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    /**
     * Get an access token for a particular user.
     *
     * @param username The user name
     * @param password The password
     * @returns Promise with the token, if everything is OK with username and
     * password. If anything goes wrong, then it will be set properly.
     */
    public getToken(username: string, password: string): Promise<string> {
        return new Promise((resolve, reject): void => {
            logger.debug("Sending token request...", TAG);
            const headers: request.CoreOptions = {
                json: {
                    passwd: password,
                    username,
                },
            };

            logger.debug(`Sending request to ${this.config.auth.uri}`, TAG);
            const httpCallback = new HttpCallback((data: IApiReturn) => {
                resolve(data.value.jwt);
            }, (error: IApiReturn) => {
                reject(error.msg);
            });
            request.post(`${this.config.auth.uri}`, headers, httpCallback.callback.bind(httpCallback));

            logger.debug("... token request was sent", TAG);
        });
    }

    public createUser(user: IUser, adminToken: string): Promise<UserId> {
        return new Promise((resolve, reject): void => {
            logger.debug("Sending user creation request...", TAG);
            const headers: request.CoreOptions = {
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                },
                json: user,
            };

            logger.debug(`Sending request to ${this.config.auth.uri}/user`, TAG);
            const httpCallback = new HttpCallback((data: IApiReturn) => {
                resolve(data.value[0].user.id);
            }, (error: IApiReturn) => {
                reject(error.msg);
            });
            request.post(`${this.config.auth.uri}/user`, headers, httpCallback.callback.bind(httpCallback));

            logger.debug("... user creation request request was sent", TAG);
        });
    }
}

export {
    Auth,
    IUser,
    UserId,
};
