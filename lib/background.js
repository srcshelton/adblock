var functions = require("functions");
var port      = require("port");
var MY        = require("myfilters");
var CP        = require("contentpolicy");
var ST        = require("stats");
var BC        = require("blockcounts");
var tabUtils  = require('sdk/tabs/utils');
//TODO - add JavaScript error reporting...

  // Send the file name and line number of any error message. This will help us
  // to trace down any frequent errors we can't confirm ourselves.
//  window.addEventListener("error", function(e) {
//    var str = "Error: " +
//             (e.filename||"anywhere").replace(chrome.extension.getURL(""), "") +
//             ":" + (e.lineno||"anywhere");
//    if (chrome && chrome.runtime && (chrome.runtime.id === "pljaalgmajnlogcgiohkhdmgpomjcihk")) {
//        var stack = "-" + ((e.error && e.error.message)||"") +
//                    "-" + ((e.error && e.error.stack)||"");
//        stack = stack.replace(/:/gi, ";").replace(/\n/gi, "");
//        //check to see if there's any URL info in the stack trace, if so remove it
//        if (stack.indexOf("http") >= 0) {
//           stack = "-removed URL-";
//        }
//        str += stack;
//    }
//    STATS.msg(str);
//    sessionStorage.setItem("errorOccurred", true);
//    functions.log(str);
//  });

  //called from bandaids, for use on our getadblock.com site
  var get_adblock_user_id = function() {
    return functions.storage_get("userid");
  };
  if (typeof exports !== 'undefined') exports.get_adblock_user_id = get_adblock_user_id;

  //called from bandaids, for use on our getadblock.com site
  var get_first_run = function() {
    return ST.STATS.firstRun;
  };
  if (typeof exports !== 'undefined') exports.get_first_run = get_first_run;

  //called from bandaids, for use on our getadblock.com site
  var set_first_run_to_false = function() {
    ST.STATS.firstRun = false;
  };
  if (typeof exports !== 'undefined') exports.set_first_run_to_false = set_first_run_to_false;

  // OPTIONAL SETTINGS

  function Settings() {
    var defaults = {
      debug_logging: false,
      youtube_channel_whitelist: false,
      show_google_search_text_ads: false,
      whitelist_hulu_ads: false, // Issue 7178
      show_context_menu_items: true,
      show_advanced_options: false,
      display_stats: true,
      show_block_counts_help_link: true,
    };
    var settings = functions.storage_get('settings') || {};
    this._data = functions.extend(defaults, settings);

  };
  Settings.prototype = {
    set: function(name, is_enabled) {
      this._data[name] = is_enabled;
      // Don't store defaults that the user hasn't modified
      var stored_data = functions.storage_get("settings") || {};
      stored_data[name] = is_enabled;
      functions.storage_set('settings', stored_data);
    },
    get_all: function() {
      return this._data;
    }
  };
  _settings = new Settings();
  if (typeof exports !== 'undefined') exports._settings = _settings;

  // Open a new tab with a given URL.
  // Inputs:
  //   url: string - url for the tab
  var openTab = function(url) {
      var tabs = require("sdk/tabs");
      var data = require("sdk/self").data;
      tabs.open(data.url(url));
  };
  if (typeof exports !== 'undefined') exports.openTab = openTab;

  //store the hidden element information on the tab.
  //the resource information is then used by the resourceblock.js
  //
  var debug_report_elemhide = function(selector, matches, sender) {

    if ((typeof sender === 'undefined') &&
        (typeof sender.tab === 'undefined') &&
        (typeof sender.tab.id === 'undefined'))
        return;

    var selectedTab = tabUtils.getTabForId(sender.tab.id);
    if (!("_getadblock_com_resources" in selectedTab)) {
        return;
    }
    if (!(selectedTab._getadblock_com_resources[0])) {
        return;
    }
    selectedTab._getadblock_com_resources[0].resources['HIDE:|:' + selector] = null;
    functions.log("hiding rule", selector, "matched:\n", matches);

  }
  if (typeof exports !== 'undefined') exports.debug_report_elemhide = debug_report_elemhide;

  // UNWHITELISTING
  // Look for a custom filter that would whitelist options.url,
  // and if any exist, remove the first one.
  // Inputs: url:string - a URL that may be whitelisted by a custom filter
  // Returns: true if a filter was found and removed; false otherwise.
  try_to_unwhitelist = function(url) {
      url = url.replace(/#.*$/, ''); // Whitelist ignores anchors
      var custom_filters = get_custom_filters_text().split('\n');
      for (var i = 0; i < custom_filters.length; i++) {
          var text = custom_filters[i];
          var whitelist = text.search(/@@\*\$document,domain=\~/);
          // Blacklist site, which is whitelisted by global @@*&document,domain=~ filter
          if (whitelist > -1) {
              // Remove protocols
              url = url.replace(/((http|https):\/\/)?(www.)?/, "").split(/[/?#]/)[0];

              text = text + "|~" + url;
              set_custom_filters_text(text);
              return true;
          } else {
              if (!MY.Filter.isWhitelistFilter(text))
                  continue;
              try {
                  var filter = MY.PatternFilter.fromText(text);
              } catch (ex) {
                  continue;
              }
              if (!filter.matches(url, MY.ElementTypes.document, false))
                  continue;

              custom_filters.splice(i, 1); // Remove this whitelist filter text
              var new_text = custom_filters.join('\n');
              set_custom_filters_text(new_text);
              return true;
          }
      }
      return false;
  }
  if (typeof exports !== 'undefined') exports.try_to_unwhitelist = try_to_unwhitelist;

  // CUSTOM FILTERS

  // Get the custom filters text as a \n-separated text string.
  get_custom_filters_text = function() {
    return functions.storage_get('custom_filters') || '';
  }
  if (typeof exports !== 'undefined') exports.get_custom_filters_text = get_custom_filters_text;

  // Set the custom filters to the given \n-separated text string, and
  // rebuild the filterset.
  // Inputs: filters:string the new filters.
  set_custom_filters_text = function(filters) {
    functions.storage_set('custom_filters', filters);
    port.chrome.extension.sendRequest({command: "filters_updated"});
    CP._myFilters.rebuild();
  }
  if (typeof exports !== 'undefined') exports.set_custom_filters_text = set_custom_filters_text;

  // Removes a custom filter entry.
  // Inputs: host:domain of the custom filters to be reset.
  remove_custom_filter = function(host) {
    var text = get_custom_filters_text();
    var custom_filters_arr = text ? text.split("\n"):[];
    var new_custom_filters_arr = [];
    var identifier = host;

    for(var i = 0; i < custom_filters_arr.length; i++) {
      var entry = custom_filters_arr[i];
      //Make sure that the identifier is at the start of the entry
      if(entry.indexOf(identifier) === 0) { continue; }
      new_custom_filters_arr.push(entry);
    }

    text = new_custom_filters_arr.join("\n");
    set_custom_filters_text(text.trim());
  }
  if (typeof exports !== 'undefined') exports.remove_custom_filter = remove_custom_filter;

  // count_cache singleton.
  var count_cache = (function(count_map) {
    var cache = count_map;
    // Update custom filter count stored in localStorage
    var _updateCustomFilterCount = function() {
      functions.storage_set("custom_filter_count", cache);
    };

    return {
      // Update custom filter count cache and value stored in localStorage.
      // Inputs: new_count_map:count map - count map to replace existing count cache
      updateCustomFilterCountMap: function(new_count_map) {
        cache = new_count_map || cache;
        _updateCustomFilterCount();
      },
      // Remove custom filter count for host
      // Inputs: host:string - url of the host
      removeCustomFilterCount: function(host) {
        if(host && cache[host]) {
          delete cache[host];
          _updateCustomFilterCount();
        }
      },
      // Get current custom filter count for a particular domain
      // Inputs: host:string - url of the host
      getCustomFilterCount: function(host) {
        return cache[host] || 0;
      },
      // Add 1 to custom filter count for the filters domain.
      // Inputs: filter:string - line of text to be added to custom filters.
      addCustomFilterCount: function(filter) {
        var host = filter.split("##")[0];
        cache[host] = this.getCustomFilterCount(host) + 1;
        _updateCustomFilterCount();
      }
    }
  })(functions.storage_get("custom_filter_count") || {});

  // Entry point for customize.js, used to update custom filter count cache.
  updateCustomFilterCountMap = function(new_count_map) {
    count_cache.updateCustomFilterCountMap(new_count_map);
  }
  if (typeof exports !== 'undefined') exports.updateCustomFilterCountMap = updateCustomFilterCountMap;

  remove_custom_filter_for_host = function(host) {
    if(count_cache.getCustomFilterCount(host)) {
      remove_custom_filter(host);
      count_cache.removeCustomFilterCount(host);
    }
  }
  if (typeof exports !== 'undefined') exports.remove_custom_filter_for_host = remove_custom_filter_for_host;

  confirm_removal_of_custom_filters_on_host = function(host) {
    var custom_filter_count = count_cache.getCustomFilterCount(host);
    var confirmation_text   = translate("confirm_undo_custom_filters", [custom_filter_count, host]);
    if (!confirm(confirmation_text)) { return; }
    remove_custom_filter_for_host(host);
  };
  if (typeof exports !== 'undefined') exports.confirm_removal_of_custom_filters_on_host = confirm_removal_of_custom_filters_on_host;

  get_settings = function() {
    return _settings.get_all();
  }
  if (typeof exports !== 'undefined') exports.get_settings = get_settings;

  set_setting = function(name, is_enabled) {
    _settings.set(name, is_enabled);

    if (name === "debug_logging")
       functions.logging(this, is_enabled);
  }
  if (typeof exports !== 'undefined') exports.set_setting = set_setting;

  // MYFILTERS PASSTHROUGHS

  // Rebuild the filterset based on the current settings and subscriptions.
  update_filters = function() {
    CP._myFilters.rebuild();
  }
  if (typeof exports !== 'undefined') exports.update_filters = update_filters;

  // Fetch the latest version of all subscribed lists now.
  update_subscriptions_now = function() {
    CP._myFilters.checkFilterUpdates(true);
  }
  if (typeof exports !== 'undefined') exports.update_subscriptions_now = update_subscriptions_now;

  // Returns map from id to subscription object.  See filters.js for
  // description of subscription object.
  get_subscriptions_minus_text = function() {
    var result = {};
    for (var id in CP._myFilters._subscriptions) {
      result[id] = {};
      for (var attr in CP._myFilters._subscriptions[id]) {
        if (attr === "text") continue;
        result[id][attr] = CP._myFilters._subscriptions[id][attr];
      }
    }
    return result;
  }
  if (typeof exports !== 'undefined') exports.get_subscriptions_minus_text = get_subscriptions_minus_text;

  // Subscribes to a filter subscription.
  // Inputs: id: id to which to subscribe.  Either a well-known
  //             id, or "url:xyz" pointing to a user-specified list.
  //         requires: the id of a list if it is a supplementary list,
  //                   or null if nothing required
  // Returns: null, upon completion
  subscribe = function(options) {
    CP._myFilters.changeSubscription(options.id, {
      subscribed: true,
      requiresList: options.requires
    });
  }
  if (typeof exports !== 'undefined') exports.subscribe = subscribe;

  // Unsubscribes from a filter subscription.
  // Inputs: id: id from which to unsubscribe.
  //         del: (bool) if the filter should be removed or not
  // Returns: null, upon completion.
  unsubscribe = function(options) {
    CP._myFilters.changeSubscription(options.id, {
      subscribed: false,
      deleteMe: (options.del ? true : undefined)
    });
  }
  if (typeof exports !== 'undefined') exports.unsubscribe = unsubscribe;

  // Returns true if the url cannot be blocked
  page_is_unblockable = function(url) {
    if (!url) { // Firefox empty/bookmarks/top sites page
      return true;
    } else {
      var scheme = functions.parseUri(url).protocol;
      return (scheme !== 'http:' && scheme !== 'https:' && scheme !== 'feed:');
    }
  }
  if (typeof exports !== 'undefined') exports.page_is_unblockable = page_is_unblockable;

  // Get or set if AdBlock is paused
  // Inputs: newValue (optional boolean): if true, AdBlock will be paused, if
  //                  false, AdBlock will not be paused.
  // Returns: undefined if newValue was specified, otherwise it returns true
  //          if paused, false otherwise.
  adblock_is_paused = function(newValue) {
    if (typeof sessionStorage === 'undefined') {
        if (newValue === undefined) {
          return (functions.storage_get('adblock_is_paused') === "true");
        }
        functions.storage_set('adblock_is_paused', newValue.toString());
    } else {
        if (newValue === undefined) {
          return (sessionStorage.getItem('adblock_is_paused') === "true");
        }
        sessionStorage.setItem('adblock_is_paused', newValue);
    }
  }
  if (typeof exports !== 'undefined') exports.adblock_is_paused = adblock_is_paused;

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
  //   }
  // Returns: null (asynchronous)
  getCurrentTabInfo = function(callback, secondTime) {
      return _getCurrentTabInfoForFirefox();

  }
  if (typeof exports !== 'undefined') exports.getCurrentTabInfo = getCurrentTabInfo;

  //Firefox specific function
  _getCurrentTabInfoForFirefox = function(callback, secondTime) {
    var tabs = require('sdk/tabs');
    if (tabs.activeTab && tabs.activeTab.url) {
      var disabled_site = page_is_unblockable(tabs.activeTab.url);
      var total_blocked = BC.blockCounts.getTotalAdsBlocked();
      var tab_blocked = BC.blockCounts.getTotalAdsBlocked(tabs.activeTab.id);
      var display_stats = get_settings().display_stats;

      var result = {
        disabled_site: disabled_site,
        total_blocked: total_blocked,
        tab_blocked: tab_blocked,
        display_stats: display_stats,
        tab: {url: tabs.activeTab.url,
            id:  tabs.activeTab.id}
      };
      if (!disabled_site)
        result.whitelisted = CP.page_is_whitelisted(tabs.activeTab.url);
      return result;
    } else {
        return null;
    }
  }

  // These functions are usually only called by content scripts.

  // Add a new custom filter entry.
  // Inputs: filter:string line of text to add to custom filters.
  // Returns: null if succesfull, otherwise an exception
  add_custom_filter = function(filter) {
    var custom_filters = get_custom_filters_text();
    try {
      if (MY.FilterNormalizer.normalizeLine(filter)) {
        if (MY.Filter.isSelectorFilter(filter)) {
          count_cache.addCustomFilterCount(filter);
        }
        custom_filters = custom_filters + '\n' + filter;
        set_custom_filters_text(custom_filters);
        return null;
      }
      return "This filter is unsupported";
    } catch(ex) {
        functions.log("background.js::add_custom_filter EXCEPTION",ex);
        functions.log(ex);
        dump(ex);
      return ex;
    }
  };
  if (typeof exports !== 'undefined') exports.add_custom_filter = add_custom_filter;

  // Creates a custom filter entry that whitelists a given page
  // Inputs: url:string url of the page
  // Returns: null if successful, otherwise an exception
  create_page_whitelist_filter = function(url) {

    var url = url.replace(/#.*$/, '');  // Remove anchors
    var parts = url.match(/^([^\?]+)(\??)/); // Detect querystring
    var has_querystring = parts[2];
    var filter = '@@|' + parts[1] + (has_querystring ? '?' : '|') + '$document';
    return add_custom_filter(filter);
  }
  if (typeof exports !== 'undefined') exports.create_page_whitelist_filter = create_page_whitelist_filter;

  // Creates a custom filter entry that whitelists YouTube channel
  // Inputs: url:string url of the page
  // Returns: null if successful, otherwise an exception
  create_whitelist_filter_for_youtube_channel = function(url) {
    if (/channel/.test(url)) {
      var get_channel = url.match(/channel=([^]*)/)[1];
    } else {
      var get_channel = url.split('/').pop();
    }
    var filter = '@@||youtube.com/*' + get_channel + '$document';
    return add_custom_filter(filter);
  }
  if (typeof exports !== 'undefined') exports.create_whitelist_filter_for_youtube_channel = create_whitelist_filter_for_youtube_channel;

  // Inputs: options object containing:
  //           domain:string the domain of the calling frame.
  get_content_script_data = function(options, sender) {
    var settings = get_settings();
    var runnable = !adblock_is_paused() && !page_is_unblockable(sender.tab.url);
    var running = runnable && !CP.page_is_whitelisted(sender.tab.url);
    var hiding = running && !CP.page_is_whitelisted(sender.tab.url,
                                                        MY.ElementTypes.elemhide);
    var result = {
      settings: settings,
      runnable: runnable,
      running: running,
      hiding: hiding
    };

    if (hiding) {
      result.selectors = CP._myFilters.hiding.filtersFor(options.domain);
    }
    return result;
  };
  if (typeof exports !== 'undefined') exports.get_content_script_data = get_content_script_data;

  // Open the resource blocker when requested
  launch_resourceblocker = function(query) {
    openTab("pages/resourceblock.html" + query, true);
  }
  if (typeof exports !== 'undefined') exports.launch_resourceblocker = launch_resourceblocker;

  // Open subscribe popup when new filter list was subscribed from site
  launch_subscribe_popup = function(loc) {
    if ((!functions.isFennec())) {
        var UI = require("uiwidgets");
        UI.openSubscribePanel(loc);
    }
  }
 if (typeof exports !== 'undefined')  exports.launch_subscribe_popup = launch_subscribe_popup;

  // Get the framedata for resourceblock
  resourceblock_get_frameData = function(tabId) {
      var tabUtils    = require('sdk/tabs/utils');
      var selectedTab = tabUtils.getTabForId(tabId);
      return selectedTab._getadblock_com_resources;
  }
  if (typeof exports !== 'undefined') exports.resourceblock_get_frameData = resourceblock_get_frameData;

  // BROWSER ACTION AND CONTEXT MENU UPDATES
  if (get_settings().debug_logging)
    require("functions").logging(this, true);

  // Record that we exist.

  ST.STATS.startPinging();
  functions.log("background: stats:firstRun " + ST.STATS.firstRun);

    // Reload the provide tab
    // To be called from popup, and options pages.
    reloadTab = function(tabId) {
        if (tabId) {
            var tabs        = require('sdk/tabs');
            for each (var tab in tabs) {
                if (tab.if === tabId) {
                    tab.reload();
                    break;
                }
            }
            //the following code can be used (uncommented when the new Firefox addon SDK is released.
//            var tabUtils = require('sdk/tabs/utils');
//            var { modelFor } = require("sdk/model/core");
//            var lowLevelTab = tabUtils.getTabForId(tabId);
//            if (lowLevelTab) {
//                var highLevelTab = modelFor(lowLevelTab);
//                highLevelTab.reload();
//            }
        }
    }
    if (typeof exports !== 'undefined') exports.reloadTab = reloadTab;

    functions.log("\n===FINISHED LOADING===\n\n");