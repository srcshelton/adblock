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
//  AboutViewController.swift
//  AdBlock
//
//
import UIKit

class AboutVC: UIViewController, UITableViewDataSource, UITableViewDelegate {
    
    var window: UIWindow?
    
    @IBOutlet weak var tableView: UITableView!
    
    override func viewDidLoad() {
        super.viewDidLoad()

        self.navigationItem.title = NSLocalizedString("about", comment:"about")
        self.navigationController?.navigationBar.tintColor = UIColor.whiteColor()
        tableView.tableFooterView = UIView(frame: CGRectZero)
    }

    override func preferredStatusBarStyle() -> UIStatusBarStyle {
        return UIStatusBarStyle.LightContent
    }
    
    //Mark - table delegate
    func tableView(tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return 4
    }
    
    func numberOfSectionsInTableView(tableView: UITableView) -> Int {
        return 1
    }
    
    func tableView(tableView: UITableView, cellForRowAtIndexPath indexPath: NSIndexPath) -> UITableViewCell {
        var cell = tableView.dequeueReusableCellWithIdentifier("aboutCell")
        if (indexPath.row == 0) {
            // get the app name from the InfoPlist.strings file
            var appName = ""
            let localInfoDict = CFBundleGetLocalInfoDictionary(CFBundleGetMainBundle()) as NSDictionary
            if let tempAppName = localInfoDict["CFBundleDisplayName"] {
                appName = (tempAppName as! String)
            }
            cell!.detailTextLabel?.text = (NSBundle.mainBundle().infoDictionary!["CFBundleShortVersionString"] as? String)! +
                " (" +
                (NSBundle.mainBundle().infoDictionary!["CFBundleVersion"] as? String)! +
            ")"
            cell!.textLabel?.text = appName + " " + NSLocalizedString("versionlabeltext", comment:"version")
        }
        if (indexPath.row == 1) {
            cell = tableView.dequeueReusableCellWithIdentifier("aboutCellLink")
            cell!.textLabel?.text = NSLocalizedString("helpspreadtheword", comment:"helpspreadtheword")
        }
        if (indexPath.row == 2) {
            cell = tableView.dequeueReusableCellWithIdentifier("aboutCellLink")
            cell!.textLabel?.text = NSLocalizedString("homepage", comment:"homepage")
        }
        if (indexPath.row == 3) {
            cell = tableView.dequeueReusableCellWithIdentifier("aboutCellLink")
            cell!.textLabel?.text = NSLocalizedString("contributors", comment:"contributors")
        }
        return cell!
    }
    
    func tableView(tableView: UITableView, didSelectRowAtIndexPath indexPath: NSIndexPath) {
        tableView.deselectRowAtIndexPath(indexPath, animated: true)
        if (indexPath.row == 1) {
            UIApplication.sharedApplication().openURL(NSURL(string:"https://getadblock.com/share/")!)
        }
        if (indexPath.row == 2) {
            UIApplication.sharedApplication().openURL(NSURL(string:"http://getadblock.com/")!)
        }
        if (indexPath.row == 3) {
            UIApplication.sharedApplication().openURL(NSURL(string:"https://getadblock.com/contributors/")!)
        }
    }
    
//    func tableView(tableView: UITableView, viewForHeaderInSection section: Int) -> UIView? {
//        if (section == 0) {
//            return nil
//        } else {
//            let grayBackgroundView = UIView()
//            grayBackgroundView.backgroundColor = UIColor.lightGrayColor()
//            return grayBackgroundView
//        }
//    }
//
//    func tableView(tableView: UITableView, heightForHeaderInSection section: Int) -> CGFloat {
//        if (section == 0) {
//            return 0
//        } else {
//            return 20
//        }
//    }
//
//    func tableView(tableView: UITableView, viewForFooterInSection section: Int) -> UIView? {
//        if (section == 3) {
//            let grayBackgroundView = UIView()
//            grayBackgroundView.backgroundColor = UIColor.lightGrayColor()
//            return grayBackgroundView
//        } else {
//            return nil
//        }
//    }
//    
//    func tableView(tableView: UITableView, heightForFooterInSection section: Int) -> CGFloat {
//        if (section == 3) {
//            return 20
//        } else {
//            return 0
//        }
//    }
    
}
