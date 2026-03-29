export interface SandpackDebugDetail {
    event: string;
    payload: Record<string, unknown>;
}
export declare function emitDebugEvent(event: string, payload?: Record<string, unknown>): void;
