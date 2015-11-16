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
//  SettingsPageTwoViewController.swift
//  AdBlock
//
//
import Foundation
import UIKit


class SettingsPageTwoVC: UIViewController, UITableViewDataSource, UITableViewDelegate  {

    var window: UIWindow?

    let tableRows = [ "settingstwostepone", "settingstep1", "settingstwosteptwo", "settingstep2", "settingstwostepthree", "settingstep3", "settingstwostepfour", "settingstep4"]
    
    var setupshown:Bool = false

    @IBOutlet weak var settingsPageTwoTitleLabel: UILabel!

    @IBOutlet weak var settingsPageNextButton: UIButton!

    @IBOutlet weak var table: UITableView!

    override func viewDidLoad() {
        super.viewDidLoad()
        setupshown = NSUserDefaults.standardUserDefaults().boolForKey("setupshown")
        if setupshown {
            settingsPageNextButton.setTitle(NSLocalizedString("exitsettings", comment:"exit settings"), forState: UIControlState.Normal)
        } else {
            NSUserDefaults.standardUserDefaults().setBool(true, forKey: "setupshown")
            settingsPageNextButton.setTitle(NSLocalizedString("settingstwonextbutton", comment:"next page"), forState: UIControlState.Normal)
        }
        settingsPageTwoTitleLabel.text = NSLocalizedString("settingstwopagetitle", comment:"title")
        table.tableFooterView = UIView(frame: CGRectZero)
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
    }

    override func preferredStatusBarStyle() -> UIStatusBarStyle {
        return UIStatusBarStyle.LightContent
    }

    @IBAction func nextButtonTouched(sender: UIButton) {
        if setupshown {
            self.window = UIWindow(frame: UIScreen.mainScreen().bounds)
            let storyboard = UIStoryboard(name: "Main", bundle: nil)
            let initialVC = storyboard.instantiateViewControllerWithIdentifier("tabhome")
            self.window?.rootViewController = initialVC
            self.window?.makeKeyAndVisible()
        } else {
            ContentBlockerManager.reload()
            setupshown = true
            settingsPageNextButton.setTitle(NSLocalizedString("exitsettings", comment:"exit settings"), forState: UIControlState.Normal)
            let myStat = Stats()
            UIApplication.sharedApplication().openURL(NSURL(string:"http://getadblock.com/mobile/test/?u=" + myStat.getUserId())!)
        }
    }
    
    func tableView(tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return tableRows.count
    }
    
    func tableView(tableView: UITableView, cellForRowAtIndexPath indexPath: NSIndexPath) -> UITableViewCell {
        if ((indexPath.row % 2) == 0) {
            let cell = tableView.dequeueReusableCellWithIdentifier("textCell")
            cell!.textLabel?.text = NSLocalizedString(tableRows[indexPath.row], comment:"setupandhelp")
            cell!.textLabel?.numberOfLines = 0
            return cell!
        } else {
            let cell = tableView.dequeueReusableCellWithIdentifier("imageCell")
            cell!.imageView!.image = UIImage(named: tableRows[indexPath.row])
            return cell!
        }
    }
    
    func tableView(tableView: UITableView, heightForRowAtIndexPath indexPath: NSIndexPath) -> CGFloat {
        if ((indexPath.row % 2) == 0) {
            return 44.0
        } else {
            return 90.0
        }
    }
}
