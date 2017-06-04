'use strict';
var BG = chrome.extension.getBackgroundPage();
var debugInfo;
var textDebugInfo = '';
var extInfo = '';
$(document).ready(function () {

    // Retrieve extension info
    var gatherExtensionInfo = function () {
      if (chrome.management &&
          typeof chrome.management.getAll === 'function') {
        chrome.management.getAll(function (result) {
            var extInfo = [];
            for (var i = 0; i < result.length; i++) {
              extInfo.push('Number ' + (i + 1));
              extInfo.push('  name: ' + result[i].name);
              extInfo.push('  id: ' + result[i].id);
              extInfo.push('  version: ' + result[i].version);
              extInfo.push('  enabled: ' + result[i].enabled);
              extInfo.push('  type: ' + result[i].type);
              extInfo.push('');
            }

            extInfo = '\nExtensions:\n' + extInfo.join('\n');
            continueProcessing();
          });
      } else {
        extInfo = '\nExtension Information not available\n';
        continueProcessing();
      }
    };

    // Get debug info
    BG.getDebugInfo(function (theDebugInfo) {
        debugInfo = theDebugInfo;
        debugInfo.language = determineUserLanguage();

        // Get written debug info
        // info is the debug info object
        var content = [];
        content.push(debugInfo.filter_lists);
        content.push('');

        // Custom & Excluded filters might not always be in the object
        if (debugInfo.custom_filters) {
          content.push('=== Custom Filters ===');
          content.push(debugInfo.custom_filters);
          content.push('');
        }

        if (debugInfo.exclude_filters) {
          content.push('=== Exclude Filters ===');
          content.push(debugInfo.exclude_filters);
          content.push('');
        }

        content.push(debugInfo.settings);
        content.push('');
        content.push('=== Other Info ===');
        content.push(debugInfo.other_info);

        // Put it together to put into the textbox
        textDebugInfo = content.join('\n');
      });

    // Cache access to input boxes
    var $name = $('#name');
    var $email = $('#email');
    var $title = $('#summary');
    var $repro = $('#repro-steps');
    var $expect = $('#expected-result');
    var $actual = $('#actual-result');
    var $comments = $('#other-comments');

    if (storageGet('user_name') !== undefined) {
      $name.val(storageGet('user_name'));
    }

    if (storageGet('user_email') !== undefined) {
      $email.val(storageGet('user_email'));
      $('#rememberDetails').prop('checked', true);
    }

    var handleResponseError = function (respObj) {
        if (respObj &&
            respObj.hasOwnProperty('error_msg')) {
          $('#step_response_error_msg').text(translate(respObj.error_msg));
        }

        $('#manual_report_DIV').show();
        $('#step_response_error').fadeIn();
        $('html, body').animate({
            scrollTop: $('#step_response_error').offset().top,
          }, 2000);
      };

    var sendReport = function () {
        var reportData = {
            title: $title.val(),
            repro: $repro.val(),
            expect: $expect.val(),
            actual: $actual.val(),
            debug: debugInfo,
            name: $name.val(),
            email: $email.val(),
            comments: $comments.val(),
          };
        if (extInfo) {
          reportData.debug.extensions = extInfo;
        }

        $.ajax({
            url: 'https://getadblock.com/freshdesk/bugReport.php',
            data: {
                bug_report: JSON.stringify(reportData),
              },
            success: function (text) {

                // if a ticket was created, the response should contain a ticket id #
                if (text) {
                  try {
                    var respObj = JSON.parse(text);
                    if (respObj &&
                        respObj.hasOwnProperty('helpdesk_ticket') &&
                        respObj.helpdesk_ticket.hasOwnProperty('display_id')) {
                      $('#step_response_success').fadeIn();
                      $('html, body').animate({
                          scrollTop: $('#step_response_success').offset().top,
                        }, 2000);
                    } else {
                      prepareManualReport(reportData, null, null, respObj);
                      handleResponseError(respObj);
                    }
                  } catch (e) {
                    prepareManualReport(reportData);
                    handleResponseError();
                  }
                } else {
                  prepareManualReport(reportData);
                  handleResponseError();
                }
              },

            error: function (xhrInfo, status, HTTPerror) {
                prepareManualReport(reportData, status, HTTPerror);
                handleResponseError();
              },

            type: 'POST',
          });
      };

    // Preparation for manual report in case of error.
    var prepareManualReport = function (data, status, HTTPerror, respObj) {
        var body = [];
        body.push('This bug report failed to send.');
        body.push('');
        body.push('* Repro Steps *');
        body.push(data.repro);
        body.push('');
        body.push('* Expected Result *');
        body.push(data.expect);
        body.push('');
        body.push('* Actual Result *');
        body.push(data.actual);
        body.push('');
        body.push('* Other comments *');
        body.push(data.comments);
        body.push('');
        body.push('');
        body.push('');
        body.push('===== Debug Info =====');
        body.push(textDebugInfo);
        if (status) {
          body.push('Status: ' + status);
        }

        if (HTTPerror) {
          body.push('HTTP error code: ' + HTTPerror);
        }

        if (respObj) {
          body.push('Server error information: ' + JSON.stringify(respObj));
        }

        $('#manual_submission').val(body.join('\n'));
      };

    var continueProcessing = function () {
        $('#debug-info').val(textDebugInfo);
        $('#step2-back').prop('disabled', false);
        $('#step_final_questions').fadeIn();

        // Auto-scroll to bottom of the page
        $('html, body').animate({
            scrollTop: 15000,
          }, 50);
        if ($('#rememberDetails').is(':checked')) {
          storageSet('user_name', $name.val());
          storageSet('user_email', $email.val());
        }
      };

    // Step 1: Name & Email
    $('#step1-next').click(function () {
        // Check for errors
        var problems = 0;
        if ($name.val() === '') {
          problems++;
          $name.addClass('inputError');
        } else {
          $name.removeClass('inputError');
        }

        if ($email.val() === '' ||
            $email.val().search(/^.+@.+\..+$/) === -1) {
          problems++;
          $email.addClass('inputError');
        } else {
          $email.removeClass('inputError');
        }

        if ($title.val() === '') {
          problems++;
          $title.addClass('inputError');
        } else {
          $title.removeClass('inputError');
        }

        if ($repro.val() === '1. \n2. \n3. ') {
          problems++;
          $repro.addClass('inputError');
        } else {
          $repro.removeClass('inputError');
        }

        if ($expect.val() === '') {
          problems++;
          $expect.addClass('inputError');
        } else {
          $expect.removeClass('inputError');
        }

        if ($actual.val() === '') {
          problems++;
          $actual.addClass('inputError');
        } else {
          $actual.removeClass('inputError');
        }

        if (problems === 0) {

          // Success - go to next step
          $(this).prop('disabled', true);
          $('#email, #name, #rememberDetails').prop('disabled', true);
          $('#summary, #repro-steps, #expected-result, #actual-result').prop('disabled', true);
          $('.missingInfoMessage').hide();
          gatherExtensionInfo();
        } else {

          // Failure - let them know there's an issue
          $('#step_name_email > .missingInfoMessage').show();
        }
      });

    $('#step2-back').click(function () {
        $('#email, #name, #rememberDetails').prop('disabled', false);
        $('#summary, #repro-steps, #expected-result, #actual-result').prop('disabled', false);
        $('#step_repro_info').fadeOut();
        $('#step_final_questions').fadeOut();
        $('html, body').animate({
            scrollTop: $('#step_name_email').parent().parent().offset().top,
          }, 2000);
        $('#step2-back').prop('disabled', true);
        $('#step1-next').prop('disabled', false);
      });

    $('#submit').click(function () {
        sendReport();
        $('#submit').prop('disabled', true);
        $('#step2-back').prop('disabled', true);
      });
  });
