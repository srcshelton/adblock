'use strict';

var _settings = {};
var _myfilters = {};

var initializeBackgroundObjects = function () {

  _settings = new Settings();
  _settings.onload().then(function ()
  {
    if (getSettings().debug_logging) {
      logging(true);
    }
  });

  if (typeof STATS === 'object') {
    STATS.startPinging();
  }

  if (typeof blockCounts === 'object') {
    blockCounts.init();

    if (chrome.runtime.setUninstallURL) {
      STATS.checkUserId().then(function (userID)
      {
        var uninstallURL = 'https://getadblock.com/uninstall/?u=' + userID;
        //if the start property of blockCount exists (which is the AdBlock installation timestamp)
        //use it to calculate the approximate length of time that user has AdBlock installed
        if (blockCounts && typeof blockCounts.get === 'function') {
          var twoMinutes = 2 * 60 * 1000;
          var updateUninstallURL = function () {
            var localBC = blockCounts.get();
            if (localBC && localBC.start) {
              var installedDuration = (Date.now() - localBC.start);
              var url = uninstallURL + '&t=' + installedDuration;
              var bc = localBC.total;
              url = url + '&bc=' + bc;
              if (typeof _myfilters === 'object' &&
                  _myfilters._subscriptions &&
                  _myfilters._subscriptions.adblock_custom &&
                  _myfilters._subscriptions.adblock_custom.last_update) {
                url = url + '&abc-lt=' + _myfilters._subscriptions.adblock_custom.last_update;
              } else {
                url = url + '&abc-lt=-1';
              }

              chrome.runtime.setUninstallURL(url);
            }
          };
          //start an interval timer that will update the Uninstall URL every 2 minutes
          setInterval(updateUninstallURL, twoMinutes);
          updateUninstallURL();
        } else {
          chrome.runtime.setUninstallURL(uninstallURL + '&t=-1');
        }
      });
    }
  }

  count_cache_init();

  _myfilters = new MyFilters(function () {
    _myfilters.init();
  }); // end of new MyFilters
  _myfilters.ready().then(function(result) {

    var handleEarlyOpenedTabs = function(tabs) {
      if (!tabs) {
        return;
      }
      log("Found", tabs.length, "tabs that were already opened");
      for (var i=0; i<tabs.length; i++) {
        var currentTab = tabs[i], tabId = currentTab.id;
        if (!frameData.get(tabId)) { // unknown tab
            currentTab.url = getUnicodeUrl(currentTab.url);
            frameData.track({url: currentTab.url, tabId: tabId, type: "main_frame"});
        }
        updateBadge(tabId);
      }
    };

    chrome.tabs.query({ url: 'http://*/*' }, handleEarlyOpenedTabs);
    chrome.tabs.query({ url: 'https://*/*' }, handleEarlyOpenedTabs);
    chrome.webRequest.onBeforeRequest.addListener(onBeforeRequestHandler, { urls: ['http://*/*', 'https://*/*'] }, ['blocking']);
    chrome.tabs.onRemoved.addListener(frameData.removeTabId);
    // Popup blocking
    if (chrome.webNavigation && chrome.webNavigation.onCreatedNavigationTarget) {
      chrome.webNavigation.onCreatedNavigationTarget.addListener(onCreatedNavigationTargetHandler);
    }
    if (chrome.tabs) {
      chrome.tabs.onUpdated.addListener(function (tabid, changeInfo, tab) {
        if (tab.active && changeInfo.status)
          updateButtonUIAndContextMenus();
      });

      chrome.tabs.onActivated.addListener(function () {
        updateButtonUIAndContextMenus();
      });
    }
  });
}; // end of initializeBackgroundObjects

  // Send the file name and line number of any error message. This will help us
  // to trace down any frequent errors we can't confirm ourselves.
  window.addEventListener("error", function(e) {
    var str = "Error: " +
             (e.filename||"anywhere").replace(chrome.extension.getURL(""), "") +
             ":" + (e.lineno||"anywhere") +
             ":" + (e.colno||"anycol");
    if (e.error) {
        var stack = "-" + (e.error.message ||"") +
                    "-" + (e.error.stack ||"");
        stack = stack.replace(/:/gi, ";").replace(/\n/gi, "");
        //only append the stack info if there isn't any URL info in the stack trace
        if (stack.indexOf("http") === -1) {
           str += stack;
        }
        //don't send large stack traces
        if (str.length > 512) {
          str = str.substr(0,511);
        }
    }
    STATS.msg(str);
    sessionStorage.setItem("errorOccurred", true);
    storage_set("error", "Date added:" + new Date() + " " + str);
    log(str);
  });

// If the Chrome API 'onInstalled' is available, and
// reason is 'install' and
// AdBlock wasn't installed using an 'admin' group policy then
// Open the install tab.
if (chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === "install") {
      STATS.checkUserId().then(function (userID) {
        var openInstalledTab = function () {
          var installedURL = 'https://getadblock.com/installed/?u=' + userID;
          chrome.tabs.create({ url: installedURL });
        };

        if (chrome.management && chrome.management.getSelf) {
          chrome.management.getSelf(function(info) {
            if (info && info.installType !== "admin") {
              openInstalledTab();
            }
          });
        } else {
          openInstalledTab();
        }
      });
    }
  });
}

