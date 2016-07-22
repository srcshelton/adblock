function load_options() {
    // Check or uncheck each option.
    BGcall("get_settings", function(settings) {
        optionalSettings = settings;
        if (!optionalSettings.show_advanced_options)
            $(".advanced").hide();
        if (!EDGE)
            $(".chrome-only").hide();
        if (EDGE)
            $(".safari-only").hide();
        var activeTab  = $.cookie('activetab');
        if (window.location &&
            window.location.search) {
            var searchQuery = parseUri.parseSearch(window.location.search);
            if (searchQuery &&
                searchQuery.tab) {
                activeTab = searchQuery.tab;
            }
        }
        localizePage();
        $("#tabs").
        tabs({
            // Go to the last opened tab
            active: activeTab,
            activate: function(event, ui) {
                $.cookie('activetab', ui.newTab.index(), {
                    expires : 10
                });

                // Toggle won't handle .advanced.chrome-only
                if (!optionalSettings.show_advanced_options)
                    $(".advanced").hide();
                if (!EDGE)
                    $(".chrome-only").hide();
                if (EDGE)
                    $(".safari-only").hide();
            },
        }).show();
        generalInit();
        filtersInit();
        customizeInit();
        supportInit();
    });
}

var language = navigator.language.match(/^[a-z]+/i)[0];
function rightToLeft() {
  if (language === "ar" || language === "he" ) {
    $(window).resize(function() {
      if ($(".social").is(":hidden")) {
        $("#translation_credits").css({margin: "0px 50%", width: "350px"});
        $("#paymentlink").css({margin: "0px 50%", width: "350px"});
        $("#version_number").css({margin: "20px 50%", width: "350px"});
      } else {
        $("#translation_credits").css("right", "0px");
        $("#paymentlink").css("right", "0px");
        $("#version_number").css({right: "0px", padding: "0px"});
      }
    });
    $("li").css("float","right");
    $("#small_nav").css({right: "initial", left: "45px"});
    $(".ui-tabs .ui-tabs-nav li").css("float", "right");
  } else {
    $(".ui-tabs .ui-tabs-nav li").css("float", "left");
  }
}

function showMiniMenu() {
  $("#small_nav").click(function() {
    if ($(".ui-tabs-nav").is(":hidden")) {
      $(".ui-tabs .ui-tabs-nav li").css("float", "none");
      $(".ui-tabs-nav").fadeIn("fast");
      if (language === "ar" || language === "he" ) {
        $(".ui-tabs-nav").css({right:"auto", left:"40px"});
      }
    } else
      $(".ui-tabs-nav").fadeOut("fast");
  });
  $(window).resize(function() {
    if ($(".ui-tabs-nav").is(":hidden") && $("#small_nav").is(":hidden")) {
      if (language === "ar" || language === "he" ) {
        $(".ui-tabs .ui-tabs-nav li").css("float", "right");
        $(".ui-tabs-nav").css({right:"auto", left:"auto"});
      } else {
        $(".ui-tabs .ui-tabs-nav li").css("float", "left");
      }
      $(".ui-tabs-nav").show();
    } else if ($("#small_nav").is(":visible"))
      $(".ui-tabs-nav").hide();
  });
}

function displayVersionNumber() {
  if (backgroundPage &&
      backgroundPage.chrome &&
      backgroundPage.chrome.runtime &&
      backgroundPage.chrome.runtime.getManifest()) {
    $("#version_number").text(translate("optionsversion", [backgroundPage.chrome.runtime.getManifest().version]));
  }
}

BGcall("storage_get", "userid", function(userId) {
    var paymentHREFhref = "https://getadblock.com/pay/?source=O&u=" + userId;
    $("#paymentlink").attr("href", paymentHREFhref);
});


function displayTranslationCredit() {
    if (navigator.language.substring(0, 2) != "en") {
        var translators = [];
        var xhr = new XMLHttpRequest();
        xhr.open("GET", chrome.extension.getURL('translators.json'), true);
        xhr.onload = function() {
            var text = JSON.parse(this.responseText);
            var lang = navigator.language;
            for (var id in text) {
                if (!SAFARI) {
                    if (id === lang) {
                        for (var translator in text[id].translators) {
                            var name = text[id].translators[translator].credit;
                            translators.push(" " + name);
                        }
                    } else {
                       for (var translator in text[id].translators) {
                          var lang = lang.toLowerCase();
                          if (id === lang) {
                              var name = text[lang].translators[translator].credit;
                              translators.push(" " + name);
                          }
                       }
                    }
                } else {
                    if (lang.substring(0, 2) === id) {
                        for (var translator in text[id].translators) {
                            var name = text[id].translators[translator].credit;
                            translators.push(" " + name);
                        }
                    } else {
                      for (var translator in text[id].translators) {
                          if (id === lang) {
                            var name = text[lang].translators[translator].credit;
                            translators.push(" " + name);
                          }
                        }
                    }
                }
            }
            $("#translator_credit").text(translate("translator_credit"));
            $("#translator_names").text(translators.toString());
        };
        xhr.send();
    }
}

var optionalSettings = {};
var backgroundPage;
$(document).ready(function(){
  backgroundPage = chrome.extension.getBackgroundPage();
  load_options();
  rightToLeft();
  showMiniMenu();
  displayVersionNumber();
  displayTranslationCredit();
  localizePage();
})