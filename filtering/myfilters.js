// Requires jquery and must be on a page with access to the background page

// MyFilters class manages subscriptions and the FilterSet.

// Constructor: merge the stored subscription data and the total possible
// list of subscriptions into this._subscriptions.  Store to disk.
// Inputs: none.
var HOUR_IN_MS = 1000 * 60 * 60;

function MyFilters(callback) {
  var _this = this;
  this._readyComplete;
  this._promise = new Promise(function (resolve, reject) {
      _this._readyComplete = resolve;
    });

  this._getSubscriptions(function (subs) {
    _this._subscriptions = subs;
    _this._official_options = _this._make_subscription_options();
    if (typeof callback === 'function') {
      callback();
    }
  });
}

// Update _subscriptions and _official_options in case there are changes.
// Should be invoked right after creating a MyFilters object.
MyFilters.prototype.init = function (callback) {
  this._updateDefaultSubscriptions();
  this._updateFieldsFromOriginalOptions();

  var _this = this;
  // Build the filter list
  this._onSubscriptionChange(true);

  // On startup and then every hour, check if a list is out of date and has to
  // be updated
  var _this = this;
  if (this._newUser) {
    this.checkFilterUpdates();
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

  if (typeof callback === 'function') {
    callback();
  }
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
  if (rebuild) {
    this.rebuild();
  }

  chrome.runtime.sendMessage({ command: 'filters_updated' });
};

MyFilters.prototype.ready = function () {
  return this._promise;
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

    texts = texts.join('\n').split('\n');

    var filters = _this._splitByType(texts);

    _this.hiding = FilterSet.fromFilters(filters.hiding);

    _this.blocking = new BlockingFilterSet(
      FilterSet.fromFilters(filters.pattern),
      FilterSet.fromFilters(filters.whitelist)
    );

    handlerBehaviorChanged(); // defined in background

    _this._readyComplete();

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
    if (forceFetch) return true;

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
MyFilters.prototype.checkFilterUpdates = function (force) {

  var key = 'last_subscriptions_check';
  var now = Date.now();
  var forceLocal = force;
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
      if (_this._subscriptions[id].subscribed) {
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


// If the user wasn't subscribed to any lists, subscribe to
// EasyList, AdBlock custom and (if any) a localized subscription
// Inputs: none.
// Returns an object containing the subscribed lists
MyFilters.prototype._load_default_subscriptions = function () {
  var result = {};

  //Update will be done immediately after this function returns
  result['yt_privacy'] = { subscribed: true };
  result['yt_ad'] = { subscribed: true };
  return result;
};

// Used to create the list of default subscriptions
// Called when MyFilters is created.
// Returns: that list
MyFilters.prototype._make_subscription_options = function () {

  // When modifying a list, IDs mustn't change!
  return {
    yt_privacy: { // YouTube Privacy related filters
      url: 'https://cdn.adblockcdn.com/filters/yt_privacy.txt',
    },
    yt_ad: { // YouTube Ad related filters
      url: 'https://cdn.adblockcdn.com/filters/yt_ad.txt',
    },
    yt_annoyances: { // YouTube Annoyances
      url: 'https://easylist-downloads.adblockplus.org/yt_annoyances_full.txt',
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

// Save the current subscription information to storage
MyFilters.prototype._saveSubscriptions = function () {
  chrome.storage.local.set({ filter_lists: this._subscriptions }, function () {
    if (chrome.runtime.lastError) {
      log('write failure', chrome.runtime.lastError);
    }
  });
};

MyFilters.prototype._getSubscriptions = function (callback) {
  var _this = this;
  chrome.storage.local.get('filter_lists', function (readResponse) {
    if (chrome.runtime.lastError) {
      log('read failure', chrome.runtime.lastError);
    }

    var subscriptions = readResponse['filter_lists'];
    _this._newUser = (subscriptions === undefined);

    if (typeof callback === 'function') {
      callback(subscriptions);
    }
  });
};
