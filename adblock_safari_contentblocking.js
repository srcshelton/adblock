// Content script when Safari content blocking API is used
adblockBegin({
	startPurger: function() {
		// Do nothing...
	},
	stopPurger: function() {
		// Do nothing...
	},
	handleHiding: function(data) {
		// Do nothing...
	},
	success: function() {
		// Add entries to right click menu of non-whitelisted pages.
		window.addEventListener("contextmenu", function(event) {
			safari.self.tab.setContextMenuEventUserInfo(event, true);
		}, false);
	}
});