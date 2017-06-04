'use strict';
// Check or uncheck each loaded DOM option checkbox according to the
// user's saved settings.
var generalInit = function () {
    // Handle incoming clicks from bandaids.js & '/installed'
    try
    {
      if (parseUri.parseSearch(location.search).aadisabled === 'true')
      {
        $('#acceptable_ads_info').show();
      }
    }
    catch (ex)
    { }

    var subs = BG.get_subscriptions_minus_text();

    //if the user is currently subscribed to AA
    //then 'check' the acceptable ads button.
    if ('acceptable_ads' in subs &&
      subs.acceptable_ads.subscribed)
    {
      $('#acceptable_ads').prop('checked', true);
    }

    for (var name in optionalSettings) {
      $('#enable_' + name).
          attr('checked', optionalSettings[name]);
    }

    $("input.feature[type='checkbox']").change(function () {
        var isEnabled = $(this).is(':checked');
        var name = this.id.substring(7); // TODO: hack
        if (this.id === 'acceptable_ads') {
          if (isEnabled) {
            $('#acceptable_ads_info').slideUp();
            BG.subscribe({ id: 'acceptable_ads' });
          } else {
            $('#acceptable_ads_info').slideDown();
            $('#acceptable_ads_content_blocking_message').text('').slideUp();
            BG.unsubscribe({ id: 'acceptable_ads', del: false });
          }

          return;
        }

        BG.setSetting(name, isEnabled);

      });

    $('#enable_show_advanced_options').change(function () {
        // Reload the page to show or hide the advanced options on the
        // options page -- after a moment so we have time to save the option.
        // Also, disable all advanced options, so that non-advanced users will
        // not end up with debug/beta/test options enabled.
        if (!this.checked) {
          $(".advanced input[type='checkbox']:checked").each(function () {
              BG.setSetting(this.id.substr(7), false);
            });
        }

        window.setTimeout(function () {
            window.location.reload();
          }, 50);
      });
  };
