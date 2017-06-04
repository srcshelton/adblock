//the tab object, which contains |id| and |url| (stored as unicodeUrl) of the current tab
var tab = null;

$(function() {
    localizePage();

    var BG = chrome.extension.getBackgroundPage();
    BG.recordGeneralMessage("popup opened");

    // Set menu entries appropriately for the selected tab.
    $(".menu-entry, .menu-status, .separator").hide();

    BG.getCurrentTabInfo(function(info) {
        // Cache tab object for later use
        tab = info.tab;

        var shown = {};
        function show(L) { L.forEach(function(x) { shown[x] = true;  }); }
        function hide(L) { L.forEach(function(x) { shown[x] = false; }); }

        show(["div_options", "separator2"]);
        var paused = BG.adblock_is_paused();
        if (paused) {
            show(["div_status_paused", "separator0","div_paused_adblock", "div_options"]);
        } else if (info.disabled_site) {
            show(["div_status_disabled", "separator0", "div_pause_adblock",
                  "div_options"]);
        } else if (info.whitelisted) {
            show(["div_status_whitelisted","div_enable_adblock_on_this_page",
                  "separator0", "div_pause_adblock", "separator1", "div_show_resourcelist",
                  "div_options"]);
        } else {
            show(["div_pause_adblock", "div_blacklist", "div_whitelist",
                  "div_whitelist_page", "div_show_resourcelist",
                  "div_report_an_ad", "separator1", "div_options", "separator3", "block_counts"]);

            var page_count = info.tab_blocked || "0";
            $("#page_blocked_count").text(page_count);
            $("#total_blocked_count").text(info.total_blocked);

            // Show help link until it is clicked.
            $("#block_counts_help").
            toggle(BG.get_settings().show_block_counts_help_link).
            click(function() {
                BG.set_setting("show_block_counts_help_link", false);
                BG.openTab($(this).attr("href"));
                $(this).hide();
                closeAndReloadPopup();
            });
        }

        var host = parseUri(tab.unicodeUrl).host;
        var advanced_option = BG.get_settings().show_advanced_options;
        var eligible_for_undo = !paused && (info.disabled_site || !info.whitelisted);
        var url_to_check_for_undo = info.disabled_site ? undefined : host;
        if (eligible_for_undo &&
            BG.count_cache.getCustomFilterCount(url_to_check_for_undo))
            show(["div_undo", "separator0"]);

        if (!advanced_option || !tab.id)
            hide(["div_show_resourcelist"]);

        if (host === "www.youtube.com" &&
            /channel|user/.test(tab.unicodeUrl) &&
            /ab_channel/.test(tab.unicodeUrl) &&
            eligible_for_undo &&
            BG.get_settings().youtube_channel_whitelist) {
            $("#div_whitelist_channel").html(translate("whitelist_youtube_channel",
                                                       parseUri.parseSearch(tab.unicodeUrl).ab_channel));
            show(["div_whitelist_channel"]);
        }

        if (BG.get_settings().youtube_channel_whitelist &&
            tab.unicodeUrl === 'https://www.youtube.com/feed/subscriptions') {
          show(["div_whitelist_all_channels"]);
        }

        if (chrome.runtime && chrome.runtime.id === "EdgeExtension_BetaFishAdBlockBeta_c1wakc4j0nefm")
            show(["div_status_beta"]);

        for (var div in shown)
            if (shown[div])
                $('#' + div).show();

        if (!info.display_menu_stats ||
            paused ||
            info.disabled_site ||
            info.whitelisted) {
            $("#block_counts").hide();
        }
    });

    // We don't need to reload popup in Chrome,
    // because Chrome reloads every time the popup for us.
    function closeAndReloadPopup() {
      window.close();
    }

    // Click handlers
    $("#bugreport").click(function() {
        BG.recordGeneralMessage("bugreport clicked");
        BG.openTab("http://help.getadblock.com/support/tickets/new");
        closeAndReloadPopup();
    });

    $("#titletext").click(function() {
        BG.recordGeneralMessage("titletext clicked");
        var edge_url = "https://www.microsoft.com/store/apps/9nblggh4rfhk";
        BG.openTab(edge_url);
        closeAndReloadPopup();
    });

    $("#div_enable_adblock_on_this_page").click(function() {
        BG.recordGeneralMessage("enable adblock clicked");
        if (BG.try_to_unwhitelist(tab.unicodeUrl)) {
            chrome.tabs.executeScript(tab.id, {code: 'location.reload();'});
            closeAndReloadPopup();
        } else {
            $("#div_status_whitelisted").
            replaceWith(translate("disabled_by_filter_lists"));
        }
    });

    $("#div_paused_adblock").click(function() {
        BG.recordGeneralMessage("unpause clicked");
        BG.adblock_is_paused(false);
        BG.handlerBehaviorChanged();
        BG.updateButtonUIAndContextMenus();
        closeAndReloadPopup();
    });

    $("#div_undo").click(function() {
        BG.recordGeneralMessage("undo clicked");
        var host = parseUri(tab.unicodeUrl).host;
        BG.confirm_removal_of_custom_filters_on_host(host, tab);
        closeAndReloadPopup();
    });

    $("#div_whitelist_channel").click(function() {
        BG.recordGeneralMessage("whitelist youtube clicked");
        BG.create_whitelist_filter_for_youtube_channel(tab.unicodeUrl);
        closeAndReloadPopup();
        chrome.tabs.executeScript(tab.id, {code: 'location.reload();'});
    });

    $('#div_whitelist_all_channels').click(function ()
    {
        BG.recordGeneralMessage("whitelist all youtube clicked");
        chrome.tabs.sendMessage(tab.id, {type: "whitelistAllYouTubeChannels"});
        closeAndReloadPopup();
    });

     $("#div_pause_adblock").click(function() {
        BG.recordGeneralMessage("pause clicked");
        BG.adblock_is_paused(true);
        BG.updateButtonUIAndContextMenus();
        closeAndReloadPopup();
     });

    $("#div_blacklist").click(function() {
        BG.recordGeneralMessage("blacklist clicked");
        BG.emit_page_broadcast(
            {fn:'top_open_blacklist_ui', options: { nothing_clicked: true }},
            { tab: tab } // fake sender to determine target page
        );
        closeAndReloadPopup();
    });

    $("#div_whitelist").click(function() {
        BG.recordGeneralMessage("whitelist domain clicked");
        BG.emit_page_broadcast(
            {fn:'top_open_whitelist_ui', options:{}},
            { tab: tab } // fake sender to determine target page
        );
        closeAndReloadPopup();
    });

    $("#div_whitelist_page").click(function() {
        BG.recordGeneralMessage("whitelist page clicked");
        BG.create_page_whitelist_filter(tab.unicodeUrl);
        closeAndReloadPopup();
        chrome.tabs.executeScript(tab.id, {code: 'location.reload();'});
    });

    $("#div_show_resourcelist").click(function() {
        BG.recordGeneralMessage("resource clicked");
        BG.launch_resourceblocker("?tabId=" + tab.id);
        closeAndReloadPopup();
    });

    $("#div_report_an_ad").click(function() {
        BG.recordGeneralMessage("report ad clicked");
        var url = "pages/adreport.html?url=" + encodeURIComponent(tab.unicodeUrl)
                + "&tabId=" + tab.id;
        BG.openTab(url, true);
        closeAndReloadPopup();
    });

    $("#div_options").click(function() {
        BG.recordGeneralMessage("options clicked");
        BG.openTab("options/index.html");
        closeAndReloadPopup();
    });

    $("#div_help_hide").click(function() {
        BG.recordGeneralMessage("help clicked");
        $("#help_hide_explanation").slideToggle();
    });

    $("#link_open").click(function() {
        BG.recordGeneralMessage("link clicked");
        var linkHref = "https://getadblock.com/pay/?exp=7002&v=0";
        BG.openTab(linkHref);
        closeAndReloadPopup();
        return;
    });
});
