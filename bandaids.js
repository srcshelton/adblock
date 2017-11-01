// Youtube-related code in this file based on code (c) Adblock Plus. GPLv3.
// and https://hg.adblockplus.org/adblockpluschrome/file/aed8fd38e824/safari/include.youtube.js

// PornHub - related code in this file based on code from uBlockOrigin GPLv3.
// and available at https://github.com/uBlockOrigin/uAssets/blob/master/filters/filters.txt
// and https://github.com/uBlockOrigin/uAssets/blob/master/filters/resources.txt

var hostname = window.location.hostname;

var abort = (function() {
    'use strict';

    var doc = document;
    if (doc instanceof HTMLDocument === false) {
        if (doc instanceof XMLDocument === false ||
            doc.createElement('div') instanceof HTMLDivElement === false) {
            return true;
        }
    }
    if ((doc.contentType || '').lastIndexOf('image/', 0) === 0 ) {
        return true;
    }
    return false;
})();


if ( !abort ) {
    if (hostname === '') {
        hostname = (function() {
            var win = window, hn = '', max = 10;
            try {
                for (;;) {
                    hn = win.location.hostname;
                    if ( hn !== '' ) { return hn; }
                    if ( win.parent === win ) { break; }
                    win = win.parent;
                    if ( !win ) { break; }
                    if ( (max -= 1) === 0 ) { break; }
                }
            } catch(ex) {
            }
            return hn;
        })();
    }
    // Don't inject if document is from local network.
    abort = /^192\.168\.\d+\.\d+$/.test(hostname);
}


var getAdblockDomain = function() {
  adblock_installed = true;
};

var getAdblockDomainWithUserID = function(userid) {
  adblock_userid = userid;
};

(function() {
    'use strict';

    if ( abort ) {
      return;
    }

    // Only for dynamically created frames and http/https documents.
    if ( /^(https?:|about:)/.test(window.location.protocol) !== true ) {
      return;
    }

    var doc = document;
    var parent = doc.head || doc.documentElement;
    if ( parent === null ) {
      return;
    }

    var scriptText = [];

    // Have the script tag remove itself once executed (leave a clean
    // DOM behind).
    var cleanup = function() {
        var c = document.currentScript, p = c && c.parentNode;
        if ( p ) {
            p.removeChild(c);
        }
    };

    if ('getadblock.com' === document.location.hostname ||
        'dev.getadblock.com' === document.location.hostname) {
      BGcall('get_adblock_user_id', function (adblock_user_id ) {
        var elem = document.createElement('script');
        var scriptToInject = '(' + getAdblockDomainWithUserID.toString() + ')(\'' + adblock_user_id + '\');' +
        '(' + getAdblockDomain.toString() + ')();' +
        '(' + cleanup.toString() + ')();';
        elem.appendChild(document.createTextNode(scriptToInject));
        try {
            (document.head || document.documentElement).appendChild(elem);
        } catch(ex) {
        }
      });
      return;
    }
})();

