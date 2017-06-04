// Requires clickwatcher.js and elementchain.js and jQuery

// Create a selector that matches an element.
function selectorFromElm(el) {
  var attrs = ['id', 'class', 'name', 'src', 'href', 'data'];
  var result = [el.prop('nodeName')];
  for (var i = 0; i < attrs.length; i++) {
    var attr = attrs[i];
    var val = el.attr(attr);
    if (val)
      result.push('[' + attr + '=' + JSON.stringify(val) + ']');
  }

  return result.join('');
}

// Wizard that walks the user through selecting an element and choosing
// properties to block.
// clicked_item: the element that was right clicked, if any.
// advanced_user:bool
function BlacklistUi(clickedItem, advancedUser) {

  // If a dialog is ever closed without setting this to false, the
  // object fires a cancel event.
  this._cancelled = true;

  // steps through dialog - see _preview()
  this._current_step = 0;

  this._callbacks = { cancel: [], block: [] };

  this._clicked_item = clickedItem;
  this._advanced_user = advancedUser;
}

// TODO: same event framework as ClickWatcher
BlacklistUi.prototype.cancel = function (callback) {
  this._callbacks.cancel.push(callback);
};

BlacklistUi.prototype.block = function (callback) {
  this._callbacks.block.push(callback);
};

BlacklistUi.prototype._fire = function (eventName, arg) {
  var callbacks = this._callbacks[eventName];
  for (var i = 0; i < callbacks.length; i++)
    callbacks[i](arg);
};

BlacklistUi.prototype._onClose = function () {
  if (this._cancelled == true) {
    this._ui_page1.empty().remove();
    this._ui_page2.empty().remove();
    $('.adblock-ui-stylesheet').remove();
    this._chain.current().show();
    this._fire('cancel');
  }
};

BlacklistUi.prototype.handle_change = function () {
  this._last.show();
  this._chain.current().hide();
  this._last = this._chain.current();
  this._redrawPage1();
  this._redrawPage2();
  this._preview(selectorFromElm(this._chain.current()));
};

BlacklistUi.prototype.show = function () {

  // If we don't know the clicked element, we must find it first.
  if (this._clicked_item == null) {
    var clickWatcher = new ClickWatcher();
    var _this = this;
    clickWatcher.cancel(function () {
      _this._preview(null);
      _this._fire('cancel');
    });

    clickWatcher.click(function (element) {
      _this._clicked_item = element;
      _this.show();
    });

    this._preview('*');
    clickWatcher.show();
    return;
  }

  // If we do know the clicked element, go straight to the slider.
  else {
    this._chain = new ElementChain(this._clicked_item);

    this._ui_page1 = this._buildPage1();
    this._ui_page2 = this._build_page2();

    this._last = this._chain.current();
    this._chain.change(this, this.handle_change);
    this._chain.change();

    this._redrawPage1();
    this._ui_page1.dialog('open');
  }
};

BlacklistUi.prototype._buildPage1 = function () {
  var _this = this;

  var page = $('<div>').
    text(translate('sliderexplanation')).
    append('<br/>').
    append("<input id='slider' type='range' min='0' value='0'/>").
    append("<div id='selected_data'></div>");
  var btns = {};
  var adblockDefaultButtonText = translate('buttonlooksgood');
  btns[adblockDefaultButtonText] = {
    text: adblockDefaultButtonText,
    class: 'adblock_default_button',
    click: function (event) {
      event.stopPropagation();
      _this._cancelled = false;
      _this._ui_page1.dialog('close');
      _this._cancelled = true;
      _this._redrawPage2();
      _this._ui_page2.dialog('open');
    },
  };
  btns[translate('buttoncancel')] =
      function () {
        _this._ui_page1.dialog('close');
      };

  page.dialog({
      dialogClass: 'adblock-blacklist-dialog',
      position: [50, 50],
      width: 410,
      autoOpen: false,
      title: translate('slidertitle'),
      buttons: btns,
      open: function (event) {
        event.stopPropagation();
        _this._current_step = 1;
        _this._preview(selectorFromElm(_this._chain.current()));
      },

      close: function (event) {
        event.stopPropagation();
        _this._preview(null);
        _this._onClose();
      },
    });
  page.dialog('widget').css('position', 'fixed');
  changeTextDirection($('body .adblock-blacklist-dialog'));

  var depth = 0;
  var guy = this._chain.current();
  while (guy.length > 0 && guy[0].nodeName != 'BODY') {
    guy = guy.parent();
    depth++;
  }

  $('#slider', page).
    attr('max', Math.max(depth - 1, 1)).
    on('input change', function () {
      _this._chain.moveTo(this.valueAsNumber);
    });

  return page;
};

