"use strict";

// Set up variables
var l10n_data = {};

var supportInit = function () {

    l10n_data = chrome.i18n.getL10nData();

    if ((typeof navigator.language !== 'undefined') &&
        navigator.language &&
        navigator.language.substring(0, 2) != "en") {
        $(".english-only").css("display", "inline");
    } else {
        $(".english-only").css("display", "none");
    }

    // Show debug info
    $("#debug").click(function () {
        BGcall("getDebugInfo", function (info) {
            var debugStr = info.filter_lists + '\n\n' + info.settings + '\n\n' + info.custom_filters + '\n\n' + info.other_info;
            $("#debugInfo").text(debugStr).css({width: "450px", height: "100px"}).fadeIn();
        });
    });
    //disable the context menu, so that user's don't open the link's on new tabs, windows, etc.
    document.getElementById("debug").oncontextmenu = function () {
        return false;
    };

    //remove the href='#' attribute from any anchor tags, this oddly disables the middle click issues
    $("a[href='#']").removeAttr("href").css("cursor", "pointer");

    //disable the context menu, so that user's don't open the link's on new tabs, windows, etc.
    document.getElementById("report").oncontextmenu = function () {
        return false;
    };

    $("#report").click(function () {
        BGcall("openBugReportPage");
    });

    // Show the changelog
    $("#whatsnew a").click(function () {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "../CHANGELOG.txt");
            xhr.onload = function () {
                $("#changes").text(xhr.responseText).css({width: "670px", height: "200px"}).fadeIn();
            };
            xhr.send();
        } catch (ex) {
            //file not found, send back empty object;
        }
    });
};