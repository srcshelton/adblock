// Allows interaction with the server to track install rate
// and log messages.
STATS = (function() {
    var stats_url = "https://ping.getadblock.com/stats/";

    //Get some information about the version, os, and browser
    var version = require("port").chrome.runtime.getManifest().version;

    var os = require("sdk/system").platform;
    var osVersion = require("sdk/system").architecture;

    var flavor = "F";
    var version = require("firefox_bg").getFirefoxManifest().version;
    var browserVersion = require("sdk/system").version;
    
    var firstRun = !(require("functions").storage_get("userid"));
    
    // Give the user a userid if they don't have one yet.
    var userId = (function() {
        var time_suffix = (Date.now()) % 1e8; // 8 digits from end of timestamp

        if (!require("functions").storage_get("userid")) {
            var alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
            var result = [];
            for (var i = 0; i < 8; i++) {
                var choice = Math.floor(Math.random() * alphabet.length);
                result.push(alphabet[choice]);
            }
            var theId = result.join('') + time_suffix;

            require("functions").storage_set("userid", theId);
        }

        return require("functions").storage_get("userid");
    })();

    var survey_data = null;

    var shouldShowSurvey = function(survey_data) {
        var data = "cmd=survey" +
                   "&u=" + userId +
                   "&sid=" + survey_data.survey_id;

        function handle_should_survey(responseData) {
            if (responseData.length ===  0)
                return;

            var data = JSON.parse(responseData);
            if (data.should_survey === 'true') {
                var tabs = require("sdk/tabs");
                tabs.open('https://getadblock.com/' + survey_data.open_this_url);
            }
        }

        const { XMLHttpRequest } = require("sdk/net/xhr");
        var xhrSurvey = new XMLHttpRequest();
        xhrSurvey.open("POST", stats_url, true);
        xhrSurvey.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhrSurvey.setRequestHeader("Content-length", data.length);
        xhrSurvey.setRequestHeader("Connection", "close");
        xhrSurvey.onload = function() {
            handle_should_survey(xhrSurvey.responseText);
        };
        xhrSurvey.onerror = function() {
            return;
        };
        xhrSurvey.send(data);
    
    };//end of shouldShowSurvey

    var pingAfterInterval = function(millisInterval) {
        require("functions").storage_set("next_ping_time", Date.now() + millisInterval);
        var delay = millisTillNextPing();    
        var nextStuffTodo = function() {
            exports.STATS.startPinging();
        };
        require('sdk/timers').setTimeout(nextStuffTodo, delay);    
    };

    // Tell the server we exist.
    var pingNow = function() {
        var pingData = "cmd=ping" +
            "&u=" + userId +
            "&v=" + version +
            "&f=" + flavor +
            "&o=" + os +
            "&g=" + (require("background").get_settings().show_google_search_text_ads ? '1': '0') +
            "&l=" + require("functions").determineUserLanguage() +
            "&b=" + require("blockcounts").blockCounts.get().total;
      
        const { XMLHttpRequest } = require("sdk/net/xhr");
        var xhr = new XMLHttpRequest();
        xhr.open("POST", stats_url, true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("Content-length", pingData.length);
        xhr.setRequestHeader("Connection", "close");
        xhr.onload = function() {
            maybeSurvey(xhr);
        };
        xhr.send(pingData);
    };//end of pingNow

    var one_time_opener = function() {
        require('sdk/tabs').removeListener("open", one_time_opener);

        if (!one_time_opener.running)
            return; // one_time_opener was called multiple times
            
        if (survey_data === null)
            return;        
        
        one_time_opener.running = false;
        var open_the_tab = function() {
            // see if survey should still be shown before opening tab
            shouldShowSurvey(survey_data);
        };
        open_the_tab();
    };

    var maybeSurvey = function(xhr) {

        if ((xhr.status === 400) || (xhr.status === 500)) {
            // ping returned error or no data, ping again tomorrow            
            pingAfterInterval(86400000);
            return;
        }

        // check to see if the extension should change its ping interval
        if (xhr && xhr.getResponseHeader("millis-to-ping"))  {
            var millisPing = parseInt(xhr.getResponseHeader("millis-to-ping"), 10);

            if (isNaN(millisPing) || millisPing < -1) // server is sick
                millisPing = null;
            if (millisPing === -1)
                millisPing = null;
            if (millisPing !== null) {
                pingAfterInterval(millisPing);
            }
        }

        if (xhr.responseText.length ===  0)
            return;    

        try {
            var url_data = JSON.parse(xhr.responseText);
            if (!url_data.open_this_url.match(/^\/survey\//))
                throw "bad survey url.";
        } catch (e) {
            console.log("Something went wrong with opening a survey.");
            console.log('error', e);
            console.log('response data', responseData);
            return;
        }
        
        one_time_opener.running = true;
        // overwrites the current survey if one exists
        survey_data = url_data;
    
        //since we can't check to see if an existing 'open' listener exists, we'll try
        //to remove one.
        require('sdk/tabs').removeListener("open", one_time_opener);
        require('sdk/tabs').on('open', one_time_opener);
        
    };//end of maybeSurvey

    // Called just after we ping the server, to schedule our next ping.
    var scheduleNextPing = function() {
        var total_pings = require("functions").storage_get("total_pings") || 0;
        total_pings += 1;
        require("functions").storage_set("total_pings", total_pings);

        var delay_hours;
        if (total_pings == 1)      // Ping one hour after install
            delay_hours = 1;
        else if (total_pings < 9)  // Then every day for a week
            delay_hours = 24;
        else                       // Then weekly forever
            delay_hours = 24 * 7;

        var millis = 1000 * 60 * 60 * delay_hours;
        require("functions").storage_set("next_ping_time", Date.now() + millis);
    };//end of scheduleNextPing

    // Return the number of milliseconds until the next scheduled ping.
    var millisTillNextPing = function() {
        var next_ping_time = require("functions").storage_get("next_ping_time");
        if (!next_ping_time)
            return 0;
        else
            return Math.max(0, next_ping_time - Date.now());
    };//end of millisTillNextPing

    // Used to rate limit .message()s.  Rate limits reset at startup.
    var throttle = {
        // A small initial amount in case the server is bogged down.
        // The server will tell us the correct amount.
        max_events_per_hour: 3, // null if no limit
        // Called when attempting an event.  If not rate limited, returns
        // true and records the event.
        attempt: function() {
            var now = Date.now(), one_hour = 1000 * 60 * 60;
            var times = this._event_times, mph = this.max_events_per_hour;
            // Discard old or irrelevant events
            while (times[0] && (times[0] + one_hour < now || mph === null))
                times.shift();
            if (mph === null) return true; // no limit
            if (times.length >= mph) return false; // used our quota this hour
            times.push(now);
            return true;
        },
        _event_times: []
    };//end of throttle

    return {
        // True if AdBlock was just installed.
        firstRun: firstRun,
        userId: userId,
        version: version,
        flavor: flavor,
        browser: ({F:"Firefox"})[flavor],
        browserVersion: browserVersion,
        os: os,
        osVersion: osVersion,

        // Ping the server when necessary.
        startPinging: function() {

            function sleepThenPing() {
                var delay = millisTillNextPing();
                var nextStuffTodo = function() {
                    pingNow();
                    scheduleNextPing();
                    sleepThenPing();
                };
                require('sdk/timers').setTimeout(nextStuffTodo, delay);
            };
            // Try to detect corrupt storage and thus avoid ping floods.
            if (! (millisTillNextPing() > 0) ) {
                require("functions").storage_set("next_ping_time", 1);
                if (require("functions").storage_get("next_ping_time") != 1)
                    return;
            }
            // This will sleep, then ping, then schedule a new ping, then
            // call itself to start the process over again.
            sleepThenPing();
            
        },//end of startPinging
        
        // Record some data, if we are not rate limited.
        msg: function(message) {
            if (!throttle.attempt()) {
                log("Rate limited:", message);
                return;
            }
            var data = {
                cmd: "msg2",
                m: message,
                u: userId,
                v: version,
                fr: firstRun,
                f: flavor,
                bv: browserVersion,
                o: os,
                ov: osVersion
            };
            $.ajax(stats_url, {
                type: "POST",
                data: data,
                complete: function(xhr) {
                    var mph = parseInt(xhr.getResponseHeader("X-RateLimit-MPH"), 10);
                    if (isNaN(mph) || mph < -1) // Server is sick
                        mph = 1;
                    if (mph === -1)
                        mph = null; // no rate limit
                    throttle.max_events_per_hour = mph;
                }
            });
        }
    };//end of msg

})();
exports.STATS = STATS;