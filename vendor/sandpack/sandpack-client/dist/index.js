'use strict';

var utils = require('./utils-5d2e6c36.js');
var debug = require('./debug-7adae006.js');
require('outvariant');

function loadSandpackClient(iframeSelector, sandboxSetup, options) {
    var _a;
    if (options === void 0) { options = {}; }
    return utils.__awaiter(this, void 0, void 0, function () {
        var template, Client, _b, client;
        return utils.__generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    template = (_a = sandboxSetup.template) !== null && _a !== void 0 ? _a : "parcel";
                    debug.emitDebugEvent("client:load:start", {
                        template: template,
                        fileCount: Object.keys(sandboxSetup.files).length,
                        startRoute: options.startRoute,
                    });
                    _b = template;
                    switch (_b) {
                        case "node": return [3 /*break*/, 1];
                        case "static": return [3 /*break*/, 3];
                    }
                    return [3 /*break*/, 5];
                case 1: return [4 /*yield*/, Promise.resolve().then(function () { return require('./clients/node/index.js'); }).then(function (m) { return m.SandpackNode; })];
                case 2:
                    Client = _c.sent();
                    return [3 /*break*/, 7];
                case 3: return [4 /*yield*/, Promise.resolve().then(function () { return require('./index-5796fa85.js'); }).then(function (m) { return m.SandpackStatic; })];
                case 4:
                    Client = _c.sent();
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, Promise.resolve().then(function () { return require('./clients/runtime/index.js'); }).then(function (m) { return m.SandpackRuntime; })];
                case 6:
                    Client = _c.sent();
                    _c.label = 7;
                case 7:
                    client = new Client(iframeSelector, sandboxSetup, options);
                    debug.emitDebugEvent("client:load:ready", {
                        template: template,
                        status: client.status,
                    });
                    return [2 /*return*/, client];
            }
        });
    });
}

Object.defineProperty(exports, 'SandpackLogLevel', {
    enumerable: true,
    get: function () { return utils.SandpackLogLevel; }
});
exports.addPackageJSONIfNeeded = utils.addPackageJSONIfNeeded;
exports.createError = utils.createError;
exports.createPackageJSON = utils.createPackageJSON;
exports.extractErrorDetails = utils.extractErrorDetails;
exports.normalizePath = utils.normalizePath;
exports.nullthrows = utils.nullthrows;
exports.loadSandpackClient = loadSandpackClient;