BlacklistUi.prototype._build_page2 = function () {
  var _this = this;
  var page = $('<div>').text(translate('blacklisteroptions1')).
      append(
        '<div>' +
          "<div id='adblock-details'></div><br/>" +
          "<div id='count'></div>" +
        '</div>').
      append(
        $('<div> <br/>').
          text(translate('blacklisternotsure'))).
          append('<br/><br/>').
          append(
          $("<div style='clear:left; font-size:smaller; margin-top: -20px;'> <br/>").
          text(translate('blacklisterthefilter'))).append(
              "<div style='margin-left:15px;margin-bottom:15px'>" +
                '<div>' +
                  "<div id='summary'></div><br/>" +
                  "<div id='filter_warning'></div>" +
                '</div>' +
              '</div>' +
            '</div>' +
         '</div>');

  var btns = {};
  var adblockDefaultButtonText = translate('buttonblockit');
  btns[adblockDefaultButtonText] = {
    text: adblockDefaultButtonText,
    class: 'adblock_default_button',
    click: function (event) {
      event.stopPropagation();
      var rule = $('#summary', _this._ui_page2).text();
      if (rule.length > 0) {
        var filter = getUnicodeDomain(document.location.hostname) + '##' + rule;

        // validateFilter will return the text passed to it, if the text is a valid filter
        // otherwise it a stringified exception is returned.
        BGcall('validateFilter', filter, true, function (response) {
          if (response === filter) {
            BGcall('add_custom_filter', filter, function () {
              mayOpenDialogUI = true;
              $('.adblock-ui-stylesheet').remove();
              page.remove();
              document.location.reload();
            });
          } else {
            try {
              var responseObj = JSON.parse(response);
              alert(translate('customfilterserrormessage', [filter, responseObj.exception]));
              mayOpenDialogUI = true;
              $('.adblock-ui-stylesheet').remove();
              page.remove();
            } catch (ex) {
              alert(translate('blacklisternofilter'));
              mayOpenDialogUI = true;
              $('.adblock-ui-stylesheet').remove();
              page.remove();
            }
          }
        });
      } else {
        alert(translate('blacklisternofilter'));
      }
    },
  };
  if (_this._advanced_user)
    btns[translate('buttonedit')] =
      function () {
        var customFilter = document.location.hostname + '##' + $('#summary', _this._ui_page2).text();
        _this._ui_page2.dialog('close');
        customFilter = prompt(translate('blacklistereditfilter'), customFilter);
        if (customFilter) {//null => user clicked cancel
          if (!/\#\#/.test(customFilter)) {
            customFilter = '##' + customFilter;
          }

          BGcall('validateFilter', customFilter, true, function (response) {
            if (response === customFilter) {
              BGcall('add_custom_filter', customFilter, function () {
                mayOpenDialogUI = true;
                $('.adblock-ui-stylesheet').remove();
                page.remove();
                document.location.reload();
              });
            } else {
              try {
                var responseObj = JSON.parse(response);
                alert(translate('customfilterserrormessage', [customFilter, responseObj.exception]));
                mayOpenDialogUI = true;
                $('.adblock-ui-stylesheet').remove();
                page.remove();
              } catch (ex) {
                alert(translate('blacklisternofilter'));
                mayOpenDialogUI = true;
                $('.adblock-ui-stylesheet').remove();
                page.remove();
              }
            }
          });
        }
      };

  btns[translate('buttonback')] =
      function () {
        _this._cancelled = false;
        _this._ui_page2.dialog('close');
        _this._cancelled = true;
        _this._redrawPage1();
        _this._ui_page1.dialog('open');
      };

  btns[translate('buttoncancel')] =
      function () {
        _this._ui_page2.dialog('close');
      };

  page.dialog({
      dialogClass: 'adblock-blacklist-dialog ui-page-2',
      position: [50, 50],
      width: 500,
      autoOpen: false,
      title: translate('blacklisteroptionstitle'),
      buttons: btns,
      open: function () {
        _this._current_step = 2;
        _this._preview($('#summary', _this._ui_page2).text());
      },

      close: function () {
        _this._preview(null);
        _this._onClose();
      },
    });
  page.dialog('widget').css('position', 'fixed');
  changeTextDirection($('body .adblock-blacklist-dialog'));

  return page;
};

