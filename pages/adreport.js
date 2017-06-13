'use strict';

//get the list of subscribed filters and
//all unsubscribed default filters
var BG = chrome.extension.getBackgroundPage();
var unsubscribed_default_filters = [];
var subscribed_filter_names = [];
var enabled_settings = [];
var malwareDomains = {};

// Get debug info
var debug_info;
BG.getDebugInfo(function (info) {
    debug_info = info;
  });

var args = parseUri.parseSearch(document.location.search);

// Auto-scroll to bottom of the page
$('input[type=radio]').click(function (event) {
    event.preventDefault();
    $('html, body').animate({ scrollTop: $(document).height() }, 'slow');
  });

// Auto-scroll to bottom of the page
$('select').change(function (event) {
    event.preventDefault();
    $('html, body').animate({ scrollTop: $(document).height() }, 'slow');
  });

$(document).ready(function () {

  localizePage();

  var subs = BG.get_subscriptions_minus_text();
  for (var id in subs)
      if (!subs[id].subscribed && !subs[id].user_submitted)
          unsubscribed_default_filters[id] = subs[id];
  else if (subs[id].subscribed)
          subscribed_filter_names.push(id);

  var settings = BG.getSettings();
  for (var setting in settings)
      if (settings[setting])
          enabled_settings.push(setting);

  //Shows the instructions for how to enable all extensions according to the browser of the user
  $('.chrome_only').hide();

  // Sort the languages list
  var languageOptions = $('#step_language_lang option');
  var currentlySelectedOption = $('#step_language_lang > option[selected]');
  languageOptions.sort(function (a, b) {
      if (!a.text) return -1;
      if (!b.text) return 1; // First one is empty
      if (!a.value) return 1;
      if (!b.value) return -1; // 'Other' at the end
      if (a.getAttribute('i18n') == 'lang_english') return -1; // English second
      if (b.getAttribute('i18n') == 'lang_english') return 1;
      return (a.text > b.text) ? 1 : -1;
    });

  $('#step_language_lang').empty().append(languageOptions);
  $('#step_language_lang').val(currentlySelectedOption.val());

  var domain = parseUri(args.url).hostname.replace(/((http|https):\/\/)?(www.)?/g, '');
  var tabId = args.tabId;
  // STEP 1: Malware/adware detection
  // Fetch file with malware-known domains
  var malwareDomains = BG.getMalwareDomains();
  // Check, if downloaded resources are available,
  // if not, just reload tab with parsed tabId
  if (BG.getSettings().show_advanced_options) {
    checkForMalware();
  } else {
    browser.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request && request.command === 'reloadcomplete') {
          BG.setSetting('show_advanced_options', false);
          checkForMalware();
          sendResponse({});
        }
      });

    BG.reloadTab(tabId);
  }

  // STEP 2: update filters
  //Updating the users filters
  $('#UpdateFilters').click(function () {
      $(this).attr('disabled', 'disabled');
      BG.update_subscriptions_now();
      $('.afterFilterUpdate input').removeAttr('disabled');
      $('.afterFilterUpdate').removeClass('afterFilterUpdate');
    });
  //if the user clicks a radio button
  $('#step_update_filters_no').click(function () {
      $('#step_update_filters').children().remove();
      var newSpan = document.createElement('span');
      newSpan.setAttribute('class', 'answer');
      newSpan.setAttribute('chosen', 'no');
      var textNode = document.createTextNode(translate('no'));
      newSpan.appendChild(textNode);
      $('#step_update_filters').append(newSpan);
      $('#checkupdate').text(translate('adalreadyblocked'));
    });

  $('#step_update_filters_yes').click(function () {
      $('#step_update_filters').children().remove();
      var newSpan = document.createElement('span');
      newSpan.setAttribute('class', 'answer');
      newSpan.setAttribute('chosen', 'yes');
      var textNode = document.createTextNode(translate('yes'));
      newSpan.appendChild(textNode);

      $('#step_update_filters').append(newSpan);

      var subs = BG.get_subscriptions_minus_text();
      //if the user is subscribed to Acceptable-Ads, ask them to disable it
      if (subs && subs['acceptable_ads'] && subs['acceptable_ads'].subscribed) {
        $('#step_update_aa_DIV')
            .show();
        $('.odd')
            .css('background-color', '#f8f8f8');
      } else {
        $('#step_disable_extensions_DIV').fadeIn().css('display', 'block');
        $('.even')
            .css('background-color', '#f8f8f8');
      }
    });

  // STEP 3: disable AA - IF enabled...

  $('#DisableAA')
      .click(function () {
          $(this)
              .prop('disabled', true);
          BG.unsubscribe({ id: 'acceptable_ads', del: false });
          // display the Yes/No buttons
          $('.afterDisableAA input')
              .prop('disabled', false);
          $('.afterDisableAA')
              .removeClass('afterDisableAA');
        });

  //if the user clicks a radio button
  $('#step_update_aa_no')
      .click(function () {
          $('#step_update_aa').children().remove();
          var newSpan = document.createElement('span');
          newSpan.setAttribute('class', 'answer');
          newSpan.setAttribute('chosen', 'no');
          var textNode = document.createTextNode(translate('no'));
          newSpan.appendChild(textNode);
          $('#step_update_aa').append(newSpan);
          $('#checkupdate')
              .text(translate('aamessageadreport'));
          $('#checkupdatelink')
              .text(translate('aalinkadreport'));
          $('#checkupdatelink_DIV')
              .fadeIn()
              .css('display', 'block');

        });

  $('#step_update_aa_yes')
      .click(function () {
          $('#step_update_aa').children().remove();
          var newSpan = document.createElement('span');
          newSpan.setAttribute('class', 'answer');
          newSpan.setAttribute('chosen', 'yes');
          var textNode = document.createTextNode(translate('yes'));
          newSpan.appendChild(textNode);
          $('#step_update_aa').append(newSpan);
          $('#step_disable_extensions_DIV')
              .fadeIn()
              .css('display', 'block');
        });

  // STEP 4: disable all extensions

  //Code for displaying the div is in the $function() that contains localizePage()
  //after user disables all extensions except for AdBlock
  //if the user clicks a radio button
  $('#step_disable_extensions_no').click(function () {
      $('#step_disable_extensions').children().remove();
      var newSpan = document.createElement('span');
      newSpan.setAttribute('class', 'answer');
      newSpan.setAttribute('chosen', 'no');
      var textNode = document.createTextNode(translate('no'));
      newSpan.appendChild(textNode);
      $('#step_disable_extensions').append(newSpan);
      $('#checkupdate').text(translate('reenableadsonebyone'));
    });

  $('#step_disable_extensions_yes').click(function () {
      $('#step_disable_extensions').children().remove();
      var newSpan = document.createElement('span');
      newSpan.setAttribute('class', 'answer');
      newSpan.setAttribute('chosen', 'yes');
      var textNode = document.createTextNode(translate('yes'));
      newSpan.appendChild(textNode);
      $('#step_disable_extensions').append(newSpan);
      $('#step_language_DIV').fadeIn().css('display', 'block');
    });

  // STEP 5: language
  //if the user clicks an item
  var contact = '';
  $('#step_language_lang').change(function () {
      var selected = $('#step_language_lang option:selected');
      $('#step_language').children().remove();
      var newSpan = document.createElement('span');
      newSpan.setAttribute('class', 'answer');
      var textNode = document.createTextNode(selected.text());
      newSpan.appendChild(textNode);
      $('#step_language').append(newSpan);
      $('#step_language span').attr('chosen', selected.attr('i18n'));
      if (selected.text() == translate('other')) {
        if (!$('#checkupdate').get(0).firstChild) {
           log("returning, no first child found", $(this).attr("i18n"));
           return;
        }
        if (!$('#checkupdate').get(0).lastChild) {
           log("returning, no last child found", $(this).attr("i18n"));
           return;
        }
        var rawMessageText = translate('nodefaultfilter1');
        var messageSplit = splitMessageWithReplacementText(rawMessageText);
        $('#checkupdate').get(0).firstChild.nodeValue = messageSplit.anchorPrefixText;
        $('#checkupdate').get(0).lastChild.nodeValue = messageSplit.anchorPostfixText;
        $('#checkupdatelink').text(messageSplit.anchorText).attr('href', 'https://adblockplus.org/en/subscriptions');
        return;
      } else {
        var required_lists = selected.attr('value').split(';');
        for (var i = 0; i < required_lists.length - 1; i++) {
          if (unsubscribed_default_filters[required_lists[i]]) {
            $('#checkupdate').text(translate('retryaftersubscribe', [translate('filter' + required_lists[i])]));
            return;
          }
        }
      }

      contact = required_lists[required_lists.length - 1];

      $('#step_chrome_DIV').fadeIn().css('display', 'block');
      $('#checkinchrome').text(translate('ff_checkinchrometitle'));
    });

  // STEP 6: also in Chrome

  //If the user clicks a radio button
  $('#step_other_browser_yes').click(function () {
      $('#step_other_browser').children().remove();
      var newSpan = document.createElement('span');
      newSpan.setAttribute('class', 'answer');
      newSpan.setAttribute('chosen', 'yes');
      var textNode = document.createTextNode(translate('yes'));
      newSpan.appendChild(textNode);
      $('#step_other_browser').append(newSpan);

      if (/^mailto\:/.test(contact))
          contact = contact.replace(' at ', '@');

      if (!$('#checkupdate').get(0).firstChild) {
         log("returning, no first child found", $(this).attr("i18n"));
         return;
      }
      if (!$('#checkupdate').get(0).lastChild) {
         log("returning, no last child found", $(this).attr("i18n"));
         return;
      }
      var rawMessageText = translate('reportfilterlistproblem');
      var messageSplit = splitMessageWithReplacementText(rawMessageText);
      $('#checkupdate').get(0).firstChild.nodeValue = messageSplit.anchorPrefixText;
      $('#checkupdate').get(0).lastChild.nodeValue = messageSplit.anchorPostfixText;
      $('#checkupdatelink').prop('href', contact);
      $('#checkupdatelink').text(contact.replace(/^mailto\:/, ''));
      $('#privacy').show();
    });

  $('#step_other_browser_no').click(function () {
      $('#step_other_browser').children().remove();
      var newSpan = document.createElement('span');
      newSpan.setAttribute('class', 'answer');
      newSpan.setAttribute('chosen', 'no');
      var textNode = document.createTextNode(translate('no'));
      newSpan.appendChild(textNode);
      $('#step_other_browser').append(newSpan);
      $('#step_report_DIV')
                  .fadeIn()
                  .css('display', 'block');
      if (debug_info) {
        $('#debug-info')
              .val(createReadableReport({
                debug: debug_info,
              }));
      }
    });

  $('#step_other_browser_wontcheck').click(function () {
      $('#step_other_browser_yes').click();
      var newSpan = document.createElement('span');
      newSpan.setAttribute('class', 'answer');
      newSpan.setAttribute('chosen', 'wont_check');
      var textNode = document.createTextNode(translate('refusetocheck'));
      newSpan.appendChild(textNode);
      $('#step_other_browser').append(newSpan);
    });

  // STEP 7: Ad Report
  $('#step_report_submit')
      .click(function () {
          $('#step_report_submit').prop('disabled', false);
          sendReport();
        });
});

