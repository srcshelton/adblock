// Requires jquery and must be on a page with access to the background page

// MyFilters class manages subscriptions and the FilterSet.

// Constructor: merge the stored subscription data and the total possible
// list of subscriptions into this._subscriptions.  Store to disk.
// Inputs: none.
var HOUR_IN_MS = 1000 * 60 * 60;
var keyPrefix = 'filter_list_';
var keyPrefixLength = keyPrefix.length;

function MyFilters(callback) {
  var _this = this;
  this._getSubscriptions(function (subs) {
    _this._subscriptions = subs;
    if (_this._subscriptions &&
        _this._subscriptions.easylist &&
        _this._subscriptions.easylist.subscribed) {
      _this._loadEasyListFromLocalFile(true);
    }

    _this._official_options = _this._make_subscription_options();
    if (typeof callback === 'function') {
      callback();
    }
  });
}

// Update _subscriptions and _official_options in case there are changes.
// Should be invoked right after creating a MyFilters object.
MyFilters.prototype.init = function () {
  this._updateDefaultSubscriptions();
  this._updateFieldsFromOriginalOptions();

  // Build the filter list
  this._onSubscriptionChange(true);

  // On startup and then every hour, check if a list is out of date and has to
  // be updated
  var _this = this;
  if (this._newUser) {
    this._loadEasyListFromLocalFile();
    this.checkFilterUpdates(false, 'easylist');
  } else {
    idleHandler.scheduleItemOnce(
      function () {
        _this.checkFilterUpdates();
      },

      60
    );
  }

  window.setInterval(
    function () {
      idleHandler.scheduleItemOnce(function () {
        _this.checkFilterUpdates();
      });
    },

    60 * 60 * 1000
  );
};

// Update the url and requiresList for entries in _subscriptions using values from _official_options.
MyFilters.prototype._updateFieldsFromOriginalOptions = function () {

  // Use the stored properties, and only add any new properties and/or lists
  // if they didn't exist in this._subscriptions
  for (var id in this._official_options) {
    if (!this._subscriptions[id])
      this._subscriptions[id] = {};
    var sub = this._subscriptions[id];
    var official = this._official_options[id];

    sub.initialUrl = sub.initialUrl || official.url;
    sub.url = sub.url || official.url;
    if (sub.initialUrl !== official.url) {

      // The official URL was changed. Use it. In case of a redirect, this
      // doesn't happen as only sub.url is changed, not sub.initialUrl.
      sub.initialUrl = official.url;
      sub.url = official.url;
    }

    var isMissingRequiredList = (sub.requiresList !== official.requiresList);
    if (official.requiresList && isMissingRequiredList && sub.subscribed) {

      // A required list was added.  Make sure main list subscribers get it.
      if (this._subscriptions[official.requiresList])
        this.changeSubscription(official.requiresList, { subscribed: true });
    }

    sub.requiresList = official.requiresList;
    sub.subscribed = sub.subscribed || false;
  }
};

// Update default subscriptions in the browser storage.
// Removes subscriptions _this are no longer in the official list, not user submitted and no longer subscribed.
// Also, converts user submitted subscriptions to recognized one if it is already added to the official list
// and vice-versa.
MyFilters.prototype._updateDefaultSubscriptions = function () {
  if (this._newUser) {

    // Brand new user. Install some filters for them.
    this._subscriptions = this._load_default_subscriptions();
    return;
  }

  for (var id in this._subscriptions) {

    // Delete unsubscribed ex-official lists.
    if (!this._official_options[id] && !this._subscriptions[id].user_submitted
        && !this._subscriptions[id].subscribed) {
      delete this._subscriptions[id];
    }

    // Convert subscribed ex-official lists into user-submitted lists.
    // Convert subscribed ex-user-submitted lists into official lists.
    else {

      // Cache subscription that needs to be checked.
      var subToCheck = this._subscriptions[id];
      var isUserSubmitted = true;
      var updateID = id;
      if (!this._official_options[id]) {

        // If id is not in official options, check if there's a matching url in the
        // official list. If there is, then the subscription is not user submitted.
        for (var officialID in this._official_options) {
          var officialURL = this._official_options[officialID].url;
          if (subToCheck.initialUrl === officialURL
            || subToCheck.url === officialURL) {
            isUserSubmitted = false;
            updateID = officialID;
            break;
          }
        }
      } else {
        isUserSubmitted = false;
      }

      subToCheck.user_submitted = isUserSubmitted;

      // Function that will add a new entry with updated id,
      // and will remove old entry with outdated id.
      var _this = this;
      var renameSubscription = function (newID, newID) {
        _this._subscriptions[newID] = _this._subscriptions[newID];
        delete _this._subscriptions[newID];
      };

      // Create new id and check if new id is the same as id.
      // If not, update entry in subscriptions.
      var newID = isUserSubmitted ? ('url:' + subToCheck.url) : updateID;

      if (newID !== id) {
        renameSubscription(id, newID);
      }
    }
  }
};

