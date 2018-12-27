/**
 * This file contains all simple type definitions used in almost every component
 */

 /**
  * API return codes
  */
enum EApiCodes {
    OK = 0,
    NOK,
}

/**
 * API return structure.
 */
interface IApiReturn {
    value?: any; // The returned value, if any.
    code: EApiCodes; // The return code.
    msg?: string; // Any text that might help to figure out what is happening.
}

export {
    EApiCodes,
    IApiReturn,
};