//generate the URL to the issue tracker
function generateReportURL() {
  var result = 'https://adblock.tenderapp.com/discussion/new' +
      '?category_id=ad-report&discussion[private]=1&discussion[title]=';

  var domain = '<enter URL of webpage here>';

  if (args && args.url)
      domain = parseUri(args.url).hostname;
  result = result + encodeURIComponent('Ad report: ' + domain);

  var body = [];
  var count = 1;
  body.push('Last step -- point me to the ad so I can fix the bug! ' +
  "Don't leave anything out or I'll probably " +
  'have to ignore your report. Thanks!');
  body.push('');
  body.push('Also, if you can put your name (or a screen name) ' +
  'and a contact email access in the boxes above, that would be great!');
  body.push('');
  body.push('We need the email so that we can contact you if we need more information ' +
  'than what you give us in your report. Otherwise, we might not be able to fix it.');
  body.push('');
  if (!args || !args.url) {
    body.push(count + '. Paste the URL of the webpage showing an ad: ');
    body.push('');
    body.push('');
    count++;
  }

  body.push(count + '. Exactly where on that page is the ad? What does it ' +
  'look like? Attach a screenshot, with the ad clearly marked, ' +
  'if you can.');
  body.push('');
  body.push('');
  count++;
  body.push(count + '. If you have created the filter which removes reported ad, please paste it here: ');
  body.push('');
  body.push('');
  count++;
  body.push(count + '. Any other information that would be helpful, besides ' +
  'what is listed below: ');
  body.push('');
  body.push('');
  body.push("-------- Please don't touch below this line. ---------");
  if (args && args.url) {
    body.push('=== URL with ad ===');
    body.push(args.url);
    body.push('');
  }

  body.push(debug_info);
  body.push('');
  body.push('=== Question Responses ===');
  var answers = $('span[class="answer"]');
  var text = $('div[class="section"]:visible');
  for (var i = 0, n = 1; i < answers.length, i < text.length; i++, n++) {
    body.push(n + '.' + text[i].id + ': ' + answers[i].getAttribute('chosen'));
  }

  body.push('');

  result = result + '&discussion[body]=' + encodeURIComponent(body.join('  \n')); // Two spaces for Markdown newlines

  return result;
}

