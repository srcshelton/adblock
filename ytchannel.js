// Store actual URL
var url = document.location.href;

function runInPage(fn, arg1, arg2) {
    var script = document.createElement("script");
    script.type = "application/javascript";
    script.async = false;
    if (arg2) {
      script.textContent = "(" + fn + ")(" + arg1 + " , " + arg2 + ");";
    } else if (arg1) {
      script.textContent = "(" + fn + ")(" + arg1 + ");";
    } else {
      script.textContent = "(" + fn + ")();";
    }
    document.documentElement.appendChild(script);
    document.documentElement.removeChild(script);
}

// Parse a URL. Based upon http://blog.stevenlevithan.com/archives/parseuri
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
// Inputs: url: the URL you want to parse
// Outputs: object containing all parts of |url| as attributes
var parseUri = function (url) {
    var matches = /^(([^:]+(?::|$))(?:(?:\w+:)?\/\/)?(?:[^:@\/]*(?::[^:@\/]*)?@)?(([^:\/?#]*)(?::(\d*))?))((?:[^?#\/]*\/)*[^?#]*)(\?[^#]*)?(\#.*)?/.exec(url);

    // The key values are identical to the JS location object values for that key
    var keys = ['href', 'origin', 'protocol', 'host', 'hostname', 'port',
        'pathname', 'search', 'hash',];
    var uri = {};
    for (var i = 0; (matches && i < keys.length); i++)
        uri[keys[i]] = matches[i] || '';
    return uri;
  };
// Parses the search part of a URL into an key: value object.
// e.g., ?hello=world&ext=adblock would become {hello:"world", ext:"adblock"}
// Inputs: search: the search query of a URL. Must have &-separated values.
parseUri.parseSearch = function (search) {

    // Fails if a key exists twice (e.g., ?a=foo&a=bar would return {a:"bar"}
    search = search.substring(search.indexOf('?') + 1).split('&');
    var params = {}, pair;
    for (var i = 0; i < search.length; i++) {
      pair = search[i].split('=');
      if (pair[0] && !pair[1])
          pair[1] = '';
      if (!params[decodeURIComponent(pair[0])] && decodeURIComponent(pair[1]) === 'undefined') {
        continue;
      } else {
        params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
      }
    }

    return params;
  };


runInPage(function() {
  var gChannelName = "";
  window.history.replaceState = function(originalReplaceState) {
      return function () {
          var theArgs = Array.prototype.slice.call(arguments);
          if (theArgs && theArgs.length >= 3 && /ab_channel/.test(theArgs[2])) {
            return originalReplaceState.call(window.history, theArgs[0], theArgs[1], theArgs[2]);
          } else if (gChannelName && theArgs && theArgs.length >= 3 && !/ab_channel/.test(theArgs[2])) {
            if (parseUri(theArgs[2]).search.indexOf('?') === -1) {
              var updatedUrl = theArgs[2] + '?&ab_channel=' + gChannelName;
            } else {
              var updatedUrl = theArgs[2] + '&ab_channel=' + gChannelName;
            }
            return originalReplaceState.call(window.history, theArgs[0], theArgs[1], updatedUrl);
          } else {
            return originalReplaceState.call(window.history, theArgs[0], theArgs[1], theArgs[2]);
          }
      };
  }(window.history.replaceState);
});

// used to decode all encoded HTML  (convert '&' to &amp;)
var parseElem = document.createElement('textarea');

var parseChannelName = function (channelName) {
  function fixedEncodeURIComponent(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
      return '%' + c.charCodeAt(0).toString(16);
    });
  }

  parseElem.innerHTML = channelName;
  channelName = parseElem.innerText;
  // Remove whitespace, and encode
  return fixedEncodeURIComponent(channelName.replace(/\s/g, ''));
};

function isEncoded(str) {
  return decodeURIComponent(str) !== str;
}

if (!/ab_channel/.test(url)) {
    // Get name of the channel by using YouTube Data v3 API
    if (/channel/.test(url)) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET",
                 "https://www.googleapis.com/youtube/v3/channels?part=snippet&id=" + getChannelId(url) +
                 "&key=" + atob("QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz"), false);
        xhr.onload = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var json = JSON.parse(xhr.response);
                // Got name of the channel
                if (json.items[0]) {
                    updateURL(json.items[0].snippet.title, false);
                }
            }
        }
        xhr.send(null);
    } else if (/watch/.test(url)) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET",
                 "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" + getVideoId(url) +
                 "&key=" + atob("QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz"), false);
        xhr.onload = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var json = JSON.parse(xhr.response);
                // Got name of the channel
                if (json.items[0]) {
                    updateURL(json.items[0].snippet.channelTitle, false);
                }
            }
        }
        xhr.send(null);
    } else {
        if (/user/.test(url)) {
            document.addEventListener("spfdone", function() {
                var channelNameElement = document.querySelector("span .qualified-channel-title-text > a");
                if (channelNameElement && channelNameElement.textContent) {
                    updateURL(channelNameElement.textContent, true);
                }
            }, true);
            // Spfdone event doesn't fire, when you access YT user directly
            window.addEventListener("DOMContentLoaded", function() {
                var channelNameElement = document.querySelector("span .qualified-channel-title-text > a");
                if (channelNameElement && channelNameElement.textContent) {
                    updateURL(channelNameElement.textContent, true);
                }
            }, true);
        }
    }

    // Get id of the channel
    function getChannelId(url) {
        return parseUri(url).pathname.split("/")[2];
    }

    // Get id of the video
    function getVideoId(url) {
        return parseUri.parseSearch(url).v;
    }

    // Function which: - adds name of the channel on the end of the URL, e.g. &ab_channel=nameofthechannel
    //                 - reload the page, so AdBlock can properly whitelist the page (just if channel is whitelisted by user)
    function updateURL(channelName, shouldReload) {
        var parsedChannelName = parseChannelName(channelName);
        gChannelName = parsedChannelName;
        //chrome.runtime.sendMessage({ command: 'updateYouTubeChannelName', args: channelName });
        // If the URL already contains the same 'AB channel', then don't add it again.
        if (/ab_channel/.test(url) && decodeURIComponent(parsedChannelName) === parseUri.parseSearch(document.location.href).ab_channel) {
          return;
        }
        if (parseUri(url).search.indexOf("?") === -1) {
            var updatedUrl = url+"?&ab_channel=" + parsedChannelName.replace(/\s/g,"");
        } else {
            var updatedUrl = url+"&ab_channel=" + parsedChannelName.replace(/\s/g,"");
        }
        // Add the name of the channel to the end of URL
        //window.history.replaceState(null, null, updatedUrl);
        runInPage(function(updatedUrl, channelName) {
          gChannelName = channelName;
          window.history.replaceState(null, null, updatedUrl);
        }, "'" + updatedUrl + "'", "'" + parsedChannelName + "'");
        // |shouldReload| is true only if we are not able to get
        // name of the channel by using YouTube Data v3 API
        if (shouldReload) {
          // Reload page from cache, if it should be whitelisted
          BGcall("page_is_whitelisted", updatedUrl, function(whitelisted) {
              if (whitelisted) {
                document.location.reload(false);
              }
          });
        }
    }
}