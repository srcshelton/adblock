/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2017 eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

/**
 * Converts filter text into regular expression string
 * @param {string} text as in Filter()
 * @return {string} regular expression representation of filter text
 */
function filterToRegExp(text)
{
  return text
    // remove multiple wildcards
    .replace(/\*+/g, "*")
    // remove anchors following separator placeholder
    .replace(/\^\|$/, "^")
    // escape special symbols
    .replace(/\W/g, "\\$&")
    // replace wildcards by .*
    .replace(/\\\*/g, ".*")
    // process separator placeholders (all ANSI characters but alphanumeric
    // characters and _%.-)
    .replace(/\\\^/g, "(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)")
    // process extended anchor at expression start
    .replace(/^\\\|\\\|/, "^[\\w\\-]+:\\/+(?!\\/)(?:[^\\/]+\\.)?")
    // process anchor at expression start
    .replace(/^\\\|/, "^")
    // process anchor at expression end
    .replace(/\\\|$/, "$")
    // remove leading wildcards
    .replace(/^(\.\*)/, "")
    // remove trailing wildcards
    .replace(/(\.\*)$/, "");
}

function splitSelector(selector)
{
  if (selector.indexOf(",") == -1)
    return [selector];

  var selectors = [];
  var start = 0;
  var level = 0;
  var sep = "";

  for (var i = 0; i < selector.length; i++)
  {
    var chr = selector[i];

    if (chr == "\\")        // ignore escaped characters
      i++;
    else if (chr == sep)    // don't split within quoted text
      sep = "";             // e.g. [attr=","]
    else if (sep == "")
    {
      if (chr == '"' || chr == "'")
        sep = chr;
      else if (chr == "(")  // don't split between parentheses
        level++;            // e.g. :matches(div,span)
      else if (chr == ")")
        level = Math.max(0, level - 1);
      else if (chr == "," && level == 0)
      {
        selectors.push(selector.substring(start, i));
        start = i + 1;
      }
    }
  }

  selectors.push(selector.substring(start));
  return selectors;
}

