//Check for updates
function checkupdates(page) {
  var AdBlockVersion;
  $.ajax({
    url: '../manifest.json',
    dataType: "json",
    success: function(json) {
      AdBlockVersion = json.version;
      //TODO - need to update URL to FF specific
      var checkURL = "";

      //fetch the version check file
      $.ajax({
        cache: false,
        dataType: "xml",
        url: checkURL,
        error: function(jqXHR,textStatus,errorThrown) {
          if (page === "help") {
            $("#checkupdate").text(translate("somethingwentwrong")).show();
          } else {
            $("#checkupdate").text(translate("checkinternetconnection")).show();
          }
        },
        success: function(response) {
            if ($("updatecheck[status='ok'][codebase]", response).length) {
              $("#checkupdate").text(translate("adblock_outdated_chrome")).show().
                find("a").click(function() {
                    BGcall("openTab", 'about:addons');
                });
            } else {
              if (page === "help") {
                $("#checkupdate").text(translate("latest_version")).show();
              } else {
                $("#step_update_filters_DIV").show();
              }
            }
        }
      });
    }
  });

  // Hide ad-reporting wizard, when user is offline
  if (page === "adreport" && $('#checkupdate').is(':visible')) {
    $('.section').hide();
  }

  // Check if newVersion is newer than AdBlockVersion
  function isNewerVersion(newVersion) {
    var versionRegex = /^(\*|\d+(\.\d+){0,2}(\.\*)?)$/;
    var current = AdBlockVersion.match(versionRegex);
    var notCurrent = newVersion.match(versionRegex);
    if (!current || !notCurrent)
      return false;
    for (var i=1; i<4; i++) {
      if (current[i] < notCurrent[i])
        return true;
      if (current[i] > notCurrent[i])
        return false;
    }
    return false;
  }
};