function sendReport() {
  // Cache access to input boxes
  var $name = $('#step_report_name');
  var $email = $('#step_report_email');
  var $location = $('#step_report_location');
  var $filter = $('#step_report_filter');
  var problems = 0;
  // Reset any error messages
  $email.removeClass('inputError');
  $name.removeClass('inputError');
  // Reset any error messages
  $('#screen_capture_file_label')
      .css('color', 'black');
  $('#step_response_error')
      .parent()
      .fadeOut();
  $('#step_response_success')
      .parent()
      .fadeOut();
  $('#adreport_missing_info')
      .hide();
  // Validate user entered info
  if ($name.val() === '') {
    problems++;
    $name.addClass('inputError');
    $('#adreport_missing_info')
        .show();
  }

  if ($email.val() === '' ||
      $email.val()
      .search(/^.+@.+\..+$/) === -1) {
    problems++;
    $email.addClass('inputError');
    $('#adreport_missing_info')
        .show();
  }

  if ($('#screen_capture_file')[0].files.length === 0) {
    $('#adreport_missing_screenshot')
        .show();
    problems++;
    $('#screen_capture_file_label')
        .css('color', '#f00');
  }

  if (problems) {
    $('html, body')
        .animate({
            scrollTop: $('#adreport_missing_info')
                .offset()
                .top,
          }, 2000);
    return;
  }

  var report_data = {
      title: 'Ad Report',
      name: $name.val(),
      email: $email.val(),
      location: $location.val(),
      filter: $filter.val(),
      debug: debug_info,
      noscreencapturefile: true,
      url: '',
    };
  var domain = '';
  var domain = parseUri(args.url).hostname.replace(/((http|https):\/\/)?(www.)?/g, '');
  report_data.title = report_data.title + ': ' + domain;
  report_data.url = args.url;
  var the_answers = [];
  var answers = $('span[class="answer"]');
  var text = $('div[class="section"]:visible');
  var minArrayLength = Math.min(answers.length, text.length);
  for (var i = 0; i < minArrayLength; i++) {
    the_answers.push((i + 1) + '.' + text[i].id + ': ' + answers[i].getAttribute('chosen'));
  }

  report_data.answers = the_answers.join('\n');

  // Handle any HTTP or server errors
  var handleResponseError = function (respObj) {
      $('#step_response_error')
          .parent()
          .fadeIn();
      if (respObj &&
          respObj.hasOwnProperty('error_msg')) {
        $('#step_response_error_msg')
            .text(translate(respObj['error_msg']));
      }
      //re-enable the button(s) if the error is recoverable (the user can re-submit)
      if (respObj &&
          respObj.hasOwnProperty('retry_allowed') &&
          respObj['retry_allowed'] === 'true') {
        $('#step_report_submit')
            .prop('disabled', false);
        $('#step_response_error_manual_submission')
            .hide();
      } else {
        $('#step_response_error_manual_submission a')
            .attr('href', 'https://adblocksupport.freshdesk.com/support/tickets/new');
        $('#step_response_error_manual_submission a')
            .attr('target', '_blank');
        $('#step_response_error_manual_submission')
            .show();
      }

      $('html, body')
          .animate({
              scrollTop: $('#step_response_error')
                  .offset()
                  .top,
            }, 2000);
    };

  $('#debug-info').val(createReadableReport(report_data));

  // Retrieve extension info
  var askUserToGatherExtensionInfo = function () {
    report_data.extensions = 'Extension information not available in Firefox';
    sendData();
  }; //end of askUserToGatherExtensionInfo

  var sendData = function () {
      var formdata = new FormData();
      formdata.append('ad_report', JSON.stringify(report_data));
      var uploadFileElement = $('#screen_capture_file');
      if (uploadFileElement && (uploadFileElement.length > 0) && uploadFileElement[0].files.length > 0) {
        formdata.append('screencapturefile', $('#screen_capture_file')[0].files[0]);
      }

      $('#debug-info')
          .val(createReadableReport(report_data));
      $.ajax({
          jsonp: false,
          url: 'https://getadblock.com/freshdesk/adReport.php',
          data: formdata,
          contentType: false,
          processData: false,
          success: function (text) {
              $('#step_report_submit')
                  .prop('disabled', true);
              // if a ticket was created, the response should contain a ticket id #
              if (text) {
                try {
                  var respObj = JSON.parse(text);

                  if (respObj &&
                      respObj.hasOwnProperty('helpdesk_ticket') &&
                      respObj['helpdesk_ticket'].hasOwnProperty('display_id')) {
                    $('#step_report_submit')
                        .prop('disabled', true);
                    // if a ticket was created, the response should contain a ticket id #
                    $('#step_response_success')
                      .parent()
                      .fadeIn();
                    $('html, body')
                      .animate({
                          scrollTop: $('#step_response_success')
                              .offset()
                              .top,
                        }, 2000);
                  } else {
                    prepareManualReport(report_data, null, null, respObj);
                    handleResponseError(respObj);
                  }
                } catch (e) {
                  prepareManualReport(report_data);
                  handleResponseError();
                }
              } else {
                prepareManualReport(report_data);
                handleResponseError();
              }
            },

          error: function (xhrInfo, status, HTTPerror) {
              prepareManualReport(report_data, status, HTTPerror);
              handleResponseError();
            },

          type: 'POST',
        });
    };

  if (chrome &&
      chrome.tabs &&
      chrome.tabs.detectLanguage) {
    var tabIdInt = -1;
    try {
      tabIdInt = parseInt(tabId);
    } catch (e) {
      report_data.language = 'unknown';
      askUserToGatherExtensionInfo();
      return;
    }

    chrome.tabs.detectLanguage(tabIdInt, function (language) {
        if (language) {
          report_data.language = language;
        }

        askUserToGatherExtensionInfo();
      }); //end of detectLanguage
  } else {
    report_data.language = 'unknown';
    askUserToGatherExtensionInfo();
  }

  // Handle any HTTP or server errors
  var handleResponseError = function (respObj) {
      $('#step_response_error')
          .parent()
          .fadeIn();
      if (respObj &&
          respObj.hasOwnProperty('error_msg')) {
        $('#step_response_error_msg')
            .text(translate(respObj['error_msg']));
      }
      //re-enable the button(s) if the error is recoverable (the user can re-submit)
      if (respObj &&
          respObj.hasOwnProperty('retry_allowed') &&
          respObj['retry_allowed'] === 'true') {
        $('#step_report_submit')
            .prop('disabled', false);
        $('#step_response_error_manual_submission')
            .hide();
      } else {
        $('#step_response_error_manual_submission a')
            .attr('href', 'https://adblocksupport.freshdesk.com/support/tickets/new');
        $('#step_response_error_manual_submission a')
            .attr('target', '_blank');
        $('#step_response_error_manual_submission')
            .show();
      }

      $('html, body')
          .animate({
              scrollTop: $('#step_response_error')
                  .offset()
                  .top,
            }, 2000);
    };

}; // end of sendReport()