// When a subscription property changes, this function stores it
// Inputs: rebuild? boolean, true if the filterset should be rebuilt
MyFilters.prototype._onSubscriptionChange = function (rebuild) {
  this._saveSubscriptions();

  // The only reasons to (re)build the filter set are
  // - when AdBlock starts
  // - when a filter list text is changed ([un]subscribed or updated a list)
  if (rebuild)
    this.rebuild();

  chrome.runtime.sendMessage({ command: 'filters_updated' });
};

// get filters that are defined in the extension
MyFilters.prototype.getExtensionFilters = function (settings) {
  var texts = [];
  if (settings.whitelist_hulu_ads) {

    // Issue 7178: FilterNormalizer removes EasyList's too-broad Hulu whitelist
    // entries.  If the user enables whitelist_hulu_ads, just add them back.
    // This workaround can be removed when EasyList changes its Hulu strategy.
    texts.push('@@||ads.hulu.com/published/*.flv');
    texts.push('@@||ads.hulu.com/published/*.mp4');
    texts.push('@@||ll.a.hulu.com/published/*.flv');
    texts.push('@@||ll.a.hulu.com/published/*.mp4');
  }

  return texts;
};

// Rebuild filters based on the current settings and subscriptions.
MyFilters.prototype.rebuild = function () {
  var texts = [];

  // Only add subscriptions in Chrome, Opera, and older version of Safari...
  for (var id in this._subscriptions) {
    if (this._subscriptions[id].subscribed) {
      texts.push(this._subscriptions[id].text);
    }
  }

  // Include custom filters.
  var _this = this;
  get_custom_filters_text(function (customfilters) {

    if (customfilters) {
      texts.push(FilterNormalizer.normalizeList(customfilters));
    }

    texts = texts.concat(_this.getExtensionFilters(getSettings()));
    texts = texts.join('\n').split('\n');

    var filters = _this._splitByType(texts);

    _this.hiding = FilterSet.fromFilters(filters.hiding);

    _this.blocking = new BlockingFilterSet(
      FilterSet.fromFilters(filters.pattern),
      FilterSet.fromFilters(filters.whitelist)
    );

    handlerBehaviorChanged(); // defined in background

    //if the user is subscribed to malware, then get it
    if (_this._subscriptions &&
        _this._subscriptions.malware &&
        _this._subscriptions.malware.subscribed &&
        !_this.getMalwareDomains()) {
      _this._initializeMalwareDomains();
    }

    // After 90 seconds, delete the cache. That way the cache is available when
    // rebuilding multiple times in a row (when multiple lists have to update at
    // the same time), but we save memory during all other times.
    window.setTimeout(function () {
      Filter._cache = {};
    }, 90000);
  });
};

MyFilters.prototype._splitByType = function (texts) {

    // Remove duplicates and empties.
    var unique = {};
    for (var i = 0; i < texts.length; i++) {
      unique[texts[i]] = 1;
    }

    delete unique[''];

    var filters = { hidingUnmerged: [], hiding: {}, exclude: {},
                    pattern: {}, whitelist: {}, };
    for (var text in unique) {
      var filter = Filter.fromText(text);
      if (Filter.isSelectorExcludeFilter(text)) {
        setDefault(filters.exclude, filter.selector, []).push(filter);
      } else if (Filter.isSelectorFilter(text)) {
        filters.hidingUnmerged.push(filter);
      } else if (Filter.isWhitelistFilter(text)) {
        filters.whitelist[filter.id] = filter;
      } else {
        filters.pattern[filter.id] = filter;
      }
    }

    for (var i = 0; i < filters.hidingUnmerged.length; i++) {
      filter = filters.hidingUnmerged[i];
      var hider = SelectorFilter.merge(filter, filters.exclude[filter.selector]);
      filters.hiding[hider.id] = hider;
    }

    return filters;
  };

