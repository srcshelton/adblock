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


import SafariServices
import Foundation
import UIKit

//displays information to the user about current filter list(s), update time stamp
//allows them to force a download / update
class FilterListVC: UIViewController  {
    
    var fileCoordinator = NSFileCoordinator()
    
    let fileManager = NSFileManager.defaultManager()

    //@IBOutlet weak var adblockPageTitleLabel: UILabel!

    @IBOutlet weak var adblockPageSubTitleLabel: UILabel!
    
    @IBOutlet weak var filterListButton: UIButton!

    @IBOutlet weak var filterListNameHeader: UILabel!

    @IBOutlet weak var filterListTimeStampHeader: UILabel!

    @IBOutlet weak var easyListName: UILabel!

    @IBOutlet weak var easyListTimeStamp: UILabel!

    @IBOutlet weak var languageName: UILabel!

    @IBOutlet weak var languageTimeStamp: UILabel!

    @IBOutlet weak var privacyName: UILabel!
    
    @IBOutlet weak var privacyTimeStamp: UILabel!

    @IBOutlet weak var adblockLoveLabel: UILabel!

    @IBOutlet weak var userMessageLabel: UILabel!
    
    @IBOutlet weak var userMessageButton: UIButton!

    //touch handler for the error message support link button
    @IBAction func userMessageButtonClick(sender: UIButton) {
         UIApplication.sharedApplication().openURL(NSURL(string:"http://support.getadblock.com/")!)
    }
    
    //touch handler for the update filter list button
    // - updates the timestamp info to fetching
    // - registers a listener to be invoked when a filter list file has been updated
    // - tells MyFilters to download the file(s)
    @IBAction func updateFilterListFile(sender: UIButton) {
        let reachabilityUtil = Reachability()
        if (reachabilityUtil.connectedToWIFINetwork()) {
            self.userMessageLabel.text = ""
            self.userMessageButton.setTitle("", forState: UIControlState.Normal)
            self.userMessageButton.hidden = true
            updateFilters()
        } else if (reachabilityUtil.connectedToWWANNetwork()) {
            //since there's only a celluar/ mobile connection, ask the user if we should proceed.
            let actionSheetController: UIAlertController = UIAlertController(title: NSLocalizedString("alerttitle", comment:"AdBlock Alert"), message: NSLocalizedString("celluaronlyconnectionmessage", comment:"warning message"), preferredStyle: .Alert)
            let cancelAction: UIAlertAction = UIAlertAction(title: NSLocalizedString("cancelbuttontext", comment:"cancel"), style: .Cancel) { action -> Void in
                return
            }
            actionSheetController.addAction(cancelAction)
            let okayAction: UIAlertAction = UIAlertAction(title: NSLocalizedString("proceedbuttontext", comment:"proceed"), style: .Default) { action -> Void in
                self.userMessageLabel.text = ""
                self.userMessageButton.setTitle("", forState: UIControlState.Normal)
                self.userMessageButton.hidden = true
                self.updateFilters()
            }
            actionSheetController.addAction(okayAction)
            self.presentViewController(actionSheetController, animated: true, completion: nil)
        } else {
            //notify the user that there isn't any connection available.
            let actionSheetController: UIAlertController = UIAlertController(title: NSLocalizedString("alerttitle", comment:"AdBlock Alert"), message: NSLocalizedString("noconnectionmessage", comment:"warning message"), preferredStyle: .Alert)
            let okayAction: UIAlertAction = UIAlertAction(title: NSLocalizedString("okaybuttontext", comment:"okay"), style: .Cancel) { action -> Void in
                return
            }
            actionSheetController.addAction(okayAction)
            self.presentViewController(actionSheetController, animated: true, completion: nil)
        }
    }

    func updateFilters() {
        self.easyListTimeStamp.text = NSLocalizedString("fetchinglabel", comment:"Fetching...")
        self.privacyTimeStamp.text = NSLocalizedString("fetchinglabel", comment:"Fetching...")
        if (getLanguageSubscriptionId() != nil) {
            self.languageTimeStamp.text = NSLocalizedString("fetchinglabel", comment:"Fetching...")
        }
        let myFilters = MyFilters()
        myFilters.updateAllFilterListFiles()
    }

