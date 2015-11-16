//
//  myfilters.swift
//  AdBlock2
//
//  Created by Brent Montrose on 8/5/15.
//  Copyright © 2015 AdBlock. All rights reserved.
//
import SafariServices
import Foundation
/*
MyFilters class
- determines which filter lists to subscribe the user to
- Easylist for all
- and language specific one, if it exists
- saves the subscription info into user defaults
-
*/
class MyFilters: NSObject, NSFilePresenter, NSURLSessionDelegate, NSURLSessionDownloadDelegate  {

    static let adBlockRuleUpdateListFilename = "AdBlockRuleListUpdate.json"
    static let adBlockLanguageRuleUpdateListFilename = "AdBlockLanguageRuleListUpdate.json"
    static let adBlockPrivacyRuleUpdateListFilename = "AdBlockPrivacyRuleListUpdate.json"

    //The user default key used to save the subscription infomation
    //Unique key for each one
    let userDefaultsEasylistKey = "easylistfilterlistsubscription"
    let userDefaultsLanguageKey = "languagefilterlistsubscription"
    let userDefaultsPrivacyKey = "privacyfilterlistsubscription"

    //The background fetch session ids used to unique id a download
    static let easylistSessionIDPrefix = "easylist"
    static let languageSessionIDPrefix = "language"
    static let privacySessionIDPrefix = "privacy"

    //The fileCoordinator - used to save the JSON file to a shared location
    var fileCoordinator = NSFileCoordinator()
    let fileManager = NSFileManager.defaultManager()

    //determine the initial subscriptions, save them,
    // ... then, if connected via WIFI,
    //     retrieve the file(s).
    func initialize() {
        saveEasylistSubscription(getInitialEasylistSubscription())
        if let languageSub = getInitialLanguageSubscription() {
            saveLanguageSubscription(languageSub)
        }
        savePrivacySubscription(getInitialPrivacySubscription())
        let reachabilityUtil = Reachability()
        if (reachabilityUtil.connectedToWIFINetwork()) {
            updateEasylistFilterListFile()
            updateLanguageFilterListFile()
            updatePrivacyFilterListFile()
        }
    }

    //determine if the language subscription has changed, 
    // if so, save it,
    // ... then, if connected via WIFI,
    //     retrieve the file.
    func checkForLanguageUpdate() {
        if let newLanguageSub = getInitialLanguageSubscription() {
            if let currentLanguageSub = getLanguageSubScription() {
                if (newLanguageSub.id != nil &&
                    currentLanguageSub.id != nil &&
                    newLanguageSub.id != currentLanguageSub.id) {
                    NSLog("updating Language from " + currentLanguageSub.id! + " to: " +  newLanguageSub.id!)
                    saveLanguageSubscription(newLanguageSub)
                } else {
                    NSLog("no update needed ")
                    //no update needed
                    return
                }
            } else {
                NSLog("updating Language to: " +  newLanguageSub.id!)
                saveLanguageSubscription(newLanguageSub)
            }
            let reachabilityUtil = Reachability()
            if (reachabilityUtil.connectedToWIFINetwork()) {
                updateLanguageFilterListFile()
            }
        } else {
            //if the user had a language subscription, but then changed their language
            //and the new language doesn't have a filter list, so we need to delete it
            if let _ = getLanguageSubScription() {
                NSLog("cleaning up old language artifacts")
                let ud = NSUserDefaults.standardUserDefaults()
                ud.removeObjectForKey(userDefaultsLanguageKey)
                deleteLanguageFile()
            }
        }
    }

    //save subscription information to the user default
    func saveSubscription(fls: FilterListSubscription, userDefaultsKey: String) {
        NSUserDefaults.standardUserDefaults().setObject(NSKeyedArchiver.archivedDataWithRootObject(fls), forKey: userDefaultsKey)
    }

    //retreive subscription information
    func getSubScription(userDefaultsKey: String)->FilterListSubscription? {
        let ud = NSUserDefaults.standardUserDefaults()
        if let data = ud.objectForKey(userDefaultsKey) as? NSData {
            let unarc = NSKeyedUnarchiver(forReadingWithData: data)
            return unarc.decodeObjectForKey("root") as? FilterListSubscription
        } else {
            return nil
        }
    }
    
    func saveEasylistSubscription(fls: FilterListSubscription) {
        saveSubscription(fls, userDefaultsKey: userDefaultsEasylistKey)
    }
    
    func getEasylistSubScription()->FilterListSubscription? {
        return getSubScription(userDefaultsEasylistKey)
    }
    
