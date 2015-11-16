//
//  settings.swift
//  AdBlock2
//
//  Created by Brent Montrose on 8/5/15.
//  Copyright © 2015 AdBlock. All rights reserved.
//
import Foundation
/*
Settings class
- initial guess at some perhaps useful user settings
*/
class Settings {
    
    let userDefaultsKey = "settings"
    
    let defaults = [ "debug_logging": false,
        "show_google_search_text_ads": false,
        "whitelist_hulu_ads": false,
        "show_advanced_options": false,
        "display_stats": true,
        "display_menu_stats": true,
        "show_block_counts_help_link": true]
    
    func initialize() {
        NSUserDefaults.standardUserDefaults().setObject(defaults, forKey: userDefaultsKey)
    }
    
    func save(updateKey:String, isEnabled:Bool) {
        let currentSettings = NSUserDefaults.standardUserDefaults().dictionaryForKey(userDefaultsKey)
        var tempSettings = defaults
        if let myCurrentSettings = currentSettings {
            for (key, _) in myCurrentSettings {
                tempSettings[key] = myCurrentSettings[key] as? Bool
            }
            tempSettings[updateKey] = isEnabled
            NSUserDefaults.standardUserDefaults().setObject(tempSettings, forKey: userDefaultsKey)
        }
    }
    
    func getSettingValueFor(key:String)->Bool {
        let currentSettings = NSUserDefaults.standardUserDefaults().dictionaryForKey(userDefaultsKey)
        if let myCurrentSettings = currentSettings {
            if let settingValue = myCurrentSettings[key] {
                return settingValue as! Bool
            } else {
                return false
            }
        } else {
            return false
        }
    }
    
    func getAll()->([String: Bool])? {
        let currentSettings = NSUserDefaults.standardUserDefaults().dictionaryForKey(userDefaultsKey)
        var tempSettings = defaults
        if let myCurrentSettings = currentSettings {
            for (key, _) in myCurrentSettings {
                tempSettings[key] = myCurrentSettings[key] as? Bool
            }
            return tempSettings
        } else {
            return defaults
        }
    }

}