'use strict';

//Binds keypress enter to trigger click action on
//default button or trigger click action on focused
//button.
function bindEnterClickToDefault() {
  if (window.GLOBAL_ran_bind_enter_click_to_default)
    return;
  window.GLOBAL_ran_bind_enter_click_to_default = true;
  $('html').bind('keypress', function (event) {
    if (event.keyCode === 13 && $('button:focus').size() <= 0) {
      event.preventDefault();
      $('.adblock_default_button').filter(':visible').click();
    }
  });
}

// Set RTL for Arabic and Hebrew users in blacklist and whitelist wizards
var textDirection = (function () {
    var language = '';
    if ((typeof navigator.language !== 'undefined') &&
        navigator.language)
        language = navigator.language.match(/^[a-z]+/i)[0];
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
