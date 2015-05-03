// Set to true to get noisier console.log statements
var VERBOSE_DEBUG = false;
if (typeof exports !== 'undefined') exports.VERBOSE_DEBUG = VERBOSE_DEBUG;

// Run a function on the background page.
// Inputs (positional):
//   first, a string - the name of the function to call
//   then, any arguments to pass to the function (optional)
//   then, a callback:function(return_value:any) (optional)
var BGcall = function() {
  var args = [];
  for (var i=0; i < arguments.length; i++)
    args.push(arguments[i]);
  var fn = args.shift();
  var has_callback = (typeof args[args.length - 1] == "function");
  var callback = (has_callback ? args.pop() : function() {});
  if (!has_callback) {
      callback = null;
  }
  chrome.extension.sendRequest({command: "call", fn:fn, args:args}, callback);
};
if (typeof exports !== 'undefined') exports.BGcall = BGcall;

// Enabled in adblock_start_common.js and background.js if the user wants
var logging = function(globals, enabled) {
  if (enabled) {
    globals.log = function() {
      if (VERBOSE_DEBUG || arguments[0] != '[DEBUG]') // comment out for verbosity
        console.log.apply(console, arguments);
    };
    globals.logGroup = function() { console.group.apply(console, arguments); };
    globals.logGroupEnd = function() { console.groupEnd(); };
  }
  else {
    globals.log = globals.logGroup = globals.logGroupEnd = function() {};
  }
};

logging(this, false); // disabled by default
if (typeof exports !== 'undefined') exports.logging = logging;
if (typeof exports !== 'undefined') exports.log = log;

// Behaves very similarly to $.ready() but does not require jQuery.
var onReady = function(callback) {
  if (document.readyState === "complete")
    window.setTimeout(callback, 0);
  else
    window.addEventListener("load", callback, false);
};
if (typeof exports !== 'undefined') exports.onReady = onReady;

var translate = function(messageID, args) {
  return chrome.i18n.getMessage(messageID, args);
};
if (typeof exports !== 'undefined') exports.translate = translate;

var localizePage = function() {
  //translate a page into the users language

  $("[i18n]:not(.i18n-replaced)").each(function() {
    var originalTranslateText = translate($(this).attr("i18n"));
    //look for embeded HTML Tag in translate text, identified by a '<' character,
    //if found, remove the tag, and create a child node with same attributes
    //and inner text.
    if (originalTranslateText.indexOf("<") >=0) {
        processHTMLNode(this, originalTranslateText)
    } else {
      $(this).text(originalTranslateText);
    }
  });

  $("[i18n_value]:not(.i18n-replaced)").each(function() {
    $(this).val(translate($(this).attr("i18n_value")));
  });

  $("[i18n_title]:not(.i18n-replaced)").each(function() {
    $(this).attr("title", translate($(this).attr("i18n_title")));
  });

  $("[i18n_placeholder]:not(.i18n-replaced)").each(function() {
    $(this).attr("placeholder", translate($(this).attr("i18n_placeholder")));
  });

  $("[i18n_replacement_el]:not(.i18n-replaced)").each(function() {
    // Replace a dummy <a/> inside of localized text with a real element.
    // Give the real element the same text as the dummy link.
    var dummy_link = $("a", this);
    var text = dummy_link.text();
    var real_el = $("#" + $(this).attr("i18n_replacement_el"));
    real_el.text(text).val(text).replaceAll(dummy_link);
    // If localizePage is run again, don't let the [i18n] code above
    // clobber our work
    $(this).addClass("i18n-replaced");
  });

  // Make a right-to-left translation for Arabic and Hebrew languages
  var language = determineUserLanguage();
  if (language === "ar" || language === "he" ) {
    $("#main_nav").removeClass("right").addClass("left");
    $(".adblock-logo").removeClass("left").addClass("right");
    $(".closelegend").css("float","left");
    document.documentElement.dir = "rtl";
  }

};
if (typeof exports !== 'undefined') exports.localizePage = localizePage;


