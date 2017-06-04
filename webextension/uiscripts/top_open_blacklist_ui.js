'use strict';

// Global lock so we can't open more than once on a tab.
if (typeof mayOpenDialogUI === 'undefined')
  var mayOpenDialogUI = true;

function topOpenBlacklistUI(options) {
  if (!mayOpenDialogUI)
    return;

  if (typeof options === 'string') {
    try {
      options = JSON.parse(options);
    } catch (ex) {
      options = {};
      options.nothing_clicked = true;
    }
  }

  mayOpenDialogUI = false;

  // Get Flash objects out of the way of our UI
  BGcall('emit_page_broadcast', { fn: 'sendContentToBack', options: {} });

  // If they chose "Block an ad on this page..." ask them to click the ad
  if (options.nothing_clicked) {
    rightclickedItem = null;
  }

  // If they right clicked in a frame, use the frame instead
  if (options.info && options.info.frameUrl) {
    var frame = $('iframe').filter(function (i, el) {
      return el.src == options.info.frameUrl;
    });

    if (frame.length == 1)
      rightclickedItem = frame[0];
  }

  if (typeof rightclickedItem !== 'undefined' && rightclickedItem && rightclickedItem.nodeName == 'BODY') {
    rightclickedItem = null;
  }

  //check if we're running on website with a frameset, if so, tell
  //the user we can't run on it.
  if ($('frameset').length >= 1) {
    alert(translate('wizardcantrunonframesets'));
    mayOpenDialogUI = true;
    $('.adblock-ui-stylesheet').remove();
    wizardClosing();
    return;
  }

  BGcall('getSettings', function (settings) {
    var advancedUser = settings.show_advanced_options;
    var blacklistUI = new BlacklistUi(rightclickedItem, advancedUser);
    blacklistUI.cancel(function () {
      mayOpenDialogUI = true;
    });

    blacklistUI.block(function () {
      mayOpenDialogUI = true;

      // In case of frames, reload, as the frame might contain matches too.
      if ($('iframe, frameset, frame').filter(':visible').length > 0)
        document.location.reload();
    });

    blacklistUI.show();
  });

  bindEnterClickToDefault();
}


//# sourceURL=/uiscripts/topOpenBlacklistUI.js
