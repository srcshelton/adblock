//the tab object, which contains |id| and |url| (stored as unicodeUrl) of the current tab
var tab = null;

$(function () {
    localizePage();

    var BG = chrome.extension.getBackgroundPage();
    BG.recordGeneralMessage('popup opened');

    // Set menu entries appropriately for the selected tab.
    $('.menu-entry, .menu-status, .separator').hide();

    BG.getCurrentTabInfo(function (info) {
        // Cache tab object for later use
        tab = info.tab;

        var shown = {};
        function show(L) { L.forEach(function (x) { shown[x] = true;  }); }

        function hide(L) { L.forEach(function (x) { shown[x] = false; }); }

        show(['div_options', 'separator2']);
        var paused = BG.adblock_is_paused();
        if (paused) {
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
          toggle(BG.getSettings().show_block_counts_help_link).
          click(function () {
              BG.setSetting('show_block_counts_help_link', false);
              BG.openTab($(this).attr('href'));
              $(this).hide();
              window.close();
            });
        }

        var host = parseUri(tab.unicodeUrl).host;
        var advanced_option = BG.getSettings().show_advanced_options;
        var eligible_for_undo = !paused && (info.disabled_site || !info.whitelisted);
        var url_to_check_for_undo = info.disabled_site ? undefined : host;
        if (eligible_for_undo &&
            (BG.count_cache.getCustomFilterCount(url_to_check_for_undo) > 0)) {
          show(['div_undo', 'separator0']);
        }

        if (!advanced_option || !tab.id) {
          hide(['div_show_resourcelist']);
        }

        if (host === 'www.youtube.com' &&
            /channel|user/.test(tab.unicodeUrl) &&
            /ab_channel/.test(tab.unicodeUrl) &&
            eligible_for_undo &&
            BG.getSettings().youtube_channel_whitelist) {
          $('#div_whitelist_channel').html(translate('whitelist_youtube_channel',
                                                       parseUri.parseSearch(tab.unicodeUrl).ab_channel));
          show(['div_whitelist_channel']);
        }

        if (BG.getSettings().youtube_channel_whitelist &&
            tab.unicodeUrl === 'https://www.youtube.com/feed/subscriptions') {
          show(['div_whitelist_all_channels']);
        }

        for (var div in shown) {
          if (shown[div]) {
            $('#' + div).show();
          }
        }

        if (!info.display_menu_stats ||
            paused ||
            info.disabled_site ||
            info.whitelisted) {
          $('#block_counts').hide();
        }
      });

    // Click handlers
    $('#bugreport').click(function () {
        BG.recordGeneralMessage('bugreport clicked');
        BG.openTab('http://help.getadblock.com/support/tickets/new');
        window.close();
      });

    $('#titletext').click(function () {
        BG.recordGeneralMessage('titletext clicked');
        BG.openTab('https://getadblock.com/');
        window.close();
      });

    $('#div_enable_adblock_on_this_page').click(function () {
        BG.recordGeneralMessage('enable adblock clicked');
        BG.try_to_unwhitelist(tab.unicodeUrl, function (response) {
          if (response) {
            chrome.tabs.executeScript(tab.id, { code: 'location.reload();' });
            window.close();
          } else {
            $('#div_status_whitelisted').
            replaceWith(translate('disabled_by_filter_lists'));
          }
        });
      });

    $('#div_paused_adblock').click(function () {
        BG.recordGeneralMessage('unpause clicked');
        BG.adblock_is_paused(false);
        BG.handlerBehaviorChanged();
        BG.updateButtonUIAndContextMenus();
        window.close();
      });

    $('#div_undo').click(function () {
        BG.recordGeneralMessage('undo clicked');
        var host = parseUri(tab.unicodeUrl).host;
        BG.confirm_removal_of_custom_filters_on_host(host, tab);
        window.close();
      });

    $('#div_whitelist_channel').click(function () {
        BG.recordGeneralMessage('whitelist youtube clicked');
        BG.create_whitelist_filter_for_youtube_channel(tab.unicodeUrl);
        chrome.tabs.executeScript(tab.id, { code: 'location.reload();' });
        window.close();
      });

    $('#div_whitelist_all_channels').click(function ()
    {
        BG.recordGeneralMessage('whitelist all youtube clicked');
        chrome.tabs.sendMessage(tab.id, { type: 'whitelistAllYouTubeChannels' });
        window.close();
      });

    $('#div_pause_adblock').click(function () {
      BG.recordGeneralMessage('pause clicked');
      BG.adblock_is_paused(true);
      BG.updateButtonUIAndContextMenus();
      window.close();
    });

    $('#div_blacklist').click(function () {
        BG.recordGeneralMessage('blacklist clicked');
        BG.emit_page_broadcast(
            { fn: 'topOpenBlacklistUI', options: { nothing_clicked: true } },
            { tab: tab } // fake sender to determine target page
        );
        window.close();
      });

    $('#div_whitelist').click(function () {
        BG.recordGeneralMessage('whitelist domain clicked');
        BG.emit_page_broadcast(
            { fn: 'topOpenWhitelistUI', options: {} },
            { tab: tab } // fake sender to determine target page
        );
        window.close();
      });

    $('#div_whitelist_page').click(function () {
        BG.recordGeneralMessage('whitelist page clicked');
        BG.create_page_whitelist_filter(tab.unicodeUrl);
        chrome.tabs.executeScript(tab.id, { code: 'location.reload();' });
        window.close();
      });

    $('#div_show_resourcelist').click(function () {
        BG.recordGeneralMessage('resource clicked');
        BG.launch_resourceblocker('?tabId=' + tab.id);
        window.close();
      });

    $('#div_report_an_ad').click(function () {
        BG.recordGeneralMessage('report ad clicked');
        var url = 'pages/adreport.html?url=' + encodeURIComponent(tab.unicodeUrl)
                + '&tabId=' + tab.id;
        BG.openTab(url, true);
        window.close();
      });

    $('#div_options').click(function () {
        BG.recordGeneralMessage('options clicked');
        BG.openTab('options/index.html');
        window.close();
      });

    $('#div_help_hide').click(function () {
        BG.recordGeneralMessage('help clicked');
        $('#help_hide_explanation').slideToggle();
      });

    $('#link_open').click(function () {
        BG.recordGeneralMessage('link clicked');
        var linkHref = "https://getadblock.com/pay/?exp=7003&u=" + BG.STATS.userId();
        BG.openTab(linkHref);
        window.close();
      });
  });
