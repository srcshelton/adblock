var needsCompat = false;
if (typeof msBrowser !== 'undefined') {
  chrome = msBrowser;
  needsCompat = true;
}
else if (typeof browser != 'undefined')
{
  chrome = browser;
  needsCompat = true;
}

SAFARI = false;
EDGE = false;

if(needsCompat) {
    var noOp = function () { };

    EDGE = true;

    chrome.extension.onRequest = chrome.runtime.onMessage;
    chrome.extension.getURL = chrome.runtime.getURL;

    chrome.extension.sendMessage = noOp;
    chrome.extension.onRequest.removeListener = noOp;

    if (!chrome.idle)
    {
        chrome.idle = Array();
        chrome.idle.queryState = noOp;        
    }

    if (!chrome.tabs) {
        chrome.tabs = Array();
    }

    if (chrome.tabs.sendMessage) {
        chrome.extension.sendRequest = chrome.runtime.sendMessage;//chrome.tabs.sendMessage;
    } else {
        chrome.extension.sendRequest = chrome.runtime.sendMessage;
    }

    if(!chrome.tabs.sendRequest && chrome.tabs.sendMessage) 
        chrome.tabs.sendRequest = chrome.tabs.sendMessage;

    if(!chrome.tabs.onRemoved) {
        chrome.tabs.onRemoved = Array();
        chrome.tabs.onRemoved.addListener = noOp;
    }

    if (!chrome.tabs.onUpdated) {
        chrome.tabs.onUpdated = Array();
        chrome.tabs.onUpdated.addListener = noOp;
    }
    if (!chrome.tabs.onActivated) {
        chrome.tabs.onActivated = Array();
        chrome.tabs.onActivated.addListener = noOp;
    }
    if (!chrome.tabs.onCreated) {
        chrome.tabs.onCreated = Array();
        chrome.tabs.onCreated.addListener = noOp;
    }
    if (!chrome.tabs.query) {
        chrome.tabs.query = noOp;
    }

    chrome.runtime.getManifest = function () { return "2"; }

}