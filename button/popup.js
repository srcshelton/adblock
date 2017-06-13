//the tab object, which contains |id| and |url| (stored as unicodeUrl) of the current tab
var tab = null;

$(function () {
    localizePage();

    BGcall('recordGeneralMessage', 'popup opened');

    // Set menu entries appropriately for the selected tab.
    $('.menu-entry, .menu-status, .separator').hide();

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (!(request.message === "getCurrentTabInfoResponse")) {
          return;
        }
        // Cache tab object for later use
        var info = request.info;
        tab = info.tab;

        var shown = {};
        function show(L) { L.forEach(function (x) { shown[x] = true;  }); }

        function hide(L) { L.forEach(function (x) { shown[x] = false; }); }

        show(['div_options', 'separator2']);
        if (info.paused) {
          show(['div_status_paused', 'separator0', 'div_paused_adblock', 'div_options']);
        } else if (info.disabled_site) {
          show(['div_status_disabled', 'separator0', 'div_pause_adblock',
                'div_options',]);
        } else if (info.whitelisted) {
          show(['div_status_whitelisted', 'div_enable_adblock_on_this_page',
                'separator0', 'div_pause_adblock', 'separator1',
                'div_options',]);
        } else {
          show(['div_pause_adblock', 'div_blacklist', 'div_whitelist',
                'div_whitelist_page', 'div_show_resourcelist',
                'div_report_an_ad', 'separator1', 'div_options', 'separator3', 'block_counts',]);

          var page_count = info.tab_blocked || '0';
          $('#page_blocked_count').text(page_count);
          $('#total_blocked_count').text(info.total_blocked);

          // Show help link until it is clicked.
          $('#block_counts_help').
          toggle(info.settings.show_block_counts_help_link).
          click(function () {
              BGcall('setSetting', 'show_block_counts_help_link', false);
              BGcall('openTab', $(this).attr('href'));
              $(this).hide();
              window.close();
            });
        }

        var host = parseUri(tab.unicodeUrl).host;
        var advanced_option = info.settings.show_advanced_options;
        var eligible_for_undo = !info.paused && (info.disabled_site || !info.whitelisted);
        var url_to_check_for_undo = info.disabled_site ? undefined : host;
        if (info.customFilterCount > 0) {
          show(['div_undo', 'separator0']);
        }

        if (!advanced_option || !tab.id) {
          hide(['div_show_resourcelist']);
        }

        if (host === "www.youtube.com" &&
            info.youTubeChannelName &&
            eligible_for_undo &&
            info.settings.youtube_channel_whitelist) {
            $("#div_whitelist_channel").text(translate("whitelist_youtube_channel", info.youTubeChannelName));
            show(["div_whitelist_channel"]);
        }

        if (info.settings.youtube_channel_whitelist &&
            tab.unicodeUrl === 'https://www.youtube.com/feed/subscriptions') {
          show(['div_whitelist_all_channels']);
        }

        for (var div in shown) {
          if (shown[div]) {
            $('#' + div).show();
          }
        }

        if (!info.display_menu_stats ||
            info.paused ||
            info.disabled_site ||
            info.whitelisted) {
          $('#block_counts').hide();
        }
        sendResponse({});
    });
    chrome.runtime.sendMessage({ message: 'getCurrentTabInfo' });

    // Click handlers
    $('#bugreport').click(function () {
        BGcall('recordGeneralMessage', 'bugreport clicked');
        BGcall('openTab', 'https://help.getadblock.com/support/tickets/new');
        window.close();
      });

    $('#titletext').click(function () {
        BGcall('recordGeneralMessage', 'titletext clicked');
        BGcall('openTab', 'https://getadblock.com/');
        window.close();
      });

    $('#div_enable_adblock_on_this_page').click(function () {
        BGcall('recordGeneralMessage', 'enable adblock clicked');
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
          if (!(request.message === "try_to_unwhitelist_response")) {
            return;
          }
          if (request.returnCode) {
            chrome.tabs.executeScript(tab.id, { code: 'location.reload();' });
            window.close();
          } else {
            $('#div_status_whitelisted').
            replaceWith(translate('disabled_by_filter_lists'));
          }
          sendResponse({});
        });
        BGcall('try_to_unwhitelist', tab.unicodeUrl);
      });

    $('#div_paused_adblock').click(function () {
        BGcall('recordGeneralMessage', 'unpause clicked');
        BGcall('adblock_is_paused', false);
        BGcall('handlerBehaviorChanged');
        BGcall('updateButtonUIAndContextMenus');
        window.close();
      });

    $('#div_undo').click(function () {
        BGcall('recordGeneralMessage', 'undo clicked');
        var host = parseUri(tab.unicodeUrl).host;
        BGcall('confirm_removal_of_custom_filters_on_host', host, tab);
        window.close();
      });

    $('#div_whitelist_channel').click(function () {
        BGcall('recordGeneralMessage', 'whitelist youtube clicked');
        BGcall('create_whitelist_filter_for_youtube_channel', tab.unicodeUrl);
        chrome.tabs.executeScript(tab.id, { code: 'location.reload();' });
        window.close();
    });

    $('#div_whitelist_all_channels').click(function () {
      BGcall('recordGeneralMessage', 'whitelist all youtube clicked');
      chrome.tabs.sendMessage(tab.id, { type: 'whitelistAllYouTubeChannels' });
      window.close();
    });

    $('#div_pause_adblock').click(function () {
      BGcall('recordGeneralMessage', 'pause clicked');
      BGcall('adblock_is_paused', true);
      BGcall('updateButtonUIAndContextMenus');
      window.close();
    });

    $('#div_blacklist').click(function () {
        BGcall('recordGeneralMessage', 'blacklist clicked');
        BGcall('emit_page_broadcast',
            { fn: 'topOpenBlacklistUI', options: { nothing_clicked: true } },
            { tab: tab } // fake sender to determine target page
        );
        window.close();
      });

    $('#div_whitelist').click(function () {
        BGcall('recordGeneralMessage', 'whitelist domain clicked');
        BGcall('emit_page_broadcast',
            { fn: 'topOpenWhitelistUI', options: {} },
            { tab: tab } // fake sender to determine target page
        );
        window.close();
      });

    $('#div_whitelist_page').click(function () {
        BGcall('recordGeneralMessage', 'whitelist page clicked');
        BGcall('create_page_whitelist_filter', tab.unicodeUrl);
        chrome.tabs.executeScript(tab.id, { code: 'location.reload();' });
        window.close();
      });

    $('#div_show_resourcelist').click(function () {
        BGcall('recordGeneralMessage', 'resource clicked');
        BGcall('launch_resourceblocker', '?tabId=' + tab.id);
        window.close();
      });

    $('#div_report_an_ad').click(function () {
        BGcall('recordGeneralMessage', 'report ad clicked');
        var url = 'pages/adreport.html?url=' + encodeURIComponent(tab.unicodeUrl)
                + '&tabId=' + tab.id;
        BGcall('openTab', url, true);
        window.close();
      });

    $('#div_options').click(function () {
        BGcall('recordGeneralMessage', 'options clicked');
        BGcall('openTab', 'options/index.html');
        window.close();
      });

    $('#div_help_hide').click(function () {
        BGcall('recordGeneralMessage', 'help clicked');
        $('#help_hide_explanation').slideToggle();
      });

    $('#link_open').click(function () {
        BGcall('recordGeneralMessage', 'link clicked');
        chrome.storage.local.get('userid', function (response) {
          var linkHref = "https://getadblock.com/pay/?exp=7003&u=" + response['userid'];
          BGcall('openTab', linkHref);
          window.close();
        });
      });
  });