// Determine what language the user's browser is set to use
var determineUserLanguage = function() {
    if (typeof navigator !== 'undefined') {
        if ((typeof navigator.language !== 'undefined') &&
            navigator.language)
            return navigator.language.match(/^[a-z]+/i)[0];
        else
            return null;
    } else {
        var prefs = require("sdk/preferences/service");
        var name = "general.useragent.locale";
        if ((typeof prefs !== 'undefined') &&
             prefs.has(name)) {
            return prefs.get(name).match(/^[a-z]+/i)[0];
        } else {
            return null;
        }
   }
};

if (typeof exports !== 'undefined') exports.determineUserLanguage = determineUserLanguage;

// Parse a URL. Based upon http://blog.stevenlevithan.com/archives/parseuri
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
// Inputs: url: the URL you want to parse
// Outputs: object containing all parts of |url| as attributes
var parseUri = function(url) {
  var matches = /^(([^:]+(?::|$))(?:(?:\w+:)?\/\/)?(?:[^:@\/]*(?::[^:@\/]*)?@)?(([^:\/?#]*)(?::(\d*))?))((?:[^?#\/]*\/)*[^?#]*)(\?[^#]*)?(\#.*)?/.exec(url);
  // The key values are identical to the JS location object values for that key
  var keys = ["href", "origin", "protocol", "host", "hostname", "port",
              "pathname", "search", "hash"];
  var uri = {};
  for (var i=0; (matches && i<keys.length); i++)
    uri[keys[i]] = matches[i] || "";
  return uri;
};

if (typeof exports !== 'undefined') exports.parseUri = parseUri;
// Parses the search part of a URL into an key: value object.
// e.g., ?hello=world&ext=adblock would become {hello:"world", ext:"adblock"}
// Inputs: search: the search query of a URL. Must have &-separated values.
parseUri.parseSearch = function(search) {
  // Fails if a key exists twice (e.g., ?a=foo&a=bar would return {a:"bar"}
  var queryKeys = {};
  search.replace(/(?:^\?|&)([^&=]*)=?([^&]*)/g, function () {
    if (arguments[1]) queryKeys[arguments[1]] = unescape(arguments[2]);
  });
  return queryKeys;
};

// Strip third+ level domain names from the domain and return the result.
// Inputs: domain: the domain that should be parsed
//         keepDot: true if trailing dots should be preserved in the domain
// Returns: the parsed domain
parseUri.secondLevelDomainOnly = function(domain, keepDot) {
  var match = domain.match(/([^\.]+\.(?:co\.)?[^\.]+)\.?$/) || [domain, domain];
  return match[keepDot ? 0 : 1].toLowerCase();
};

// Inputs: key:string.
// Returns value if key exists, else undefined.
var storage_get = function(key) {
    var json = require("sdk/simple-storage").storage[key];
    if (json == null)
        return undefined;
  try {
      return JSON.parse(json);
  } catch (e) {
      log("Couldn't parse json for " + key);
      return undefined;
  }
};
if (typeof exports !== 'undefined') exports.storage_get = storage_get;

// Inputs: key:string, value:object.
// If value === undefined, removes key from storage.
// Returns undefined.
var storage_set = function(key, value) {
    if (value === undefined) {
        delete require("sdk/simple-storage").storage[key];
        return;
    } else {
        try {
            require("sdk/simple-storage").storage[key] = JSON.stringify(value);
        } catch (ex) {
            // Firefox throws this error for all writes in Private Browsing mode.
            //TODO - fix this
            alert(translate("storage_quota_exceeded"));
            openTab("options/index.html#ui-tabs-2");
        }
    }
}
if (typeof exports !== 'undefined') exports.storage_set = storage_set;

// Return obj[value], first setting it to |defaultValue| if it is undefined.
var setDefault = function(obj, value, defaultValue) {
  if (obj[value] === undefined)
    obj[value] = defaultValue;
  return obj[value];
};
if (typeof exports !== 'undefined') exports.setDefault = setDefault;

var extend = function() {
	var src, copyIsArray, copy, name, options, clone,
		target = arguments[0] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;

		// skip the boolean and the target
		target = arguments[ i ] || {};
		i++;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" &&  typeof target !== "function" ) {
		target = {};
	}

	// extend jQuery itself if only one argument is passed
	if ( i === length ) {
		target = this;
		i--;
	}

	for ( ; i < length; i++ ) {
		// Only deal with non-null/undefined values
		if ( (options = arguments[ i ]) != null ) {
			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( isPlainObject(copy) || (copyIsArray = isArray(copy)) ) ) {
					if ( copyIsArray ) {
						copyIsArray = false;
						clone = src && isArray(src) ? src : [];

					} else {
						clone = src && isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[ name ] = extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};
if (typeof exports !== 'undefined') exports.extend = extend;

var isPlainObject = function(obj) {
	var key;

	// Must be an Object.
	// Because of IE, we also have to check the presence of the constructor property.
	// Make sure that DOM nodes and window objects don't pass through, as well
	if ( !obj || typeof obj !== "object" || obj.nodeType || obj == obj.window ) {
		return false;
	}

	try {
		// Not own constructor property must be Object
		if ( obj.constructor &&
			!hasOwn.call(obj, "constructor") &&
			!hasOwn.call(obj.constructor.prototype, "isPrototypeOf") ) {
			return false;
		}
	} catch ( e ) {
		// IE8,9 Will throw exceptions on certain host objects #9897
		return false;
	}

	// Support: IE<9
	// Handle iteration over inherited properties before own properties.
	if ( support.ownLast ) {
		for ( key in obj ) {
			return hasOwn.call( obj, key );
		}
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	for ( key in obj ) {}

	return key === undefined || hasOwn.call( obj, key );
};
if (typeof exports !== 'undefined') exports.isPlainObject = isPlainObject;

var isArray = function( obj ) {
	return typeof obj === "array";
};
if (typeof exports !== 'undefined') exports.isArray = isArray;

var getParentWindow = function(wdow) {
    while (wdow && wdow != wdow.parent) {
      wdow = wdow.parent;
    }
    return wdow;
  }
if (typeof exports !== 'undefined') exports.getParentWindow = getParentWindow;

var getWindow = function(node) {
    if ("ownerDocument" in node && node.ownerDocument)
      node = node.ownerDocument;

    if ("defaultView" in node)
      return node.defaultView;

    return null;
  }
if (typeof exports !== 'undefined') exports.getWindow = getWindow;


var isHttpUri = function(uri) {
    if (!uri || !uri.scheme) return false;
    return (uri.scheme === 'http' || uri.scheme === 'https');
}
if (typeof exports !== 'undefined') exports.isHttpUri = isHttpUri;

// If url is relative, convert to absolute.
var relativeToAbsoluteUrl = function(url) {
  // Author: Tom Joseph of AdThwart

  if (!url)
    return url;

  // If URL is already absolute, don't mess with it
  if (/^[a-zA-Z\-]+\:/.test(url))
    return url;

  if (url[0] == '/') {
    // Leading // means only the protocol is missing
    if (url[1] && url[1] == "/")
      return document.location.protocol + url;

    // Leading / means absolute path
    return document.location.protocol + "//" + document.location.host + url;
  }

  // Remove filename and add relative URL to it
  var base = document.baseURI.match(/.+\//);
  if (!base)
    return document.baseURI + "/" + url;
  return base[0] + url;
}
if (typeof exports !== 'undefined') exports.relativeToAbsoluteUrl = relativeToAbsoluteUrl;

//add a 'link' to the web page, with a src link of a 'local' CSS file
//called from the content scripts
function load_css(src) {
    BGcall('getLocalFileURL', src, function(result) {
        var link = $('<link rel="stylesheet" type="text/css" />').
                attr('href', result).
                addClass("adblock-ui-stylesheet");
        $(document.head || document.documentElement).append(link);
    });
}

var isFennec = function() {
    var system = require("sdk/system");
    return system.name === "Fennec";
}
if (typeof exports !== 'undefined') exports.isFennec = isFennec;

function processHTMLNode(currentElement, originalTranslateText) {
    var returnText = originalTranslateText;
    if (originalTranslateText.indexOf("<a") >=0) {
        returnText = processAnchorNode(currentElement, originalTranslateText);
    } else if (originalTranslateText.indexOf("<br") >=0) {
        returnText = processBreakNode(currentElement, originalTranslateText);
    } else if (originalTranslateText.indexOf("<b>") >=0) {
        returnText = processSimpleNode(currentElement, originalTranslateText, document.createElement("b"), "b", 4);
    } else if (originalTranslateText.indexOf("<i>") >=0) {
        returnText = processSimpleNode(currentElement, originalTranslateText, document.createElement("i"), "i", 4);
    } else if (originalTranslateText.indexOf("<span") >=0) {
        returnText = processSpanNode(currentElement, originalTranslateText);
    }
    return returnText;
}

function processAnchorNode(currentElement, originalTranslateText) {
    var startPos = originalTranslateText.indexOf("<a");
    var endPos = originalTranslateText.indexOf("<\/a>");
    var newEl = document.createElement("a");
    if (startPos === 0) {
        var translateText = originalTranslateText.substring(endPos + 5);
        $(currentElement).append(newEl);
        processHTMLNode(currentElement, translateText);
        $(currentElement).append(document.createTextNode(" " + translateText));
    } else if (endPos === (originalTranslateText.length - 4)) {
        var translateText = originalTranslateText.substring(0, startPos);
        processHTMLNode(currentElement, translateText);
        $(currentElement).append(document.createTextNode(translateText + " "));
        $(currentElement).append(newEl);
    } else {
        var preAnchorText = originalTranslateText.substring(0, (startPos - 1));
        var postAnchorText = originalTranslateText.substring(endPos + 4);
        preAnchorText = processHTMLNode(currentElement, preAnchorText);
        $(currentElement).append(document.createTextNode(preAnchorText + " "));
        $(currentElement).append(newEl);
        postAnchorText = processHTMLNode(currentElement, postAnchorText);
        $(currentElement).append(document.createTextNode(" " + postAnchorText));
    }
    var entireAnchorText = originalTranslateText.substring(startPos, endPos);
    var startInnerTextPos = entireAnchorText.indexOf(">");
    var innerAnchorText = entireAnchorText.substring(startInnerTextPos + 1);
    $(newEl).text(innerAnchorText);
    processAttributes(newEl, entireAnchorText);
    return originalTranslateText.substring(endPos + 5);
}

function processSimpleNode(currentElement, originalTranslateText, newEl, newElString, endTagLength) {
    var startPos = originalTranslateText.indexOf("<" + newElString);
    var endPos = originalTranslateText.indexOf("<\/" + newElString + ">");
    if (startPos === 0) {
        var translateText = originalTranslateText.substring(endPos + endTagLength + 1);
        $(currentElement).append(newEl);
        processHTMLNode(currentElement, translateText);
        $(currentElement).append(document.createTextNode(" " + translateText));
    } else if (endPos === (originalTranslateText.length - endTagLength)) {
        var translateText = originalTranslateText.substring(0, startPos);
        processHTMLNode(currentElement, translateText);
        $(currentElement).append(document.createTextNode(translateText + " "));
        $(currentElement).append(newEl);
    } else {
        var preTagText = originalTranslateText.substring(0, (startPos - 1));
        var postTagText = originalTranslateText.substring(endPos + endTagLength);
        preTagText = processHTMLNode(currentElement, preTagText);
        $(currentElement).append(document.createTextNode(preTagText + " "));
        $(currentElement).append(newEl);
        processHTMLNode(currentElement, postTagText);
        $(currentElement).append(document.createTextNode(" " + postTagText));
    }
    var entireTagText = originalTranslateText.substring(startPos, endPos);
    var startInnerTextPos = entireTagText.indexOf(">");
    var innerTagText = entireTagText.substring(startInnerTextPos + 1);
    $(newEl).text(innerTagText);
    return originalTranslateText.substring(endPos + endTagLength + 1);
}

function processBreakNode(currentElement, originalTranslateText) {
    var startPos = originalTranslateText.indexOf("<br\/>");
    var endTagLength = 5;
    if (startPos < 0) {
        startPos = originalTranslateText.indexOf("<br>");
        var endTagLength = 4;
    }
    var endPos = startPos;
    var newEl = document.createElement("br");
    if (startPos === 0) {
        var translateText = originalTranslateText.substring(endPos + endTagLength + 1);
        $(currentElement).append(newEl);
        translateText = processHTMLNode(currentElement, translateText);
        $(currentElement).append(document.createTextNode(" " + translateText));
    } else if (endPos === (originalTranslateText.length - endTagLength)) {
        var translateText = originalTranslateText.substring(0, startPos);
        translateText = processHTMLNode(currentElement, translateText);
        $(currentElement).append(document.createTextNode(translateText + " "));
        $(currentElement).append(newEl);
    } else {
        var preTagText = originalTranslateText.substring(0, startPos);
        var postTagText = originalTranslateText.substring(endPos + endTagLength);
        preTagText = processHTMLNode(currentElement, preTagText);
        $(currentElement).append(document.createTextNode(preTagText + " "));
        $(currentElement).append(newEl);
        postTagText = processHTMLNode(currentElement, postTagText);
        $(currentElement).append(document.createTextNode(" " + postTagText));
    }
    return originalTranslateText.substring(endPos + endTagLength + 1);
}

function processSpanNode(currentElement, originalTranslateText) {
    var startPos = originalTranslateText.indexOf("<span");
    var endPos = originalTranslateText.indexOf("<\/span>");
    var newEl = document.createElement("span");
    if (startPos === 0) {
        var translateText = originalTranslateText.substring(endPos + 8);
        $(currentElement).append(newEl);
        processHTMLNode(currentElement, translateText);
        $(currentElement).append(document.createTextNode(" " + translateText));
    } else if (endPos === (originalTranslateText.length - 7)) {
        var translateText = originalTranslateText.substring(0, startPos);
        processHTMLNode(currentElement, translateText);
        $(currentElement).append(document.createTextNode(translateText + " "));
        $(currentElement).append(newEl);
    } else {
        var preSpanText = originalTranslateText.substring(0, (startPos - 1));
        var postSpanText = originalTranslateText.substring(endPos + 7);
        processHTMLNode(currentElement, preSpanText);
        $(currentElement).append(document.createTextNode(preSpanText + " "));
        $(currentElement).append(newEl);
        processHTMLNode(currentElement, postSpanText);
        $(currentElement).append(document.createTextNode(" " + postSpanText));
    }
    var entireSpanText = originalTranslateText.substring(startPos, endPos);
    var startInnerTextPos = entireSpanText.indexOf(">");
    var innerSpanText = entireSpanText.substring(startInnerTextPos + 1);
    $(newEl).text(innerSpanText);
    processAttributes(newEl, entireSpanText);
    return originalTranslateText.substring(endPos + 8);
}

function processAttributes(newEl, attributeText) {
    var startStylePos = attributeText.indexOf("style='");
    if (startStylePos > 0) {
        var styleText = attributeText.substring(startStylePos + 7);
        styleText = styleText.substring(0, styleText.indexOf("'"));
        $(newEl).attr('style', styleText);
    }
    var startIdPos = attributeText.indexOf("id='");
    if (startIdPos > 0) {
        var idText = attributeText.substring(startIdPos + 4);
        idText = idText.substring(0, idText.indexOf("'"));
        $(newEl).attr('id', idText);
    }
    var startHREFPos = attributeText.indexOf("href='");
    if (startHREFPos > 0) {
        var HREFText = attributeText.substring(startHREFPos + 6);
        HREFText = HREFText.substring(0, HREFText.indexOf("'"));
        $(newEl).attr('href', HREFText);
    }
}