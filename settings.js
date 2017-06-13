// OPTIONAL SETTINGS
function Settings()
{
  this._settingsKey = 'settings';
  this._defaults = {
    debug_logging: false,
    youtube_channel_whitelist: false,
    whitelist_hulu_ads: false,
    show_context_menu_items: true,
    show_advanced_options: false,
    display_stats: true,
    display_menu_stats: true,
    show_block_counts_help_link: true,
    show_survey: true,
  };
  var _this = this;
  this._init = new Promise(function (resolve)
  {
    chrome.storage.local.get(_this._settingsKey, function (response)
    {
      var settings = response.settings || {};
      _this._data = $.extend(_this._defaults, settings);
      if (settings.debug_logging)
      {
        logging(true);
      }

      resolve();
    });
  });
}

Settings.prototype = {
  set: function (name, isEnabled, callback)
  {
    this._data[name] = isEnabled;
    var _this = this;
    var _name = name;
    var _isEnabled =  isEnabled;

    // Don't store defaults that the user hasn't modified
    chrome.storage.local.get(this._settingsKey, function (response)
    {

      // Don't store defaults that the user hasn't modified
      var storedData = response[_this._settingsKey] || {};
      storedData[_name] = _isEnabled;
      chrome.storage.local.set({ settings: storedData });
      if (callback !== undefined && typeof callback === 'function')
      {
        callback();
      }
    });
  },

  get_all: function ()
  {
    return this._data;
  },

  onload: function ()
  {
    return this._init;
  },

};

var getSettings = function ()
{
  return _settings.get_all();
};

var setSetting = function (name, isEnabled, callback)
{
  _settings.set(name, isEnabled, callback);

  if (name === 'debug_logging')
  {
    logging(isEnabled);
  }
};

var disableSetting = function (name)
{
  _settings.set(name, false);
};
