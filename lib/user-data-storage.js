const ss = require("sdk/simple-storage");

var getStorageValue = function (key) {
    var json = require("sdk/simple-storage").storage[key];
    if (json == null)
        return undefined;
    try {
        return JSON.parse(json);
    } catch (e) {
        log("Couldn't parse json for " + key);
        return undefined;
    }
};

exports.setSyncLegacyDataPort = function(port) {
  // Send the initial data dump.
  var storageData = {};
  if (ss.storage.userid) {
    storageData.userid = getStorageValue("userid");
    delete ss.storage.userid;
  }
  if (ss.storage.total_pings) {
    storageData.total_pings = getStorageValue("total_pings");
    delete ss.storage.total_pings;
  }
  if (ss.storage.blockage_stats) {
    storageData.blockage_stats = getStorageValue("blockage_stats");
    delete ss.storage.blockage_stats;
  }
  if (ss.storage.next_ping_time) {
    storageData.next_ping_time = getStorageValue("next_ping_time");
    delete ss.storage.next_ping_time;
  }
  if (ss.storage.settings) {
    storageData.settings = getStorageValue("settings");
    delete ss.storage.settings;
  }
  if (ss.storage.filter_lists) {
    storageData.filter_lists = getStorageValue("filter_lists");
    delete ss.storage.filter_lists;
  }
  if (ss.storage.last_subscriptions_check) {
    storageData.last_subscriptions_check = getStorageValue("last_subscriptions_check");
    delete ss.storage.last_subscriptions_check;
  }
  if (ss.storage["malware-notification"]) {
    storageData["malware-notification"] = getStorageValue("malware-notification");
    delete ss.storage["malware-notification"];
  }
  if (ss.storage.custom_filters) {
    storageData.custom_filters = getStorageValue("custom_filters");
    delete ss.storage.custom_filters;
  }
  if (ss.storage.custom_filter_count) {
    storageData.custom_filter_count = getStorageValue("custom_filter_count");
    delete ss.storage.custom_filter_count;
  }
  if (ss.storage.exclude_filters) {
    storageData.exclude_filters = getStorageValue("exclude_filters");
    delete ss.storage.exclude_filters;
  }
  if (Object.keys(storageData).length) {
    port.postMessage({
      storage: storageData
    });    
  } else {
    port.postMessage({
      init: true
    });    
  }
};