BlacklistUi.prototype._redrawPage1 = function () {
  var el = this._chain.current();
  var showLink = (this._advanced_user &&
    /^https?\:\/\//.test(relativeToAbsoluteUrl(el.attr('src') || el.attr('data'))));
  if (showLink) {
    $('#block_by_url_link').css('visibility', 'visible');
  }

  var $selectedData = $('#selected_data', this._ui_page1);
  $selectedData.append('<b>').text(translate('blacklisterblockedelement')).append('<br/>');

  $selectedData.append($('<i></i>').text('<' + el[0].nodeName));
  var attrs = ['id', 'class', 'name', 'src', 'href', 'data'];
  for (var i in attrs) {
    var val = BlacklistUi._ellipsis(el.attr(attrs[i]));
    if (val)
      $selectedData.append('<br/>').
                  append($('<i></i>').
                           text(attrs[i] + '="' + val + '"').
                           css('margin-left', '10px'));
  }

  $selectedData.append('<i>&nbsp;&gt;</i>');
};

// Return the CSS selector generated by the blacklister.  If the
// user has not yet gotten far enough through the wizard to
// determine the selector, return an empty string.
BlacklistUi.prototype._makeFilter = function () {
  var result = [];

  var el = this._chain.current();
  var $detailsDiv = $('#adblock-details', this._ui_page2);

  if ($("input[type='checkbox']#cknodeName", $detailsDiv).is(':checked')) {
    result.push(el.prop('nodeName'));

    // Some iframed ads are in a bland iframe.  If so, at least try to
    // be more specific by walking the chain from the body to the iframe
    // in the CSS selector.
    if (el.prop('nodeName') == 'IFRAME' && el.attr('id') == '') {
      var cur = el.parent();
      while (cur.prop('nodeName') != 'BODY') {
        result.unshift(cur.prop('nodeName') + ' ');
        cur = cur.parent();
      }
    }
  }

  var attrs = ['id', 'class', 'name', 'src', 'href', 'data'];
  for (var i in attrs) {
    if ($("input[type='checkbox']#ck" + attrs[i], $detailsDiv).is(':checked'))
      result.push('[' + attrs[i] + '=' + JSON.stringify(el.attr(attrs[i])) + ']');
  }

  var warningMessage;
  if (result.length == 0)
    warningMessage = translate('blacklisterwarningnofilter');
  else if (result.length == 1 && $("input[type='checkbox']#cknodeName", $detailsDiv).is(':checked'))
    warningMessage = translate('blacklisterblocksalloftype', [result[0]]);
  $('#filter_warning', this._ui_page2).
    css('display', (warningMessage ? 'block' : 'none')).
    text(warningMessage);
  return result.join('');
};

BlacklistUi.prototype._redrawPage2 = function () {

  var el = this._chain.current();
  var _this = this;

  var $detailsDiv = $('#adblock-details', _this._ui_page2);

  var $summary = $('#summary', _this._ui_page2);

  function updateFilter() {
    var theFilter = _this._makeFilter();

    $summary.text(theFilter);

    var matchCount = $(theFilter).not('.ui-dialog').not('.ui-dialog *').length;
    $('#count', _this._ui_page2).
    append('<center>').
    text(function () {
        if (matchCount == 1)
            return translate('blacklistersinglematch');
        else
            return translate('blacklistermatches', [matchCount]);
      });
  }

  $detailsDiv.empty();
  var attrs = ['nodeName', 'id', 'class', 'name', 'src', 'href', 'data'];
  for (var i = 0; i < attrs.length; i++) {
    var attr = attrs[i];
    var longVal = (attr == 'nodeName' ? el.prop('nodeName') : el.attr(attr));
    var val = BlacklistUi._ellipsis(longVal);

    if (!val)
      continue;

    // Check src, data and href only by default if no other identifiers are
    // present except for the nodeName selector.
    var checked = true;
    if (attr == 'src' || attr == 'href' || attr == 'data')
      checked = $('input', $detailsDiv).length == 1;
    var checkboxlabel = $('<label></label>').
      text(translate('blacklisterattrwillbe',
           [(attr == 'nodeName' ? translate('blacklistertype') : attr), val])).
      attr('for', 'ck' + attr);

    var checkbox = $('<div></div>').
      append('<input type=checkbox ' + (checked ? 'checked="checked"' : '') +
             ' id=ck' + attr + ' /> ').
      append(checkboxlabel);

    checkbox.find('input').change(function () {
      updateFilter();
      _this._preview($('#summary', _this._ui_page2).text());
    });

    $detailsDiv.append(checkbox);
  }

  updateFilter();
};

// Change the appearance of a CSS selector on the page, or if null, undo the change.
// Inputs: selector:string - the selector generated by the blacklist wizard
BlacklistUi.prototype._preview = function (selector) {
  $('#adblock_blacklist_preview_css').remove();
  if (!selector) return;

  var cssPreview = document.createElement('style');
  cssPreview.type = 'text/css';
  cssPreview.id = 'adblock_blacklist_preview_css';

  var d = 'body .adblock-blacklist-dialog';

  switch (this._current_step) {
  case 0:

    // Raise highlight.
    cssPreview.innerText = 'body .adblock-highlight-node,';
    break;
  case 1:

    // Show ui_page1.
    cssPreview.innerText = d + ', ' + d + ' * {opacity:1!important;} ';

    // Fade the selector, while skipping any matching children.
    cssPreview.innerText += selector + ' {opacity:.1!important;} ' +
      selector + ' ' + selector + ' {opacity:1!important;}';
    break;
  case 2:

    // Show ui_page2.
    cssPreview.innerText = d + ' input, ' + d +
      ' button {display:inline-block!important;} ' + d + '.ui-page-2, ' + d +
      ' div:not(#filter_warning), ' + d + ' .ui-icon, ' + d + ' a, ' + d +
      ' center {display:block!important;} ' +  d + ' #adblock-details, ' + d +
      ' span, ' + d + ' b, ' + d + ' i {display:inline!important;} ';

    // Hide the specified selector.
    cssPreview.innerText += selector + ' {display:none!important;}';
}

  // Finally, raise the UI above *all* website UI, using max 32-bit signed int.
  cssPreview.innerText += ' ' + d + ' {z-index:2147483647!important;}';

  document.documentElement.appendChild(cssPreview);
};

// Return a copy of value that has been truncated with an ellipsis in
// the middle if it is too long.
// Inputs: value:string - value to truncate
//         size?:int - max size above which to truncate, defaults to 50
BlacklistUi._ellipsis = function (value, size) {
  if (value == null)
    return value;

  if (size == undefined)
    size = 50;

  var half = size / 2 - 2; // With ellipsis, the total length will be ~= size

  if (value.length > size)
    value = (value.substring(0, half) + '...' +
             value.substring(value.length - half));

  return value;
};

//# sourceURL=/uiscripts/blacklisting/blacklistui.js
