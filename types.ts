import {
    MSG_GET_ALL_REQUEST_HEADERS,
    MSG_GET_REQUEST_HEADER_VALUE,
    MSG_GET_ALL_RESPONSE_TRACES,
    MSG_CLEAR,
} from "./constants";

export interface Message {
    type:
        | typeof MSG_GET_ALL_REQUEST_HEADERS
        | typeof MSG_GET_REQUEST_HEADER_VALUE
        | typeof MSG_GET_ALL_RESPONSE_TRACES
        | typeof MSG_CLEAR;
    headerName?: string;
}

export interface HeadersResponse {
    ok: boolean;
    data?: {
        tabId: string;
        url: string;
        headerNames: string[];
        updatedAt: number;
    } | null;
    error?: string;
}

export interface HeaderValueResponse {
    ok: boolean;
    value?: string;
    error?: string;
}

export interface Trace {
    traceId: string;
    requestId: string;
    updatedAt: number;
    operationName?: string;
    count: number;
}

export interface TracesResponse {
    ok: boolean;
    data?: Trace[] | null;
    error?: string;
}

export interface ClearResponse {
    ok: boolean;
}

export interface StoredRequestHeaders {
    tabId: string;
    url: string;
    headers: Record<string, string>;
    updatedAt: number;
}

export interface StoredResponseHeader {
    tabId: string;
    requestId: string;
    url: string;
    headers: Record<string, string>;
    updatedAt: number;
}

export interface StoredRequestPayload {
    requestId: string;
    operationName: string;
    tabId: string;
    updatedAt: number;
}