// Change a property of a subscription or check if it has to be updated
// Inputs: id: the id of the subscription to change
//         subData: object containing all data that should be changed
//         forceFetch: if the subscriptions have to be fetched again forced
MyFilters.prototype.changeSubscription = function (id, subData, forceFetch) {
  var subscribeRequiredListToo = false;
  var listDidntExistBefore = false;

  // Check if the list has to be updated
  function outOfDate(subscription) {
    if (forceFetch) {
      return true;
    }

    // After a failure, wait at least a day to refetch (overridden below if
    // it's a new filter list, having no .text)
    var failedAt = subscription.last_update_failed_at || 0;
    if (Date.now() - failedAt < HOUR_IN_MS * 24) {
      return false;
    }

    // Don't let expiresAfterHours delay indefinitely (Issue 7443)
    var hardStop = subscription.expiresAfterHoursHard || 240;
    var smallerExpiry = Math.min(subscription.expiresAfterHours, hardStop);
    var millis = Date.now() - subscription.last_update;
    var returnVal = (millis > HOUR_IN_MS * smallerExpiry);
    return returnVal;
  }

  //since the malware ID isn't really a filter list, we need to process it seperately
  if (id === 'malware') {

    // Apply all changes from subData
    for (var property in subData) {
      if (subData[property] !== undefined) {
        this._subscriptions[id][property] = subData[property];
      }
    }

    if (this._subscriptions[id].subscribed) {

      //if forceFetch, set the last update timestamp of the malware to zero, so it's updated now.
      if (forceFetch) {
        this._subscriptions.malware.last_update = 0;
      }

      //load the malware domains
      this._loadMalwareDomains();
    } else {
      if (this.blocking) {
        this.blocking.setMalwareDomains(null);
      }

      // If unsubscribed, remove properties
      delete this._subscriptions[id].text;
      delete this._subscriptions[id].last_update;
      delete this._subscriptions[id].expiresAfterHours;
      delete this._subscriptions[id].last_update_failed_at;
      delete this._subscriptions[id].last_modified;
    }

    this._onSubscriptionChange(subData.subscribed == false);
    return;
  }

  // Working with an unknown list: create the list entry
  if (!this._subscriptions[id]) {
    id = this.customToDefaultId(id);
    if (/^url\:.*/.test(id)) {
      listDidntExistBefore = true;
      this._subscriptions[id] = {
        user_submitted: true,
        initialUrl: id.substr(4),
        url: id.substr(4),
        title: subData.title,
      };
    }

    subscribeRequiredListToo = true;
  }

  // Subscribing to a well known list should also subscribe to a required list
  if (!this._subscriptions[id].subscribed && subData.subscribed)
    subscribeRequiredListToo = true;

  // Apply all changes from subData
  for (var property in subData)
    if (subData[property] !== undefined)
      this._subscriptions[id][property] = subData[property];

  // Check if the required list is a well known list, but only if it is changed
  if (subData.requiresList)
    this._subscriptions[id].requiresList =
                   this.customToDefaultId(this._subscriptions[id].requiresList);

  if (forceFetch)
    delete this._subscriptions[id].last_modified;

  if (this._subscriptions[id].subscribed) {
    if ((!this._subscriptions[id].text) ||
         outOfDate(this._subscriptions[id])) {
      this.fetch_and_update(id, listDidntExistBefore);
    }
  } else {

    // If unsubscribed, remove some properties
    delete this._subscriptions[id].text;
    delete this._subscriptions[id].last_update;
    delete this._subscriptions[id].expiresAfterHours;
    delete this._subscriptions[id].last_update_failed_at;
    delete this._subscriptions[id].last_modified;
    if (this._subscriptions[id].deleteMe) {

      // Need to remove the filter list from memory, and permanent storage
      delete this._subscriptions[id];
      chrome.storage.local.remove(keyPrefix + id);
    }
  }

  // Notify of change.  If we subscribed, we rebuilt above; so we
  // only force a rebuild if we unsubscribed.
  this._onSubscriptionChange(subData.subscribed == false);

  // Subscribe to a required list if nessecary
  if (subscribeRequiredListToo && this._subscriptions[id] && this._subscriptions[id].requiresList) {
    var requiredList = this._subscriptions[id].requiresList;
    this.changeSubscription(requiredList, { subscribed: true });
  }

};

