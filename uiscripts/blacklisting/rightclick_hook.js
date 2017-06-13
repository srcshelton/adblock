// Record the last element to be right-clicked, since that information isn't
// passed to the contextmenu click handler that calls top_open_blacklist_ui
var rightclickedItem = null;

if (document.body) {
  document.body.addEventListener('contextmenu', function (e) {
    rightclickedItem = e.target;
  });

  document.body.addEventListener('click', function () {
    rightclickedItem = null;
  });
}
