function emitDebugEvent(event, payload) {
    if (payload === void 0) { payload = {}; }
    if (typeof window === "undefined") {
        return;
    }
    var debugWindow = window;
    if (!debugWindow.__SANDPACK_DEBUG__) {
        return;
    }
    debugWindow.dispatchEvent(new CustomEvent("sandpack-debug", {
        detail: { event: event, payload: payload },
    }));
}

export { emitDebugEvent as e };
