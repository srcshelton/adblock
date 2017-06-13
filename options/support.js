'use strict';

var supportInit = function () {

    if ((typeof navigator.language !== 'undefined') &&
        navigator.language &&
        navigator.language.substring(0, 2) != 'en') {
      $('.english-only').css('display', 'inline');
    } else {
      $('.english-only').css('display', 'none');
    }

    // Show debug info
    $('#debug').click(function () {
      BG.getDebugInfo(function (theDebugInfo) {
        var debugStr = theDebugInfo.filter_lists + '\n\n' + theDebugInfo.settings + '\n\n==== Custom Filters ====\n' + theDebugInfo.custom_filters + '\n\n==== Other Info ====\n' + theDebugInfo.other_info;
        $('#debugInfo').text(debugStr).css({ width: '450px', height: '100px' }).fadeIn();
      });
    });

    //disable the context menu, so that user's don't open the link's on new tabs, windows, etc.
    document.getElementById('debug').oncontextmenu = function () {
        return false;
      };

    //remove the href='#' attribute from any anchor tags, this oddly disables the middle click issues
    $("a[href='#']").removeAttr('href').css('cursor', 'pointer');

    //disable the context menu, so that user's don't open the link's on new tabs, windows, etc.
    document.getElementById('report').oncontextmenu = function () {
        return false;
      };

    // Show the changelog
    $('#whatsnew a').click(function () {
        try {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', chrome.extension.getURL('CHANGELOG.txt'));
          xhr.onload = function () {          
            var object = xhr.responseText;
            $('#changes').text(object).css({ width: '670px', height: '200px' }).fadeIn();
          };
          xhr.send();
        } catch (ex) {
          //file not found, send back empty object;
        }
      });
  };