var run_bandaids = function()
{
  // Tests to determine whether a particular bandaid should be applied
  var apply_bandaid_for = "";
  if (/pornhub\.com/.test(document.location.hostname))
  {
    apply_bandaid_for = "pornhub";
  }
  else if (/mail\.live\.com/.test(document.location.hostname))
  {
    apply_bandaid_for = "hotmail";
  }
  else if (("getadblock.com" === document.location.hostname ||
            "dev.getadblock.com" === document.location.hostname) &&
           (window.top === window.self))
  {
    if (/\/question\/$/.test(document.location.pathname))
    {
      apply_bandaid_for = "getadblockquestion";
    }
    else
    {
      apply_bandaid_for = "getadblock";
    }
  }
  else if (/mobilmania\.cz|zive\.cz|doupe\.cz|e15\.cz|sportrevue\.cz|autorevue\.cz/.test(document.location.hostname))
  {
    apply_bandaid_for = "czech_sites";
  }
  else
  {
    var hosts = [/mastertoons\.com$/];
    hosts = hosts.filter(function(host)
    {
      return host.test(document.location.hostname);
    });
    if (hosts.length > 0)
    {
      apply_bandaid_for = "noblock";
    }
  }
  var bandaids = {
    noblock : function()
    {
      var styles = document.querySelectorAll("style");
      var re = /#(\w+)\s*~\s*\*\s*{[^}]*display\s*:\s*none/;
      for (var i = 0; i < styles.length; i++)
      {
        var id = styles[i].innerText.match(re);
        if (id)
        {
          styles[i].innerText = '#' + id[1] + ' { display: none }';
        }
      }
    },
    hotmail : function()
    {
      // removing the space remaining in Hotmail/WLMail
      var css_chunk = document.createElement("style");
      css_chunk.type = "text/css";
      (document.head || document.documentElement).insertBefore(css_chunk, null);
      css_chunk.sheet.insertRule(".WithRightRail { right:0px !important; }", 0);
      css_chunk.sheet.insertRule("#RightRailContainer  { display:none !important; visibility: none !important; orphans: 4321 !important; }", 0);
    },
    getadblockquestion : function()
    {
      BGcall('addGABTabListeners');
      var personalBtn = document.getElementById("personal-use");
      var enterpriseBtn = document.getElementById("enterprise-use");
      var buttonListener = function(event)
      {
        BGcall('removeGABTabListeners', true);
        if (enterpriseBtn)
        {
          enterpriseBtn.removeEventListener("click", buttonListener);
        }
        if (personalBtn)
        {
          personalBtn.removeEventListener("click", buttonListener);
        }
      };
      if (personalBtn)
      {
        personalBtn.addEventListener("click", buttonListener);
      }
      if (enterpriseBtn)
      {
        enterpriseBtn.addEventListener("click", buttonListener);
      }
    },
    getadblock : function()
    {
      BGcall('get_adblock_user_id', function (adblock_user_id ) {
        if (adblock_user_id)
        {
          var elemDiv = document.createElement("div");
          elemDiv.id = "adblock_user_id";
          elemDiv.innerText = adblock_user_id;
          elemDiv.style.display = "none";
          document.body.appendChild(elemDiv);
        }
      });
      if (document.getElementById("enable_show_survey"))
      {
        document.getElementById("enable_show_survey").onclick = function(event)
        {
          BGcall("set_setting", "show_survey", !document.getElementById("enable_show_survey").checked, true);
        };
      }
      if (document.getElementById("disableacceptableads")) {
        document.getElementById("disableacceptableads").onclick = function(event) {
          event.preventDefault();
          BGcall("unsubscribe", {id:"acceptable_ads", del:false}, function() {
            BGcall("recordGeneralMessage", "disableacceptableads clicked", undefined, function() {
              BGcall("openTab",  "options/index.html?tab=0&aadisabled=true");
            });
            // Rebuild the rules if running in Safari
            if (SAFARI) {
              BGcall("update_subscriptions_now");
            }
          });
        }
      }
    },
    czech_sites : function()
    {
      var player = document.getElementsByClassName("flowplayer");
      // Remove data-ad attribute from videoplayer
      if (player)
      {
        for (var i = 0; i < player.length; i++)
        {
          player[i].removeAttribute("data-ad");
        }
      }
    },
    pornhub: function() {
      (function() {
      	var w = window;
      	var count = Math.ceil(8+Math.random()*4);
      	var tomorrow = new Date(Date.now() + 86400);
      	var expire = tomorrow.toString();
      	document.cookie = 'FastPopSessionRequestNumber=' + count + '; expires=' + expire;
      	var db;
      	if ( (db = w.localStorage) ) {
      		db.setItem('InfNumFastPops', count);
      		db.setItem('InfNumFastPopsExpire', expire);
      	}
      	if ( (db = w.sessionStorage) ) {
      		db.setItem('InfNumFastPops', count);
      		db.setItem('InfNumFastPopsExpire', expire);
      	}
      })();
      (function() {
      	var removeAdFrames = function(aa) {
      		var el;
      		for ( var i = 0; i < aa.length; i++ ) {
      			el = document.getElementById(aa[i]);
      			if ( el !== null ) {
      				el.parentNode.removeChild(el);
      			}
      		}
      	};
      	Object.defineProperty(window, 'block_logic', {
      		get: function() { return removeAdFrames; },
      		set: function() {}
      	});
      })();
    },
  }; // end bandaids

  if (apply_bandaid_for)
  {
    log("Running bandaid for " + apply_bandaid_for);
    bandaids[apply_bandaid_for]();
  }

};