// Records how many ads have been blocked by AdBlock.  This is used
// by the AdBlock app in the Chrome Web Store to display statistics
// to the user.
// Block Counts are stored in 'localstorage' because of performance requirements
// in the recordOneAdBlocked() function.  Data loss can occur when using storage.local.get/set
// in quick succession.
var blockCounts = (function () {

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (!(request.message == "recordOneAdBlocked")) {
      return;
    }
    if (sender && sender.tab && sender.tab.id) {
      blockCounts.recordOneAdBlocked(sender.tab.id);
      updateBadge(sender.tab.id);
    }
    sendResponse({});
  });

  var BCkey = 'blockage_stats';
  return {
    init: function () {
      var data = storage_get(BCkey);
      if (!data)
        data = {};
      if (data.start === undefined)
        data.start = Date.now();
      if (data.total === undefined)
        data.total = 0;
      if (data.malware_total === undefined)
        data.malware_total = 0;
      data.version = 1;
      storage_set(BCkey, data);
    },

    recordOneAdBlocked: function (tabId) {
      var data = storage_get(BCkey);
      data.total += 1;
      storage_set(BCkey, data);

      //code for incrementing ad blocks
      var currentTab = frameData.get(tabId);
      if (currentTab) {
        currentTab.blockCount++;
      }
    },

    recordOneMalwareBlocked: function () {
      var data = storage_get(BCkey);
      data.malware_total += 1;
      storage_set(BCkey, data);
    },

    get: function () {
      return storage_get(BCkey);
    },

    getTotalAdsBlocked: function (tabId) {
      if (tabId) {
        var currentTab = frameData.get(tabId);
        return currentTab ? currentTab.blockCount : 0;
      }

      return this.get().total;
    },
  };
})();

  //called from bandaids, for use on our getadblock.com site
  var get_adblock_user_id = function() {
    return storage_get("userid");
  };

  //called from bandaids, for use on our getadblock.com site
  var get_first_run = function() {
    return STATS.firstRun;
  };

  //called from bandaids, for use on our getadblock.com site
  var set_first_run_to_false = function() {
    STATS.firstRun = false;
  };

  // Open a new tab with a given URL.
  // Inputs:
  //   url: string - url for the tab
  //   nearActive: bool - open the tab near currently active (instead of at the end). optional, defaults to false
  function openTab(url, nearActive) {
      chrome.windows.getCurrent(function(current) {
          // Normal window - open tab in it
          if (!current.incognito) {
              if (!nearActive) {
                  chrome.tabs.create({url: url});
              } else {
                  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                      chrome.tabs.create({ url: url, index: (tabs[0] ? tabs[0].index + 1 : undefined)});
                  });
              }
          } else {
              // Get all windows
              chrome.windows.getAll(function(window) {
                  var windowId = null;
                  for (var i=0; i<window.length; i++) {
                      // We have found a normal (non-incognito) window
                      if (!window[i].incognito && window[i].type === "normal") {
                          // If more normal windows were found,
                          // overwrite windowId, so we get the most recent
                          // opened normal window
                          windowId = window[i].id;
                      }
                  }
                  // Create a new tab in found normal window
                  if (windowId) {
                      if (!nearActive) {
                          chrome.tabs.create({windowId: windowId, url: url, active: true});
                      } else {
                          chrome.tabs.query({active: true, windowId: windowId}, function(tabs) {
                              chrome.tabs.create({windowId: windowId, url: url,
                                                  index: (tabs[0] ? tabs[0].index + 1 : undefined), active: true});
                              chrome.windows.update(windowId, {focused: true});
                          });
                      }
                      chrome.windows.update(windowId, {focused: true});
                  } else {
                      // Normal window is not currently opened,
                      // so create a new one
                      chrome.tabs.create({url: url});
                  }
              });
          }
      });
  };

  // Reload already opened tab
  // Input:
  //   tabId: integer - id of the tab which should be reloaded
  var reloadTab = function(tabId) {
      var listener = function(tabId, changeInfo, tab) {
          if (changeInfo.status === "complete" &&
              tab.status === "complete") {
              setTimeout(function() {
                  chrome.runtime.sendMessage({ command: 'reloadcomplete' });
                  chrome.tabs.onUpdated.removeListener(listener);
              }, 2000);
          }
      }
      if (typeof tabId === 'string') {
        tabId = parseInt(tabId);
      }
      chrome.tabs.onUpdated.addListener(listener);
      if (typeof chrome.tabs.reload === "function") {
        chrome.tabs.reload(tabId, { bypassCache: true });
      } else {
        chrome.tabs.executeScript(tabId, {code: 'location.reload();'});
      }
  }

  // Implement blocking via the Chrome webRequest API.
  // Stores url, whitelisting, and blocking info for a tabid+frameid
  // TODO: can we avoid making this a global?
  var frameData = {
      // Returns the data object for the frame with ID frameId on the tab with
      // ID tabId. If frameId is not specified, it'll return the data for all
      // frames on the tab with ID tabId. Returns undefined if tabId and frameId
      // are not being tracked.
      get: function(tabId, frameId) {
          if (frameId !== undefined)
              return (frameData[tabId] || {})[frameId];
          return frameData[tabId];
      },

      // Record that |tabId|, |frameId| points to |url|.
      record: function(tabId, frameId, url) {
          var fd = frameData;
          if (!fd[tabId]) fd[tabId] = {};
          fd[tabId][frameId] = {
              url: url,
              // Cache these as they'll be needed once per request
              domain: parseUri(url).hostname,
              resources: {}
          };
          fd[tabId][frameId].whitelisted = page_is_whitelisted(url);
      },

      // Watch for requests for new tabs and frames, and track their URLs.
      // Inputs: details: object from onBeforeRequest callback
      // Returns false if this request's tab+frame are not trackable.
      track: function(details) {
          var fd = frameData, tabId = details.tabId;

          // A hosted app's background page
          if (tabId === -1) {
              return false;
          }

          if (details.type === 'main_frame') { // New tab
              delete fd[tabId];
              fd.record(tabId, 0, details.url);
              fd[tabId].blockCount = 0;
              if (loggingEnable) {
                log("\n-------", fd.get(tabId, 0).domain, ": loaded in tab", tabId, "--------\n\n");
              }
              return true;
          }

          // Request from a tab opened before AdBlock started, or from a
          // chrome:// tab containing an http:// iframe
          if (!fd[tabId]) {
              if (loggingEnable) {
                log("[DEBUG]", "Ignoring unknown tab:", tabId, details.frameId, details.url);
              }
              return false;
          }

          // Some times e.g. Youtube create empty iframes via JavaScript and
          // inject code into them.  So requests appear from unknown frames.
          // Treat these frames as having the same URL as the tab.
          var potentialEmptyFrameId = (details.type === 'sub_frame' ? details.parentFrameId: details.frameId);
          if (undefined === fd.get(tabId, potentialEmptyFrameId)) {
              fd.record(tabId, potentialEmptyFrameId, fd.get(tabId, 0).url);
              if (loggingEnable) {
                log("[DEBUG]", "Null frame", tabId, potentialEmptyFrameId, "found; giving it the tab's URL.");
              }
          }

          if (details.type === 'sub_frame') { // New frame
              fd.record(tabId, details.frameId, details.url);
              if (loggingEnable) {
                log("[DEBUG]", "=========== Tracking frame", tabId, details.parentFrameId, details.frameId, details.url);
              }
          }

          return true;
      },

      // Save a resource for the resource blocker.
      storeResource: function(tabId, frameId, url, elType, frameDomain) {
          if (!getSettings().show_advanced_options)
              return;
          var data = frameData.get(tabId, frameId);
          if (data !== undefined &&
              data.resources) {
              data.resources[elType + ":|:" + url + ":|:" + frameDomain] = null;
          }
      },

      removeTabId: function(tabId) {
          delete frameData[tabId];
      }
  };

  // When a request starts, perhaps block it.
  function onBeforeRequestHandler(details) {

    if (adblock_is_paused())
      return { cancel: false };

    // Convert punycode domain to Unicode - GH #472
    details.url = getUnicodeUrl(details.url);

    if (!frameData.track(details))
      return { cancel: false };

    var tabId = details.tabId;
    var reqType = details.type;

    var top_frame = frameData.get(tabId, 0);
    var sub_frame = (details.frameId !== 0 ? frameData.get(tabId, details.frameId) : null);

    // If top frame is whitelisted, don't process anything
    if (top_frame.whitelisted) {
      if (loggingEnable) {
        log("[DEBUG]", "Ignoring whitelisted tab", tabId, details.url.substring(0, 100));
      }
      return { cancel: false };
    // If request comes from whitelisted sub_frame and
    // top frame is not whitelisted, don't process the request
    } else if (sub_frame && sub_frame.whitelisted) {
      if (loggingEnable) {
        log("[DEBUG]", "Ignoring whitelisted frame", tabId, details.url.substring(0, 100));
      }
      return { cancel: false };
    }

    // For most requests, Chrome and we agree on who sent the request: the frame.
    // But for iframe loads, we consider the request to be sent by the outer
    // frame, while Chrome claims it's sent by the new iframe.  Adjust accordingly.
    var requestingFrameId = (reqType === 'sub_frame' ? details.parentFrameId : details.frameId);

    var elType = ElementTypes.fromOnBeforeRequestType(reqType);

    // May the URL be loaded by the requesting frame?
    var frameDomain = frameData.get(tabId, requestingFrameId).domain;

    // If |matchGeneric| is null, don't test request against blocking generic rules
    var matchGeneric = _myfilters.blocking.whitelist.matches(top_frame.url, ElementTypes.genericblock, top_frame.url);
    if (getSettings().data_collection) {
        var blockedData = _myfilters.blocking.matches(details.url, elType, frameDomain, true, true, matchGeneric);
        if (blockedData !== false) {
            DataCollection.addItem(blockedData.text);
            var blocked = blockedData.blocked;
        } else {
            var blocked = blockedData;
        }
    } else {
        var blocked = _myfilters.blocking.matches(details.url, elType, frameDomain, false, false, matchGeneric);
    }

    frameData.storeResource(tabId, requestingFrameId, details.url, elType, frameDomain);

    // Issue 7178
    if (blocked && frameDomain === "www.hulu.com") {
      if (frameData.get(tabId, 0).domain !== "www.hulu.com"
          && /ads\.hulu\.com/.test(details.url)) // good enough
        blocked = false;
    }

    var canPurge = (elType & (ElementTypes.image | ElementTypes.subdocument | ElementTypes.object));
    if (canPurge && blocked) {
      // frameUrl is used by the recipient to determine whether they're the frame who should
      // receive this or not.  Because the #anchor of a page can change without navigating
      // the frame, ignore the anchor when matching.
      var frameUrl = frameData.get(tabId, requestingFrameId).url.replace(/#.*$/, "");
      var data = { command: "purge-elements", tabId: tabId, frameUrl: frameUrl, url: details.url, elType: elType };
      chrome.tabs.sendRequest(tabId, data);
    }
    if (blocked) {
      blockCounts.recordOneAdBlocked(tabId);
      updateBadge(tabId);
    }
    if (loggingEnable) {
      log("[DEBUG]", "Block result", blocked, reqType, frameDomain, details.url.substring(0, 100));
    }
    if (blocked && elType === ElementTypes.subdocument) {
      return { redirectUrl: "about:blank" };
    }
    return { cancel: blocked };
  }

  // Popup blocking
  function onCreatedNavigationTargetHandler(details) {
    if (adblock_is_paused())
        return;
    var opener = frameData.get(details.sourceTabId, details.sourceFrameId);
    if (opener === undefined)
      return;
    if (frameData.get(details.sourceTabId, 0).whitelisted)
      return;
    // Change to opener's url in so that it would still be tested against the
    // blocking filter's regex rule. Github issue # 69
    if (details.url === "about:blank")
      details.url = opener.url;
    var url = getUnicodeUrl(details.url);
    var match = _myfilters.blocking.matches(url, ElementTypes.popup, opener.domain);
    if (match) {
        chrome.tabs.remove(details.tabId);
        blockCounts.recordOneAdBlocked(details.sourceTabId);
        updateBadge(details.sourceTabId);
    }
    frameData.storeResource(details.sourceTabId, details.sourceFrameId, url, ElementTypes.popup, opener.domain);
  };

  // If tabId has been replaced by Chrome, delete it's data
  chrome.webNavigation.onTabReplaced.addListener(function(details) {
      frameData.removeTabId(details.replacedTabId);
  });

  chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {
      if (details &&
          details.hasOwnProperty("frameId") &&
          details.hasOwnProperty("tabId") &&
          details.hasOwnProperty("url")) {
          //on some single page sites that update the URL using the History API pushState(),
          //but they don't actually load a new page, we need to get notified when this happens
          //and track these updates in the frameData object.
          var tabData = frameData.get(details.tabId, details.frameId);
          if (tabData &&
              tabData.url !== details.url &&
              !page_is_unblockable(details.url)) {
              details.type = 'main_frame';
              details.url = getUnicodeUrl(details.url);
              frameData.track(details);
              if (tabData.youTubeChannelName) {
                frameData.get(details.tabId, details.frameId).youTubeChannelName = tabData.youTubeChannelName;
              }
          }
      }
  });

  var debug_report_elemhide = function(selector, matches, sender) {
    if (!window.frameData) {
      return;
    }
    var frameDomain = parseUri(sender.url || sender.tab.url).hostname;
    frameData.storeResource(sender.tab.id, sender.frameId || 0, selector, "selector", frameDomain);

    var data = frameData.get(sender.tab.id, sender.frameId || 0);
    if (data) {
      if (loggingEnable) {
        log(data.domain, ": hiding rule", selector, "matched:\n", matches);
      }
      DataCollection.addItem(selector);
      blockCounts.recordOneAdBlocked(sender.tab.id);
      updateBadge(sender.tab.id);
    }
  }

  // UNWHITELISTING

  // Look for a custom filter that would whitelist options.url,
  // and if any exist, remove the first one.
  // Inputs: url:string - a URL that may be whitelisted by a custom filter
  // Returns: true if a filter was found and removed; false otherwise.
  var try_to_unwhitelist = function (url, callback) {
    url = url.replace(/#.*$/, ''); // Whitelist ignores anchors
    get_custom_filters_text(function (custom_filters) {
        custom_filters = custom_filters.split('\n');
        for (var i = 0; i < custom_filters.length; i++) {
          var text = custom_filters[i];
          var whitelist = text.search(/@@\*\$document,domain=\~/);
          // Blacklist site, which is whitelisted by global @@*&document,domain=~ filter
          if (whitelist > -1) {
            // Remove protocols
            url = url.replace(/((http|https):\/\/)?(www.)?/, '').split(/[/?#]/)[0];
            text = text + '|~' + url;
            custom_filters.splice(i, 1); // Remove the old filter text
            custom_filters.push(text); // add the new filter text to original array
            var new_text = custom_filters.join('\n');
            set_custom_filters_text(new_text);
            if (typeof callback === 'function') {
              callback(true);
            }

            return true;
          } else {
            if (!Filter.isWhitelistFilter(text))
                continue;
            try {
              var filter = PatternFilter.fromText(text);
            } catch (ex) {
              continue;
            }

            if (!filter.matches(url, ElementTypes.document, false))
                continue;

            custom_filters.splice(i, 1); // Remove this whitelist filter text
            var new_text = custom_filters.join('\n');
            set_custom_filters_text(new_text);
            if (typeof callback === 'function') {
              callback(true);
            }

            return true;
          }
        }

        if (typeof callback === 'function') {
          callback(false);
        }

        return false;
      });
  };

  // Called when Chrome blocking needs to clear the in-memory cache.
  var handlerBehaviorChanged = function() {
    try {
      chrome.webRequest.handlerBehaviorChanged();
    } catch (ex) {
    }
  }

  // CUSTOM FILTERS

  // Get the custom filters text as a \n-separated text string.
  var get_custom_filters_text = function (callback) {
    if (typeof callback !== 'function') {
      return;
    }
    var localCallback = callback;
    chrome.storage.local.get('custom_filters', function (response)
    {
      localCallback(response['custom_filters']);
    });
  };

  // Set the custom filters to the given \n-separated text string, and
  // rebuild the filterset.
  // Inputs: filters:string the new filters.
  var set_custom_filters_text = function (filters) {
    chrome.storage.local.set({ custom_filters: filters });
    chrome.runtime.sendMessage({ command: 'filters_updated' });
    _myfilters.rebuild();
  };

  // Get the user enterred exclude filters text as a \n-separated text string.
  var get_exclude_filters_text = function (callback) {
    if (typeof callback !== 'function') {
      return;
    }
    var localCallback = callback;
    chrome.storage.local.get('exclude_filters', function (response)
    {
      localCallback(response['exclude_filters']);
    });
  };
  // Set the exclude filters to the given \n-separated text string, and
  // rebuild the filterset.
  // Inputs: filters:string the new filters.
  var set_exclude_filters = function (filters) {
    filters = filters.trim();
    filters = filters.replace(/\n\n/g, '\n');
    chrome.storage.local.set({ exclude_filters: filters });
    FilterNormalizer.setExcludeFilters(filters);
    update_subscriptions_now();
  };
  // Add / concatenate the exclude filter to the existing excluded filters, and
  // rebuild the filterset.
  // Inputs: filter:string the new filter.
  var add_exclude_filter = function (filter) {
    get_exclude_filters_text(function (currentExcludedFilters) {
      if (currentExcludedFilters) {
        set_exclude_filters(currentExcludedFilters + '\n' + filter);
      } else {
        set_exclude_filters(filter);
      }
    });
  };

  // Removes a custom filter entry.
  // Inputs: host:domain of the custom filters to be reset.
  var remove_custom_filter = function (host) {
    get_custom_filters_text(function (text) {
      var custom_filters_arr = text ? text.split('\n') : [];
      var new_custom_filters_arr = [];
      var identifier = host;

      for (var i = 0; i < custom_filters_arr.length; i++) {
        var entry = custom_filters_arr[i];
        //Make sure that the identifier is at the start of the entry
        if (entry.indexOf(identifier) === 0) { continue; }

        new_custom_filters_arr.push(entry);
      }

      text = new_custom_filters_arr.join('\n');
      set_custom_filters_text(text.trim());
    });
  };

  var count_cache = {};
  // count_cache singleton.
  var count_cache_init = function () {
    chrome.storage.local.get('custom_filter_count', function (response)
    {
      count_cache = (function (count_map) {
        var cache = count_map;
        // Update custom filter count stored in localStorage
        var _updateCustomFilterCount = function () {
          var dataToStore = {};
          dataToStore['custom_filter_count'] = cache;
          chrome.storage.local.set(dataToStore);
        };

        return {
          // Update custom filter count cache and value stored in localStorage.
          // Inputs: new_count_map:count map - count map to replace existing count cache
          updateCustomFilterCountMap: function (new_count_map) {
            if (new_count_map) {
              new_count_map = JSON.parse(JSON.stringify(new_count_map));
            }            
            cache = new_count_map || cache;
            _updateCustomFilterCount();
          },
          // Remove custom filter count for host
          // Inputs: host:string - url of the host
          removeCustomFilterCount: function (host) {
            if (host && cache[host]) {
              delete cache[host];
              _updateCustomFilterCount();
            }
          },
          // Get current custom filter count for a particular domain
          // Inputs: host:string - url of the host
          getCustomFilterCount: function (host) {
            return cache[host] || 0;
          },
          // Add 1 to custom filter count for the filters domain.
          // Inputs: filter:string - line of text to be added to custom filters.
          addCustomFilterCount: function (filter) {
            var host = filter.split('##')[0];
            cache[host] = this.getCustomFilterCount(host) + 1;
            _updateCustomFilterCount();
          },
        };
      })(response['custom_filter_count'] || {});
    });
  };

  // Entry point for customize.js, used to update custom filter count cache.
  var updateCustomFilterCountMap = function(new_count_map) {
    count_cache.updateCustomFilterCountMap(new_count_map);
  }

  var remove_custom_filter_for_host = function(host) {
    if (count_cache.getCustomFilterCount(host)) {
      remove_custom_filter(host);
      count_cache.removeCustomFilterCount(host);
    }
  }

  var confirm_removal_of_custom_filters_on_host = function(host, activeTab) {
    var custom_filter_count = count_cache.getCustomFilterCount(host);
    var confirmation_text   = translate("confirm_undo_custom_filters", [custom_filter_count, host]);
    if (!confirm(confirmation_text)) { return; }
    remove_custom_filter_for_host(host);
    chrome.tabs.executeScript(activeTab.id, {code: 'location.reload();'});
  };


  // Rebuild the filterset based on the current settings and subscriptions.
  var update_filters = function() {
    _myfilters.rebuild();
  }

  // Fetch the latest version of all subscribed lists now.
  var update_subscriptions_now = function() {
    _myfilters.checkFilterUpdates(true);
  }

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if(request.message != 'get_subscriptions_minus_text')
      return;

    var result = get_subscriptions_minus_text();
    sendResponse(result);
  });

  // Returns map from id to subscription object.  See filters.js for
  // description of subscription object.
  var get_subscriptions_minus_text = function() {
    var result = {};
    for (var id in _myfilters._subscriptions) {
      result[id] = {};
      for (var attr in _myfilters._subscriptions[id]) {
        if ((attr === "text") || (attr === "rules")) continue;
        result[id][attr] = _myfilters._subscriptions[id][attr];
      }
    }
    return result;
  }

  // Returns map from id to subscription object.  See filters.js for
  // description of subscription object.
  // returns all subscription data which will be a large object
  var get_subscriptions = function() {
    var result = {};
    for (var id in _myfilters._subscriptions) {
      result[id] = {};
      for (var attr in _myfilters._subscriptions[id]) {
        result[id][attr] = _myfilters._subscriptions[id][attr];
      }
    }
    return result;
  }

  // Get subscribed filter lists
  var get_subscribed_filter_lists = function() {
      var subs = get_subscriptions_minus_text();
      var subscribed_filter_names = [];
      for (var id in subs) {
          if (subs[id].subscribed)
              subscribed_filter_names.push(id);
      }
      return subscribed_filter_names;
  }

  // Subscribes to a filter subscription.
  // Inputs: id: id to which to subscribe.  Either a well-known
  //             id, or "url:xyz" pointing to a user-specified list.
  //         requires: the id of a list if it is a supplementary list,
  //                   or null if nothing required
  // Returns: null, upon completion
  var subscribe = function(options) {
      _myfilters.changeSubscription(options.id, {
          subscribed: true,
          requiresList: options.requires,
          title: options.title
      });
  }

  // Unsubscribes from a filter subscription.
  // Inputs: id: id from which to unsubscribe.
  //         del: (bool) if the filter should be removed or not
  // Returns: null, upon completion.
  var unsubscribe = function(options) {
      _myfilters.changeSubscription(options.id, {
          subscribed: false,
          deleteMe: (options.del ? true : undefined)
      });
  }

  // Get the current (loaded) malware domains
  // Returns: an object with all of the malware domains
  // will return undefined, if the user is not subscribed to the Malware 'filter list'.
  var getMalwareDomains = function() {
    return _myfilters.getMalwareDomains();
  }

  // Returns true if the url cannot be blocked
  var page_is_unblockable = function(url) {
    if (!url) {
      return true;
    } else {
      var parsedUrl = parseUri(url);
      var scheme = parsedUrl.protocol;
      var pathname = parsedUrl.pathname;
      return ((scheme !== 'http:' && scheme !== 'https:' && scheme !== 'feed:') || (pathname && pathname.includes('.pdf')));
    }
  }

  // Get or set if AdBlock is paused
  // Inputs: newValue (optional boolean): if true, AdBlock will be paused, if
  //                  false, AdBlock will not be paused.
  // Returns: undefined if newValue was specified, otherwise it returns true
  //          if paused, false otherwise.
  var _adblock_is_paused = false;
  var adblock_is_paused = function (newValue) {
    if (newValue === undefined) {
      return (_adblock_is_paused === true);
    }

    _adblock_is_paused = newValue;
  };

  // Get if AdBlock is paused
  // called from content scripts
  // Returns: true if paused, false otherwise.
  var is_adblock_paused = function () {
    return adblock_is_paused();
  };

  // INFO ABOUT CURRENT PAGE

  // Get interesting information about the current tab.
  // Inputs:
  //   callback: function(info).
  //   info object passed to callback: {
  //     tab: Tab object
  //     whitelisted: bool - whether the current tab's URL is whitelisted.
  //     disabled_site: bool - true if the url is e.g. about:blank or the
  //                           Extension Gallery, where extensions don't run.
  //     total_blocked: int - # of ads blocked since install
  //     tab_blocked: int - # of ads blocked on this tab
  //     display_stats: bool - whether block counts are displayed on button
  //     display_menu_stats: bool - whether block counts are displayed on the popup menu
  //   }
  // Returns: null (asynchronous)
  var getCurrentTabInfo = function (callback, secondTime) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs) {
        return;
      }

      if (tabs.length === 0)
        return; // For example: only the background devtools or a popup are opened

      var tab = tabs[0];
      var result = {
        tab: tab,
        settings: getSettings()
      };

      if (!tab.url) {
        result.disabled_site = true;
        result.tab_blocked = 0;
      } else {
        tab.unicodeUrl = getUnicodeUrl(tab.url);
        result.disabled_site = page_is_unblockable(tab.unicodeUrl);
      }

      if (!result.disabled_site) {
        result.whitelisted = page_is_whitelisted(tab.unicodeUrl);
      }

      if (getSettings().youtube_channel_whitelist &&
          parseUri(tab.unicodeUrl).hostname === "www.youtube.com") {
        result.youTubeChannelName = frameData.get(tab.id, 0).youTubeChannelName;
      }

      result.total_blocked = blockCounts.getTotalAdsBlocked();
      if (tab.url && tab.id) {
        result.tab_blocked = blockCounts.getTotalAdsBlocked(tab.id);
        callback(result);
        return;
      } else {
        callback(result);
      }
    });
  };

  // Returns true if anything in whitelist matches the_domain.
  //   url: the url of the page
  //   type: one out of ElementTypes, default ElementTypes.document,
  //         to check what the page is whitelisted for: hiding rules or everything
  var page_is_whitelisted = function(url, type) {
    if (!url) {
      return true;
    }
    url = getUnicodeUrl(url);
    url = url.replace(/\#.*$/, ''); // Remove anchors
    if (!type)
      type = ElementTypes.document;
    var whitelist = _myfilters.blocking.whitelist;
    return whitelist.matches(url, type, parseUri(url).hostname, false);
  }

  var setBrowserActions = function(options) {
      var iconCallback = function() {
          if (chrome.runtime.lastError) {
              return;
          }
          chrome.browserAction.setBadgeText({text: options.badge_text, tabId: options.tabId});
          chrome.browserAction.setBadgeBackgroundColor({ color: options.color });
      };
      chrome.browserAction.setIcon({ tabId: options.tabId, path: options.iconPaths }, iconCallback);
  }

  var updateBadge = function(tabId) {
    var display = getSettings().display_stats;
    var badge_text = "";
    var main_frame = frameData.get(tabId, 0);
    // main_frame is undefined if the tab is a new one, so no use updating badge.
    if (!main_frame) return;

    var isBlockable = !page_is_unblockable(main_frame.url) && !page_is_whitelisted(main_frame.url) && !/chrome\/newtab/.test(main_frame.url);

    if (display && (main_frame && isBlockable) && !adblock_is_paused()) {
      var browsersBadgeOptions = {};
      browsersBadgeOptions.tabId = tabId;
      browsersBadgeOptions.color = "#555";
      var badge_text = blockCounts.getTotalAdsBlocked(tabId).toString();
      if (badge_text === "0")
          badge_text = ""; // Only show the user when we've done something useful
      browsersBadgeOptions.badge_text = badge_text;
      browsersBadgeOptions.iconPaths = {'19': 'img/icon20.png', '38': 'img/icon40.png'};
      //see for more details - https://code.google.com/p/chromium/issues/detail?id=410868#c8
      setBrowserActions(browsersBadgeOptions);
    }
  };

  // Set the button image and context menus according to the URL
  // of the current tab.
  var updateButtonUIAndContextMenus = function() {
    function setContextMenus(info) {
      chrome.contextMenus.removeAll();
      if (!getSettings().show_context_menu_items)
        return;

      if (adblock_is_paused() || info.whitelisted || info.disabled_site)
        return;

      function addMenu(title, callback) {
        chrome.contextMenus.create({
          id: title,
          title: title,
          contexts: ["all"],
          onclick: function(clickdata, tab) { callback(tab, clickdata); }
        });
      }

      addMenu(translate("block_this_ad"), function(tab, clickdata) {
        emit_page_broadcast(
          {fn:'topOpenBlacklistUI', options:{info: clickdata}},
          {tab: tab}
        );
      });

      addMenu(translate("block_an_ad_on_this_page"), function(tab) {
        emit_page_broadcast(
          {fn:'topOpenBlacklistUI', options:{nothing_clicked: true}},
          {tab: tab}
        );
      });

      var host = getUnicodeDomain(parseUri(info.tab.unicodeUrl).host);
      var custom_filter_count = count_cache.getCustomFilterCount(host);
      if (custom_filter_count) {
        addMenu(translate("undo_last_block"), function(tab) {
          confirm_removal_of_custom_filters_on_host(host, tab);
        });
      }
    }

    function setBrowserButton(info) {
      var browsersBadgeOptions = {};
      browsersBadgeOptions.tabId = info.tab.id;
      browsersBadgeOptions.color = "#555";
      browsersBadgeOptions.badge_text = "";
      if (adblock_is_paused()) {
        browsersBadgeOptions.iconPaths = {'19': "img/icon20-grayscale.png", '38': "img/icon40-grayscale.png"};
        setBrowserActions(browsersBadgeOptions);
      } else if (info.disabled_site &&
          !/^chrome-extension:.*pages\/install\//.test(info.tab.unicodeUrl)) {
        // Show non-disabled icon on the installation-success page so it
        // users see how it will normally look. All other disabled pages
        // will have the gray one
        browsersBadgeOptions.iconPaths = {'19': "img/icon20-grayscale.png", '38': "img/icon40-grayscale.png"};
        setBrowserActions(browsersBadgeOptions);
      } else if (info.whitelisted) {
        browsersBadgeOptions.iconPaths = {'19': "img/icon20-whitelisted.png", '38': "img/icon40-whitelisted.png"};
        setBrowserActions(browsersBadgeOptions);
      } else {
        updateBadge(info.tab.id);
      }
    }

    getCurrentTabInfo(function(info) {
      setContextMenus(info);
      setBrowserButton(info);
    });
  }

  // These functions are usually only called by content scripts.

  // Add a new custom filter entry.
  // Inputs: filter:string line of text to add to custom filters.
  // Returns: null if succesfull, otherwise an exception
  var add_custom_filter = function (filter, callback) {
    var newFilter = filter;
    get_custom_filters_text(function (text) {
      try {
        if (FilterNormalizer.normalizeLine(newFilter)) {
          if (Filter.isSelectorFilter(newFilter)) {
            count_cache.addCustomFilterCount(newFilter);
            updateButtonUIAndContextMenus();
          }
          if (!text) {
            text = "";
          } else {
            text += '\n';
          }
          var custom_filters = text + newFilter;
          set_custom_filters_text(custom_filters);
          if (typeof callback === 'function') {
            callback(null);
          }
        }

        if (typeof callback === 'function') {
          callback('This filter is unsupported');
        }
      } catch (ex) {
        // convert to a string so that it can be passed
        // back to content scripts
        if (typeof callback === 'function') {
          callback(ex.toString());
        }
      }
    });
  };

  // Return the contents of a local file.
  // Inputs: file:string - the file relative address, eg "js/foo.js".
  // Returns: the content of the file.
  var readfile = function (file) {
    // A bug in jquery prevents local files from being read, so use XHR.
    var xhr = new XMLHttpRequest();
    xhr.open('GET', chrome.extension.getURL(file), false);
    xhr.send();
    return xhr.responseText;
  };

  // Creates a custom filter entry that whitelists a given page
  // Inputs: url:string url of the page
  // Returns: null if successful, otherwise an exception
  var create_page_whitelist_filter = function (url) {
    var url = url.replace(/#.*$/, '');  // Remove anchors
    var parts = url.match(/^([^\?]+)(\??)/); // Detect querystring
    var has_querystring = parts[2];
    var filter = '@@|' + parts[1] + (has_querystring ? '?' : '|') + '$document';
    return add_custom_filter(filter);
  };

  // Creates a custom filter entry that whitelists a YouTube channel
  // Inputs: url:string url of the page
  // Returns: null if successful, otherwise an exception
  var create_whitelist_filter_for_youtube_channel = function (url) {
    if (/ab_channel=/.test(url)) {
      var yt_channel = url.match(/ab_channel=([^]*)/)[1];
    } else {
      var yt_channel = url.split('/').pop();
    }

    if (yt_channel) {
      var filter = '@@|https://www.youtube.com/*' + yt_channel + '|$document';
      return add_custom_filter(filter);
    }
  };

  // Listen for the message from the ytchannel.js content script
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse)
  {
    if (message.command === 'updateYouTubeWhitelistFilters') {
      var response = updateYouTubeWhitelistFilters(message.args);
      sendResponse(response);
    } else if (message.command === 'updateYouTubeChannelName') {
      var fd = frameData.get(sender.tab.id, 0);
      fd.youTubeChannelName = message.args;
      sendResponse({});
    }
  });

  // Creates a custom filter entry that whitelists a YouTube channel
  // Inputs: titles:string array of the YouTube Channels to Whitelist.
  // The titles / channel names in the input string should be parsed, and
  // URLEncoded prior to calling this function.
  // Returns: true if successful, or throws an exception.
  var updateYouTubeWhitelistFilters = function (titles) {
    if (!titles ||
        !Array.isArray(titles) ||
        titles.length < 1) {
      return true;
    }

    var newTitles = titles;
    get_custom_filters_text(function (text) {
      var customFiltersArray = text ? text.split('\n') : [];
      var newCustomFiltersArray = [];
      // First, remove any old YouTube white list filters
      if (customFiltersArray) {
        for (var inx = 0; inx < customFiltersArray.length; inx++) {
          var filter = customFiltersArray[inx];
          if (!filter.startsWith('@@|https://www.youtube.com/*')) {
            newCustomFiltersArray.push(filter);
          }
        }
      }
      // Second, add all of the YouTube channel titles
      for (var inx = 0; inx < newTitles.length; inx++)
      {
        var title = newTitles[inx];
        if (title) {
          var filter = '@@|https://www.youtube.com/*' + title + '|$document';
          newCustomFiltersArray.push(filter);
        }
      }
      // Second, add all of the YouTube channel titles
      set_custom_filters_text(newCustomFiltersArray.join('\n'));
    });
  };

  // Inputs: options object containing:
  //           domain:string the domain of the calling frame.
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (!(request.message == "get_content_script_data")) {
      return;
    }
    var options = request.opts;
    var settings = getSettings();
    var runnable = !adblock_is_paused() && !page_is_unblockable(sender.url);
    var running_top = runnable && !page_is_whitelisted(sender.tab.url);
    var running = runnable && !page_is_whitelisted(sender.url);
    var hiding = running && !page_is_whitelisted(sender.url, ElementTypes.elemhide);

    // Don't run in frame, when top frame is whitelisted
    if (!running_top && running) {
      running = false;
      hiding = false;
    }

    var result = {
      settings: settings,
      runnable: runnable,
      running: running,
      hiding: hiding
    };

    if (hiding &&
        _myfilters &&
        _myfilters.hiding &&
        settings) {
      // If |matchGeneric| is , don't test request against hiding generic rules
      var matchGeneric = _myfilters.blocking.whitelist.matches(sender.tab.url, ElementTypes.generichide, sender.tab.url);
      result.selectors = _myfilters.hiding.filtersFor(options.domain, matchGeneric);
      result.advanceSelectors = _myfilters.advanceHiding.advanceFiltersFor(options.domain);
    }
    sendResponse(result);
  });

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (!(request.message == 'open.options.page.subscriptions.add')) {
      return;
    }

    var opennedtabId = 0;
    var pageCompleteListener = function (tabId, info) {
      if (info.status == 'complete' && opennedtabId === tabId) {
        chrome.tabs.onUpdated.removeListener(pageCompleteListener);
        chrome.tabs.sendMessage(tabId, {
          message: 'addSubscription',
          title: request.title,
          url: request.url,
        });
      }
    };

    chrome.tabs.onUpdated.addListener(pageCompleteListener);
    var optionsUrl = chrome.extension.getURL('options/index.html?tab=1');
    chrome.tabs.create({ url: optionsUrl }, function (tab) {
      opennedtabId = tab.id;
    });

    sendResponse({});
  });

  // Bounce messages back to content scripts.
  var emit_page_broadcast = (function() {
    var injectMap = {
      'topOpenWhitelistUI': {
        allFrames: false,
        include: [
          "compat.js",
          "punycode.min.js",
          "jquery/jquery.min.js",
          "jquery/jquery-ui.custom.min.js",
          "uiscripts/load_jquery_ui.js",
          "uiscripts/top_open_whitelist_ui.js"
          ]
      },
      'topOpenBlacklistUI': {
        allFrames: false,
        include: [
          "compat.js",
          "punycode.min.js",
          "jquery/jquery.min.js",
          "jquery/jquery-ui.custom.min.js",
          "uiscripts/load_jquery_ui.js",
          "uiscripts/blacklisting/overlay.js",
          "uiscripts/blacklisting/clickwatcher.js",
          "uiscripts/blacklisting/elementchain.js",
          "uiscripts/blacklisting/blacklistui.js",
          "uiscripts/top_open_blacklist_ui.js"
          ]
      },
      'sendContentToBack': {
        allFrames: true,
        include: [
          "uiscripts/send_content_to_back.js"
          ]
      }
    };

    // Inject the required scripts to execute fn_name(parameter) in
    // the current tab.
    // Inputs: fn_name:string name of function to execute on tab.
    //         fn_name must exist in injectMap above.
    //         parameter:object to pass to fn_name.  Must be JSON.stringify()able.
    //         injectedSoFar?:int used to recursively inject required scripts.
    var executeOnTab = function(fn_name, parameter, injectedSoFar) {
      injectedSoFar = injectedSoFar || 0;
      var data = injectMap[fn_name];
      var details = { allFrames: data.allFrames };
      // If there's anything to inject, inject the next item and recurse.
      if (data.include.length > injectedSoFar) {
        details.file = data.include[injectedSoFar];
        chrome.tabs.executeScript(undefined, details, function() {
          executeOnTab(fn_name, parameter, injectedSoFar + 1);
        });
      }
      // Nothing left to inject, so execute the function.
      else {
        var param = JSON.stringify(parameter);
        details.code = fn_name + "(" + param + ");";
        chrome.tabs.executeScript(undefined, details);
      }
    };

    // The emit_page_broadcast() function
    var theFunction = function(request) {
      request.options = JSON.stringify(request.options);
      executeOnTab(request.fn, request.options);
    };
    return theFunction;
  })();  // end emit_page_broadcast

  var validateFilter = function (filter, returnException) {
    var response = FilterNormalizer.validateLine(filter, returnException);
    if (returnException && response && response.exception) {
      return JSON.stringify(response);
    }

    return response;
  };

  // Open the resource blocker when requested from popup.
  var launch_resourceblocker = function (query) {
    openTab('pages/resourceblock.html' + query, true);
  };

  // Get the frameData for the 'Report an Ad' & 'Resource' page
  var get_frameData = function (tabId) {
    return frameData.get(tabId);
  };

  // Process requests from 'Resource' page
  // Determine, whether requests have been whitelisted/blocked
  var process_frameData = function (fd) {
    for (var frameId in fd) {
      var frame = fd[frameId];
      var frameResources = frame.resources;
      for (var resource in frameResources) {
        var res = frameResources[resource];
        // We are processing selectors in resource viewer page
        if (res.elType === 'selector') {
          continue;
        }

        res.blockedData = _myfilters.blocking.matches(res.url, res.elType, res.frameDomain, true, true);
      }
    }

    return fd;
  };

  // Add previously cached requests to matchCache
  // Used by 'Resource' page
  var add_to_matchCache = function (cache) {
    _myfilters.blocking._matchCache = cache;
    _myfilters.blocking._numCacheEntries = Object.keys(cache).length;
  };

  // Reset matchCache
  // Used by 'Resource' page
  // Returns: object with cached requests
  var reset_matchCache = function () {
    var matchCache = _myfilters.blocking._matchCache;
    _myfilters.blocking.resetMatchCache();
    return matchCache;
  };

  // BROWSER ACTION AND CONTEXT MENU UPDATES
  if (chrome.tabs) {
    chrome.tabs.onUpdated.addListener(function(tabid, changeInfo, tab) {
      if (tab.active && changeInfo.status === "loading")
        updateButtonUIAndContextMenus();
    });
    chrome.tabs.onActivated.addListener(function() {
      updateButtonUIAndContextMenus();
    });
  }

  // Respond to calls from the content script regarding the
  // blocking of websocket requests.
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
      if (message.type !== "request.websocket") {
        return;
      }
      var data = frameData.get(sender.tab.id, sender.frameId || 0);
      if (data) {
        var blocked = _myfilters.blocking.matches(message.url, ElementTypes.websocket, data.domain);
        frameData.track({tabId: sender.tab.id, type: ElementTypes.websocket, url: message.url, frameId: sender.frameId || 0})
        frameData.storeResource(sender.tab.id, sender.frameId || 0, message.url, ElementTypes.websocket, data.domain);
        if (blocked) {
          blockCounts.recordOneAdBlocked(sender.tab.id);
          updateBadge(sender.tab.id);
        }
        log("web socket block result", blocked, data.domain, message.url.substring(0, 100));
        sendResponse(blocked);
      } else {
        sendResponse(false);
      }
  })


  var createMalwareNotification = function() {
    if (chrome &&
        chrome.notifications &&
        storage_get('malware-notification')) {

        //get the current tab, so we only create 1 notification per tab
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs) {
              return;
            }
            if (tabs.length === 0) {
                return; // For example: only the background devtools or a popup are opened
            }

            var tab = tabs[0];
            if (sessionStorage.getItem("malwareNotification" + tab.id)) {
                //we've already notified the user, just return.
                return;
            } else {
                sessionStorage.setItem("malwareNotification" + tab.id, true);
            }
            var notificationOptions = {
                title: "AdBlock",
                iconUrl: chrome.extension.getURL('img/icon48.png'),
                type: 'basic',
                priority: 2,
                message: translate('malwarenotificationmessage'),
                buttons: [{title:translate('malwarenotificationlearnmore'),
                           iconUrl:chrome.extension.getURL('img/icon24.png')},
                          {title:translate('malwarenotificationdisablethesemessages'),
                           iconUrl:chrome.extension.getURL('img/icon24.png')}]
            }
            chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
                if (buttonIndex === 0) {
                    openTab("https://help.getadblock.com/support/solutions/articles/6000055822");
                }
                if (buttonIndex === 1) {
                    storage_set('malware-notification', false);
                }
            });
            // Pop up a notification to the user.
            chrome.notifications.create((Math.floor(Math.random() * 3000)).toString(), notificationOptions, function(id) {
                    //do nothing in callback
            });
        });//end of chrome.tabs.query
    }//end of if
  }//end of createMalwareNotification function


  // YouTube Channel Whitelist
  var runChannelWhitelist = function(tabUrl, tabId) {
    if (parseUri(tabUrl).hostname === "www.youtube.com" &&
        getSettings().youtube_channel_whitelist) {
        chrome.tabs.executeScript(tabId, {file: "compat.js", runAt: "document_start"});
        chrome.tabs.executeScript(tabId, {file: "functions.js", runAt: "document_start"});
        chrome.tabs.executeScript(tabId, {file: "ytchannel.js", runAt: "document_start"});
    }
  }

  chrome.tabs.onCreated.addListener(function(tab) {
      if (chrome.runtime.lastError) {
        return;
      }
      chrome.tabs.get(tab.id, function(tabs) {
          if (chrome.runtime.lastError) {
            return;
          }
          if (tabs && tabs.url && tabs.id) {
              runChannelWhitelist(tabs.url, tabs.id);
          }
      });
  });

  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (chrome.runtime.lastError) {
      return;
    }
    if (changeInfo.status === "loading") {
      chrome.tabs.get(tabId, function(tabs) {
        if (chrome.runtime.lastError) {
          return;
        }
        if (tabs && tabs.url && tabs.id) {
          runChannelWhitelist(tabs.url, tabs.id);
        }
      });
    }
  });


  // DEBUG INFO
  // Get debug info for bug reporting and ad reporting - returns an object
