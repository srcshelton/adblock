
"use strict";

var ST = require("./stats");
// Log an 'error' message on GAB log server.
var recordErrorMessage = function(msg, callback)
{
  recordMessageWithUserID(msg, 'error', callback);
};
exports.recordErrorMessage = recordErrorMessage;

// Log an 'status' related message on GAB log server.
var recordStatusMessage = function(msg, callback)
{
  recordMessageWithUserID(msg, 'stats', callback);
};
exports.recordStatusMessage = recordStatusMessage;

// Log a 'general' message on GAB log server.
var recordGeneralMessage = function(msg, callback)
{
  recordMessageWithUserID(msg, 'general', callback);
};
exports.recordGeneralMessage = recordGeneralMessage;

// Log an 'adreport' related message on GAB log server.
var recordAdreportMessage = function(msg) {
  recordMessageWithUserID(msg, 'adreport');
};
exports.recordAdreportMessage = recordAdreportMessage;

// Log a message on GAB log server. The user's userid will be prepended to the
// message.
// If callback() is specified, call callback() after logging has completed
var recordMessageWithUserID = function(msg, queryType, callback)
{
  if (!msg || !queryType)
  {
    return;
  }

  // Include user ID in message
  var fullUrl = 'https://log.getadblock.com/record_log.php?type=' + queryType + '&message=' + encodeURIComponent(ST.STATS.userId + ' ' + msg);
  sendMessageToLogServer(fullUrl, callback);
};

// Log a message on GAB log server.
// If callback() is specified, call callback() after logging has completed
var recordAnonymousMessage = function(msg, queryType, callback)
{
  if (!msg || !queryType)
  {
    return;
  }

  // Include user ID in message
  var fullUrl = 'https://log.getadblock.com/record_log.php?type=' + queryType + '&message=' + encodeURIComponent(msg);
  sendMessageToLogServer(fullUrl, callback);
};

// Log a message on GAB log server. The user's userid will be prepended to the
// message.
// If callback() is specified, call callback() after logging has completed
var sendMessageToLogServer = function(fullUrl, callback)
{
  if (!fullUrl)
  {
    return;
  }

  const { XMLHttpRequest } = require("sdk/net/xhr");
  var xhr = new XMLHttpRequest();
  xhr.open("GET", fullUrl, true);
  xhr.setRequestHeader("Connection", "close");
  xhr.onload = function () {
      if (callback)
      {
        callback();
      }
  };
  xhr.send();
};

var sendBugReportToServer = function(report_data)
{
  if (!report_data)
  {
    return;
  }
  var Request = require("sdk/request").Request;
  var bugReportRequest = Request({
    url:  "https://getadblock.com/freshdesk/bugReport.php",
    content: report_data,
    onComplete: function (response) {
      var data = { command: "bugReportResponse", data: response.text};
      require("./port").chrome.extension.sendRequest(data);
    }
  }).post();
};
exports.sendBugReportToServer = sendBugReportToServer;

var sendAdReportToServer = function(report_data)
{
  if (!report_data)
  {
    return;
  }
  var Request = require("sdk/request").Request;
  var adReportRequest = Request({
    url:  "http://dev.getadblock.com/freshdesk/adReport.php",
    content: report_data,
    onComplete: function (response) {
      var data = { command: "adReportResponse", data: response.text};
      require("./port").chrome.extension.sendRequest(data);
    }
  }).post();
};
exports.sendAdReportToServer = sendAdReportToServer;