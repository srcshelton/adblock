//
//  ActionRequestHandler.swift
//  Privacy
//
//  Created by Brent Montrose on 9/1/15.
//  Copyright © 2015 AdBlock. All rights reserved.
//

import UIKit
import MobileCoreServices


class ActionRequestHandler: NSObject, NSExtensionRequestHandling {

    let adBlockRuleUpdateListFilename = "AdBlockPrivacyRuleListUpdate.json"

    var fileCoordinator = NSFileCoordinator()

    let fileManager = NSFileManager.defaultManager()

    func loadFile(context: NSExtensionContext, url: NSURL){
        let attachment = NSItemProvider(contentsOfURL: url)!
        let item = NSExtensionItem()
        item.attachments = [attachment]
        context.completeRequestReturningItems([item], completionHandler: { (result: Bool)-> Void in
            if result {
                NSLog("Privacy completeRequestReturningItem true ")
            } else {
                NSLog("Privacy completeRequestReturningItem false")
            }
        })
    }

    //invoked when the user enables this particular content blocker from the settings pag
    //or when the AdBlock app tells the content blocker manager to reload it
    //if it finds a JSON file in the shared area, it will use it, other wise
    //it will use the default JSON file included in the project
    func beginRequestWithExtensionContext(context: NSExtensionContext) {
        NSLog("Privacy beginRequestWithExtensionContext ")

        if let presentedItemURL = presentedItemURL {
            if (fileManager.fileExistsAtPath(presentedItemURL.path!)) {
                NSLog( adBlockRuleUpdateListFilename + "Privacy downloaded (shared) .json file found")
                fileCoordinator.coordinateReadingItemAtURL(presentedItemURL, options: .ResolvesSymbolicLink, error: nil) { (newURL:NSURL) -> Void in
                    self.loadFile(context, url: newURL)
                }
            } else {
                NSLog( adBlockRuleUpdateListFilename + "Privacy downloaded (shared) .json file NOT found using default 1")
                let defaultURL =  NSBundle.mainBundle().URLForResource("blockerList", withExtension: "json")
                self.loadFile(context, url: defaultURL!)
            }
        } else {
            NSLog( adBlockRuleUpdateListFilename + "Privacy downloaded (shared) .json file NOT found using default 2")
            let defaultURL =  NSBundle.mainBundle().URLForResource("blockerList", withExtension: "json")
            self.loadFile(context, url: defaultURL!)
        }
    }

}

// MARK: NSFilePresenter Protocol
extension ActionRequestHandler: NSFilePresenter {

    var presentedItemURL: NSURL? {
        let groupURL = NSFileManager.defaultManager().containerURLForSecurityApplicationGroupIdentifier("group.filterlist")
        let fileURL = groupURL?.URLByAppendingPathComponent(adBlockRuleUpdateListFilename)
        return fileURL
    }

    var presentedItemOperationQueue: NSOperationQueue {
        return NSOperationQueue.mainQueue()
    }
}