var getDebugInfo = function (callback) {
  // An object, which contains info about AdBlock like
  // subscribed filter lists, settings and other settings
  var the_debug_info = {
      filter_lists: [],
      settings: [],
      other_info: [],
      custom_filters: '',
    };
  // Get subscribed filter lists
  var subs = get_subscriptions_minus_text();
  the_debug_info.filter_lists.push('=== Filter Lists ===');
  the_debug_info.filter_lists.push('');
  for (var id in subs) {
    if (subs[id].subscribed) {
      the_debug_info.filter_lists.push(id);
      the_debug_info.filter_lists.push('  last updated: ' + new Date(subs[id].last_update).toUTCString());
      the_debug_info.filter_lists.push('');
    }
  }
  // Format info about filter lists properly
  the_debug_info.filter_lists = the_debug_info.filter_lists.join('\n');
  // Get settings
  the_debug_info.settings.push('=== Settings ===');
  var settings = getSettings();
  for (var setting in settings) {
    the_debug_info.settings.push(setting + ': ' + getSettings()[setting]);
  }

  the_debug_info.settings = the_debug_info.settings.join('\n');

  the_debug_info.other_info.push('');
  the_debug_info.other_info.push('AdBlock version number: ' + chrome.runtime.getManifest().version);
  the_debug_info.other_info.push('browser =' + STATS.browser);
  the_debug_info.other_info.push('browserVersion = ' + STATS.browserVersion);
  the_debug_info.other_info.push('osVersion =' + STATS.osVersion);
  the_debug_info.other_info.push('os =' + STATS.os);
  the_debug_info.other_info.push('navigator user language =' + determineUserLanguage());
  the_debug_info.other_info.push('extension user language =' + chrome.i18n.getUILanguage());
  the_debug_info.other_info.push("is adblock paused: " + adblock_is_paused());
  the_debug_info.other_info.push('');

  if (localStorage &&
      localStorage.length) {
    the_debug_info.other_info.push('local storage data');
    the_debug_info.other_info.push('length =' + localStorage.length);
    var inx = 1;
    for (var key in localStorage) {
      the_debug_info.other_info.push('key ' + inx + ' = ' + key);
      inx++;
    }
  } else
  {
    the_debug_info.other_info.push('no local storage data');
  }

  the_debug_info.other_info.push('');
  // Get total pings
  chrome.storage.local.get('total_pings', function (storageResponse)
  {
    the_debug_info.other_info.push('total_pings =' + (storageResponse.total_pings || 0));

    // Now, add exclude filters (if there are any)
    var excludeFiltersKey = 'exclude_filters';
    chrome.storage.local.get(excludeFiltersKey, function (secondResponse)
    {
      if (secondResponse && secondResponse[excludeFiltersKey])
      {
        the_debug_info.other_info.push('==== Exclude Filters ====');
        the_debug_info.other_info.push(secondResponse[excludeFiltersKey]);
        the_debug_info.other_info.push('');
      }
      // Now, add the migration messages (if there are any)
      var migrateLogMessageKey = 'migrateLogMessageKey';
      chrome.storage.local.get(migrateLogMessageKey, function (thirdResponse)
      {
        if (thirdResponse && thirdResponse[migrateLogMessageKey])
        {
          the_debug_info.other_info.push('');
          var messages = thirdResponse[migrateLogMessageKey].split('\n');
          for (var i = 0; i < messages.length; i++)
          {
            var key = 'migration_message_' + i;
            the_debug_info.other_info.push(key + ' : ' + messages[i]);
          }

          the_debug_info.other_info.push('');
        }

        var malwareKey = 'malware-notification';
        chrome.storage.local.get(migrateLogMessageKey, function (fourthResponse)
        {
          if (fourthResponse && fourthResponse[malwareKey]) {
            // We need to hardcode malware-notification setting,
            // because it isn't included in _settings object, but just in localStorage
            the_debug_info.other_info.push('malware-notification: ' + fourthResponse[malwareKey]);
          }

          var customFiltersKey = 'custom_filters';
          chrome.storage.local.get(customFiltersKey, function (fifthResponse)
          {
            if (fifthResponse && fifthResponse[customFiltersKey]) {
              the_debug_info.custom_filters = fifthResponse[customFiltersKey];
            }

            the_debug_info.other_info = the_debug_info.other_info.join('\n');
            if (typeof callback === 'function') {
              callback(the_debug_info);
            }
          });
        });
      });
    });
  });
};

