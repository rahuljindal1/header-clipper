import {
    MSG_GET_ALL_REQUEST_HEADERS,
    MSG_GET_REQUEST_HEADER_VALUE,
    MSG_GET_ALL_RESPONSE_TRACES,
    MSG_CLEAR,
    MSG_UPDATE_BADGE,
    MSG_DELETE_TRACE,
} from "./constants";

export interface Message {
    type:
        | typeof MSG_GET_ALL_REQUEST_HEADERS
        | typeof MSG_GET_REQUEST_HEADER_VALUE
        | typeof MSG_GET_ALL_RESPONSE_TRACES
        | typeof MSG_CLEAR
        | typeof MSG_UPDATE_BADGE
        | typeof MSG_DELETE_TRACE;
    headerName?: string;
    payload?: string;
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
    groupKey: string;
}

export interface TracesResponse {
    ok: boolean;
    data?: Trace[] | null;
    error?: string;
}

export interface ClearResponse {
    ok: boolean;
}

export interface DeleteTraceResponse {
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
