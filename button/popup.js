//the tab object, which contains |id| and |url| (stored as unicodeUrl) of the current tab
var tab = null;
var shown = {};

var showMenuItems = function() {
    for (var div in shown) {
        if (shown[div]) {
            $('#' + div).show();
        }
    }
}

var checkWidthOfChannelName = function(channelName, trimmed) {
  if (!channelName || channelName.length === 0) {
    return channelName;
  }
  // Create dummy span
  this.e = document.createElement('span');
  this.e.style.fontSize = '15px';
  this.e.style.fontFamily = 'Arial';
  this.e.innerHTML = channelName;
  document.body.appendChild(this.e);
  var w = this.e.offsetWidth;
  document.body.removeChild(this.e);
  // '80' pixels seems to the magic number to make sure all channel names fit
  if (w > ($(window).width() - 80)) {
    // remove the last character of the channel name
    channelName = channelName.slice(0, -1);
    return checkWidthOfChannelName(channelName, true);
  }
  // add the elipses, if needed
  if (trimmed) {
    channelName = channelName + "...";
  }
  return channelName;
}

$(function() {
    localizePage();

    var BG = chrome.extension.getBackgroundPage();
    BG.recordGeneralMessage("popup_opened");

    // Set menu entries appropriately for the selected tab.
    $(".menu-entry, .menu-status, .separator").hide();

    function show(L) { L.forEach(function(x) { shown[x] = true;  }); }
    function hide(L) { L.forEach(function(x) { shown[x] = false; }); }

    BG.getCurrentTabInfo(function(info) {
        // Cache tab object for later use
        tab = info.tab;

        show(["div_options", "separator2", "div_helpsupport"]);
        var paused = BG.adblock_is_paused();
        var host = parseUri(tab.unicodeUrl).host;

        if (paused && host === "www.youtube.com") {
            show(["separator0","div_paused_adblock", "div_options"]);
        } else if (info.disabled_site) {
            show(["div_status_disabled", "separator0", "div_options"]);
        } else if (info.whitelisted && host === "www.youtube.com") {
            show(["div_status_whitelisted","div_enable_adblock_on_this_page",
                  "separator0", "div_pause_adblock", "separator1", "div_options"]);
        } else if (host === "www.youtube.com")  {
            show(["div_pause_adblock", "separator1", "div_options", "separator3", "block_counts"]);

            var page_count = info.tab_blocked || "0";
            $("#page_blocked_count").text(page_count);
            var formattedTotalBlockedCount = info.total_blocked;
            var totalBlockedCount = Number.parseInt(info.total_blocked);
            if (Number.NaN !== totalBlockedCount) {
                formattedTotalBlockedCount = totalBlockedCount.toLocaleString();
            }
            $("#total_blocked_count").text(formattedTotalBlockedCount);
        } else {
            show(["div_status_disabled", "separator0",
                  "div_options"]);
        }

        var host = parseUri(tab.unicodeUrl).host;
        var eligible_for_undo = !paused && (info.disabled_site || !info.whitelisted);

        if (info.settings.youtube_channel_whitelist &&
            host === "www.youtube.com" &&
            info.youTubeChannelName &&
            /channel|user/.test(tab.unicodeUrl) &&
            /ab_channel/.test(tab.unicodeUrl) &&
            eligible_for_undo) {
            $("#div_whitelist_channel").css("display","block");
            $("#whitelist_channel_name").text(checkWidthOfChannelName(info.youTubeChannelName));
        }

        if (info.settings.youtube_channel_whitelist &&
            tab.unicodeUrl === 'https://www.youtube.com/feed/subscriptions') {
          show(["div_whitelist_all_channels"]);
        }

        showMenuItems();

        if (!info.settings.display_menu_stats ||
            paused ||
            info.disabled_site ||
            info.whitelisted) {
            $("#block_counts").hide();
        }
    });  // end of BG.getCurrentTabInfo()

    // We don't need to reload popup in Chrome,
    // because Chrome reloads every time the popup for us.
    function closeAndReloadPopup() {
      window.close();
    }

    $("#titletext").click(function() {
        BG.recordGeneralMessage("titletext_clicked");
        var edge_url = "https://chrome.google.com/webstore/detail/adblock-on-youtube/emngkmlligggbbiioginlkphcmffbncb";
        BG.openTab(edge_url);
        closeAndReloadPopup();
    });

    $("#div_enable_adblock_on_this_page").click(function() {
        BG.recordGeneralMessage("enable_adblock_clicked");
        BG.try_to_unwhitelist(tab.unicodeUrl, function(response) {
          if (response) {
            chrome.tabs.executeScript(tab.id, { code: 'location.reload();' });
            window.close();
          } else {
            $('#div_status_whitelisted').
            replaceWith(translate('disabled_by_filter_lists_yt'));
          }
        });
    });

    $("#div_paused_adblock").click(function() {
        BG.recordGeneralMessage("unpause_clicked");
        BG.adblock_is_paused(false);
        BG.handlerBehaviorChanged();
        BG.updateButtonUIAndContextMenus();
        closeAndReloadPopup();
    });

    $("#div_whitelist_channel").click(function() {
        BG.recordGeneralMessage("whitelist_youtube_clicked");
        BG.create_whitelist_filter_for_youtube_channel(tab.unicodeUrl);
        closeAndReloadPopup();
        chrome.tabs.executeScript(tab.id, {code: 'location.reload();'});
    });

    $('#div_whitelist_all_channels').click(function ()
    {
        BG.recordGeneralMessage("whitelist_all_youtube_clicked");
        chrome.tabs.sendMessage(tab.id, {type: "whitelistAllYouTubeChannels"});
        closeAndReloadPopup();
    });

     $("#div_pause_adblock").click(function() {
        BG.recordGeneralMessage("pause_clicked");
        BG.adblock_is_paused(true);
        BG.updateButtonUIAndContextMenus();
        closeAndReloadPopup();
     });

    $("#div_options").click(function() {
        BG.recordGeneralMessage("options_clicked");
        BG.openTab("options/index.html");
        closeAndReloadPopup();
    });
    
    $('#div_slideout').click(function ()
    {
      // TODO - update URL
      var linkHref = "https://getadblock.com/pay/?exp=7003&u=" + BG.STATS.userId();
      BG.openTab(linkHref);
      closeAndReloadPopup();
    });    

});
