'use strict';
var run_bandaids = function () {
    // Tests to determine whether a particular bandaid should be applied
    var apply_bandaid_for = '';
    if (/facebook\.com/.test(document.location.hostname))
    {
      apply_bandaid_for = 'facebook';
    } else if (/pornhub\.com/.test(document.location.hostname))
    {
      apply_bandaid_for = 'pornhub';
    } else if (/mail\.live\.com/.test(document.location.hostname))
        apply_bandaid_for = 'hotmail';
    else if ('getadblock.com' === document.location.hostname ||
             'dev.getadblock.com' === document.location.hostname)
    {
      apply_bandaid_for = 'getadblock';
    } else if (/mobilmania\.cz|zive\.cz|doupe\.cz|e15\.cz|sportrevue\.cz|autorevue\.cz/.test(document.location.hostname))
        apply_bandaid_for = 'czech_sites';
    else {
      var hosts = [/mastertoons\.com$/];
      hosts = hosts.filter(function (host) {
          return host.test(document.location.hostname);
        });

      if (hosts.length > 0)
          apply_bandaid_for = 'noblock';
    }

    var bandaids = {
        noblock: function () {
            var styles = document.querySelectorAll('style');
            var re = /#(\w+)\s*~\s*\*\s*{[^}]*display\s*:\s*none/;
            for (var i = 0; i < styles.length; i++) {
              var id = styles[i].innerText.match(re);
              if (id) {
                styles[i].innerText = '#' + id[1] + ' { display: none }';
              }
            }
          },

        hotmail: function () {
            //removing the space remaining in Hotmail/WLMail
            var el = document.querySelector('.Unmanaged .WithSkyscraper #MainContent');
            if (el) {
              el.style.setProperty('margin-right', '1px', null);
            }

            el = document.querySelector('.Managed .WithSkyscraper #MainContent');
            if (el) {
              el.style.setProperty('right', '1px', null);
            }

            el = document.getElementById('SkyscraperContent');
            if (el) {
              el.style.setProperty('display', 'none', null);
              el.style.setProperty('position', 'absolute', null);
              el.style.setProperty('right', '0px', null);
            }
          },

        getadblock: function () {
            browser.storage.local.get('userid', function (response) {
                var adblock_user_id = response['userid'];
                var elemDiv = document.createElement('div');
                elemDiv.id = 'adblock_user_id';
                elemDiv.innerText = adblock_user_id;
                elemDiv.setAttribute('data-adblock_user_id', adblock_user_id);
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

            BGcall('set_first_run_to_false', null);
            var aaElements = document.querySelectorAll('#disableacceptableads');
            if (aaElements.length > 0)
            {
              for (var i = 0; i < aaElements.length; ++i)
              {
                aaElements[i].onclick = function (event)
                {
                  if (event.isTrusted === false) {
                    return;
                  }

                  event.preventDefault();
                  BGcall('unsubscribe', {
                    id: 'acceptable_ads',
                    del: false,
                  }, function ()
                  {
                    BGcall('recordGeneralMessage', 'disableacceptableads clicked', undefined, function ()
                    {
                      BGcall('openTab', 'options/index.html?tab=0&aadisabled=true');
                    });
                  });
                };
              }
            }
          },

        czech_sites: function () {
            var player = document.getElementsByClassName('flowplayer');
            // Remove data-ad attribute from videoplayer
            if (player) {
              for (var i = 0; i < player.length; i++)
                  player[i].removeAttribute('data-ad');
            }
          },

        pornhub: function () {
            (function () {
              var w = window;
              var count = Math.ceil(8 + Math.random() * 4);
              var tomorrow = new Date(Date.now() + 86400);
              var expire = tomorrow.toString();
              document.cookie = 'FastPopSessionRequestNumber=' + count + '; expires=' + expire;
              var db;
              if ((db = w.localStorage)) {
                db.setItem('InfNumFastPops', count);
                db.setItem('InfNumFastPopsExpire', expire);
              }

              if ((db = w.sessionStorage)) {
                db.setItem('InfNumFastPops', count);
                db.setItem('InfNumFastPopsExpire', expire);
              }
            })();

            (function () {
                var removeAdFrames = function (aa) {
                  var el;
                  for (var i = 0; i < aa.length; i++) {
                    el = document.getElementById(aa[i]);
                    if (el !== null) {
                     el.parentNode.removeChild(el);
                    }
                  }
                };

                Object.defineProperty(window, 'block_logic', {
                    get: function () { return removeAdFrames; },

                    set: function () {},
                  });
              })();
          },

        facebook: function () {
            // The following code is from :
            // https://greasyfork.org/en/scripts/22210-facebook-unsponsored
            var streamSelector = 'div[id^="topnews_main_stream"]';
            var storySelector = 'div[id^="hyperfeed_story_id"]';
            var sponsoredSelectors = [
                'a[href^="https://www.facebook.com/about/ads"]',
                'a[href^="https://www.facebook.com/ads/about"]',
                'a[href^="/about/ads"]',
                'a[href^="/ads/about"]',
            ];

            var mutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;

            function block(story) {
              if (!story) {
                return;
              }

              var sponsored = false;
              for (var i = 0; i < sponsoredSelectors.length; i++) {
                if (story.querySelectorAll(sponsoredSelectors[i]).length) {
                  sponsored = true;
                  break;
                }
              }

              if (sponsored) {
                story.remove();
              }
            }

            function process() {
              // Locate the stream every iteration to allow for FB SPA navigation which
              // replaces the stream element
              var stream = document.querySelector(streamSelector);
              if (!stream) {
                return;
              }

              var stories = stream.querySelectorAll(storySelector);
              if (!stories.length) {
                return;
              }

              for (var i = 0; i < stories.length; i++) {
                block(stories[i]);
              }
            }

            var observer = new mutationObserver(process);
            observer.observe(document.querySelector('body'), {
                childList: true,
                subtree: true,
              });
          },
      }; // end bandaids

    if (apply_bandaid_for) {
      bandaids[apply_bandaid_for]();
    }
  };
