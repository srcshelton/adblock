var whiteSpaceRE = /\s/;

// Filters that block by CSS selector.
var DomainFilter = function (text, id) {
  this.id = ++DomainFilter._lastId;
  this.text = text;
  this.id = id;
  this.key = text.charAt(0);
};

DomainFilter._lastId = 0;

// Maps filter text to Filter instances.  This is important, as it allows
// us to throw away and rebuild the FilterSet at will.
// Will be cleared after a fixed time interval
DomainFilter._cache = {};

// Return a DomainFilter for the given filter text.
DomainFilter.fromText = function (text, id) {
  var cache = DomainFilter._cache;
  if (!(text in cache)) {
    if (DomainFilter.isFilterListDomain(text)) {
      text = DomainFilter.convertFilterListRule(text);
    }
    if (DomainFilter.isValidDomain(text))
      cache[text] = new DomainFilter(text, id);
  }

  return cache[text];
};

// Test if text contains on valid characters, and doesn't start with a comment
DomainFilter.isValidDomain = function (text) {
  return (text && text.length > 2 && text.charAt(0) !== "#" && text.charAt(0) !== "!" && !whiteSpaceRE.test(text));
};

// Test if domain (text) is from a filter list
DomainFilter.isFilterListDomain = function (text) {
  return (text &&
      text.length > 2 &&
      text.charAt(0) !== '!' &&
      text.charAt(0) !== '[' &&
      text.charAt(0) === '|' &&
      text.charAt(1) === '|');
};

DomainFilter.convertFilterListRule = function(text) {
  if (DomainFilter.isFilterListDomain(text)) {
      text = text.substr(2); // remove preceeding ||
      text = text.substring(0, text.length - 1); // # remove ending ^
      //convert any non-ascii characters to ascii (punycode)
      text = getUnicodeDomain(text.toLowerCase());
      return text;
  }
  return text;
}

// Normalize a set of domain filters.
// Remove broken filters, useless comments and unsupported things.
// Input: text:string filter strings separated by '\n'
// Returns: domain filter strings separated by '\n' with invalid filters
//          removed
DomainFilter.normalizeDomainList = function (domainText) {
    var lines = domainText.split('\n');
    delete domainText;
    var result = [];
    var ignoredFilterCount = 0;
    for (var i = 0; i < lines.length; i++) {
      var text = lines[i];
      if (DomainFilter.isFilterListDomain(text)) {
        text = DomainFilter.convertFilterListRule(text);
      }
      if (DomainFilter.isValidDomain(text)) {
        result.push(text);
      } else {
        ignoredFilterCount++;
      }
    }

    if (ignoredFilterCount)
      log('Ignoring ' + ignoredFilterCount + ' rule(s)');
    return result.join('\n') + '\n';
};

//Test cases:
//(true) DomainFilter.fromText("anmeiqi.com", "cheese");
//(true) DomainFilter.fromText("dentastyle.ro", "cheese");
//(false) DomainFilter.fromText("[Adblock Plus 1.1]", "cheese");
//(false) DomainFilter.fromText("! Checksum: YbKBUjmULlRF8RC5mC06dg", "cheese");
//(false) DomainFilter.fromText("! Expires: 1d", "cheese");
//(false) DomainFilter.fromText("!", "cheese");
//(true) DomainFilter.fromText("||amazon.co.uk.security-check.ga^", "cheese");
//(true) DomainFilter.fromText("||autosegurancabrasil.com^", "cheese");
//(true) DomainFilter.fromText("||christianmensfellowshipsoftball.org^", "cheese");
//(true) DomainFilter.fromText("||dadossolicitado-antendimento.sad879.mobi^", "cheese");
//(false) DomainFilter.fromText("Malvertising list by Disconnect", "cheese");
//(false) DomainFilter.fromText("# License: GPLv3", "cheese");
//(false) DomainFilter.fromText("# Contact: support [at] disconnect.me", "cheese");
//(false) DomainFilter.fromText("# Basic tracking list by Disconnect", "cheese");
//(false) DomainFilter.fromText("", "cheese");
//(true) DomainFilter.fromText("adjust.io", "cheese");

//DomainFilter.normalizeDomainList("anmeiqi.com\ndentastyle.ro\n[Adblock Plus 1.1]\n! Checksum: YbKBUjmULlRF8RC5mC06dg\n! Expires: 1d\n!\n||amazon.co.uk.security-check.ga^\n||autosegurancabrasil.com^\n||christianmensfellowshipsoftball.org^\n||dadossolicitado-antendimento.sad879.mobi^\nMalvertising list by Disconnect\n# License: GPLv3\n# Contact: support [at] disconnect.me\n# Basic tracking list by Disconnect")