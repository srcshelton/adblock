'use strict';

let elemhide;

const typeMap = new Map([
  ["img", "IMAGE"],
  ["input", "IMAGE"],
  ["picture", "IMAGE"],
  ["audio", "MEDIA"],
  ["video", "MEDIA"],
  ["frame", "SUBDOCUMENT"],
  ["iframe", "SUBDOCUMENT"],
  ["object", "OBJECT"],
  ["embed", "OBJECT"]
]);

function getURLsFromObjectElement(element)
{
  let url = element.getAttribute("data");
  if (url)
    return [url];

  for (let child of element.children)
  {
    if (child.localName != "param")
      continue;

    let name = child.getAttribute("name");
    if (name != "movie" &&  // Adobe Flash
        name != "source" && // Silverlight
        name != "src" &&    // Real Media + Quicktime
        name != "FileName") // Windows Media
      continue;

    let value = child.getAttribute("value");
    if (!value)
      continue;

    return [value];
  }

  return [];
}

function getURLsFromAttributes(element)
{
  let urls = [];

  if (element.src)
    urls.push(element.src);

  if (element.srcset)
  {
    for (let candidate of element.srcset.split(","))
    {
      let url = candidate.trim().replace(/\s+\S+$/, "");
      if (url)
        urls.push(url);
    }
  }

  return urls;
}

function getURLsFromMediaElement(element)
{
  let urls = getURLsFromAttributes(element);

  for (let child of element.children)
  {
    if (child.localName == "source" || child.localName == "track")
      urls.push(...getURLsFromAttributes(child));
  }

  if (element.poster)
    urls.push(element.poster);

  return urls;
}

function getURLsFromElement(element)
{
  let urls;
  switch (element.localName)
  {
    case "object":
      urls = getURLsFromObjectElement(element);
      break;

    case "video":
    case "audio":
    case "picture":
      urls = getURLsFromMediaElement(element);
      break;

    default:
      urls = getURLsFromAttributes(element);
      break;
  }

  for (let i = 0; i < urls.length; i++)
  {
    if (/^(?!https?:)[\w-]+:/i.test(urls[i]))
      urls.splice(i--, 1);
  }

  return urls;
}

function hideElement(element)
{
  console.log("hideElement(element)", element)
  function doHide()
  {
    let propertyName = "display";
    let propertyValue = "none";
    if (element.localName == "frame")
    {
      propertyName = "visibility";
      propertyValue = "hidden";
    }

    if (element.style.getPropertyValue(propertyName) != propertyValue ||
        element.style.getPropertyPriority(propertyName) != "important")
      element.style.setProperty(propertyName, propertyValue, "important");
  }

  doHide();

  new MutationObserver(doHide).observe(
    element, {
      attributes: true,
      attributeFilter: ["style"]
    }
  );
}

function checkCollapse(element)
{
  let mediatype = typeMap.get(element.localName);
  if (!mediatype)
    return;

  let urls = getURLsFromElement(element);
  if (urls.length == 0)
    return;
//
//TODO
//  ext.backgroundPage.sendMessage(
//    {
//      type: "filters.collapse",
//      urls,
//      mediatype,
//      baseURL: document.location.href
//    },
//
//    collapse =>
//    {
//      if (collapse)
//      {
//        hideElement(element);
//      }
//    }
//  );
}

