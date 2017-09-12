// Chrome to Safari port
// Author: Michael Gundlach (gundlach@gmail.com)
// License: GPLv3 as part of code.getadblock.com
//          or MIT if GPLv3 conflicts with your code's license.
//
// Porting library to make Chrome extensions work in Safari.
// To use: Add as the first script loaded in your Options page,
// your background page, your Chrome manifest.json, and your
// Safari Info.plist (created by the Extensions Builder).
//
// Then you can use chrome.* APIs as usual, and check the SAFARI
// global boolean variable to see if you're in Safari or Chrome
// for doing browser-specific stuff.  The safari.* APIs will
// still be available in Safari, and the chrome.* APIs will be
// unchanged in Chrome.

if (typeof SAFARI == 'undefined') {
  (function () {

    // True in Safari, false in Chrome.
    SAFARI = (function () {
      if (typeof safari === 'undefined' && typeof chrome === 'undefined') {
        // Safari bug: window.safari undefined in iframes with JS src in them.
        // Must get it from an ancestor.
        var w = window;
        while (w.safari === undefined && w !== window.top) {
          w = w.parent;
        }

        window.safari = w.safari;
      }

      return (typeof safari !== 'undefined');
    })();

    // Safari 5.0 (533.x.x) with no menu support
    LEGACY_SAFARI = SAFARI && (navigator.appVersion.match(/\sSafari\/(\d+)\./) || [null, 0])[1] < 534;

    // Safari 5.1 (534.x.x) with no undo support
    LEGACY_SAFARI_51 = SAFARI && (navigator.appVersion.match(/\sSafari\/(\d+)\./) || [null, 0])[1] <= 534;

  })();
}