// Fetch a filter list and parse it
// id:        the id of the list
// isNewList: true when the list is completely new and must succeed or
//            otherwise it'll be deleted.
MyFilters.prototype.fetch_and_update = function (id, isNewList) {
  var url = this._subscriptions[id].url;
  var _this = this;
  function onError() {
    _this._subscriptions[id].last_update_failed_at = Date.now();
    _this._onSubscriptionChange();
    if (isNewList) {

      // Delete the list. The user subscribed to an invalid list URL.
      // Delay it a bit, so subscribe.html can first finish it's async call to
      // see if the subscription succeeded or not. Otherwise it assumes it was
      // a well-known subscription and will report a succesfull fetch
      window.setTimeout(function () {
        _this.changeSubscription(id, { subscribed: false, deleteMe: true });
      }, 500);
    }
  }

  var ajaxRequest = {
    jsonp: false,
    url: url,
    cache: false,
    headers: {
      Accept: 'text/plain',
      'X-Client-ID': 'AdBlock/' + STATS.version,
      'If-Modified-Since': this._subscriptions[id].last_modified || undefined,
    },
    success: function (text, status, xhr) {

      // In case the subscription disappeared while we were out
      if (!_this._subscriptions[id] ||
          !_this._subscriptions[id].subscribed)
        return;

      // Sometimes text is "". Happens sometimes.  Weird, I know.
      // Every legit list starts with a comment.
      if (status == 'notmodified') {
        log('List not modified ', id, url);
        _this._updateSubscriptionText(id, _this._subscriptions[id].text);
        _this._onSubscriptionChange(true);
      } else if (text &&
                 (((typeof text === 'string') &&
                   text.length != 0 && Filter.isComment(text.trim())) ||
                  (typeof text === 'object'))) {
        log('Fetched ', id, url);
        _this._updateSubscriptionText(id, text, xhr);
        _this._onSubscriptionChange(true);
      } else {
        log('Fetched, but invalid list ' + url);
        onError();
      }
    },

    error: function (xhr, textStatus, errorThrown) {
      if (_this._subscriptions[id])
        onError();
      log('Error fetching ' + url);
      log('textStatus ' + textStatus);
      log('errorThrown ' + errorThrown);
    },
  };
  $.ajax(ajaxRequest);
};

// Record that subscription_id is subscribed, was updated now, and has
// the given text.  Requires that this._subscriptions[subscription_id] exists.
// The xhr variable can be used to search the response headers
MyFilters.prototype._updateSubscriptionText = function (id, text, xhr) {
  this._subscriptions[id].last_update = Date.now();
  delete this._subscriptions[id].last_update_failed_at;

  // In case the resource wasn't modified, there is no need to reparse this.
  // xhr isn't send in this case. Do reparse .text, in case we had some update
  // which modified the checks in filternormalizer.js.
  if (xhr) {

    // Store the last time a resource was modified on the server, so we won't re-
    // fetch if it wasn't modified. It is null if the server doesn't support this.
    this._subscriptions[id].last_modified = xhr.getResponseHeader('Last-Modified');

    // Record how many hours until we need to update the subscription text. This
    // can be specified in the file. Defaults to 120.
    this._subscriptions[id].expiresAfterHours = 120;
    var checkLines = text.split('\n', 15); //15 lines should be enough
    var expiresRegex = /(?:expires\:|expires\ after\ )\ *(\d+)\ ?(h?)/i;
    var redirectRegex = /(?:redirect\:|redirects\ to\ )\ *(https?\:\/\/\S+)/i;
    for (var i = 0; i < checkLines.length; i++) {
      if (!Filter.isComment(checkLines[i]))
        continue;
      var match = checkLines[i].match(redirectRegex);
      if (match && match[1] !== this._subscriptions[id].url) {
        this._subscriptions[id].url = match[1]; //assuming the URL is always correct

        // Force an update.  Even if our refetch below fails we'll have to
        // fetch the new URL in the future until it succeeds.
        this._subscriptions[id].last_update = 0;
      }

      match = checkLines[i].match(expiresRegex);
      if (match && parseInt(match[1], 10)) {
        var hours = parseInt(match[1], 10) * (match[2] == 'h' ? 1 : 24);
        this._subscriptions[id].expiresAfterHours = Math.min(hours, 21 * 24); // 3 week maximum
      }
    }

    // Smear expiry (Issue 7443)
    this._subscriptions[id].expiresAfterHoursHard = this._subscriptions[id].expiresAfterHours * 2;
    var smear = Math.random() * 0.4 + 0.8;
    this._subscriptions[id].expiresAfterHours *= smear;
  }

  this._subscriptions[id].text = FilterNormalizer.normalizeList(text);

  // The url changed. Simply refetch...
  if (this._subscriptions[id].last_update === 0)
    this.changeSubscription(id, {}, true);
};