function ElementHidingTracer()
{
  this.selectors = [];
  this.changedNodes = [];
  this.timeout = null;
  this.observer = new MutationObserver(this.observe.bind(this));
  this.trace = this.trace.bind(this);

  if (document.readyState == "loading")
    document.addEventListener("DOMContentLoaded", this.trace);
  else
    this.trace();
}
ElementHidingTracer.prototype = {
  addSelectors(selectors, filters)
  {
    let pairs = selectors.map((sel, i) => [sel, filters && filters[i]]);

    if (document.readyState != "loading")
      this.checkNodes([document], pairs);

    this.selectors.push(...pairs);
  },

  checkNodes(nodes, pairs)
  {
    let selectors = [];
    let filters = [];

    for (let [selector, filter] of pairs)
    {
      nodes: for (let node of nodes)
      {
        for (let element of node.querySelectorAll(selector))
        {
          // Only consider selectors that actually have an effect on the
          // computed styles, and aren't overridden by rules with higher
          // priority, or haven't been circumvented in a different way.
          if (getComputedStyle(element).display == "none")
          {
            // For regular element hiding, we don't know the exact filter,
            // but the background page can find it with the given selector.
            // In case of element hiding emulation, the generated selector
            // we got here is different from the selector part of the filter,
            // but in this case we can send the whole filter text instead.
            if (filter)
              filters.push(filter);
            else
              selectors.push(selector);

            break nodes;
          }
        }
      }
    }
  },

  onTimeout()
  {
    this.checkNodes(this.changedNodes, this.selectors);
    this.changedNodes = [];
    this.timeout = null;
  },

  observe(mutations)
  {
    // Forget previously changed nodes that are no longer in the DOM.
    for (let i = 0; i < this.changedNodes.length; i++)
    {
      if (!document.contains(this.changedNodes[i]))
        this.changedNodes.splice(i--, 1);
    }

    for (let mutation of mutations)
    {
      let node = mutation.target;

      // Ignore mutations of nodes that aren't in the DOM anymore.
      if (!document.contains(node))
        continue;

      // Since querySelectorAll() doesn't consider the root itself
      // and since CSS selectors can also match siblings, we have
      // to consider the parent node for attribute mutations.
      if (mutation.type == "attributes")
        node = node.parentNode;

      let addNode = true;
      for (let i = 0; i < this.changedNodes.length; i++)
      {
        let previouslyChangedNode = this.changedNodes[i];

        // If we are already going to check an ancestor of this node,
        // we can ignore this node, since it will be considered anyway
        // when checking one of its ancestors.
        if (previouslyChangedNode.contains(node))
        {
          addNode = false;
          break;
        }

        // If this node is an ancestor of a node that previously changed,
        // we can ignore that node, since it will be considered anyway
        // when checking one of its ancestors.
        if (node.contains(previouslyChangedNode))
          this.changedNodes.splice(i--, 1);
      }

      if (addNode)
        this.changedNodes.push(node);
    }

    // Check only nodes whose descendants have changed, and not more often
    // than once a second. Otherwise large pages with a lot of DOM mutations
    // (like YouTube) freeze when the devtools panel is active.
    if (this.timeout == null)
      this.timeout = setTimeout(this.onTimeout.bind(this), 1000);
  },

  trace()
  {
    this.checkNodes([document], this.selectors);

    this.observer.observe(
      document,
      {
        childList: true,
        attributes: true,
        subtree: true
      }
    );
  },

  disconnect()
  {
    document.removeEventListener("DOMContentLoaded", this.trace);
    this.observer.disconnect();
    clearTimeout(this.timeout);
  }
};

function ElemHide(data)
{
  this.shadow = this.createShadowTree();
  this.style = null;
  this.tracer = null;
  this._data = data;
  let _data = data;

  this.elemHideEmulation = new ElemHideEmulation(
    this.addSelectors.bind(this),
    this.hideElements.bind(this)
  );
}
ElemHide.prototype = {
  selectorGroupSize: 200,

  createShadowTree()
  {
    // Use Shadow DOM if available as to not mess with with web pages that
    // rely on the order of their own <style> tags (#309). However, creating
    // a shadow root breaks running CSS transitions. So we have to create
    // the shadow root before transistions might start (#452).
    if (!("createShadowRoot" in document.documentElement))
      return null;

    // Using shadow DOM causes issues on some Google websites,
    // including Google Docs, Gmail and Blogger (#1770, #2602, #2687).
    if (/\.(?:google|blogger)\.com$/.test(document.domain))
      return null;

    // Finally since some users have both AdBlock and Adblock Plus installed we
    // have to consider how the two extensions interact. For example we want to
    // avoid creating the shadowRoot twice.
    let shadow = document.documentElement.shadowRoot ||
                 document.documentElement.createShadowRoot();
    shadow.appendChild(document.createElement("shadow"));

    return shadow;
  },

  addSelectors(selectors, filters)
  {
    if (!selectors || selectors.length == 0) {
      return;
    }

    if (!this.style)
    {
      // Create <style> element lazily, only if we add styles. Add it to
      // the shadow DOM if possible. Otherwise fallback to the <head> or
      // <html> element. If we have injected a style element before that
      // has been removed (the sheet property is null), create a new one.
      this.style = document.createElement("style");
      this.style.type = 'text/css';
      (document.head || document.documentElement).insertBefore(this.style, null);

      // It can happen that the frame already navigated to a different
      // document while we were waiting for the background page to respond.
      // In that case the sheet property will stay null, after addind the
      // <style> element to the shadow DOM.
      if (!this.style.sheet)
        return;
    }

    let preparedSelectors = selectors;

    function fillInCssChunk(cssChunk) {
      if (!cssChunk.sheet) {
        window.setTimeout(function() {
          fillInCssChunk(cssChunk);
        }, 0);
        return;
      }

      var GROUPSIZE = 1000; // Hide in smallish groups to isolate bad selectors
      for (var i = 0; i < preparedSelectors.length; i += GROUPSIZE) {
        var line = preparedSelectors.slice(i, i + GROUPSIZE);
        var rule = line.join(',') + ' { display:none !important;  visibility: none !important; orphans: 4321 !important; }';
        cssChunk.sheet.insertRule(rule, 0);
      }
    }

    fillInCssChunk(this.style);
  },

  hideElements(elements, filters)
  {
    for (let element of elements)
      hideElement(element);
  },

  apply()
  {
      this.tracer = null;

      if (this.style && this.style.parentElement)
        this.style.parentElement.removeChild(this.style);
      this.style = null;

      if (this._data && this._data.selectors)
        this.addSelectors(this._data.selectors);

      if (this._data && this._data.advanceSelectors)
        this.elemHideEmulation.apply(this._data);
  }
};

