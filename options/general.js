// Handle incoming clicks from bandaids.js & '/installed'
try {
  if (parseUri.parseSearch(location.search).aadisabled === "true") {
    $("#acceptable_ads_info").show();
  }
}
catch(ex) {}

// Check or uncheck each loaded DOM option checkbox according to the
// user's saved settings.
var generalInit = function() {

  // BGcall("get_subscriptions_minus_text", function(subs) {
  chrome.runtime.sendMessage({"message": "get_subscriptions_minus_text"}, function(subs) {
    //if the user is currently subscribed to AA
    //then 'check' the acceptable ads button.
    if (subs["acceptable_ads"].subscribed) {
      $("#acceptable_ads").prop("checked", true);
    }
  });

  for (var name in optionalSettings) {
    $("#enable_" + name).
      prop("checked", optionalSettings[name]);
  }

  $("input.feature[type='checkbox']").change(function() {
    var is_enabled = $(this).is(':checked');
    if (this.id === "acceptable_ads") {
      if (is_enabled) {
        $("#acceptable_ads_info").slideUp();
        BGcall("subscribe", {id: "acceptable_ads"});
      } else {
        $("#acceptable_ads_info").slideDown();
        $("#acceptable_ads_content_blocking_message").text("").slideUp();
        BGcall("unsubscribe", {id:"acceptable_ads", del:false});
      }
      return;
    }
    var name = this.id.substring(7); // TODO: hack
    BGcall("set_setting", name, is_enabled, true);
    // Rebuild filters, so matched filter text is returned
    // when using resource viewer page
    if (name === "show_advanced_options") {
      BGcall("update_filters");
    }
    // if the user enables/disable data collection update the filter lists, so that the
    // filter list data is retained, and any cached responses are cleared
    if (name === "data_collection") {
      BGcall("update_subscriptions_now");
    }
    BGcall("get_settings", function(settings) {
        optionalSettings = settings;
    });
  }); // end of change handler
};

$("#enable_show_advanced_options").change(function() {
  // Reload the page to show or hide the advanced options on the
  // options page -- after a moment so we have time to save the option.
  // Also, disable all advanced options, so that non-advanced users will
  // not end up with debug/beta/test options enabled.
  if (!this.checked)
    $(".advanced input[type='checkbox']:checked").each(function() {
      BGcall("set_setting", this.id.substr(7), false);
    });
  window.setTimeout(function() {
    window.location.reload();
  }, 50);
});