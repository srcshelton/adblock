// Copyright 2015 BetaFish, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
//  settings.swift
//  AdBlock2
//
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