    //update a label field on the view for a given file
    func getTimestampInfoForFile(fileName: NSURL, theLabel: UILabel) {
        if (fileManager.fileExistsAtPath(fileName.path!)) {
            fileCoordinator.coordinateReadingItemAtURL(fileName, options: .ImmediatelyAvailableMetadataOnly, error: nil) { (newURL:NSURL) -> Void in
                var attributes = [String: AnyObject]()
                do {
                    attributes = try NSFileManager.defaultManager().attributesOfItemAtPath(newURL.path!)
                } catch  {
                    theLabel.text = NSLocalizedString("notimestampdata", comment:"nodata")
                }
                if let dateVal = attributes["NSFileModificationDate"] {
                    let formatter = NSDateFormatter()
                    formatter.dateStyle = NSDateFormatterStyle.ShortStyle
                    formatter.timeStyle = NSDateFormatterStyle.ShortStyle
                    let localTimestamp = formatter.stringFromDate(dateVal as! NSDate)
                    theLabel.text = localTimestamp
                } else {
                    theLabel.text = NSLocalizedString("notimestampdata", comment:"nodata")
                }
            }
        } else {
            self.updateTimestampLabelsWithDefaults()
        }
    }

    //if no date information for a filter list JSON file, display a 'no time stamp' message
    func updateTimestampLabelsWithDefaults() {
        self.easyListTimeStamp.text = NSLocalizedString("notimestampdata", comment:"nodata")
        self.privacyTimeStamp.text = NSLocalizedString("notimestampdata", comment:"nodata")
        if (getLanguageSubscriptionId() != nil) {
            self.languageTimeStamp.text = NSLocalizedString("notimestampdata", comment:"nodata")
        } else {
            self.languageName.hidden = true
            self.languageTimeStamp.hidden = true
        }
    }

    //update the timestamp(s) labels
    //called when the view loads, or
    //when a filter list file download has been completed
    //Parameter: sessionID - Optional - if provided, will only update the that timestamp
    //                                  if not provided, will update all timestamps
    func updateTimestampLabels(sessionID: String?) {
        if let presentedItemURL = presentedItemURL {
            if let id = sessionID {
                if (id.hasPrefix(MyFilters.easylistSessionIDPrefix)) {
                    let fileURL = presentedItemURL.URLByAppendingPathComponent(MyFilters.adBlockRuleUpdateListFilename)
                    self.getTimestampInfoForFile(fileURL, theLabel: easyListTimeStamp)
                } else if (id.hasPrefix(MyFilters.languageSessionIDPrefix)) {
                    NSLog("update language selection")
                    if let languageID = self.getLanguageSubscriptionId() {
                        let fileURL = presentedItemURL.URLByAppendingPathComponent(MyFilters.adBlockLanguageRuleUpdateListFilename)
                        self.getTimestampInfoForFile(fileURL, theLabel: languageTimeStamp)
                        self.languageName.text = NSLocalizedString(languageID, comment:"languagename")
                        self.languageName.hidden = false
                        self.languageTimeStamp.hidden = false
                    }
                } else if (id.hasPrefix(MyFilters.privacySessionIDPrefix)) {
                    let fileURL = presentedItemURL.URLByAppendingPathComponent(MyFilters.adBlockPrivacyRuleUpdateListFilename)
                    self.getTimestampInfoForFile(fileURL, theLabel: privacyTimeStamp)
                }
            } else {
                var fileURL = presentedItemURL.URLByAppendingPathComponent(MyFilters.adBlockRuleUpdateListFilename)
                self.getTimestampInfoForFile(fileURL, theLabel: easyListTimeStamp)
                fileURL = presentedItemURL.URLByAppendingPathComponent(MyFilters.adBlockPrivacyRuleUpdateListFilename)
                self.getTimestampInfoForFile(fileURL, theLabel: privacyTimeStamp)
                if (getLanguageSubscriptionId() != nil) {
                    fileURL = presentedItemURL.URLByAppendingPathComponent(MyFilters.adBlockLanguageRuleUpdateListFilename)
                    self.getTimestampInfoForFile(fileURL, theLabel: languageTimeStamp)
                }
            }
        } else {
            self.updateTimestampLabelsWithDefaults()
        }
    }
    
    func updateFailureLabel(sessionID: String?) {
        self.userMessageLabel.text = NSLocalizedString("downloaderrormessage", comment:"error")
        self.userMessageButton.setTitle(NSLocalizedString("downloaderrorlinkmessage", comment:"error"), forState: UIControlState.Normal)
        self.userMessageButton.hidden = false
        if let id = sessionID {
            if (id.hasPrefix(MyFilters.easylistSessionIDPrefix)) {
                self.easyListTimeStamp.text = NSLocalizedString("failedmessage", comment:"error")
            } else if (id.hasPrefix(MyFilters.languageSessionIDPrefix)) {
                self.languageTimeStamp.text = NSLocalizedString("failedmessage", comment:"error")
            } else if (id.hasPrefix(MyFilters.privacySessionIDPrefix)) {
                self.privacyTimeStamp.text = NSLocalizedString("failedmessage", comment:"error")
            }
        } else {
            self.updateTimestampLabels(sessionID)
        }
    }

    
    //receive a notification from MyFilters that a download has completed
    func logNotificationReceived(notification: NSNotification) {
        if let userInfo = notification.userInfo {
            let userInfoDict = userInfo as Dictionary
            if let sessionID = userInfoDict["sessionID"] {
                dispatch_async(dispatch_get_main_queue()) {
                    self.updateTimestampLabels(sessionID as? String)
                    return
                }
                return
            }
        }
        dispatch_async(dispatch_get_main_queue()) {
            self.updateTimestampLabels(nil)
        }
    }
    
