'use strict';

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
  adblock_premium_installed = true;
};

var getAdblockDomainWithUserID = function(userid) {
  adblock_premium_userid = userid;
};


/*******************************************************************************
    Collate and add scriptlets to document.
**/

(function() {
    'use strict';

    if ( abort ) {
      return;
    }

    // https://bugs.chromium.org/p/chromium/issues/detail?id=129353
    // Trap calls to WebSocket constructor, and expose websocket-based network
    // requests to AdBlock

    // Fix won't be applied on older versions of Chromium.
    if ( window.WebSocket instanceof Function === false ) {
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

    // Have the script tag remove itself once executed (leave a clean
    // DOM behind).
    var cleanup = function() {
        var c = document.currentScript, p = c && c.parentNode;
        if ( p ) {
            p.removeChild(c);
        }
    };

    var scriptText = [];
    if ('getadblock.com' === document.location.hostname ||
        'dev.getadblock.com' === document.location.hostname) {
      scriptText.push('(' + getAdblockDomain.toString() + ')();');
      chrome.storage.local.get('userid', function (response) {
        var adblock_user_id = response['userid'];
        var elem = document.createElement('script');
        var scriptToInject = '(' + getAdblockDomainWithUserID.toString() + ')(\'' + adblock_user_id + '\');' +
        '(' + cleanup.toString() + ')();';
        elem.appendChild(document.createTextNode(scriptToInject));
        try {
            (document.head || document.documentElement).appendChild(elem);
        } catch(ex) {
        }
      });
    }

    if ( scriptText.length === 0 ) { return; }

    scriptText.push('(' + cleanup.toString() + ')();');
    var elem = document.createElement('script');
    elem.appendChild(document.createTextNode(scriptText.join('\n')));
    try {
        (document.head || document.documentElement).appendChild(elem);
    } catch(ex) {
    }
})();

var run_bandaids = function () {
    // Tests to determine whether a particular bandaid should be applied
    var apply_bandaid_for = '';
    if ('getadblock.com' === document.location.hostname ||
             'dev.getadblock.com' === document.location.hostname)
    {
      apply_bandaid_for = 'getadblock';
    }
    var bandaids = {
        getadblock: function () {
            chrome.storage.local.get('userid', function (response) {
                var adblock_user_id = response['userid'];
                var elemDiv = document.createElement('div');
                elemDiv.id = 'adblock_premium_user_id';
                elemDiv.innerText = adblock_user_id;
                elemDiv.setAttribute('data-adblock_premium_user_id', adblock_user_id);
                elemDiv.style.display = 'none';
                document.body.appendChild(elemDiv);
              });

            BGcall('get_first_run', function (first_run) {
                var elemDiv = document.createElement('div');
                elemDiv.id = 'adblock_first_run_id';
                elemDiv.innerText = first_run;
                elemDiv.setAttribute('data-adblock_first_run_id', first_run);
                elemDiv.style.display = 'none';
                document.body.appendChild(elemDiv);
              });
          },
  }; // end bandaids

    if (apply_bandaid_for) {
      bandaids[apply_bandaid_for]();
    }
  };
