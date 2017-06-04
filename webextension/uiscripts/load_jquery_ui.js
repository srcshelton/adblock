//Binds keypress enter to trigger click action on
//default button or trigger click action on focused
//button.
function bindEnterClickToDefault() {
  if (window.GLOBALRanBindEnterClickToDefault)
    return;
  GLOBALRanBindEnterClickToDefault = true;
  $('html').bind('keypress', function (e) {
    if (e.keyCode === 13 && $('button:focus').size() <= 0) {
      e.preventDefault();
      $('.adblock_default_button').filter(':visible').click();
    }
  });
}

function loadjQueryUI(callback) {
  function loadCSS(src) {
    var url = chrome.extension.getURL(src);
    var link = $('<link rel="stylesheet" type="text/css" />').
      attr('href', url).
      addClass('adblock-ui-stylesheet');
    $(document.head || document.documentElement).append(link);
  }

  loadCSS('jquery/css/jquery-ui.custom.css');
  loadCSS('jquery/css/override-page.css');

}

// Set RTL for Arabic and Hebrew users in blacklist and whitelist wizards
var textDirection = (function () {
  var language = navigator.language.match(/^[a-z]+/i)[0];
  return language === 'ar' || language === 'he' ? 'rtl' : 'ltr';
})();

function changeTextDirection($selector) {
  $selector.attr('dir', textDirection);
  if (textDirection === 'rtl') {
    $('.ui-dialog .ui-dialog-buttonpane .ui-dialog-buttonset').css('float', 'left');
    $('.ui-dialog .ui-dialog-title').css('float', 'right');
    $('.ui-dialog .ui-dialog-titlebar').css('background-position', 'right center');
    $('.ui-dialog .ui-dialog-titlebar-close').css({ left: '0.3em', right: 'initial' });
  }
}

//#  sourceURL=/uiscripts/load_jquery_ui.js
