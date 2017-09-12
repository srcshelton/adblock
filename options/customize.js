'use strict';

var customizeInit = function () {

    chrome.runtime.onMessage.addListener(function (request) {
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
      });

    // Add a custom filter to the list
    function appendCustomFilter(filter) {
      var customFilterText = $('#txtFiltersAdvanced').val();
      $('#txtFiltersAdvanced').val(filter + '\n' + customFilterText);
      saveFilters();
      $('.addControls').slideUp();
    }

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
  };
