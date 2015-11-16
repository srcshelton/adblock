//
//  FilterListSubscription.swift
//  AdBlock2
//
//  Created by Brent Montrose on 8/5/15.
//  Copyright © 2015 AdBlock. All rights reserved.
//

import Foundation
class FilterListSubscription: NSObject, NSCoding {

    var id: String?                         // id of subscription
    var url: String?                        // url of subscription
    var last_update: NSNumber?              // date & time is ms of the last succesfull update
    var last_modified: NSNumber?            // date & time of the last change on the server
    var last_update_failed_at: NSNumber?    // if set, when the last update attempt failed

    override init() {}
    
    required init(coder aDecoder: NSCoder) {
        if let id = aDecoder.decodeObjectForKey("id") as? String {
            self.id = id
        }
        if let url = aDecoder.decodeObjectForKey("url") as? String {
            self.url = url
        }
        if let last_update = aDecoder.decodeObjectForKey("last_update") as? NSNumber {
            self.last_update = last_update
        }
        if let last_modified = aDecoder.decodeObjectForKey("last_modified") as? NSNumber {
            self.last_modified = last_modified
        }
        if let last_update_failed_at = aDecoder.decodeObjectForKey("last_update_failed_at") as? NSNumber {
            self.last_update_failed_at = last_update_failed_at
        }
    }
    
    func encodeWithCoder(aCoder: NSCoder) {
        if let id = self.id {
            aCoder.encodeObject(id, forKey: "id")
        }
        if let url = self.url {
            aCoder.encodeObject(url, forKey: "url")
        }
        if let last_update = self.last_update {
            aCoder.encodeObject(last_update, forKey: "last_update")
        }
        if let last_modified = self.last_modified {
            aCoder.encodeObject(last_modified, forKey: "last_modified")
        }
        if let last_update_failed_at = self.last_update_failed_at {
            aCoder.encodeObject(last_update_failed_at, forKey: "last_update_failed_at")
        }
    }
    
    convenience init(id:String) {
        self.init()
        self.id = id
        self.url = ""
        self.last_update = 0
        self.last_modified = 0
        self.last_update_failed_at = 0
    }

    convenience init(id:String, url:String) {
        self.init(id: id)
        self.url = url
    }

    //delete / reset all updatable content
    func reset() {
        last_update = 0
        last_modified = 0
        last_update_failed_at = 0
    }

    func clone(fls:FilterListSubscription) {
        if let tempId = fls.id where tempId.isEmpty == false {
            self.id = tempId
        }
        if let tempURL = fls.url where tempURL.isEmpty == false {
            self.url = tempURL
        }
        if (fls.last_update != nil) {
            self.last_update = fls.last_update
        }
        if (fls.last_modified != nil) {
            self.last_modified = fls.last_modified
        }
        if (fls.last_update_failed_at != nil) {
            self.last_update_failed_at = fls.last_update_failed_at
        }
    }

    //get L10N / I18N text string for a given filter list id
    //used only for the language subscription
    func getI18NId()->String  {
        if let myID = self.id {
            switch myID {
                case "easylist_plus_bulgarian": return  "filtereasylist_plus_bulgarian"
                case "czech": return  "filterczech"
                case "easylist_plus_bulgarian": return  "filtereasylist_plus_bulgarian"
                case "danish": return  "filterdanish"
                case "easylist_plus_german": return  "filtereasylist_plus_german"
                case "easylist_plus_greek": return  "filtereasylist_plus_greek"
                case "easylist_plus_finnish": return  "filtereasylist_plus_finnish"
                case "easylist_plus_french": return  "filtereasylist_plus_french"
                case "israeli": return  "filterisraeli"
                case "hungarian": return  "filterhungarian"
                case "italian": return  "filteritalian"
                case "easylist_plus_indonesian": return  "filtereasylist_plus_indonesian"
                case "japanese": return  "filterjapanese"
                case "easylist_plun_korean": return  "filtereasylist_plun_korean"
                case "latvian": return  "filterlatvian"
                case "dutch": return  "filterdutch"
                case "easylist_plus_polish": return  "filtereasylist_plus_polish"
                case "easylist_plus_romanian": return  "filtereasylist_plus_romanian"
                case "russian": return  "filterrussian"
                case "czech": return  "filterczech"
                case "swedish": return  "filterswedish"
                case "turkish": return  "filterturkish"
                case "russian": return  "filterrussian"
                case "chinese": return  "filterchinese"
                default: return ""
            }
        } else {
            return ""
        }
    }
}