var createReadableReport = function (data) {
    var body = [];
    if (data.location) {
      body.push('* Location of ad *');
      body.push(data.location);
    }

    if (data.expect) {
      body.push('');
      body.push('* Working Filter? *');
      body.push(data.expect);
    }

    body.push('');

    // Get written debug info
    // data.debug is the debug info object
    content = [];
    content.push('* Debug Info *');
    content.push('');
    if (data.debug &&
        data.debug.filter_lists) {
      content.push(data.debug.filter_lists);
    }

    content.push('');
    // Custom & Excluded filters might not always be in the object
    if (data.custom_filters) {
      content.push('=== Custom Filters ===');
      content.push(data.debug.custom_filters);
      content.push('');
    }

    if (data.exclude_filters) {
      content.push('=== Exclude Filters ===');
      content.push(data.debug.exclude_filters);
      content.push('');
    }

    if (data.debug &&
        data.debug.settings) {
      content.push('=== Settings ===');
      content.push(data.debug.settings);
    }

    content.push('');
    if (data.debug &&
        data.debug.other_info) {
      content.push('=== Other Info ===');
      content.push(data.debug.other_info);
    }

    body.push(content.join('\n'));
    body.push('');
    return body.join('\n');
  }; // end of createReadableReport

// Pretty Print the data
var prepareManualReport = function (data, status, HTTPerror, respObj) {
    var body = [];
    body.push(createReadableReport(data));
    if (status) {
      body.push('Status: ' + status);
    }

    if (HTTPerror) {
      body.push('HTTP error code: ' + HTTPerror);
    }

    if (respObj) {
      body.push('Server error information: ' + JSON.stringify(respObj));
    }

    $('#manual_submission')
        .val(body.join('\n'));
  };