var before_ready_bandaids = function() {

};

//Safari & YouTube only
//This function is outside the normal 'bandaids' processing
//so that it works correctly
(function() {
    if ((typeof SAFARI) !== 'undefined' &&
         SAFARI &&
         document.domain === "www.youtube.com") {
       //continue
    } else {
       return;
    }
    //a regex used to test the ytplayer config / flashvars for youtube ads, references to ads, etc.
    var badArgumentsRegex = /^((.*_)?(ad|ads|afv|adsense)(_.*)?|(ad3|st)_module|prerolls|interstitial|infringe|iv_cta_url)$/;

    function rewriteFlashvars(flashvars) {
        var pairs = flashvars.split("&");
        for (var i = 0; i < pairs.length; i++)
            if (badArgumentsRegex.test(pairs[i].split("=")[0]))
                pairs.splice(i--, 1);
        return pairs.join("&");
    }

    function patchPlayer(player) {
        var newPlayer = player.cloneNode(true);
        var flashvarsChanged = false;

        var flashvars = newPlayer.getAttribute("flashvars");
        if (flashvars) {
            var newFlashvars = rewriteFlashvars(flashvars);
            if (flashvars != newFlashvars) {
                newPlayer.setAttribute("flashvars", newFlashvars);
                flashvarsChanged = true;
            }
        }

        var param = newPlayer.querySelector("param[name=flashvars]");
        if (param) {
            var value = param.getAttribute("value");
            if (value) {
                var newValue = rewriteFlashvars(value);
                if (value != newValue) {
                    param.setAttribute("value", newValue);
                    flashvarsChanged = true;
                }
            }
        }

        if (flashvarsChanged)
            player.parentNode.replaceChild(newPlayer, player);
    }

    function runInPage(fn, arg) {
        var script = document.createElement("script");
        script.type = "application/javascript";
        script.async = false;
        script.textContent = "(" + fn + ")(" + arg + ");";
        document.documentElement.appendChild(script);
        document.documentElement.removeChild(script);
    }

    document.addEventListener("beforeload", function(event) {
        if ((event.target.localName == "object" || event.target.localName == "embed") && /:\/\/[^\/]*\.ytimg\.com\//.test(event.url))
            patchPlayer(event.target);
    }, true);

    runInPage(function(badArgumentsRegex) {
        // If history.pushState is available, YouTube uses the history API
        // when navigation from one video to another, and tells the flash
        // player with JavaScript which video and which ads to show next,
        // bypassing our flashvars rewrite code. So we disable
        // history.pushState before YouTube's JavaScript runs.
        History.prototype.pushState = undefined;

        // The HTML5 player is configured via ytplayer.config.args. We have
        // to make sure that ad-related arguments are ignored as they are set.
        var ytplayer = undefined;
        Object.defineProperty(window, "ytplayer", {
          configurable: true,
          get: function() {
            return ytplayer;
          },
          set: function(rawYtplayer) {
            if (!rawYtplayer || typeof rawYtplayer != "object") {
              ytplayer = rawYtplayer;
              return;
            }

            var config = undefined;
            ytplayer = Object.create(rawYtplayer, {
              config: {
                enumerable: true,
                get: function() {
                  return config;
                },
                set: function(rawConfig) {
                  if (!rawConfig || typeof rawConfig != "object") {
                    config = rawConfig;
                    return;
                  }

                  var args = undefined;
                  config = Object.create(rawConfig, {
                    args: {
                      enumerable: true,
                      get: function() {
                        return args;
                      },
                      set: function(rawArgs) {
                        if (!rawArgs || typeof rawArgs != "object") {
                          args = rawArgs;
                          return;
                        }

                        args = {};
                        for (var arg in rawArgs) {
                          if (!badArgumentsRegex.test(arg))
                            args[arg] = rawArgs[arg];
                        }
                      }
                    }
                  });

                  config.args = rawConfig.args;
                }
              }
            });

            ytplayer.config = rawYtplayer.config;
          }
        });
      }, badArgumentsRegex);//end of runInPage()
})();