    func filterListUpdatedFailed(notification: NSNotification) {
        if let userInfo = notification.userInfo {
            let userInfoDict = userInfo as Dictionary
            if let sessionID = userInfoDict["sessionID"] {
                dispatch_async(dispatch_get_main_queue()) {
                    self.updateFailureLabel(sessionID as? String)
                    return
                }
                return
            }
        }
        dispatch_async(dispatch_get_main_queue()) {
            self.updateFailureLabel(nil)
        }
    }
    
    func languageFilterListRemoved(notification: NSNotification) {
        dispatch_async(dispatch_get_main_queue()) {
            self.languageName.hidden = true
            self.languageTimeStamp.hidden = true
        }
    }

    //set the labels and button text when loaded
    override func viewDidLoad() {
        super.viewDidLoad()
        let titleText = NSLocalizedString("adblocktabtext", comment:"AdBlock")
        //adblockPageTitleLabel.text = titleText
        self.navigationItem.title = titleText
        adblockLoveLabel.text = NSLocalizedString("adblocklove", comment:"AdBlock")
        //
        let abString = "AdBlock" as NSString
        let attributedString = NSMutableAttributedString(string: abString as String)
        let boldAttrs = [NSFontAttributeName : UIFont.boldSystemFontOfSize(25)]
        attributedString.addAttributes(boldAttrs, range: abString.rangeOfString("Ad"))
        let attrs = [NSFontAttributeName : UIFont.systemFontOfSize(25)]
        attributedString.addAttributes(attrs, range: abString.rangeOfString("Block"))
        adblockPageSubTitleLabel.attributedText = attributedString

        filterListButton.setTitle(NSLocalizedString("updatefilterlistbutton", comment:"Update Filter List"), forState: UIControlState.Normal)

        filterListNameHeader.text = NSLocalizedString("filterlistname_header", comment:"Name")
        filterListTimeStampHeader.text = NSLocalizedString("filterlist_timestamp_header", comment:"Timestamp")
        easyListName.text = NSLocalizedString("filtereasylist", comment:"EasyList")
        privacyName.text = NSLocalizedString("filtereasyprivacy", comment:"EasyList")
        if let languageID = self.getLanguageSubscriptionId() {
            languageName.text = NSLocalizedString(languageID, comment:"languagename")
            self.languageName.hidden = false
            self.languageTimeStamp.hidden = false
        } else {
            self.languageName.hidden = true
            self.languageTimeStamp.hidden = true
        }
        self.updateTimestampLabels(nil)
        self.userMessageLabel.text = ""
        self.userMessageButton.setTitle("", forState: UIControlState.Normal)
        self.userMessageButton.hidden = true
        NSNotificationCenter.defaultCenter().addObserver(self, selector: "logNotificationReceived:", name:"FilterListUpdated", object: nil)
        NSNotificationCenter.defaultCenter().addObserver(self, selector: "filterListUpdatedFailed:", name:"FilterListUpdatedFailed", object:nil)
        NSNotificationCenter.defaultCenter().addObserver(self, selector: "languageFilterListRemoved:", name:"LanguageFilterListRemoved", object: nil)
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        NSNotificationCenter.defaultCenter().removeObserver(self)
    }

    override func preferredStatusBarStyle() -> UIStatusBarStyle {
        return UIStatusBarStyle.LightContent
    }

    //helper function to retreive the Language subscription id converted to i18n code
    func getLanguageSubscriptionId()->String? {
        let myFilters = MyFilters()
        if let myLanguageSub = myFilters.getLanguageSubScription() {
            return FilterListSubscription.getI18NId(myLanguageSub.id!)
        }
        return nil
    }
}

// MARK: NSFilePresenter Protocol
extension FilterListVC: NSFilePresenter {

    //used to retreive the timestamp information on the unzipped JSON files in the shared area
    var presentedItemURL: NSURL? {
        return NSFileManager.defaultManager().containerURLForSecurityApplicationGroupIdentifier("group.filterlist")
    }
    
    var presentedItemOperationQueue: NSOperationQueue {
        return NSOperationQueue.mainQueue()
    }
    
    func presentedItemDidChange() {
        //do nothing
    }
}

