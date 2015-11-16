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
//  ContentBlockerManager.swift
//  AdBlock
//
//
import SafariServices
import Foundation

class ContentBlockerManager {
    
    static func reload() {
        NSLog("reload content blocking rules")
        SFContentBlockerManager.reloadContentBlockerWithIdentifier("com.betafish.mobile.ios.AdBlock.General",  completionHandler:  { (result: NSError?)-> Void in
            
            if let myresult = result {
                NSLog("reload Easylist SFContentBlockerManager response: ")
                NSLog(myresult.description)
            } else {
                NSLog("reload Easylist SFContentBlockerManager no errors")
            }
        })
        SFContentBlockerManager.reloadContentBlockerWithIdentifier("com.betafish.mobile.ios.AdBlock.LanguagePack",  completionHandler:  { (result: NSError?)-> Void in
            
            if let myresult = result {
                NSLog("reload LanguagePack SFContentBlockerManager response: ")
                NSLog(myresult.description)
            } else {
                NSLog("reload LanguagePack SFContentBlockerManager no errors")
            }
        })
        SFContentBlockerManager.reloadContentBlockerWithIdentifier("com.betafish.mobile.ios.AdBlock.Privacy",  completionHandler:  { (result: NSError?)-> Void in
            
            if let myresult = result {
                NSLog("reload Privacy SFContentBlockerManager response: ")
                NSLog(myresult.description)
            } else {
                NSLog("reload Privacy SFContentBlockerManager no errors")
            }
        })
    }
}