"use strict";

const webext = require("sdk/webextension");
const {setSyncLegacyDataPort} = require("./lib/user-data-storage");

exports.main = function (options, callbacks) {
    webext.startup().then(({browser}) => {
      browser.runtime.onConnect.addListener(port => {
        if (port.name === "sync-legacy-addon-data") {
          setSyncLegacyDataPort(port);
        }
      });
    });
};

exports.onUnload = function (reason) {

};