// Checks if subscriptions have to be updated
// Inputs: force? (boolean), true if every filter has to be updated
//         idToIgnore a string containing the id of any subscription which should not be updated,
//         used only when the AdBlock is installed (new user)
MyFilters.prototype.checkFilterUpdates = function (force, idToIgnore) {
  var key = 'last_subscriptions_check';
  var now = Date.now();
  var forceLocal = force;
  var idToIgnoreLocal = idToIgnore;
  var _this = this;
  chrome.storage.local.get(key, function (response)
  {
    var delta = now - (response[key] || now);
    var deltaHours = delta / HOUR_IN_MS;
    var saveData = {};
    saveData[key] = now;
    chrome.storage.local.set(saveData);
    if (deltaHours > 24) {

      // Extend expiration of subscribed lists (Issue 7443)
      for (var id in _this._subscriptions) {
        if (_this._subscriptions[id].subscribed) {
          _this._subscriptions[id].expiresAfterHours += deltaHours;
        }
      }

      _this._onSubscriptionChange(); // Store the change
    }

    for (var id in _this._subscriptions) {
      if (_this._subscriptions[id].subscribed && id !== idToIgnoreLocal) {
        _this.changeSubscription(id, {}, forceLocal);
      }
    }
  });
};

// Checks if a custom id is of a known list
// Inputs: id: the list id to compare
// Returns the id that should be used
MyFilters.prototype.customToDefaultId = function (id) {
  var urlOfCustomList = id.substr(4);
  for (var defaultList in this._official_options)
    if (this._official_options[defaultList].url == urlOfCustomList)
      return defaultList;
  return id;
};

//Retreive the list of malware domains from our site.
//and set the response (list of domains) on the blocking
//filter set for processing.
//Retreive the list of malware domains from our site.
//and set the response (list of domains) on the blocking
//filter set for processing.
MyFilters.prototype._loadMalwareDomains = function () {

    function outOfDate(subscription) {

      // After a failure, wait at least a day to refetch (overridden below if
      // it has no .text)
      var failedAt = subscription.last_update_failed_at || 0;
      if (Date.now() - failedAt < HOUR_IN_MS * 24)
        return false;
      var hardStop = subscription.expiresAfterHoursHard || 240;
      var smallerExpiry = Math.min((subscription.expiresAfterHours || 24), hardStop);
      var millis = Date.now() - (subscription.last_update || 0);
      return (millis > HOUR_IN_MS * smallerExpiry);
    }

    if (!this._subscriptions.malware.text ||
        !this.getMalwareDomains() ||
        outOfDate(this._subscriptions.malware)) {
      var url = this._subscriptions.malware.url + '?_=' + new Date().getTime();

      // Fetch file with malware-known domains
      var xhr = new XMLHttpRequest();
      var _this = this;
      xhr.onerror = function (e) {

          //if the request fail, retry the next time
          _this._subscriptions.malware.last_update_failed_at = Date.now();
        };

      xhr.onload = function (e) {
          if (!xhr.responseText) {
            _this._subscriptions.malware.last_update_failed_at = Date.now();
            return;
          }

          // Convert the filter list to an array of domains
          var domains = [];
          var lines = xhr.responseText.split('\n');
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i];

            // The entries we're interested in, should be of the form: ||domain.org^
            // Ignore all others
            if (line.charAt(0) !== '!' &&
                line.charAt(0) !== '[' &&
                line.charAt(0) === '|' &&
                line.charAt(1) === '|') {

              line = line.substr(2); // remove preceeding ||
              line = line.substring(0, line.length - 1); // # remove ending ^
              //convert any non-ascii characters to ascii (punycode)
              line = getUnicodeDomain(line.toLowerCase());
              domains.push(line);
            }
          }

          var malwareObj = {};
          malwareObj['adware'] = domains;

          //make sure the blocking filter set exists (it may not in Safari 9)
          if (_this.blocking) {
            _this.blocking.setMalwareDomains(malwareObj);
          }

          //set the malware object on the 'text' property so it's persisted to storage
          _this._subscriptions.malware.text = malwareObj;
          _this._subscriptions.malware.last_update = Date.now();
          _this._subscriptions.malware.last_modified = Date.now();
          delete _this._subscriptions.malware.last_update_failed_at;

          // since the Malware file is updated ~1 day
          // expiration is around 24 hours.
          _this._subscriptions.malware.expiresAfterHours = 24;
          var smear = Math.random() * 0.4 + 0.8;
          _this._subscriptions.malware.expiresAfterHours *= smear;
          chrome.runtime.sendMessage({ command: 'filters_updated' });
          log('Fetched ' + url);
        };

      xhr.open('GET',  url);
      xhr.send();
    }
  };