// Check every domain of downloaded resource against malware-known domains
var checkForMalware = function () {
    var tab_frameData = BG.get_frameData(args.tabId);
    if (!tab_frameData)
        return;

    var frames = [];
    var loaded_resources = [];
    var extracted_domains = [];
    var infected = null;

    // Get all loaded frames
    for (var object in tab_frameData) {
      if (!isNaN(object))
          frames.push(object);
    }
    // Push loaded resources from each frame into an array
    for (var i = 0; i < frames.length; i++) {
      if (Object.keys(tab_frameData[frames[i]].resources).length !== 0)
          loaded_resources.push(tab_frameData[frames[i]].resources);
    }

    // Extract domains from loaded resources
    for (var i = 0; i < loaded_resources.length; i++) {
      for (var key in loaded_resources[i]) {
        // Push just domains, which are not already in extracted_domains array
        var resource = key.split(':|:');
        if (resource &&
            resource.length == 2 &&
            extracted_domains.indexOf(parseUri(resource[1]).hostname) === -1) {
          extracted_domains.push(parseUri(resource[1]).hostname);
        }
      }
    }

    // Compare domains of loaded resources with domain.json
    for (var i = 0; i < extracted_domains.length; i++) {
      if (malwareDomains && malwareDomains.adware.indexOf(extracted_domains[i]) > -1) {
        // User is probably infected by some kind of malware,
        // because resource has been downloaded from malware/adware/spyware site.
        var infected = true;
      }
    }

    $('.gifloader').hide();
    if (infected) {
      $('#step_update_filters_DIV').hide();
      $('#malwarewarning').text(translate('malwarewarning'));
      $('a', '#malwarewarning').attr('href', 'https://help.getadblock.com/support/solutions/articles/6000055822-i-m-seeing-similar-ads-on-every-website-');
    } else {
      $('#step_update_filters_DIV').show();
      $('#malwarewarning').text(translate('malwarenotfound'));
    }

    $('#malwarewarning').show();
  };