    func saveLanguageSubscription(fls: FilterListSubscription) {
        saveSubscription(fls, userDefaultsKey: userDefaultsLanguageKey)
    }
    
    func getLanguageSubScription()->FilterListSubscription? {
        return getSubScription(userDefaultsLanguageKey)
    }

    func savePrivacySubscription(fls: FilterListSubscription) {
        saveSubscription(fls, userDefaultsKey: userDefaultsPrivacyKey)
    }

    func getPrivacySubScription()->FilterListSubscription? {
        return getSubScription(userDefaultsPrivacyKey)
    }
    
    func updateEasylistFilterListFile() {
        if let currentFLS = getEasylistSubScription() {
            if let url = currentFLS.url {
                updateFilterListFile(url, sessionID: MyFilters.easylistSessionIDPrefix)
            }
        }
    }
    
    func updateLanguageFilterListFile() {
        if let currentFLS = getLanguageSubScription() {
            if let url = currentFLS.url {
                updateFilterListFile(url, sessionID: MyFilters.languageSessionIDPrefix)
            }
        }
    }

    func updatePrivacyFilterListFile() {
        if let currentFLS = getPrivacySubScription() {
            if let url = currentFLS.url {
                updateFilterListFile(url, sessionID: MyFilters.privacySessionIDPrefix)
            }
        }
    }

    //helper function called from either 
    //the AppDelegate during background fetch
    //the filterlist view when the user clicks the update filter list button
    func updateAllFilterListFiles() {
        updateEasylistFilterListFile()
        updateLanguageFilterListFile()
        updatePrivacyFilterListFile()
    }

    //update a filter file using the given URL and Session id.
    func updateFilterListFile(url:String, sessionID: String) {
        let request = NSMutableURLRequest(URL: NSURL(string: url)!)
        request.addValue("text/plain,application/json,application/octet-stream", forHTTPHeaderField: "Accept")
        request.addValue("AdBlock/", forHTTPHeaderField: "X-Client-ID")
        let configuration = NSURLSessionConfiguration.backgroundSessionConfigurationWithIdentifier(sessionID + "_" + NSUUID().UUIDString)
        
        configuration.allowsCellularAccess = false
        let backgroundSession = NSURLSession(configuration: configuration, delegate: self, delegateQueue: nil)
        let downloadTask = backgroundSession.downloadTaskWithRequest(request)
        downloadTask.resume()
    }

    //unzips the temporary, downloaded (zip) file to temporary folder
    //then moves that temp JSON file to the shared file area
    //parameters:
    //returns: a Bool indicating success or failure
    func writeURLToFile(fileURL: NSURL, sessionID: String)->Bool {
        NSLog("downloaded file URL: " + fileURL.path! + " session ID: " + sessionID)
        if let downloadedFilePath = fileURL.path {
            //Unzip the download file...
            let myUnzipper = UnZipDelegate()
            Main.unzipFileAtPath(downloadedFilePath, toDestination: NSTemporaryDirectory(), delegate: myUnzipper)

            let filePath = myUnzipper.unzippedJSONFilePath
            NSLog("un-zipped filePath - " + filePath + " session: " + sessionID)
            //remove the downloaded zip file.
            if (NSFileManager.defaultManager().fileExistsAtPath(downloadedFilePath)) {
                do {
                     //remove the downloaded zip file
                    try NSFileManager.defaultManager().removeItemAtPath(downloadedFilePath)
                } catch {
                    //do nothing
                }
            }
            if (!NSFileManager.defaultManager().fileExistsAtPath(filePath)) {
                NSLog("un-zipped file not found, returning - " + filePath + " session: " + sessionID)
                sendErrorNotificationForSession(sessionID)
                return false
            }
            var ruleText = ""
            do {
                ruleText = try NSString(contentsOfFile: filePath, encoding: NSUTF8StringEncoding) as String!
            } catch {
                NSLog("error during reading of URL:" + filePath)
                sendErrorNotificationForSession(sessionID)
                return false
            }
            // save the file to the shared area
            if let presentedItemURL = presentedItemURL {
                var fileURL:NSURL
                if (sessionID.hasPrefix(MyFilters.languageSessionIDPrefix)) {
                    fileURL = presentedItemURL.URLByAppendingPathComponent(MyFilters.adBlockLanguageRuleUpdateListFilename)
                } else if (sessionID.hasPrefix(MyFilters.easylistSessionIDPrefix)) {
                    fileURL = presentedItemURL.URLByAppendingPathComponent(MyFilters.adBlockRuleUpdateListFilename)
                } else if (sessionID.hasPrefix(MyFilters.privacySessionIDPrefix)) {
                    fileURL = presentedItemURL.URLByAppendingPathComponent(MyFilters.adBlockPrivacyRuleUpdateListFilename)
                } else {
                    NSLog("session id not recognized: " + sessionID)
                    sendErrorNotificationForSession(sessionID)
                    return false
                }
                var fileCoodrinatorError: NSError?
                fileCoordinator.coordinateWritingItemAtURL(fileURL, options: .ForReplacing, error: &fileCoodrinatorError, byAccessor: { (newURL) -> Void in
                    do {
                        try ruleText.writeToURL(newURL, atomically: true, encoding: NSUTF8StringEncoding)
                        //remove the temp JSON file
                        try NSFileManager.defaultManager().removeItemAtPath(filePath)
                    } catch let theError as NSError {
                        NSLog(" rule file " + newURL.path! + " could not be written to: " + theError.description)
                        self.sendErrorNotificationForSession(sessionID)
                        return
                    } catch {
                        NSLog("Unknown error, rule file " + newURL.path! + " could not be written to ")
                        self.sendErrorNotificationForSession(sessionID)
                        return
                    }
                })
                if let error = fileCoodrinatorError {
                    NSLog(" error updating shared json file error: \(error)")
                    sendErrorNotificationForSession(sessionID)
                    return false
                }
            } else {
                NSLog("presentedItemURL is nil, no place to save JSON file")
                sendErrorNotificationForSession(sessionID)
                return false
            }
        } else {
            NSLog("no file to process!")
            sendErrorNotificationForSession(sessionID)
            return false
        }
         NSLog("done processing file download session ID: " + sessionID)
        return true
    }

