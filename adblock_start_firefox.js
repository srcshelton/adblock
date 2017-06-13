'use strict';

var elementPurger = {
  onPurgeRequest: function (request, sender, sendResponse) {
    if (document &&
        document.location &&
        document.location.href &&
        request.command === 'purge-elements' &&
        request.frameUrl === document.location.href.replace(/#.*$/, '')) {
      elementPurger._purgeElements(request);
      sendResponse({});
    }
  },

  // Remove elements on the page of |request.elType| that request
  // |request.url|.  Will try again if none are found unless |lastTry|.
  _purgeElements: function (request, lastTry) {
    var elType = request.elType;
    var url = request.url;

    log('[DEBUG]', 'Purging:', lastTry, elType, url);

    var tags = {};
    tags[ElementTypes.image] = { IMG: 1 };
    tags[ElementTypes.subdocument] = { IFRAME: 1, FRAME: 1 };
    tags[ElementTypes.object] = { OBJECT: 1, EMBED: 1 };

    var srcdata = this._srcsFor(url);
    for (var i = 0; i < srcdata.length; i++) {
      for (var tag in tags[elType]) {
        var src = srcdata[i];
        var attr = (tag === 'OBJECT' ? 'data' : 'src');
        var selector = tag + '[' + attr + src.op + '"' + src.text + '"]';

        var results = document.querySelectorAll(selector);
        log('[DEBUG]', '  ', results.length, 'results for selector:', selector);
        if (results.length) {
          for (var j = 0; j < results.length; j++) {
            destroyElement(results[j], elType);
          }

          return; // I doubt the same URL was loaded via 2 different src attrs.
        }
      }
    }

    // No match; try later.  We may still miss it (race condition) in which
    // case we give up, rather than polling every second or waiting 10 secs
    // and causing a jarring page re-layout.
    if (!lastTry) {
      var that = this;
      setTimeout(function () { that._purgeElements(request, true); }, 2000);
    }
  },

  // Return a list of { op, text }, where op is a CSS selector operator and
  // text is the text to select in a src attr, in order to match an element on
  // this page that could request the given absolute |url|.
  _srcsFor: function (url) {

    // NB: <img src="a#b"> causes a request for "a", not "a#b".  I'm
    // intentionally ignoring IMG tags that uselessly specify a fragment.
    // AdBlock will fail to hide them after blocking the image.
    var urlParts = parseUri(url);
    var pageParts = this._page_location;
    var results = [];

    // Case 1: absolute (of the form "abc://de.f/ghi" or "//de.f/ghi")
    results.push({ op: '$=', text: url.match(/\:(\/\/.*)$/)[1] });
    if (urlParts.hostname === pageParts.hostname) {
      var urlSearchAndHash = urlParts.search + urlParts.hash;

      // Case 2: The kind that starts with '/'
      results.push({ op: '=', text: urlParts.pathname + urlSearchAndHash });

      // Case 3: Relative URL (of the form "ab.cd", "./ab.cd", "../ab.cd" and
      // "./../ab.cd")
      var pageDirs = pageParts.pathname.split('/');
      var urlDirs = urlParts.pathname.split('/');
      var i = 0;
      while (pageDirs[i] === urlDirs[i]
             && i < pageDirs.length - 1
             && i < urlDirs.length - 1) {
        i++; // i is set to first differing position
      }

      var dir = new Array(pageDirs.length - i).join('../');
      var path = urlDirs.slice(i).join('/') + urlSearchAndHash;
      if (dir) {
        results.push({ op: '$=', text: dir + path });
      } else {
        results.push({ op: '=', text: path });
        results.push({ op: '=', text: './' + path });
      }
    }

    return results;
  },

  // To enable testing
  _page_location: document.location,
};

adblockBegin({
  startPurger: function () {
    browser.runtime.onMessage.addListener(elementPurger.onPurgeRequest);
  },

  stopPurger: function () {
    browser.runtime.onMessage.removeListener(elementPurger.onPurgeRequest);
  },

  handleHiding: function (data) {
    if (data && data.hiding) {
      blockListViaCSS(data.selectors);
    }
  },
});