function runInPageContext(fn, arg)
{
  let script = document.createElement("script");
  script.type = "application/javascript";
  script.async = false;
  script.textContent = "(" + fn + ")(" + JSON.stringify(arg) + ");";
  document.documentElement.appendChild(script);
  document.documentElement.removeChild(script);
}

//cache a reference to window.confirm
//so that web sites can not clobber the default implementation
var abConfirm = window.confirm;

// Return the ElementType element type of the given element.
function typeForElement(el) {

  // TODO: handle background images that aren't just the BODY.
  switch (el.nodeName.toUpperCase()) {
    case 'INPUT':
    case 'IMG':
      return ElementTypes.image;
    case 'SCRIPT':
      return ElementTypes.script;
    case 'OBJECT':
    case 'EMBED':
      return ElementTypes.object;
    case 'VIDEO':
    case 'AUDIO':
    case 'SOURCE':
      return ElementTypes.media;
    case 'FRAME':
    case 'IFRAME':
      return ElementTypes.subdocument;
    case 'LINK':

      // favicons are reported as 'other' by onBeforeRequest.
      // if this is changed, we should update this too.
      if (/(^|\s)icon($|\s)/i.test(el.rel))
          return ElementTypes.other;
      return ElementTypes.stylesheet;
    case 'BODY':
      return ElementTypes.background;
    default:
      return ElementTypes.NONE;
  }
}

