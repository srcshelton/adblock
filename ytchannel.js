
// Store actual URL
var url = document.location.href;

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
    xhr.open('GET',
             'https://www.googleapis.com/youtube/v3/channels?part=snippet&id=' + getChannelId(url) +
             '&key=' + atob('QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz'));
    xhr.onload = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
          var json = JSON.parse(xhr.response);

          // Got name of the channel
          if (json.items[0]) {
            updateURL(json.items[0].snippet.title, false);
          }
        }
      };

    xhr.send();
  } else if (/watch/.test(url)) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET',
             'https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' + getVideoId(url) +
             '&key=' + atob('QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz'));
    xhr.onload = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
          var json = JSON.parse(xhr.response);

          // Got name of the channel
          if (json.items[0]) {
            updateURL(json.items[0].snippet.channelTitle, false);
          }
        }
      };

    xhr.send();
  } else {
    if (/user/.test(url)) {
      document.addEventListener('spfdone', function () {
          var channelNameElement  = document.querySelector('span .qualified-channel-title-text > a');
          if (channelNameElement && channelNameElement.textContent) {
            updateURL(channelNameElement.textContent, true);
          }
        }, true);

      // Spfdone event doesn't fire, when you access YT user directly
      window.addEventListener('DOMContentLoaded', function () {
          var channelNameElement = document.querySelector('span .qualified-channel-title-text > a');
          if (channelNameElement && channelNameElement.textContent) {
            updateURL(channelNameElement.textContent, true);
          }
        }, true);
    }
  }

  // Get id of the channel
  function getChannelId(url) {
    return parseUri(url).pathname.split('/')[2];
  }

  // Get id of the video
  function getVideoId(url) {
    return parseUri.parseSearch(url).v;
  }

  // Function which: - adds name of the channel on the end of the URL, e.g. &ab_channel=nameofthechannel
  //                 - reload the page, so AdBlock can properly whitelist the page (just if channel is whitelisted by user)
  function updateURL(channelName, shouldReload) {
    var parsedChannelName = parseChannelName(channelName);
    if (parseUri(url).search.indexOf("?") === -1) {
        var updatedUrl = url+"?&ab_channel=" + parsedChannelName;
    } else {
        var updatedUrl = url+"&ab_channel=" + parsedChannelName;
    }
    chrome.runtime.sendMessage({ command: 'updateYouTubeChannelName', args: channelName });

    // Add the name of the channel to the end of URL
    window.history.replaceState(null, null, updatedUrl);

    // |shouldReload| is true only if we are not able to get
    // name of the channel by using YouTube Data v3 API
    if (shouldReload) {

      // Reload page from cache, if it should be whitelisted
      BGcall('page_is_whitelisted', updatedUrl, function (whitelisted) {
          if (whitelisted) {
            document.location.reload(false);
          }
        });
    }
  }
}

// Process messages from the background
// - Query the YouTube page for channel names, and send them to the background page to white-list
function onMessage(msg)
{
  if (msg.type === 'whitelistAllYouTubeChannels')
  {
    alert(translate('one_moment_all_youtube_channels'));

    // The list of subscriptions maybe accessed with different query selectors,
    // We'll try both.
    var myElements = document.querySelectorAll('a[href^="/channel/"');
    var titles = [];
    for (var inx = 0; inx < myElements.length; inx++)
    {
      var theChannelAnchorElement = myElements[inx];
      var theTitle = theChannelAnchorElement.getAttribute('title');
      if (theTitle && (typeof theTitle === 'string'))
      {
        titles.push(parseChannelName(theTitle.trim()));
      }
    }

    var myElements = document.querySelectorAll('#guide-channels .display-name span');
    for (var inx = 0; inx < myElements.length; inx++)
    {
      var theElement = myElements[inx];
      var theTitle = theElement.innerText;
      if (theTitle)
      {
        titles.push(parseChannelName(theTitle.trim()));
      }
    }

    if (titles.length > 0)
    {

      // Remove any duplicates
      var seen = {};
      var newTitles = [];
      for (var inx = 0; inx < titles.length; inx++)
      {
        if (!(titles[inx] in seen))
        {
          newTitles.push(titles[inx]);
          seen[titles[inx]] = true;
        }
      }

      chrome.runtime.sendMessage({ command: 'updateYouTubeWhitelistFilters', args: newTitles }, function (response)
      {
        alert(translate('all_youtube_channels_complete'));
      });
    }
  }
}

if ((typeof listenersAdded) === 'undefined') {
  listenersAdded = true;
  chrome.runtime.onMessage.addListener(onMessage);
}
