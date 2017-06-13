'use strict';

var customizeInit = function () {

    browser.runtime.onMessage.addListener(function (request) {
        if (request && request.command != 'filters_updated') {
          return;
        } else if (!request) {
          return;
        }

        if ($('#txtFiltersAdvanced').prop('disabled') === false) {
          return;
        }

        BG.get_custom_filters_text(function (customFiltersResponse) {
          $('#txtFiltersAdvanced').val(customFiltersResponse);
        });

        BG.get_exclude_filters_text(function (excludeFiltersResponse) {
          $('#txtExcludeFiltersAdvanced').val(excludeFiltersResponse);
        });
      });

    // Add a custom filter to the list
    function appendCustomFilter(filter) {
      var customFilterText = $('#txtFiltersAdvanced').val();
      $('#txtFiltersAdvanced').val(filter + '\n' + customFilterText);
      saveFilters();
      $('.addControls').slideUp();
    }

    // Convert a messy list of domains to ~domain1.com|~domain2.com format
    function toTildePipeFormat(domainList) {
      domainList = domainList.trim().replace(/[\ \,\;\|]+\~?/g, '|~');
      if (domainList && domainList[0] != '~')
          domainList = '~' + domainList;
      return domainList;
    }

    $('#txtBlacklist').focus(function () {
        // Find the blacklist entry in the user's filters, and put it
        // into the blacklist input.
        var customFilterText = $('#txtFiltersAdvanced').val();
        var match = customFilterText.match(/^\@\@\*\$document\,domain\=(\~.*)$/m);
        if (match && $(this).val() == '')
            $(this).val(match[1]);
      });

    // The add_filter functions
    $('#btnAddUserFilter').click(function () {
        var blockCss = $('#txtUserFilterCss').val().trim();
        var blockDomain = $('#txtUserFilterDomain').val().trim();

        if (blockDomain == '.*' || blockDomain == '*' || blockDomain == '')
            appendCustomFilter('##' + blockCss);
        else
            appendCustomFilter(blockDomain + '##' + blockCss);

        $(this).closest('.entryTable').find("input[type='text']").val('');
        $(this).attr('disabled', 'disabled');
      });

    $('#btnAddExcludeFilter').click(function () {
        var excludeUrl = $('#txtUnblock').val().trim();

        //prevent regexes
        if (/^\/.*\/$/.test(excludeUrl))
            excludeUrl = excludeUrl + '*';

        appendCustomFilter('@@' + excludeUrl + '$document');

        $(this).closest('.entryTable').find("input[type='text']").val('');
        $(this).attr('disabled', 'disabled');
      });

    $('#btnAddBlacklist').click(function () {
        var blacklist = toTildePipeFormat($('#txtBlacklist').val());

        var filters = $('#txtFiltersAdvanced').val().trim() + '\n';

        // Delete the first likely line
        filters = filters.replace(/^\@\@\*\$document,domain\=~.*\n/m, '').trim();
        $('#txtFiltersAdvanced').val(filters);

        // Add our line in its place, or if it was empty, remove the filter
        if (blacklist)
            appendCustomFilter('@@*$document,domain=' + blacklist);
        else
            saveFilters(); // just record the deletion
        $('#btnAddBlacklist').attr('disabled', 'disabled');
      });

    $('#btnAddUrlBlock').click(function () {
        var blockUrl = $('#txtBlockUrl').val().trim();
        var blockDomain = $('#txtBlockUrlDomain').val().trim();
        if (blockDomain == '*')
            blockDomain = '';

        //prevent regexes
        if (/^\/.*\/$/.test(blockUrl))
            blockUrl = blockUrl + '*';

        if (blockDomain == '')
            appendCustomFilter(blockUrl);
        else
            appendCustomFilter(blockUrl + '$domain=' + blockDomain);

        $(this).closest('.entryTable').find("input[type='text']").val('');
        $(this).attr('disabled', 'disabled');
      });

    // The validation functions
    $('#txtBlacklist').bind('input', function () {
        var blacklist = toTildePipeFormat($('#txtBlacklist').val());

        if (blacklist)
            blacklist = '@@*$document,domain=' + blacklist;
        $('#messageBlacklist').empty();
        $('#messageBlacklist').hide();
        var response = BG.FilterNormalizer.validateLine(blacklist, true);
        if (response && !response.exception) {
          $('#btnAddBlacklist').removeAttr('disabled');
        } else if (response && response.exception) {
          $('#btnAddBlacklist').attr('disabled', 'disabled');
          var filterErrorMessage = translate('customfilterserrormessage', [blacklist, response.exception]);
          $("#messageBlacklist").text(filterErrorMessage);
          $('#messageBlacklist').show();
        } else {
          $('#btnAddBlacklist').attr('disabled', 'disabled');
        }
      });

    $("#divUrlBlock input[type='text']").bind('input', function () {
        var blockUrl = $('#txtBlockUrl').val().trim();
        var blockDomain = $('#txtBlockUrlDomain').val().trim();
        if (blockDomain == '*')
            blockDomain = '';
        if (blockDomain)
            blockDomain = '$domain=' + blockDomain;
        var ok = false;

        var response = BG.FilterNormalizer.validateLine((blockUrl + blockDomain));
        if (response)
            ok = true;
        var secondResponse = BG.isSelectorFilter(blockUrl);
        if (secondResponse)
            ok = false;

        $('#btnAddUrlBlock').attr('disabled', ok ? null : 'disabled');
      });

    $("#divCssBlock input[type='text']").bind('input', function () {
        var blockCss = $('#txtUserFilterCss').val().trim();
        var blockDomain = $('#txtUserFilterDomain').val().trim();
        if (blockDomain == '*')
            blockDomain = '';
        var ok = false;
        var response = BG.FilterNormalizer.validateLine(blockDomain + '##' + blockCss);
        if (response)
            ok = true;
        $('#btnAddUserFilter').attr('disabled', ok ? null : 'disabled');
      });

    $("#divExcludeBlock input[type='text']").bind('input', function () {
        var unblockUrl = $('#txtUnblock').val().trim();
        var ok = false;
        var response = BG.FilterNormalizer.validateLine('@@' + unblockUrl + '$document');
        if (response)
            ok = true;

        var secondResponse = BG.isSelectorFilter(unblockUrl);
        if (!unblockUrl || secondResponse)
            ok = false;

        $('#btnAddExcludeFilter').attr('disabled', ok ? null : 'disabled');
      });

    // When one presses 'Enter', pretend it was a click on the 'add' button
    $(".entryTable input[type='text']").keypress(function (event) {
        var submitButton = $(this).closest('.entryTable').find("input[type='button']");
        if (event.keyCode === 13 && !submitButton.prop('disabled')) {
          event.preventDefault();
          submitButton.click();
        }
      });

    $('a.controlsLink').click(function (event) {
        try {
          event.preventDefault();
          var myControls = $(this).closest('div').find('.addControls');
          $('.addControls').not(myControls).slideUp();
          myControls.slideToggle();
        } catch (e) {
          dump(e);
        }
      });

    $('#btnEditAdvancedFilters').click(function () {
        $('#divAddNewFilter').slideUp();
        $('.addControls').slideUp();
        $('#txtFiltersAdvanced').removeAttr('disabled');
        $('#spanSaveButton').show();
        $('#btnEditAdvancedFilters').hide();
        $('#txtFiltersAdvanced').focus();
      });

    $('#btnEditExcludeAdvancedFilters').click(function () {
        $('#divAddNewFilter').slideUp();
        $('.addControls').slideUp();
        $('#txtExcludeFiltersAdvanced').removeAttr('disabled');
        $('#spanSaveExcludeButton').show();
        $('#btnEditExcludeAdvancedFilters').hide();
        $('#txtExcludeFiltersAdvanced').focus();
      });

    // Update custom filter count in the background.
    // Inputs: customFiltersText:string - string representation of the custom filters
    // delimited by new line.
    function updateCustomFiltersCount(customFiltersText) {
      var customFiltersArray = customFiltersText.split('\n');
      var newCount = {};
      var tempFilterTracker = [];
      for (var i = 0; i < customFiltersArray.length; i++) {
        var filter = customFiltersArray[i];

        //Check if filter is a duplicate and that it is a hiding filter.
        if (tempFilterTracker.indexOf(filter) < 0 && filter.indexOf('##') > -1) {
          tempFilterTracker.push(filter);
          var host = filter.split('##')[0];
          newCount[host] = (newCount[host] || 0) + 1;
        }
      }

      BG.updateCustomFilterCountMap(newCount);
    }

    function saveExcludeFilters() {
      var excludeFiltersText = $('#txtExcludeFiltersAdvanced').val();
      BG.set_exclude_filters(excludeFiltersText);
      $('#divAddNewFilter').slideDown();
      $('#txtExcludeFiltersAdvanced').attr('disabled', 'disabled');
      $('#spanSaveExcludeButton').hide();
      $('#btnEditExcludeAdvancedFilters').show();
      BG.get_exclude_filters_text(function (excludeFiltersResponse) {
        $('#txtExcludeFiltersAdvanced').val(excludeFiltersResponse);
        if (excludeFiltersResponse)
            $('#divExcludeFilters').show();
      });
    }

    $('#btnSaveExcludeAdvancedFilters').click(saveExcludeFilters);

    function saveFilters() {
      var customFiltersText = $('#txtFiltersAdvanced').val();
      var customFiltersArray = customFiltersText.split('\n');
      $('#messagecustom').empty();
      $('#messagecustom').hide();
      var response = BG.FilterNormalizer.validateList(customFiltersArray, true);
      if (response && !response.exception) {
        BG.set_custom_filters_text(customFiltersText);
        updateCustomFiltersCount(customFiltersText);
        $('#divAddNewFilter').slideDown();
        $('#txtFiltersAdvanced').attr('disabled', 'disabled');
        $('#spanSaveButton').hide();
        $('#btnEditAdvancedFilters').show();
        $('#btnCleanUp').show();
      } else if (response && response.exception) {
        var filterErrorMessage = translate('customfilterserrormessage', [response.filter, response.exception]);
        $('#messagecustom').text(filterErrorMessage);
        $('#messagecustom').show();
      }
    }

    $('#btnSaveAdvancedFilters').click(saveFilters);
    BG.get_custom_filters_text(function (customFiltersResponse) {
      $('#txtFiltersAdvanced').val(customFiltersResponse);
    });

    var settings = BG.getSettings();
    if (settings.show_advanced_options) {
      $('#divExcludeFilters').show();
    }

    BG.get_exclude_filters_text(function (excludeFiltersResponse) {
      $('#txtExcludeFiltersAdvanced').val(excludeFiltersResponse);
      if (excludeFiltersResponse) {
        $('#divExcludeFilters').show();
      }
    });

    $('#btnCleanUp').click(function () {
        //Don't save immediately, first allow them to review changes
        if ($('#btnEditAdvancedFilters').is(':visible'))
            $('#btnEditAdvancedFilters').click();
        var response = BG.FilterNormalizer.normalizeList($('#txtFiltersAdvanced').val(), true);
        var newFilters = response;
        newFilters = newFilters.replace(/(\n)+$/, '\n'); // Del trailing \n's
        $('#txtFiltersAdvanced').val(newFilters);
      });
  };