//Retreive the list of malware domains from our site.
//and set the response (list of domains) on the blocking
//filter set for processing.
MyFilters.prototype._initializeMalwareDomains = function () {
    if (this._subscriptions.malware.text) {
      this.blocking.setMalwareDomains(this._subscriptions.malware.text);
    } else {
      this._loadMalwareDomains();
    }
  };

//Get the current list of malware domains
//will return undefined, if the user is not subscribed to the Malware 'filter list'.
MyFilters.prototype.getMalwareDomains = function () {

    //make sure the blocking filter set exists (it may not in Safari 9)
    if (this.blocking) {
      return this.blocking.getMalwareDomains();
    } else {
      return this._subscriptions.malware.text;
    }
  };

// If the user wasn't subscribed to any lists, subscribe to
// EasyList, AdBlock custom and (if any) a localized subscription
// Inputs: none.
// Returns an object containing the subscribed lists
MyFilters.prototype._load_default_subscriptions = function () {
  var result = {};

  // Returns the ID of the list appropriate for the user's locale, or ''
  function listIdForThisLocale() {
    var language = determineUserLanguage();
    switch (language) {
      case 'ar': return 'easylist_plus_arabic';
      case 'bg': return 'easylist_plus_bulgarian';
      case 'cs': return 'czech';
      case 'cu': return 'easylist_plus_bulgarian';
      case 'da': return 'danish';
      case 'de': return 'easylist_plus_german';
      case 'el': return 'easylist_plus_greek';
      case 'es': return 'easylist_plus_spanish';
      case 'et': return 'easylist_plus_estonian';
      case 'fi': return 'easylist_plus_finnish';
      case 'fr': return 'easylist_plus_french';
      case 'he': return 'israeli';
      case 'hu': return 'hungarian';
      case 'is': return 'icelandic';
      case 'it': return 'italian';
      case 'id': return 'easylist_plus_indonesian';
      case 'ja': return 'japanese';
      case 'ko': return 'easylist_plun_korean';
      case 'lt': return 'easylist_plus_lithuania';
      case 'lv': return 'latvian';
      case 'nl': return 'dutch';
      case 'pl': return 'easylist_plus_polish';
      case 'ro': return 'easylist_plus_romanian';
      case 'ru': return 'russian';
      case 'sk': return 'czech';
      case 'sv': return 'swedish';
      case 'tr': return 'turkish';
      case 'uk': return 'russian';
      case 'zh': return 'chinese';
      default: return '';
    }
  }

  //Update will be done immediately after this function returns
  result['adblock_custom'] = { subscribed: true };
  result['easylist'] = { subscribed: true };
  result['acceptable_ads'] = { subscribed: true };
  var listForLang = listIdForThisLocale();
  if (listForLang)
    result[listForLang] = { subscribed: true };
  return result;
};

