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
//  ActionRequestHandler.swift
//  AdBlock
//

import UIKit
import MobileCoreServices

class ActionRequestHandler: NSObject, NSExtensionRequestHandling {
    
    let adBlockRuleUpdateListFilename = "AdBlockRuleListUpdate.json"
    
    var fileCoordinator = NSFileCoordinator()
    
    let fileManager = NSFileManager.defaultManager()
    
    func loadFile(context: NSExtensionContext, url: NSURL){
        let attachment = NSItemProvider(contentsOfURL: url)!
        let item = NSExtensionItem()
        item.attachments = [attachment]
        context.completeRequestReturningItems([item], completionHandler: { (result: Bool)-> Void in
            if result {
                NSLog("completeRequestReturningItem true ")
            } else {
                NSLog("completeRequestReturningItem false")
            }
        })
    }

    //invoked when the user enables this particular content blocker from the settings pag
    //or when the AdBlock app tells the content blocker manager to reload it
    //if it finds a JSON file in the shared area, it will use it, other wise
    //it will use the default JSON file included in the project
    func beginRequestWithExtensionContext(context: NSExtensionContext) {
        NSLog(" General beginRequestWithExtensionContext ")
        
        if let presentedItemURL = presentedItemURL {
            if (fileManager.fileExistsAtPath(presentedItemURL.path!)) {
                NSLog( adBlockRuleUpdateListFilename + " downloaded (shared) .json file found")
                fileCoordinator.coordinateReadingItemAtURL(presentedItemURL, options: NSFileCoordinatorReadingOptions.ResolvesSymbolicLink, error: nil) { (newURL:NSURL) -> Void in
                    self.loadFile(context, url: newURL)
                }
            } else {
                NSLog( adBlockRuleUpdateListFilename + " downloaded (shared) .json file NOT found using default 1")
                let defaultURL =  NSBundle.mainBundle().URLForResource("AdBlockList", withExtension: "json")
                self.loadFile(context, url: defaultURL!)
            }
        } else {
            NSLog( adBlockRuleUpdateListFilename + " downloaded (shared) .json file NOT found using default 2")
            let defaultURL =  NSBundle.mainBundle().URLForResource("AdBlockList", withExtension: "json")
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
