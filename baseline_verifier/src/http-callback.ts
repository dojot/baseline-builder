import { logger } from "@dojot/dojot-module-logger";
import request = require("request");
import * as util from "util";
import { EApiCodes, IApiReturn } from "./types";
type PromiseCallback = (data: IApiReturn) => void;

const TAG = { filename: "http-dispatcher" };

class HttpCallback {
    private resolve: PromiseCallback;
    private reject: PromiseCallback;

    constructor(resolve: PromiseCallback, reject: PromiseCallback) {
        this.resolve = resolve;
        this.reject = reject;
    }

    public callback(error: any, response: request.Response, body: any) {
        logger.debug("Processing results...", TAG);
        const ret: IApiReturn = {
            code: EApiCodes.OK,
        };
        logger.debug(`Status code is ${response.statusCode}.`, TAG);
        if (response.statusCode === 200) {
            logger.debug("... data was succesffully retrieved.", TAG);
            ret.value = body;
            this.resolve(ret);
        } else {
            ret.code = EApiCodes.NOK;
            ret.msg = `${error}. Data is ${util.inspect(body)}`;
            logger.debug("... data was not succesffully retrieved.", TAG);
            logger.warn(`Error while retrieving data: ${error}.`, TAG);
            this.reject(ret);
        }
    }
}

export {
    HttpCallback,
    PromiseCallback,
};