// If url is relative, convert to absolute.
function relativeToAbsoluteUrl(url) {
  // Author: Tom Joseph of AdThwart

  if (!url)
      return url;

  // If URL is already absolute, don't mess with it
  if (/^[a-zA-Z\-]+\:/.test(url))
      return url;

  if (url[0] == '/') {
    // Leading // means only the protocol is missing
    if (url[1] && url[1] == '/')
        return document.location.protocol + url;

    // Leading / means absolute path
    return document.location.protocol + '//' + document.location.host + url;
  }

  // Remove filename and add relative URL to it
  var base = document.baseURI.match(/.+\//);
  if (!base)
      return document.baseURI + '/' + url;
  return base[0] + url;
}

//Do not make the frame display a white area
//Not calling .remove(); as this causes some sites to reload continuesly
function removeFrame(el) {
  var parentEl = el.parentNode;
  var cols = ((parentEl.getAttribute('cols') || '').indexOf(',') > 0);
  if (!cols && (parentEl.getAttribute('rows') || '').indexOf(',') <= 0)
      return;

  // Figure out which column or row to hide
  var index = 0;
  while (el.previousElementSibling) {
    index++;
    el = el.previousElementSibling;
  }

  // Convert e.g. '40,20,10,10,10,10' into '40,20,10,0,10,10'
  var attr = (cols ? 'cols' : 'rows');
  var sizes = parentEl.getAttribute(attr).split(',');
  sizes[index] = '0';
  parentEl.setAttribute(attr, sizes.join(','));
}

// Remove an element from the page.
function destroyElement(el, elType) {
  if (el.nodeName == 'FRAME') {
    removeFrame(el);
  } else if (elType != ElementTypes.script) {

    // There probably won't be many sites that modify all of these.
    // However, if we get issues, we might have to set the location and size
    // via the css properties position, left, top, width and height
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    var w = (el.width === undefined ? -1 : el.width);
    var h = (el.height === undefined ? -1 : el.height);
    el.style.setProperty('background-position', w + 'px ' + h + 'px');
    el.setAttribute('width', 0);
    el.setAttribute('height', 0);
  }
}

function debugPrintSelectorMatches(selectors) {
  selectors.
    filter(function(selector) {
      return document.querySelector(selector);
    }).
    forEach(function(selector) {
      var matches = "";
      var elems = document.querySelectorAll(selector);
      for (var i=0; i<elems.length; i++) {
        var el = elems[i];
        matches += "        " + el.nodeName + "#" + el.id + "." + el.className + "\n";
      }
      BGcall("debug_report_elemhide", "##" + selector, matches);
    });
}

function handleABPLinkClicks() {
  // Subscribe to the list when you click an abp: link
  var elems = document.querySelectorAll('[href^="abp:"], [href^="ABP:"]');
  var abplinkhandler = function(event) {
    if (event.isTrusted === false) {
      return;
    }
    event.preventDefault();
    var searchquery = this.href.replace(/^.+?\?/, '?');
    if (searchquery) {
      var queryparts = parseUri.parseSearch(searchquery);
      var loc = queryparts.location;
      var reqLoc = queryparts.requiresLocation;
      var reqList = (reqLoc ? "url:" + reqLoc : undefined);
      var title = queryparts.title;
      BGcall('translate', "subscribeconfirm",(title || loc), function(translatedMsg) {
        if (abConfirm(translatedMsg)) {
          BGcall("subscribe", {id: "url:" + loc, requires: reqList, title: title});
          // Open subscribe popup
          if (SAFARI) {
            // In Safari, window.open() cannot be used
            // to open a new window from our global HTML file
            window.open(chrome.extension.getURL('pages/subscribe.html?' + loc),
                        "_blank",
                        'scrollbars=0,location=0,resizable=0,width=460,height=150');
          } else {
            BGcall("launch_subscribe_popup", loc);
          }
        }
      });
    }
  }
  for (var i=0; i<elems.length; i++) {
    elems[i].addEventListener("click", abplinkhandler, false);
  }
}

// Called at document load.
// inputs:
//   startPurger: function to start watching for elements to remove.
//   stopPurger: function to stop watch for elemenst to remove, called in case
//               AdBlock should not be running.
//   success?: function called at the end if AdBlock should run on the page.
function adblockBegin(inputs) {

  if (document.location.href === 'about:blank') // Safari does this
    return;
  if (document.location.href === 'topsites://') // Safari does this
    return;
  if (document.location.href === 'favorites://') // Safari does this
    return;

  if (!(document.documentElement instanceof HTMLElement))
    return; // Only run on HTML pages

  inputs.startPurger();

  var opts = { domain: document.location.hostname };
  BGcall('get_content_script_data', opts, function(data) {

    if (data && data.settings && data.settings.debug_logging)
      logging(true);

      elemhide = new ElemHide(data);
      elemhide.apply();

      document.addEventListener("error", event =>
      {
        checkCollapse(event.target);
      }, true);

      document.addEventListener("load", event =>
      {
        let element = event.target;
        if (/^i?frame$/.test(element.localName))
          checkCollapse(element);
      }, true);

      if (data && !data.running) {
        inputs.stopPurger();
        return;
      }

      onReady(function () {
          // TODO: ResourceList could pull html.innerText from page instead:
          // we could axe this
          if (data && data.settings && (data.settings.debug_logging || data.settings.data_collection))
              debugPrintSelectorMatches(data.selectors || []);

          if (typeof run_bandaids === 'function') {
            run_bandaids('new');
          }

          handleABPLinkClicks();
        });
      if (inputs.success) inputs.success();
    });
}