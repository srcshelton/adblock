var debug_info;
var text_debug_info = "";
var ext_info = "";

$(document).ready(function() {
  chrome.i18n.initializeL10nData(function () {
      // Get debug info
      BGcall("getDebugInfo", function(info) {
          debug_info = info;
          // Put it together to put into the textbox
          text_debug_info = info.filter_lists + '\n\n' + info.settings + '\n\n' + info.custom_filters + '\n\n' + info.other_info;
      });

      // Cache access to input boxes
      var $name = $("#name");
      var $email = $("#email");
      var $title = $("#summary");
      var $repro = $("#repro-steps");
      var $expect = $("#expected-result");
      var $actual = $("#actual-result");
      var $comments = $("#other-comments");

      var handleResponseError = function(respObj) {
          if (respObj &&
              respObj.hasOwnProperty("error_msg")) {
              $("#step_response_error_msg").text(translate(respObj["error_msg"]));
          }
          $("#manual_report_DIV").show();
          $("#step_response_error").fadeIn();
          $('html, body').animate({
              scrollTop: $("#step_response_error").offset().top
          }, 2000);
      }
      var sendReport = function() {
          var report_data = {
              title: $title.val(),
              repro: $repro.val(),
              expect: $expect.val(),
              actual: $actual.val(),
              debug: debug_info,
              name: $name.val(),
              email: $email.val(),
              comments: $comments.val(),
          };
          if (ext_info) {
              report_data.debug.extensions = ext_info;
          }
          chrome.extension.onRequest.addListener(function (request) {
              if (request && request.command != "bugReportResponse")
                  return;
              else if (!request || !request.data) {
                  return;
              }
              var respObj = {};
              try {
                respObj = JSON.parse(request.data);
              } catch(e) {
                  prepareManualReport(report_data, null, null, respObj);
                  handleResponseError(respObj);
              }
              if (respObj &&
                  respObj.hasOwnProperty("helpdesk_ticket") &&
                  respObj["helpdesk_ticket"].hasOwnProperty("display_id")) {
                  $("#step_response_success").fadeIn();
                  $('html, body').animate({
                      scrollTop: $("#step_response_success").offset().top
                  }, 2000);
              } else {
                  prepareManualReport(report_data, null, null, respObj);
                  handleResponseError(respObj);
              }
          });
          BGcall("sendBugReportToServer", { bug_report: JSON.stringify(report_data) });
      }
      // Preparation for manual report in case of error.
      var prepareManualReport = function(data, status, HTTPerror, respObj) {
          var body = [];
          body.push("This bug report failed to send.");
          body.push("");
          body.push("* Repro Steps *");
          body.push(data.repro);
          body.push("");
          body.push("* Expected Result *");
          body.push(data.expect);
          body.push("");
          body.push("* Actual Result *");
          body.push(data.actual);
          body.push("");
          body.push("* Other comments *");
          body.push(data.comments);
          body.push("");
          body.push("");
          body.push("");
          body.push("===== Debug Info =====");
          body.push(text_debug_info);
          if (status) {
              body.push("Status: " + status);
          }
          if (HTTPerror) {
              body.push("HTTP error code: " + HTTPerror);
          }
          if (respObj) {
              body.push("Server error information: " + JSON.stringify(respObj));
          }
          $("#manual_submission").val(body.join("\n"));
      }
      var continueProcessing = function() {
          $("#debug-info").val(text_debug_info);
          $("#step2-back").prop("disabled", false);
          $("#step_final_questions").fadeIn();
          // Auto-scroll to bottom of the page
          $("html, body").animate({
              scrollTop: 15000
          }, 50);
      }

      // Step 1: Name & Email
      $("#step1-next").click(function() {
          // Check for errors
          var problems = 0;
          if ($name.val() === "") {
              problems++;
              $name.addClass("inputError");
          } else {
              $name.removeClass("inputError");
          }
          if ($email.val() === "" ||
              $email.val().search(/^.+@.+\..+$/) === -1) {
              problems++;
              $email.addClass("inputError");
          } else {
              $email.removeClass("inputError");
          }
          if ($title.val() === "") {
              problems++;
              $title.addClass("inputError");
          } else {
              $title.removeClass("inputError");
          }
          if ($repro.val() === "1. \n2. \n3. ") {
              problems++;
              $repro.addClass("inputError");
          } else {
              $repro.removeClass("inputError");
          }
          if ($expect.val() === "") {
              problems++;
              $expect.addClass("inputError");
          } else {
              $expect.removeClass("inputError");
          }
          if ($actual.val() === "") {
              problems++;
              $actual.addClass("inputError");
          } else {
              $actual.removeClass("inputError");
          }
          if (problems === 0) {
              // Success - go to next step
              $(this).prop("disabled", true);
              $("#email, #name").prop("disabled", true);
              $("#summary, #repro-steps, #expected-result, #actual-result").prop("disabled", true);
              $(".missingInfoMessage").hide();
              continueProcessing();
          } else {
              // Failure - let them know there's an issue
              $("#step_name_email > .missingInfoMessage").show();
          }
      });

      $("#step2-back").click(function() {
          $("#email, #name").prop("disabled", false);
          $("#summary, #repro-steps, #expected-result, #actual-result").prop("disabled", false);
          $("#step_repro_info").fadeOut();
          $("#step_final_questions").fadeOut();
          $('html, body').animate({
              scrollTop: $("#step_name_email").parent().parent().offset().top
          }, 2000);
          $("#step2-back").prop("disabled", true);
          $("#step1-next").prop("disabled", false);
      });

      $("#submit").click(function() {
          sendReport();
          $("#submit").prop("disabled", true);
          $("#step2-back").prop("disabled", true);
      });
    });
});