    // Inputs: none.
    // Returns the initial EasyList subscription info
    func getInitialEasylistSubscription()->FilterListSubscription {
        return FilterListSubscription(id: "easylist", url: "https://adblockcdn.com/filters/easylist.zip")
    }

    // Inputs: none.
    // Returns the initial Privacy subscription info
    func getInitialPrivacySubscription()->FilterListSubscription {
        return FilterListSubscription(id: "easyprivacy", url: "https://adblockcdn.com/filters/easyprivacy.zip")
    }

    func deleteLanguageFile() {
        //write an 'empty' rule that effectively does nothing to the shared language file
        if let presentedItemURL = presentedItemURL {
            NSLog("writing empty rule to language file")
            let emptyRuleText = "[ { \"trigger\": { \"url-filter\": \"https?://*.\" }, \"action\": { \"type\": \"ignore-previous-rules\" }  } ]"
            var fileURL:NSURL
            fileURL = presentedItemURL.URLByAppendingPathComponent(MyFilters.adBlockLanguageRuleUpdateListFilename)
            var fileCoodrinatorError: NSError?
            fileCoordinator.coordinateWritingItemAtURL(fileURL, options: .ForReplacing, error: &fileCoodrinatorError, byAccessor: { (newURL) -> Void in
                do {
                    try emptyRuleText.writeToURL(newURL, atomically: true, encoding: NSUTF8StringEncoding)
                } catch let theError as NSError {
                    NSLog(" rule file " + newURL.path! + " could not be written to: " + theError.description)
                    return
                } catch {
                    NSLog("Unknown error, rule file " + newURL.path! + " could not be written to ")
                    return
                }
                NSLog("sending message to reload content blocker for language pack")
                SFContentBlockerManager.reloadContentBlockerWithIdentifier("com.betafish.mobile.ios.AdBlock.LanguagePack",  completionHandler:  { (result: NSError?)-> Void in
                    if let myresult = result {
                        NSLog("LanguagePack SFContentBlockerManager response: ")
                        NSLog(myresult.description)
                    } else {
                        NSLog("LanguagePack SFContentBlockerManager no errors")
                    }
                    NSNotificationCenter.defaultCenter().postNotificationName("FilterListUpdated", object: nil)
                })
            })
        }
    }

