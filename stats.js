'use strict';

// Allows interaction with the server to track install rate
// and log messages.

var STATS = (function () {

  var userIDStorageKey = 'userid';
  var totalPingStorageKey = 'total_pings';
  var nextPingTimeStorageKey = 'next_ping_time';

  var statsUrl = 'https://ping.getadblock.com/stats/';

  var FiftyFiveMinutes = 3300000;

  var dataCorrupt = false;

  //Get some information about the version, os, and browser
  var version = chrome.runtime.getManifest().version;
  var match = navigator.userAgent.match(/(CrOS\ \w+|Windows\ NT|Mac\ OS\ X|Linux)\ ([\d\._]+)?/);
  var os = (match || [])[1] || 'Unknown';
  var osVersion = (match || [])[2] || 'Unknown';
  var flavor = 'M';
  match = navigator.userAgent.match(/(?:Edge|Version)\/([\d\.]+)/);
  var browserVersion = (match || [])[1] || 'Unknown';

  var firstRun = false;

  var userID;

  // Inputs: key:string.
  // Returns value if key exists, else undefined.
  var storage_get = function (key) {
    var store = localStorage;
    if (store === undefined) {
      return undefined;
    }

    var json = store.getItem(key);
    if (json == null)
      return undefined;
    try {
      return JSON.parse(json);
    } catch (e) {
      log("Couldn't parse json for " + key);
      return undefined;
    }
  };

  // Inputs: key:string, value:object.
  // Note: this is stats specific storage_set_stats that allows us
  // to capture any exception, and set the dataCorruption indicator
  // If value === undefined, removes key from storage.
  // Returns undefined.
  var storage_set_stats = function (key, value) {
    var store = localStorage;
    if (value === undefined) {
      store.removeItem(key);
      return;
    }

    try {
      store.setItem(key, JSON.stringify(value));
    } catch (ex) {
      dataCorrupt = true;
    }
  };

  var chrome_storage_set = function (key, value, callback) {
    if (value === undefined) {
      chrome.storage.local.removeItem(key);
      return;
    }

    var saveData = {};
    saveData[key] = value;
    chrome.storage.local.set(saveData, callback);
  };

  var determineTotalPingCount = function (response) {
      var localTotalPings = storage_get(STATS.totalPingStorageKey);
      localTotalPings = isNaN(localTotalPings) ? 0 : localTotalPings;
      var totalPings = response[STATS.totalPingStorageKey];
      totalPings = isNaN(totalPings) ? 0 : totalPings;
      return Math.max(localTotalPings, totalPings);
    };

  // Give the user a userid if they don't have one yet.
  var checkUserId = function ()
  {
    var userIDPromise = new Promise(function (resolve)
    {
      chrome.storage.local.get(STATS.userIDStorageKey, function (response)
      {
        var localuserid = storage_get(STATS.userIDStorageKey);
        if (!response[STATS.userIDStorageKey] && !localuserid)
        {
          STATS.firstRun = true;
          var timeSuffix = (Date.now()) % 1e8; // 8 digits from end of timestamp
          var alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
          var result = [];
          for (var i = 0; i < 8; i++)
          {
            var choice = Math.floor(Math.random() * alphabet.length);
            result.push(alphabet[choice]);
          }

          userID = result.join('') + timeSuffix;

          // store in redudant locations
          chrome_storage_set(STATS.userIDStorageKey, userID);
          storage_set_stats(STATS.userIDStorageKey, userID);
        } else
        {
          userID = response[STATS.userIDStorageKey] || localuserid;
          if (!response[STATS.userIDStorageKey] && localuserid)
          {
            chrome_storage_set(STATS.userIDStorageKey, userID);
          }

          if (response[STATS.userIDStorageKey] && !localuserid)
          {
            storage_set_stats(STATS.userIDStorageKey, userID);
          }
        }

        resolve(userID);
      });
    });

    return userIDPromise;
  };

  var getPingData = function (callbackFN)
  {
    if (!callbackFN && (typeof callbackFN !== 'function'))
    {
      return;
    }

    chrome.storage.local.get(STATS.totalPingStorageKey, function (response)
    {
      var totalPings = determineTotalPingCount(response);
      var data = {
        u: userID,
        v: version,
        f: flavor,
        o: os,
        bv: browserVersion,
        ov: osVersion,
        ad: getSettings().show_advanced_options ? '1' : '0',
        l: determineUserLanguage(),
        st: SURVEY.types(),
        pc: totalPings,
        cb: '0',
      };
      if (blockCounts &&
          typeof blockCounts.get === 'function') {
        var bc = blockCounts.get();
        data.b = bc.total;
        data.mt = bc.malware_total;
      }

      if (chrome.runtime.id) {
        data.extid = chrome.runtime.id;
      }

      var subs = get_subscriptions_minus_text();
      if (subs && subs.acceptable_ads) {
        data.aa = subs.acceptable_ads.subscribed ? '1' : '0';
      } else {
        data.aa = 'u';
      }

      data.dc = dataCorrupt ? '1' : '0';
      callbackFN(data);
    });
  };

  // Tell the server we exist.
  var pingNow = function ()
  {
    getPingData(function (data)
    {
      if (!data.u)
      {
        return;
      }

      // attempt to stop users that are pinging us 'a lot'
      // by checking the current ping count,
      // if the ping count is above a theshold,
      // then only ping 'occasionally'
      if (data.pc > 5000)
      {
        if (data.pc > 5000 && data.pc < 100000 && ((data.pc % 5000) !== 0))
        {
          return;
        }

        if (data.pc >= 100000 && ((data.pc % 50000) !== 0))
        {
          return;
        }
      }

      data.cmd = 'ping';
      var ajaxOptions = {
        type: 'POST',
        url: statsUrl,
        data: data,
        success: handlePingResponse, // TODO: Remove when we no longer do a/b

        // tests
        error: function (e)
        {
          console.log('Ping returned error: ', e.status);
        },
      };
      if (chrome.management && chrome.management.getSelf)
      {
        chrome.management.getSelf(function (info)
        {
          data.it = info.installType.charAt(0);
          $.ajax(ajaxOptions);
        });
      } else
      {
        $.ajax(ajaxOptions);
      }
    });
  };

  var handlePingResponse = function (responseData, textStatus, jqXHR) {
    SURVEY.maybeSurvey(responseData);
  };

  // Called just after we ping the server, to schedule our next ping.
  var scheduleNextPing = function ()
  {
    chrome.storage.local.get(STATS.totalPingStorageKey, function (response)
    {
      var totalPings = determineTotalPingCount(response);
      totalPings += 1;

      // store in redudant locations
      chrome_storage_set(STATS.totalPingStorageKey, totalPings, function ()
      {
        if (chrome.runtime.lastError)
        {
          dataCorrupt = true;
        }
      });

      storage_set_stats(STATS.totalPingStorageKey, totalPings);

      var delayHours;
      if (totalPings == 1) // Ping one hour after install
        delayHours = 1;
      else if (totalPings < 9) // Then every day for a week
        delayHours = 24;
      else
        delayHours = 24 * 7; // Then weekly forever

      var millis = 1000 * 60 * 60 * delayHours;
      var nextPingTime = Date.now() + millis;

      // store in redudant location
      chrome_storage_set(STATS.nextPingTimeStorageKey, nextPingTime, function ()
      {
        if (chrome.runtime.lastError)
        {
          dataCorrupt = true;
        }
      });

      storage_set_stats(STATS.nextPingTimeStorageKey, nextPingTime);
    });
  };

  // Return the number of milliseconds until the next scheduled ping.
  var millisTillNextPing = function (callbackFN)
  {
    if (!callbackFN || (typeof callbackFN !== 'function'))
    {
      return;
    }

    // If we've detected data corruption issues,
    // then default to a 55 minute ping interval
    if (dataCorrupt)
    {
      callbackFN(FiftyFiveMinutes);
      return;
    }

    // Wait 10 seconds to allow the previous 'set' to finish
    window.setTimeout(function ()
    {
      chrome.storage.local.get(STATS.nextPingTimeStorageKey, function (response)
      {
        var localNextPingTime = storage_get(STATS.nextPingTimeStorageKey);
        localNextPingTime = isNaN(localNextPingTime) ? 0 : localNextPingTime;
        var nextPingTime = isNaN(response[STATS.nextPingTimeStorageKey]) ? 0 : response[STATS.nextPingTimeStorageKey];
        nextPingTime = Math.max(localNextPingTime, nextPingTime);

        // if this is the first time we've run (just installed), millisTillNextPing is 0
        if (nextPingTime === 0 && STATS.firstRun)
        {
          callbackFN(0);
          return;
        }

        // if we don't have a 'next ping time', or it's not a valid number,
        // default to 55 minute ping interval
        if (nextPingTime === 0 || isNaN(nextPingTime))
        {
          callbackFN(FiftyFiveMinutes);
          return;
        }

        callbackFN(nextPingTime - Date.now());
      }); // end of get
    }, 10000);
  };

  // Used to rate limit .message()s.  Rate limits reset at startup.
  var throttle =
  {

    // A small initial amount in case the server is bogged down.
    // The server will tell us the correct amount.

    max_events_per_hour: 3, // null if no limit

    // Called when attempting an event. If not rate limited, returns
    // true and records the event.
    attempt: function ()
    {
      var now = Date.now();
      var oneHour = 1000 * 60 * 60;
      var times = this._event_times;
      var mph = this.max_events_per_hour;

      // Discard old or irrelevant events
      while (times[0] && (times[0] + oneHour < now || mph === null)) {
        times.shift();
      }

      if (mph === null) {
        return true; // no limit
      }

      if (times.length >= mph) {
        return false; // used our quota this hour
      }

      times.push(now);
      return true;
    },

    _event_times: [],
  };

  return {
    userIDStorageKey: userIDStorageKey,
    totalPingStorageKey: totalPingStorageKey,
    nextPingTimeStorageKey: nextPingTimeStorageKey,

    // True if AdBlock was just installed.
    firstRun: firstRun,
    checkUserId: checkUserId,
    userId: function ()
    {
      return userID;
    },

    version: version,
    flavor: flavor,
    browser: 'Edge',
    browserVersion: browserVersion,
    os: os,
    osVersion: osVersion,
    stats_url: statsUrl,

    // Ping the server when necessary.
    startPinging: function ()
    {
      function sleepThenPing()
      {
        millisTillNextPing(function (delay)
        {
          window.setTimeout(function ()
          {
            pingNow();
            scheduleNextPing();
            sleepThenPing();
          }, delay);
        });
      };

      checkUserId().then(function (userID)
      {

        // Do 'stuff' when we're first installed...
      });

      // This will sleep, then ping, then schedule a new ping, then
      // call itself to start the process over again.
      sleepThenPing();
    },

    // Record some data, if we are not rate limited.
    msg: function (message) {
      if (!throttle.attempt()) {
        log('Rate limited:', message);
        return;
      }

      var data = {
        cmd: 'msg2',
        m: message,
        u: userID,
        v: version,
        fr: firstRun,
        f: flavor,
        bv: browserVersion,
        o: os,
        ov: osVersion,
      };
      if (chrome.runtime.id) {
        data.extid = chrome.runtime.id;
      }

      $.ajax(statsUrl, {
        type: 'POST',
        data: data,
        complete: function (xhr) {
          var mph = parseInt(xhr.getResponseHeader('X-RateLimit-MPH'), 10);
          if (isNaN(mph) || mph < -1) // Server is sick
            mph = 1;
          if (mph === -1)
            mph = null; // no rate limit
          throttle.max_events_per_hour = mph;
        },
      });
    },
  };

})();
