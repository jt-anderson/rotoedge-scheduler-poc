import { CI } from "../../ChronoGraph/collection/Iterator.js";
export const isNotNumber = (value) => Number(value) !== value;
export const CIFromSetOrArrayOrValue = (value) => {
    if (value instanceof Set || value instanceof Array)
        return CI(value);
    return CI([value]);
};
export const delay = (value) => new Promise(resolve => setTimeout(resolve, value));
export const format = (format, ...values) => {
    return format.replace(/{(\d+)}/g, (match, number) => typeof values[number] !== 'undefined' ? values[number] : match);
};
