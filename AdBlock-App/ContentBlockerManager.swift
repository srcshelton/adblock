//
//  ContentBlockerManager.swift
//  AdBlock
//
//  Created by Brent Montrose on 9/21/15.
//  Copyright © 2015 AdBlock. All rights reserved.
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