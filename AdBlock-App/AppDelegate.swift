//
//  AppDelegate.swift
//  AdBlock2
//
//  Created by Brent Montrose on 8/3/15.
//  Copyright © 2015 AdBlock. All rights reserved.
//

import UIKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    let WEEKLY = 7 * 24 * 1000 * 60

    func application(application: UIApplication, didFinishLaunchingWithOptions launchOptions: [NSObject: AnyObject]?) -> Bool {
        
        let launchedBefore = NSUserDefaults.standardUserDefaults().boolForKey("launchedBefore")

        NSLog("launchedBefore: \(launchedBefore)")
        if launchedBefore {
            let myStats = Stats()
            myStats.pingNow(true)
            let myFilters = MyFilters()
            myFilters.checkForLanguageUpdate()
        } else {
            NSUserDefaults.standardUserDefaults().setBool(true, forKey: "launchedBefore")
            let today = NSDate()
            NSUserDefaults.standardUserDefaults().setObject(today, forKey: "installdate")
            let myStats = Stats()
            myStats.initialize()
            let settings = Settings()
            settings.initialize()
            let myFilters = MyFilters()
            myFilters.initialize()
            self.window = UIWindow(frame: UIScreen.mainScreen().bounds)
            let storyboard = UIStoryboard(name: "Main", bundle: nil)
            let initialVC = storyboard.instantiateViewControllerWithIdentifier("settingsone")
            self.window?.rootViewController = initialVC
            self.window?.makeKeyAndVisible()
        }
        let intervalTime = NSTimeInterval(WEEKLY)
        application.setMinimumBackgroundFetchInterval(intervalTime)
        return true
    }
    
    func applicationWillResignActive(application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and throttle down OpenGL ES frame rates. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(application: UIApplication) {
        // Called as part of the transition from the background to the inactive state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    //invoked by the OS when a background fetch is to be done.
    //Checks the connectivity to make sure we have a WIFI connection before
    //downloading the zip file(s)
    //will do a ping if we only have a cellular connection
    func application(application: UIApplication,
        performFetchWithCompletionHandler completionHandler:
        ((UIBackgroundFetchResult) -> Void)) {
            NSLog("background fetch initiated")
            let reachabilityUtil = Reachability()
            if (reachabilityUtil.connectedToWIFINetwork()) {
                let myFilters = MyFilters()
                myFilters.updateAllFilterListFiles()
                let myStats = Stats()
                myStats.pingNow()
                completionHandler(.NewData)
            } else if (reachabilityUtil.connectedToWWANNetwork()) {
                let myStats = Stats()
                myStats.pingNow()
                completionHandler(.NewData)
            } else {
                NSLog("-- no wifi connection")
                completionHandler(.NoData)
            }
    }


    //function is ivoked by iOS when the schema the following URL is invoked:
    // AdBlock://....
    // ifthe query string contains the view id (key = 'view')
    // take the user the specific view
    // or if the query string contain the tab id (key = 'tab')
    // take the user to the specific tab
    // otherwise if no view is specified, but the user id is correct, just opens the app
    // AdBlock://
    // AdBlock://l?view=settingsone
    // AdBlock://l?view=settingstwo
    // AdBlock://l?tab=0 (home)
    // AdBlock://l?tab=1 (Setup and Help)
    // AdBlock://l?tab=2 (Support us)
    // adblock://l?reloadrules=t (launches app, and reloads the content blocking rules)
    //
    func application(application: UIApplication, openURL url: NSURL, sourceApplication: String?, annotation: AnyObject) -> Bool {
        NSLog("invoked via URL : \(url.description)")
        let urlComponents = NSURLComponents(URL: url, resolvingAgainstBaseURL: false)
        if let components = urlComponents {
            if let queryItems = components.queryItems {
                //convert the query string into a dictionary for easier processing
                var queryItemsDictionary = [String:String]()
                for item in queryItems {
                    if let value = item.value {
                        queryItemsDictionary.updateValue(value, forKey: item.name)
                    }
                }
                if let _ = queryItemsDictionary["reloadrules"] {
                    ContentBlockerManager.reload()
                }
                if let viewFromURL = queryItemsDictionary["view"] {
                    self.window = UIWindow(frame: UIScreen.mainScreen().bounds)
                    let storyboard = UIStoryboard(name: "Main", bundle: nil)
                    do {
                        let newVC = try storyboard.instantiateViewControllerWithIdentifier(viewFromURL)
                        self.window?.rootViewController = newVC
                        self.window?.makeKeyAndVisible()
                    } catch {
                        NSLog("Unknown view in query string: " + url.query!)
                    }
                }
                if let tabIndexAsString = queryItemsDictionary["tab"] {
                    let tabIndex:Int? = Int(tabIndexAsString)
                    if tabIndex != nil {
                        if (tabIndex < 0) {
                            return true
                        }
                        self.window = UIWindow(frame: UIScreen.mainScreen().bounds)
                        let storyboard = UIStoryboard(name: "Main", bundle: nil)
                        do {
                            let newVC = try storyboard.instantiateViewControllerWithIdentifier("tabhome")
                            self.window?.rootViewController = newVC
                            let tabVC = newVC as! UITabBarController
                            if let controllers = tabVC.viewControllers {
                                if controllers.count > tabIndex {
                                    tabVC.selectedIndex = tabIndex!
                                }
                            }
                            self.window?.makeKeyAndVisible()
                        } catch {
                            NSLog("Unknown tab in query string: " + url.query!)
                        }
                    }
                }
            }
        }
        return true
    }
}

