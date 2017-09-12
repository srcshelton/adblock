'use strict';
// Check or uncheck each loaded DOM option checkbox according to the
// user's saved settings.
var generalInit = function () {

    for (var name in optionalSettings) {
      $('#enable_' + name).
          attr('checked', optionalSettings[name]);
    }

    var subs = BG.get_subscriptions_minus_text();
    for (var id in subs) {
      if (subs[id].subscribed){
        $('#enable_' + id).attr('checked', true);
      } else {
        $('#enable_' + id).attr('checked', false);
      }
    }

    $("input.feature[type='checkbox']").change(function () {
        var isEnabled = $(this).is(':checked');
        var name = this.id.substring(7); // hack
        if (name === 'yt_privacy' || name === 'yt_ad' || name === 'yt_annoyances') {
          if (isEnabled) {
            BG.subscribe({id: name});
          } else {
            BG.unsubscribe({id: name, del:false});
          }
        } else {
          BG.setSetting(name, isEnabled);
        }
      });

    $('#enable_show_advanced_options').change(function () {
        // Reload the page to show or hide the advanced options on the
        // options page -- after a moment so we have time to save the option.
        // Also, disable all advanced options, so that non-advanced users will
        // not end up with debug/beta/test options enabled.
        if (!this.checked) {
          $(".advanced input[type='checkbox']:checked").each(function () {
              BG.setSetting(this.id.substr(7), false);
              var checked = $(this).is(':checked');
              if (checked) {
                $( this ).trigger( "click" );
              }
            });
        }

        window.setTimeout(function () {
            window.location.reload();
          }, 50);
      });
  };