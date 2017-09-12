// Log an 'error' message on GAB log server.
var recordErrorMessage = function (msg, callback, additionalParams)
{
  // TODO - uncomment
  //recordMessageWithUserID(msg, 'error', callback, additionalParams);
};

// Log an 'status' related message on GAB log server.
var recordStatusMessage = function (msg, callback, additionalParams)
{
  // TODO - uncomment
  //recordMessageWithUserID(msg, 'stats', callback, additionalParams);
};

// Log a 'general' message on GAB log server.
var recordGeneralMessage = function (msg, callback, additionalParams)
{
  // TODO - uncomment
  //recordMessageWithUserID(msg, 'general', callback, additionalParams);
};

// Log a message on GAB log server. The user's userid will be prepended to the
// message.
// If callback() is specified, call callback() after logging has completed
var recordMessageWithUserID = function (msg, queryType, callback, additionalParams)
{
  if (!msg || !queryType)
  {
    return;
  }
  var payload = {
    "u": STATS.userId(),
    "f": STATS.flavor,
    "o": STATS.os,
    "l": determineUserLanguage(),
    "t": queryType,
  };
  if (typeof additionalparams === "object") {
    for (var prop in additionalparams) {
      payload[prop] = additionalparams[prop];
    }
  }
  var payload = {'event':  msg, 'payload': payload};
  sendMessageToLogServer(payload, callback);
};

// Log a message on GAB log server.
// If callback() is specified, call callback() after logging has completed
var recordAnonymousMessage = function (msg, queryType, callback, additionalParams)
{
  if (!msg || !queryType)
  {
    return;
  }

  // Include user ID in message
  var payload = {
    "f": STATS.flavor,
    "o": STATS.os,
    "l": determineUserLanguage(),
    "t": queryType,
  };
  if (chrome.runtime.id) {
    payload.extid = chrome.runtime.id;
  }  
  if (typeof additionalparams === "object") {
    for (var prop in additionalparams) {
      payload[prop] = additionalparams[prop];
    }
  }
  var payload = {'event':  msg, 'payload': payload};
  sendMessageToLogServer(payload, callback);
};

// Log a message on GAB log server. The user's userid will be prepended to the
// message.
// If callback() is specified, call callback() after logging has completed
var sendMessageToLogServer = function (payload, callback)
{
  $.ajax({
    jsonp: false,
    type: 'POST',
    url: "https://log.getadblock.com/v2/record_log.php",
    data: JSON.stringify(payload),
    success: function ()
    {
      if (typeof callback === "function")
      {
        callback();
      }
    },

    error: function (e)
    {
      log('message server returned error: ', e.status);
    },
  });
};