// Used to create the list of default subscriptions
// Called when MyFilters is created.
// Returns: that list
MyFilters.prototype._make_subscription_options = function () {

  // When modifying a list, IDs mustn't change!
  return {
    adblock_custom: { // AdBlock custom filters
      url: 'https://cdn.adblockcdn.com/filters/adblock_custom.txt',
    },
    easylist: { // EasyList
      url: 'https://easylist-downloads.adblockplus.org/easylist.txt',
    },
    easylist_plus_bulgarian: { // Additional Bulgarian filters
      url: 'https://easylist-downloads.adblockplus.org/bulgarian_list+easylist.txt',
      requiresList: 'easylist',
    },
    dutch: { // Additional Dutch filters
      url: 'https://easylist-downloads.adblockplus.org/easylistdutch.txt',
      requiresList: 'easylist',
    },
    easylist_plus_finnish: { // Additional Finnish filters
      url: 'http://adb.juvander.net/Finland_adb.txt',
      requiresList: 'easylist',
    },
    easylist_plus_french: { // Additional French filters
      url: 'https://easylist-downloads.adblockplus.org/liste_fr.txt',
      requiresList: 'easylist',
    },
    easylist_plus_german: { // Additional German filters
      url: 'https://easylist-downloads.adblockplus.org/easylistgermany.txt',
      requiresList: 'easylist',
    },
    easylist_plus_greek: { // Additional Greek filters
      url: 'https://www.void.gr/kargig/void-gr-filters.txt',
      requiresList: 'easylist',
    },
    easylist_plus_indonesian: { // Additional Indonesian filters
      url: 'https://easylist-downloads.adblockplus.org/abpindo+easylist.txt',
    },
    easylist_plus_polish: { // Additional Polish filters
      url: 'https://www.certyficate.it/adblock/adblock.txt',
      requiresList: 'easylist',
    },
    easylist_plus_romanian: { // Additional Romanian filters
      url: 'http://www.zoso.ro/pages/rolist.txt',
      requiresList: 'easylist',
    },
    russian: { // Additional Russian filters
      url: 'https://easylist-downloads.adblockplus.org/advblock.txt',
      requiresList: 'easylist',
    },
    chinese: { // Additional Chinese filters
      url: 'https://easylist-downloads.adblockplus.org/easylistchina.txt',
      requiresList: 'easylist',
    },
    czech: { // Additional Czech and Slovak filters
      url: 'https://raw.github.com/tomasko126/easylistczechandslovak/master/filters.txt',
      requiresList: 'easylist',
    },
    danish: { // Danish filters
      url: 'http://adblock.schack.dk/block.txt',
    },
    hungarian: { // Hungarian filters
      url: 'https://raw.githubusercontent.com/szpeter80/hufilter/master/hufilter.txt',
    },
    israeli: { // Israeli filters
      url: 'https://easylist-downloads.adblockplus.org/israellist+easylist.txt',
    },
    italian: { // Italian filters
      url: 'https://easylist-downloads.adblockplus.org/easylistitaly.txt',
      requiresList: 'easylist',
    },
    japanese: { // Japanese filters
      url: 'https://raw.githubusercontent.com/k2jp/abp-japanese-filters/master/abpjf.txt',
    },
    easylist_plun_korean: {  // Korean filters
      url: 'https://secure.fanboy.co.nz/fanboy-korean.txt',
    },
    latvian: {  // Latvian filters
      url: 'https://notabug.org/latvian-list/adblock-latvian/raw/master/lists/latvian-list.txt',
    },
    swedish: {  // Swedish filters
      url: 'http://fanboy.co.nz/fanboy-swedish.txt',
    },
    turkish: {  // Turkish filters
      url: 'http://fanboy.co.nz/fanboy-turkish.txt',
    },
    easyprivacy: { // EasyPrivacy
      url: 'https://easylist-downloads.adblockplus.org/easyprivacy.txt',
    },
    antisocial: { // Antisocial
      url: 'https://easylist-downloads.adblockplus.org/fanboy-social.txt',
    },
    malware: { // Malware protection
      url: 'https://easylist-downloads.adblockplus.org/malwaredomains_full.txt',
    },
    annoyances: { // Fanboy's Annoyances
      url: 'https://easylist-downloads.adblockplus.org/fanboy-annoyance.txt',
    },
    warning_removal: { // AdBlock warning removal
      url: 'https://easylist-downloads.adblockplus.org/antiadblockfilters.txt',
    },
    acceptable_ads: { // Acceptable Ads
      url: 'https://easylist-downloads.adblockplus.org/exceptionrules.txt',
    },
    easylist_plus_estonian: { // Estonian filters
      url: 'http://gurud.ee/ab.txt',
      requiresList: 'easylist',
    },
    easylist_plus_lithuania: { // Lithuania filters
      url: 'http://margevicius.lt/easylistlithuania.txt',
      requiresList: 'easylist',
    },
    easylist_plus_arabic: { // Arabic filters
      url: 'https://easylist-downloads.adblockplus.org/Liste_AR.txt',
      requiresList: 'easylist',
    },
    icelandic: { // Icelandic filters
      url: 'http://adblock.gardar.net/is.abp.txt',
    },
    easylist_plus_spanish: { // Spanish filters
      url: 'https://easylist-downloads.adblockplus.org/easylistspanish.txt',
      requiresList: 'easylist',
    },
  };
};

