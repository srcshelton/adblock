var getLocalFileURL = function(path) {
    return require("sdk/self").data.url(path);
}
if (typeof exports !== 'undefined') exports.getLocalFileURL = getLocalFileURL;

var getLocalFileContents = function(path) {
    try {
        return require("sdk/self").data.load(path);
    } catch(e) {
        //For File Not Founds...return null
        return null;
    }
}
if (typeof exports !== 'undefined') exports.getLocalFileContents = getLocalFileContents;

var getLocaleFile = function(request) {
    var response = JSON.stringify(getLocalFileContents("_locales/" + request + "/messages.json"));
    if (!response || response.trim().length === 0) {
         var response = "{}";
    }
    return response;
}
if (typeof exports !== 'undefined') exports.getLocaleFile = getLocaleFile;

var getFirefoxManifest = function(fn) {
        var self = require("sdk/self");
        var manifest = {version:self.version, uri:self.uri, id:self.id, name:self.name};
        if (typeof fn === "function")
            fn(manifest);
        return manifest;
}
if (typeof exports !== 'undefined') exports.getFirefoxManifest = getFirefoxManifest;