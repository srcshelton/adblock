
var run_bandaids = function() {
  // Tests to determine whether a particular bandaid should be applied
  var apply_bandaid_for = "";
  if (/facebook\.com/.test(document.location.hostname)) {
    apply_bandaid_for = "facebook";
  } else if (/mail\.live\.com/.test(document.location.hostname)) {
    apply_bandaid_for = "hotmail";
  } else if (("getadblock.com" === document.location.hostname ||
            "dev.getadblock.com" === document.location.hostname) &&
           (window.top === window.self))
  {
    if (/\/question\/$/.test(document.location.pathname)) {
      apply_bandaid_for = "getadblockquestion";
    } else {
      apply_bandaid_for = "getadblock";
    }
  } else if (/mobilmania\.cz|zive\.cz|doupe\.cz|e15\.cz|sportrevue\.cz|autorevue\.cz/.test(document.location.hostname))
    apply_bandaid_for = "czech_sites";
  else {
    var hosts = [ /mastertoons\.com$/ ];
    hosts = hosts.filter(function(host) { return host.test(document.location.hostname); });
    if (hosts.length > 0)
      apply_bandaid_for = "noblock";
  }
  var bandaids = {
    noblock: function() {
      var styles = document.querySelectorAll("style");
      var re = /#(\w+)\s*~\s*\*\s*{[^}]*display\s*:\s*none/;
      for (var i = 0; i < styles.length; i++) {
        var id = styles[i].innerText.match(re);
        if(id) {
          styles[i].innerText = '#' + id[1] + ' { display: none }';
        }
      }
    },
    hotmail: function() {
      //removing the space remaining in Hotmail/WLMail
      var css_chunk = document.createElement("style");
      css_chunk.type = "text/css";
      (document.head || document.documentElement).insertBefore(css_chunk, null);
      css_chunk.sheet.insertRule(".WithRightRail { right:0px !important; }", 0);
      css_chunk.sheet.insertRule("#RightRailContainer  { display:none !important; visibility: none !important; orphans: 4321 !important; }" , 0);
    },
    getadblockquestion: function() {
      BGcall('addGABTabListeners');
      var personalBtn = document.getElementById("personal-use");
      var enterpriseBtn = document.getElementById("enterprise-use");
      var buttonListener = function(event) {
        BGcall('removeGABTabListeners', true);
        if (enterpriseBtn) {
          enterpriseBtn.removeEventListener("click", buttonListener);
        }
        if (personalBtn) {
          personalBtn.removeEventListener("click", buttonListener);
        }
      };
      if (personalBtn) {
        personalBtn.addEventListener("click", buttonListener);
      }
      if (enterpriseBtn) {
        enterpriseBtn.addEventListener("click", buttonListener);
      }
    },
    getadblock: function() {
      BGcall('get_adblock_user_id', function(adblock_user_id) {
        var elemDiv = document.createElement("div");
        elemDiv.id = "adblock_user_id";
        elemDiv.innerText = adblock_user_id;
        elemDiv.style.display = "none";
        document.body.appendChild(elemDiv);
      });
      if (document.getElementById("enable_show_survey")) {
        document.getElementById("enable_show_survey").onclick = function(event) {
            BGcall("set_setting", "show_survey", !document.getElementById("enable_show_survey").checked, true);
         };
      }
      var aaElements = document.querySelectorAll("#disableacceptableads");
      if (aaElements &&
          aaElements.length) {
        for (i = 0; i < aaElements.length; ++i) {
          aaElements[i].onclick = function(event) {
            if (event.isTrusted === false) {
              return;
            }
            event.preventDefault();
            BGcall("unsubscribe", {id:"acceptable_ads", del:false}, function() {
              BGcall("recordGeneralMessage", "disableacceptableads clicked", undefined, function() {
                BGcall("openTab",  "options/index.html?tab=0&aadisabled=true");
              });
            });
          }
        }
      }
    },
    czech_sites: function() {
      var player = document.getElementsByClassName("flowplayer");
      // Remove data-ad attribute from videoplayer
      if (player) {
        for (var i=0; i<player.length; i++)
          player[i].removeAttribute("data-ad");
      }
    },
    facebook: function() {
      // The following code is from :
      // https://greasyfork.org/en/scripts/22210-facebook-unsponsored
      var streamSelector = 'div[id^="topnews_main_stream"]';
      var storySelector = 'div[id^="hyperfeed_story_id"]';
      var sponsoredSelectors = [
          'a[href^="https://www.facebook.com/about/ads"]',
          'a[href^="https://www.facebook.com/ads/about"]',
          'a[href^="/about/ads"]',
          'a[href^="/ads/about"]'
      ];

      var mutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;

      function block(story) {
          if(!story) {
              return;
          }

          var sponsored = false;
          for(var i = 0; i < sponsoredSelectors.length; i++) {
              if(story.querySelectorAll(sponsoredSelectors[i]).length) {
                  sponsored = true;
                  break;
              }
          }

          if(sponsored) {
              story.remove();
          }
      }

      function process() {
          // Locate the stream every iteration to allow for FB SPA navigation which
          // replaces the stream element
          var stream = document.querySelector(streamSelector);
          if(!stream) {
              return;
          }

          var stories = stream.querySelectorAll(storySelector);
          if(!stories.length) {
              return;
          }

          for(var i = 0; i < stories.length; i++) {
              block(stories[i]);
          }
      }

      var observer = new mutationObserver(process);
      observer.observe(document.querySelector('body'), {
          'childList': true,
          'subtree': true
      });
    },    
  }; // end bandaids

  if (apply_bandaid_for) {
    log("Running bandaid for " + apply_bandaid_for);
    bandaids[apply_bandaid_for]();
  }

};


var before_ready_bandaids = function() {

};