    // Inputs: none.
    // Returns an object containing the Language specific subscription info
    // , or nil
    func getInitialLanguageSubscription()->FilterListSubscription? {
        var language =  NSLocale.preferredLanguages()[0]
        if (language.characters.count > 2) {
            let endIndex = language.startIndex.advancedBy(2)
            language = language.substringToIndex(endIndex)
        }
        NSLog("getInitialLanguageSubscription Language code: \(language)")
        switch language {
            case "bg": return FilterListSubscription(id: "easylist_plus_bulgarian", url: "https://adblockcdn.com/filters/easylist_plus_bulgarian.zip")
            
            case "cs": return FilterListSubscription(id: "czech",  url: "https://adblockcdn.com/filters/czech.zip")
            
            case "cu": return FilterListSubscription(id: "easylist_plus_bulgarian", url: "https://adblockcdn.com/filters/easylist_plus_bulgarian.zip")
            
            case "da": return FilterListSubscription(id: "danish", url: "https://adblockcdn.com/filters/danish.zip")
            
            case "de": return FilterListSubscription(id: "easylist_plus_german", url: "https://adblockcdn.com/filters/easylist_plus_german.zip")
            
            case "el": return FilterListSubscription(id: "easylist_plus_greek", url: "https://adblockcdn.com/filters/easylist_plus_greek.zip")
            
            case "fi": return FilterListSubscription(id: "easylist_plus_finnish", url: "https://adblockcdn.com/filters/easylist_plus_finnish.zip")
            
            case "fr": return FilterListSubscription( id: "easylist_plus_french", url: "https://adblockcdn.com/filters/easylist_plus_french.zip")
            
            case "he": return FilterListSubscription(id: "israeli", url: "https://adblockcdn.com/filters/israeli.zip")
            
            case "hu": return FilterListSubscription(id: "hungarian", url: "https://adblockcdn.com/filters/hungarian.zip")
            
            case "it": return FilterListSubscription(id: "italian", url: "https://adblockcdn.com/filters/italian.zip")
            
            case "id": return FilterListSubscription(id: "easylist_plus_indonesian", url: "https://adblockcdn.com/filters/easylist_plus_indonesian.zip")
            
            case "ja": return FilterListSubscription(id: "japanese", url: "https://adblockcdn.com/filters/japanese.zip")
            
            case "ko": return FilterListSubscription(id: "easylist_plun_korean", url: "https://adblockcdn.com/filters/easylist_plun_korean.zip")
            
            case "lv": return FilterListSubscription(id: "latvian", url: "https://adblockcdn.com/filters/latvian.zip")
            
            case "nl": return FilterListSubscription(id: "dutch", url: "https://adblockcdn.com/filters/dutch.zip")
            
            case "pl": return FilterListSubscription(id: "easylist_plus_polish", url: "https://adblockcdn.com/filters/easylist_plus_polish.zip")
            
            case "ro": return FilterListSubscription(id: "easylist_plus_romanian", url: "https://adblockcdn.com/filters/easylist_plus_romanian.zip")
            
            case "ru": return FilterListSubscription(id: "russian", url: "https://adblockcdn.com/filters/russian")
            
            case "sk": return FilterListSubscription(id: "czech",  url: "https://adblockcdn.com/filters/czech.zip")
            
            case "sv": return FilterListSubscription(id: "swedish", url: "https://adblockcdn.com/filters/swedish.zip")
            
            case "tr": return FilterListSubscription(id: "turkish", url: "https://adblockcdn.com/filters/turkish.zip")
            
            case "uk": return FilterListSubscription(id: "russian", url: "https://adblockcdn.com/filters/russian")
            
            case "zh": return FilterListSubscription(id: "chinese", url: "https://adblockcdn.com/filters/chinese.zip")
            
            default: return nil
        }
    }
    
    func sendErrorNotificationForSession(sessionID: String) {
        var userInfo: [String: String] = [:]
        if (sessionID.hasPrefix(MyFilters.easylistSessionIDPrefix)) {
            userInfo["sessionID"] = MyFilters.easylistSessionIDPrefix
        } else if (sessionID.hasPrefix(MyFilters.languageSessionIDPrefix)) {
            userInfo["sessionID"] = MyFilters.languageSessionIDPrefix
        } else if (sessionID.hasPrefix(MyFilters.privacySessionIDPrefix)) {
            userInfo["sessionID"] = MyFilters.privacySessionIDPrefix
        }
        NSNotificationCenter.defaultCenter().postNotificationName("FilterListUpdatedFailed", object: nil, userInfo: userInfo)
    }
    
    func sendErrorNotification() {
        NSNotificationCenter.defaultCenter().postNotificationName("FilterListUpdatedFailed", object: nil, userInfo: nil)
    }
    
    //MARK: file presenter
    var presentedItemURL: NSURL? {
        return NSFileManager.defaultManager().containerURLForSecurityApplicationGroupIdentifier("group.filterlist")
    }
    
    var presentedItemOperationQueue: NSOperationQueue {
        return NSOperationQueue.mainQueue()
    }
    