/* subscription properties:
url (string): url of subscription
initialUrl (string): the hardcoded url. Same as .url except when redirected
user_submitted (bool): submitted by the user or not
requiresList (string): id of a list required for this list
subscribed (bool): if you are subscribed to the list or not
last_update (date): time of the last succesfull update
last_modified (string): time of the last change on the server
last_update_failed_at (date): if set, when the last update attempt failed
text (string): the filters of the subscription
expiresAfterHours (int): the time after which the subscription expires
expiresAfterHoursHard (int): we must redownload subscription after this delay
deleteMe (bool): if the subscription has to be deleted
*/

MyFilters.prototype._saveSubscriptions = function () {
  var result = {};
  for (var id in this._subscriptions) {
    result[keyPrefix + id] = {};
    for (var attr in this._subscriptions[id]) {
      result[keyPrefix + id][attr] = this._subscriptions[id][attr];
    }
  }

  chrome.storage.local.set(result, function () {
      if (chrome.runtime.lastError) {
        log('write failure', chrome.runtime.lastError);
      }
    });
};

MyFilters.prototype._getSubscriptions = function (callback) {
  var _this = this;
  chrome.storage.local.get(undefined, function (readResponse) {
    if (chrome.runtime.lastError) {
      log('read failure', chrome.runtime.lastError);
    }

    var readResult = {};
    for (var fullID in readResponse) {
      if (fullID.startsWith(keyPrefix)) {
        var id = fullID.substring(keyPrefixLength);
        readResult[id] = {};
        for (var attr in readResponse[fullID]) {
          readResult[id][attr] = readResponse[fullID][attr];
        }
      }
    }

    _this._newUser = (Object.keys(readResult).length === 0);
    if (typeof callback === 'function') {
      callback(readResult);
    }
  });
};

MyFilters.prototype._loadEasyListFromLocalFile = function (rebuild) {
  var _this = this;
  if (this._subscriptions &&
      this._subscriptions.easylist) {

    // Add a fake rule that will be over written when the file is successfully read from the local file
    // This prevents the check later in the processing to incorrectly retrieving easylist from the web site.
    _this._subscriptions.easylist.text = FilterNormalizer.normalizeList('&ad_box_');
  }

  var ajaxRequest = {
    jsonp: false,
    url: chrome.extension.getURL('filters/easylist.txt'),
    headers: {
      Accept: 'text/plain'
    },
    dataType: 'text',
    success: function (text, status, xhr) {
      if (xhr.readyState === 4 && status === 'success' && text) {
        _this._subscriptions.easylist.text = FilterNormalizer.normalizeList(text);
        var currentTimeInMs = Date.now();

        // Subtract 241 hours from current time to
        // force a downloaded during the next filter list check
        currentTimeInMs = currentTimeInMs - (241 * HOUR_IN_MS);

        _this._subscriptions.easylist.last_update = currentTimeInMs;
        _this._subscriptions.easylist.last_modified = currentTimeInMs;
        _this._subscriptions.easylist.expiresAfterHours = 120;
        if (rebuild) {
          _this.rebuild();
        }
      }
    },

    error: function (xhr, textStatus, errorThrown) {
      log('load easylist from file failed');

      // If there's an error reading the local file, force a download of easylist
      _this._subscriptions.easylist.last_update_failed_at = Date.now();
      _this.changeSubscription('easylist', {}, true);
    },
  };
  $.ajax(ajaxRequest);
};
