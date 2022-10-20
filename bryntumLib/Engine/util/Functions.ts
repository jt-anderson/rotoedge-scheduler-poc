import { ChainedIterator, CI } from "../../ChronoGraph/collection/Iterator.js"

export const isNotNumber = (value : any) => Number(value) !== value

export const CIFromSetOrArrayOrValue = <T>(value : T | Set<T> | T[]) : ChainedIterator<T> => {
    if (value instanceof Set || value instanceof Array) return CI(value)

    return CI([ value ])
}

export const delay = (value : number) => new Promise(resolve => setTimeout(resolve, value))

export const format = (format : string, ...values) : string => {
    return format.replace(/{(\d+)}/g, (match, number) => typeof values[number] !== 'undefined' ? values[number] : match)
}

