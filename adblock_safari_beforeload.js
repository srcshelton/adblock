// Content script when Safari "beforeLoad" API is used
adblockBegin({
  startPurger: function() {
    document.addEventListener("beforeload", beforeLoadHandler, true);
  },
  stopPurger: function() {
    document.removeEventListener("beforeload", beforeLoadHandler, true);
  },
  success: function() {
    onReady(function() { blockBackgroundImageAd(); });

    // Add entries to right click menu of non-whitelisted pages.
    window.addEventListener("contextmenu", function(event) {
      safari.self.tab.setContextMenuEventUserInfo(event, true);
    }, false);
  }
});