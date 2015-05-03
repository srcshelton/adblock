// Set up variables
var AdBlockVersion = "1.0";
var subscribed_filter_names = [];
var adblock_settings = [];
var adblock_error = null;
var adblock_pings = 0;
var l10n_data = {};
var adblock_custom_filters;

// Create the debug info for the textbox or the bug report
var getDebugInfo = function() {
    var info = [];
    info.push("==== Filter Lists ====");
    info.push(subscribed_filter_names.join('  \n'));
    info.push("");
    info.push("==== Custom Filters ====");
    info.push(adblock_custom_filters);
    info.push("");
    info.push("==== Settings ====");
    info.push(adblock_settings);
    info.push("");
    info.push("==== Other info: ====");
    if (AdBlockVersion)
        info.push("AdBlock version number: " + AdBlockVersion);
    if (adblock_error)
        info.push("Last known error: " + adblock_error);
    info.push("Total pings: " + adblock_pings);
    info.push("UserAgent: " + navigator.userAgent.replace(/;/,""));
    info.push("Navigator Language: " + navigator.language);
    info.push("L10N Locales: " + l10n_data.locales);
    return info.join('  \n');
};

// Create a bug report
var makeReport = function(){
    var body = [];
    body.push(chrome.i18n.getMessage("englishonly") + "!");
    body.push("");
    body.push("** Please answer the following questions so that we can process your bug report, otherwise, we may have to ignore it. **");
    body.push("Also, please put your name, or a screen name, and your email above so that we can contact you if needed.");
    body.push("If you don't want your report to be made public, check that box, too.");
    body.push("");
    body.push("**Can you provide detailed steps on how to reproduce the problem?**");
    body.push("");
    body.push("1. ");
    body.push("2. ");
    body.push("3. ");
    body.push("");
    body.push("**What should happen when you do the above steps**");
    body.push("");
    body.push("");
    body.push("**What actually happened?**");
    body.push("");
    body.push("");
    body.push("**Do you have any other comments? If you can, can you please attach a screenshot of the bug?**");
    body.push("");
    body.push("");
    body.push("--- The questions below are optional but VERY helpful. ---");
    body.push("");
    body.push("If unchecking all filter lists fixes the problem, which one filter" +
              "list must you check to cause the problem again after another restart?");
    body.push("");
    body.push("====== Do not touch below this line ======");
    body.push("");
    body.push(getDebugInfo());


    var out = encodeURIComponent(body.join('  \n'))
    return out;
};//end of makeReport

var supportInit = function() {

    l10n_data = chrome.i18n.getL10nData();

    BGcall("getFirefoxManifest", function(manifest) {
            AdBlockVersion = manifest.version;
    });

    // Get subscribed filter lists
    BGcall("get_subscriptions_minus_text", function(subs) {
        for (var id in subs) {
            if (subs[id].subscribed)
                subscribed_filter_names.push(id);
        }
    });

    // Get settings
    BGcall("get_settings", function(settings) {
        for (setting in settings)
            adblock_settings.push(setting+": "+settings[setting] + "\n");
        adblock_settings = adblock_settings.join('');
    });

    // Get last known error
    BGcall("storage_get", "error", function(error) {
        adblock_error = error;
    });

    // Get number of total pings
    BGcall("storage_get", "total_pings", function(total_pings) {
        adblock_pings = total_pings;
    });

    // Get custom filters
    BGcall("storage_get", "custom_filters", function(custom_filters) {
       adblock_custom_filters = custom_filters;
    });

    if ((typeof navigator.language !== 'undefined') &&
         navigator.language &&
         navigator.language.substring(0, 2) != "en") {
        $(".english-only").css("display", "inline");
    } else {
        $(".english-only").css("display", "none");
    }

    // Show debug info
    $("#debug").click(function(){
        var settings = getDebugInfo();
        $("#debugInfo").css({ width: "450px", height: "100px"});
        $("#debugInfo").text(settings);
        $("#debugInfo").fadeIn();
    });
    //disable the context menu, so that user's don't open the link's on new tabs, windows, etc.
    document.getElementById("debug").oncontextmenu = function() {
       return false;
    };    

    //remove the href='#' attribute from any anchor tags, this oddly disables the middle click issues
    $("a[href='#']").removeAttr("href").css("cursor","pointer");

    // Report us the bug
    $("#report").click(function(){
        var out = makeReport();
        var result = "http://support.getadblock.com/discussion/new" +
        "?category_id=problems&discussion[body]=" + out;
        document.location.href = result;
    });
    //disable the context menu, so that user's don't open the link's on new tabs, windows, etc.
    document.getElementById("report").oncontextmenu = function() {
       return false;
    };


    // Check, whether update is available
    //TODO
    //$("#checkupdate").text(translate("checkforupdates"));
    //checkupdates("help");

    // Show the changelog
    $("#whatsnew a").click(function() {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "../CHANGELOG.txt");
            xhr.onload = function() {
                $("#changes").text(xhr.responseText).css({width: "670px", height: "200px"}).fadeIn();
            };
            xhr.send();
        } catch (ex) {
           //file not found, send back empty object;
        }
    });
}