// Inputs: options object containing:
//           domain:string the domain of the calling frame.
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (!(request.message == 'debug_report_elemhide')) {
    return;
  }

  if (!window.frameData) {
    return;
  }

  if (!sender) {
    return;
  }

  var selector = request.opts.selector;
  var matches = request.opts.matches;
  var frameDomain = parseUri(sender.url || sender.tab.url).hostname;
  frameData.storeResource(sender.tab.id, sender.frameId || 0, selector, 'selector', frameDomain);

  var data = frameData.get(sender.tab.id, sender.frameId || 0);
  if (data) {
    if (loggingEnable) {
      log(data.domain, ': hiding rule', selector, 'matched:\n', matches);
    }

    blockCounts.recordOneAdBlocked(sender.tab.id);
    updateBadge(sender.tab.id);
  }

  sendResponse({});
});

 // BGcall DISPATCH
  chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse) {
      if (request.command != "call")
        return; // not for us
      // +1 button in browser action popup loads a frame which
      // runs content scripts.  Ignore their cries for ad blocking.
      if ((sender.tab === undefined) || (sender.tab === null))
        return;
      var fn = window[request.fn];
      request.args.push(sender);
      var result = fn.apply(window, request.args);
      sendResponse(result);
    }
  );

  initializeBackgroundObjects();