    //MARK: session delegate
    func URLSession(session: NSURLSession, didBecomeInvalidWithError error: NSError?) {
        if error != nil {
            NSLog("session error: \(error?.localizedDescription).")
        }
    }
    
    func URLSessions(session: NSURLSession,
        didReceiveChallenge challenge:
        NSURLAuthenticationChallenge,
        completionHandler:
        (NSURLSessionAuthChallengeDisposition,
        NSURLCredential!) -> Void) {
            completionHandler(
                NSURLSessionAuthChallengeDisposition.UseCredential,
                NSURLCredential(forTrust:
                    challenge.protectionSpace.serverTrust!))
    }
    
    func URLSessions(session: NSURLSession,
        task: NSURLSessionTask,
        willPerformHTTPRedirection response:
        NSHTTPURLResponse,
        newRequest request: NSURLRequest,
        completionHandler: (NSURLRequest!) -> Void) {
            let newRequest : NSURLRequest? = request
            completionHandler(newRequest)
    }

    //called when the background fetch has completed the download of the temporary file
    //when the downloaded file has been unzipped, and saved the shared location
    //will call the content blocker manager to reload the updated file
    func URLSession(session: NSURLSession, downloadTask: NSURLSessionDownloadTask, didFinishDownloadingToURL location: NSURL) {
        
        let writeResult = writeURLToFile(location, sessionID: session.configuration.identifier!)
        if (writeResult) {
            var userInfo: [String: String] = [:]
            if let sessionID = session.configuration.identifier {
                if (sessionID.hasPrefix(MyFilters.easylistSessionIDPrefix)) {
                    NSLog("sending message to reload content blocker for easylist")
                    SFContentBlockerManager.reloadContentBlockerWithIdentifier("com.betafish.mobile.ios.AdBlock.General",  completionHandler:  { (result: NSError?)-> Void in
                        if let myresult = result {
                            NSLog("Easylist SFContentBlockerManager response: ")
                            NSLog(myresult.description)
                        } else {
                            NSLog("Easylist SFContentBlockerManager no errors")
                        }
                        userInfo["sessionID"] = MyFilters.easylistSessionIDPrefix
                        NSNotificationCenter.defaultCenter().postNotificationName("FilterListUpdated", object: nil, userInfo: userInfo)
                    })
                } else if (sessionID.hasPrefix(MyFilters.languageSessionIDPrefix)) {
                    NSLog("sending message to reload content blocker for language pack")
                SFContentBlockerManager.reloadContentBlockerWithIdentifier("com.betafish.mobile.ios.AdBlock.LanguagePack",  completionHandler:  { (result: NSError?)-> Void in
                        if let myresult = result {
                            NSLog("LanguagePack SFContentBlockerManager response: ")
                            NSLog(myresult.description)
                        } else {
                            NSLog("LanguagePack SFContentBlockerManager no errors")
                        }
                        userInfo["sessionID"] = MyFilters.languageSessionIDPrefix
                        NSNotificationCenter.defaultCenter().postNotificationName("FilterListUpdated", object: nil, userInfo: userInfo)
                    })
                } else if (sessionID.hasPrefix(MyFilters.privacySessionIDPrefix)) {
                    NSLog("sending message to reload content blocker for privacy")
                    SFContentBlockerManager.reloadContentBlockerWithIdentifier("com.betafish.mobile.ios.AdBlock.Privacy",  completionHandler:  { (result: NSError?)-> Void in
                        if let myresult = result {
                            NSLog("Privacy SFContentBlockerManager response: ")
                            NSLog(myresult.description)
                        } else {
                            NSLog("Privacy SFContentBlockerManager no errors")
                        }
                        userInfo["sessionID"] = MyFilters.privacySessionIDPrefix
                        NSNotificationCenter.defaultCenter().postNotificationName("FilterListUpdated", object: nil, userInfo: userInfo)
                    })
                }
            } else {
                NSLog(" session config id is nill")
            }
        }
        session.finishTasksAndInvalidate()
    }
    
    func URLSession(session: NSURLSession, downloadTask: NSURLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {

    }
    
    func URLSession(session: NSURLSession, downloadTask: NSURLSessionDownloadTask, didResumeAtOffset fileOffset: Int64, expectedTotalBytes: Int64) {

    }
    
    func URLSession(session: NSURLSession, task: NSURLSessionTask, didCompleteWithError error: NSError?) {
        if error != nil {
            NSLog("session \(session) download failed with error \(error?.localizedDescription)")
            if let sessionID = session.configuration.identifier {
                self.sendErrorNotificationForSession(sessionID)
            } else {
                self.sendErrorNotification()
            }
        }
    }
}