var MIN_INVOCATION_INTERVAL = 3000;
var MAX_SYNCHRONOUS_PROCESSING_TIME = 50;
var abpSelectorRegexp = /:-abp-([\w-]+)\(/i;

/** Return position of node from parent.
 * @param {Node} node the node to find the position of.
 * @return {number} One-based index like for :nth-child(), or 0 on error.
 */
function positionInParent(node)
{
  var children = node.parentNode.children;
  for (var i = 0; i < children.length; i++)
    if (children[i] == node)
      return i + 1;
  return 0;
}

function makeSelector(node, selector)
{
  if (node == null)
    return null;
  if (!node.parentElement)
  {
    var newSelector = ":root";
    if (selector)
      newSelector += " > " + selector;
    return newSelector;
  }
  var idx = positionInParent(node);
  if (idx > 0)
  {
    var newSelector = node.tagName + ':nth-child(' + idx '})';
    if (selector)
      newSelector += " > " + selector;
    return makeSelector(node.parentElement, newSelector);
  }

  return selector;
}

function parseSelectorContent(content, startIndex)
{
  var parens = 1;
  var quote = null;
  var i = startIndex;
  for (; i < content.length; i++)
  {
    var c = content[i];
    if (c == "\\")
    {
      // Ignore escaped characters
      i++;
    }
    else if (quote)
    {
      if (c == quote)
        quote = null;
    }
    else if (c == "'" || c == '"')
      quote = c;
    else if (c == "(")
      parens++;
    else if (c == ")")
    {
      parens--;
      if (parens == 0)
        break;
    }
  }

  if (parens > 0)
    return null;
  return {text: content.substring(startIndex, i), end: i};
}

/** Stringified style objects
 * @typedef {Object} StringifiedStyle
 * @property {string} style CSS style represented by a string.
 * @property {string[]} subSelectors selectors the CSS properties apply to.
 */

/**
 * Produce a string representation of the stylesheet entry.
 * @param {CSSStyleRule} rule the CSS style rule.
 * @return {StringifiedStyle} the stringified style.
 */
function stringifyStyle(rule)
{
  var styles = [];
  for (var i = 0; i < rule.style.length; i++)
  {
    var property = rule.style.item(i);
    var value = rule.style.getPropertyValue(property);
    var priority = rule.style.getPropertyPriority(property);
    //styles.push(`${property}: ${value}${priority ? " !" + priority : ""};`);
    styles.push(property ': ' + value + (priority ? " !" + priority : "") + ';');
  }
  styles.sort();
  return {
    style: styles.join(" "),
    subSelectors: splitSelector(rule.selectorText)
  };
}

function* evaluate(chain, index, prefix, subtree, styles)
{
  if (index >= chain.length)
  {
    yield prefix;
    return;
  }
  for (var [selector, element] of
       chain[index].getSelectors(prefix, subtree, styles))
  {
    if (selector == null)
      yield null;
    else
      yield* evaluate(chain, index + 1, selector, element, styles);
  }
  // Just in case the getSelectors() generator above had to run some heavy
  // document.querySelectorAll() call which didn't produce any results, make
  // sure there is at least one point where execution can pause.
  yield null;
}

function PlainSelector(selector)
{
  this._selector = selector;
}

PlainSelector.prototype = {
  /**
   * Generator function returning a pair of selector
   * string and subtree.
   * @param {string} prefix the prefix for the selector.
   * @param {Node} subtree the subtree we work on.
   * @param {StringifiedStyle[]} styles the stringified style objects.
   */
  *getSelectors(prefix, subtree, styles)
  {
    yield [prefix + this._selector, subtree];
  }
};

var incompletePrefixRegexp = /[\s>+~]$/;
var relativeSelectorRegexp = /^[>+~]/;

function HasSelector(selectors)
{
  this._innerSelectors = selectors;
}

HasSelector.prototype = {
  requiresHiding: true,

  get dependsOnStyles()
  {
    return this._innerSelectors.some(selector => selector.dependsOnStyles);
  },

  *getSelectors(prefix, subtree, styles)
  {
    for (var element of this.getElements(prefix, subtree, styles))
      yield [makeSelector(element, ""), element];
  },

  /**
   * Generator function returning selected elements.
   * @param {string} prefix the prefix for the selector.
   * @param {Node} subtree the subtree we work on.
   * @param {StringifiedStyle[]} styles the stringified style objects.
   */
  *getElements(prefix, subtree, styles)
  {
    var actualPrefix = (!prefix || incompletePrefixRegexp.test(prefix)) ?
        prefix + "*" : prefix;
    var elements = subtree.querySelectorAll(actualPrefix);
    for (var element of elements)
    {
      var iter = evaluate(this._innerSelectors, 0, "", element, styles);
      for (var selector of iter)
      {
        if (selector == null)
        {
          yield null;
          continue;
        }
        if (relativeSelectorRegexp.test(selector))
          selector = ":scope" + selector;
        try
        {
          if (element.querySelector(selector))
            yield element;
        }
        catch (e)
        {
          // :scope isn't supported on Edge, ignore error caused by it.
        }
      }
      yield null;
    }
  }
};

function ContainsSelector(textContent)
{
  this._text = textContent;
}

ContainsSelector.prototype = {
  requiresHiding: true,

  *getSelectors(prefix, subtree, stylesheet)
  {
    for (var element of this.getElements(prefix, subtree, stylesheet))
      yield [makeSelector(element, ""), subtree];
  },

  *getElements(prefix, subtree, stylesheet)
  {
    var actualPrefix = (!prefix || incompletePrefixRegexp.test(prefix)) ?
        prefix + "*" : prefix;
    var elements = subtree.querySelectorAll(actualPrefix);

    for (var element of elements)
    {
      if (element.textContent.includes(this._text))
        yield element;
      else
        yield null;
    }
  }
};

function PropsSelector(propertyExpression)
{
  var regexpString;
  if (propertyExpression.length >= 2 && propertyExpression[0] == "/" &&
      propertyExpression[propertyExpression.length - 1] == "/")
  {
    regexpString = propertyExpression.slice(1, -1)
      .replace("\\x7B ", "{").replace("\\x7D ", "}");
  }
  else
    regexpString = filterToRegExp(propertyExpression);

  if (SAFARI && propertyExpression.indexOf('content:') > -1) {
    // Safari / Webkit parses the CSS 'content' attribute for before & after rules differently then
    // Chrome, Edge, or Firefox.  Safari / Webkit removes the single & double quotes, so we need to do
    // so as well to get a match.
    var tempPropertyExpression = propertyExpression;
    tempPropertyExpression = tempPropertyExpression.replace(/\"/g, '');
    tempPropertyExpression = tempPropertyExpression.replace(/\'/g, "");
    this._regexp2 = new RegExp(filterToRegExp(tempPropertyExpression), "i");
  }
  this._regexp = new RegExp(regexpString, "i");
}

PropsSelector.prototype = {
  preferHideWithSelector: true,
  dependsOnStyles: true,

  *findPropsSelectors(styles, prefix, regexp)
  {
    for (var style of styles) {
      if (regexp.test(style.style)) {
        for (var subSelector of style.subSelectors)
        {
          if (subSelector.startsWith("*") &&
              !incompletePrefixRegexp.test(prefix))
          {
            subSelector = subSelector.substr(1);
          }
          var idx = subSelector.lastIndexOf("::");
          if (idx != -1) {
            subSelector = subSelector.substr(0, idx);
          }
          yield prefix + subSelector;
        }
      } else if (this._regexp2 && this._regexp2.test(style.style)) {
        for (var subSelector of style.subSelectors)
        {
          if (subSelector.startsWith("*") &&
              !incompletePrefixRegexp.test(prefix))
          {
            subSelector = subSelector.substr(1);
          }
          var idx = subSelector.lastIndexOf("::");
          if (idx != -1) {
            subSelector = subSelector.substr(0, idx);
          }
          yield prefix + subSelector;
        }
      }
    }
  },

  *getSelectors(prefix, subtree, styles)
  {
    for (var selector of this.findPropsSelectors(styles, prefix, this._regexp))
      yield [selector, subtree];
  }
};

function isSelectorHidingOnlyPattern(pattern)
{
  return pattern.selectors.some(s => s.preferHideWithSelector) &&
    !pattern.selectors.some(s => s.requiresHiding);
}

function ElemHideEmulation(addSelectorsFunc, hideElemsFunc)
{
  this.document = document;
  this.addSelectorsFunc = addSelectorsFunc;
  this.hideElemsFunc = hideElemsFunc;
  this.observer = new MutationObserver(this.observe.bind(this));
}

ElemHideEmulation.prototype = {
  isSameOrigin(stylesheet)
  {
    try
    {
      return new URL(stylesheet.href).origin == this.document.location.origin;
    }
    catch (e)
    {
      // Invalid URL, assume that it is first-party.
      return true;
    }
  },

  /** Parse the selector
   * @param {string} selector the selector to parse
   * @return {Array} selectors is an array of objects,
   * or null in case of errors.
   */
  parseSelector(selector)
  {
    if (!selector || selector.length == 0)
      return [];

    var match = abpSelectorRegexp.exec(selector);
    if (!match)
      return [new PlainSelector(selector)];

    var selectors = [];
    if (match.index > 0)
      selectors.push(new PlainSelector(selector.substr(0, match.index)));

    var startIndex = match.index + match[0].length;
    var content = parseSelectorContent(selector, startIndex);
    if (!content)
    {
      console.error(`Failed to parse Adblock Plus selector ${selector} due to unmatched parentheses.`);
      return null;
    }
    if (match[1] == "properties") {
      selectors.push(new PropsSelector(content.text));
    }
    else if (match[1] == "has")
    {
      var hasSelectors = this.parseSelector(content.text);
      if (hasSelectors == null)
        return null;
      selectors.push(new HasSelector(hasSelectors));
    }
    else if (match[1] == "contains")
      selectors.push(new ContainsSelector(content.text));
    else
    {
      // this is an error, can't parse selector.
      console.error(`Failed to parse Adblock Plus selector ${selector}, invalid pseudo-class :-abp-${match[1]}().`);
      return null;
    }

    var suffix = this.parseSelector(selector.substr(content.end + 1));
    if (suffix == null)
      return null;

    selectors.push(...suffix);

    if (selectors.length == 1 && selectors[0] instanceof ContainsSelector)
    {
      console.error(`Failed to parse Adblock Plus selector ${selector}, can not have a lonely :-abp-contains().`);
      return null;
    }
    return selectors;
  },

  /**
   * Processes the current document and applies all rules to it.
   * @param {CSSStyleSheet[]} [stylesheets]
   *    The list of new stylesheets that have been added to the document and
   *    made reprocessing necessary. This parameter shouldn't be passed in for
   *    the initial processing, all of document's stylesheets will be considered
   *    then and all rules, including the ones not dependent on styles.
   * @param {function} [done]
   *    Callback to call when done.
   */
  _addSelectors(stylesheets, done)
  {
    var selectors = [];
    var selectorFilters = [];

    var elements = [];
    var elementFilters = [];

    var cssStyles = [];

    var stylesheetOnlyChange = !!stylesheets;

    if (!stylesheets) {
      stylesheets = this.document.styleSheets;
    }

    for (var inx = 0; inx < stylesheets.length; inx++)
    {
      var stylesheet = stylesheets[inx];
      // Explicitly ignore third-party stylesheets to ensure consistent behavior
      // between Firefox and Chrome.
      if (!this.isSameOrigin(stylesheet))
        continue;

      try {
        // In some versions of Firefox the cssRules object isn't available until after parsing
        // so we'll retry
        // https://bugzilla.mozilla.org/show_bug.cgi?id=761236
        var rules = stylesheet.cssRules;
      } catch(e) {
        setTimeout(() =>
        {
          this._addSelectors(stylesheets, done);
        }, 30);
        return;
      }

      if (!rules)
        continue;

      for (var jnx = 0; jnx < rules.length; jnx++)
      {
        var rule = rules[jnx];
        if (rule.type != rule.STYLE_RULE)
          continue;

        cssStyles.push(stringifyStyle(rule));
      }
    }

    var patterns = this.patterns.slice();
    var pattern = null;
    var generator = null;

    var processPatterns = () =>
    {
      var cycleStart = performance.now();

      if (!pattern)
      {
        if (!patterns.length)
        {
          this.addSelectorsFunc(selectors, selectorFilters);
          this.hideElemsFunc(elements, elementFilters);
          if (typeof done == "function")
            done();
          return;
        }

        pattern = patterns.shift();

        if (stylesheetOnlyChange &&
            !pattern.selectors.some(selector => selector.dependsOnStyles))
        {
          pattern = null;
          return processPatterns();
        }
        generator = evaluate(pattern.selectors, 0, "", this.document, cssStyles);
      }
      for (var selector of generator)
      {
        if (selector != null)
        {
          if (isSelectorHidingOnlyPattern(pattern))
          {
            selectors.push(selector);
            selectorFilters.push(pattern.text);
          }
          else
          {
            for (var element of this.document.querySelectorAll(selector))
            {
              elements.push(element);
              elementFilters.push(pattern.text);
            }
          }
        }
        if (performance.now() -
            cycleStart > MAX_SYNCHRONOUS_PROCESSING_TIME)
        {
          setTimeout(processPatterns, 0);
          return;
        }
      }
      pattern = null;
      return processPatterns();
    };

    processPatterns();
  },
  /**
   This property is only used in the tests
   to shorten the invocation interval
  */
  get MIN_INVOCATION_INTERVAL()
  {
    return MIN_INVOCATION_INTERVAL;
  },

  set MIN_INVOCATION_INTERVAL(interval)
  {
    MIN_INVOCATION_INTERVAL = interval;
  },

  _filteringInProgress: false,
  _lastInvocation: -MIN_INVOCATION_INTERVAL,
  _scheduledProcessing: null,

  /**
   * Re-run filtering either immediately or queued.
   * @param {CSSStyleSheet[]} [stylesheets]
   *    new stylesheets to be processed. This parameter should be omitted
   *    for DOM modification (full reprocessing required).
   */
  queueFiltering(stylesheets)
  {
    var completion = () =>
    {
      this._lastInvocation = performance.now();
      this._filteringInProgress = false;
      if (this._scheduledProcessing)
      {
        var newStylesheets = this._scheduledProcessing.stylesheets;
        this._scheduledProcessing = null;
        this.queueFiltering(newStylesheets);
      }
    };

    if (this._scheduledProcessing)
    {
      if (!stylesheets)
        this._scheduledProcessing.stylesheets = null;
      else if (this._scheduledProcessing.stylesheets)
        this._scheduledProcessing.stylesheets.push(...stylesheets);
    }
    else if (this._filteringInProgress)
    {
      this._scheduledProcessing = {stylesheets};
    }
    else if (performance.now() -
             this._lastInvocation < MIN_INVOCATION_INTERVAL)
    {
      this._scheduledProcessing = {stylesheets};
      setTimeout(() =>
      {
        var newStylesheets = this._scheduledProcessing.stylesheets;
        this._filteringInProgress = true;
        this._scheduledProcessing = null;
        this._addSelectors(newStylesheets, completion);
      },
      MIN_INVOCATION_INTERVAL -
      (performance.now() - this._lastInvocation));
    }
    else
    {
      this._filteringInProgress = true;
      this._addSelectors(stylesheets, completion);
    }
  },

  onLoad(event)
  {
    var stylesheet = event.target.sheet;
    if (stylesheet)
      this.queueFiltering([stylesheet]);
  },

  observe(mutations)
  {
    this.queueFiltering();
  },

  apply(patterns)
  {
    this.patterns = [];
    if (patterns && patterns.advanceSelectors) {
      for (var inx = 0; inx < patterns.advanceSelectors.length; inx++)
      {
        var pattern = patterns.advanceSelectors[inx];
        var selectors = this.parseSelector(pattern.selector);

        if (selectors && selectors.length > 0) {
          this.patterns.push({selectors, text: pattern.text});
        }
      }

      if (this.patterns.length > 0)
      {
        this.queueFiltering();
        this.observer.observe(
          this.document,
          {
            childList: true,
            attributes: true,
            characterData: true,
            subtree: true
          }
        );
        this.document.addEventListener("load", this.onLoad.bind(this), true);
      }
    }
  }
};

