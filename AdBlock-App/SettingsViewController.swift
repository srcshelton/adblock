//
//  SettingsViewController.swift
//  AdBlock
//
//  Created by Brent Montrose on 10/7/15.
//  Copyright © 2015 AdBlock. All rights reserved.
//

import UIKit

class SettingsVC: UIViewController, UITableViewDataSource, UITableViewDelegate {
    
    var window: UIWindow?
    
    let tableRows = [ "supportandhelptabtext", "languages", "supportus", "rateus", "about"]
    
    let simpleTableIdentifier = "settingsCell"
    
    @IBOutlet weak var navItem: UINavigationItem!
    
    @IBOutlet weak var tableView: UITableView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        tableView.tableFooterView = UIView(frame: CGRectZero)
        navItem.title = NSLocalizedString("settingstabtext", comment:"tab")
    }
    
    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
    }
    
    override func preferredStatusBarStyle() -> UIStatusBarStyle {
        return UIStatusBarStyle.LightContent
    }
    
    //Mark - table delegate
    func tableView(tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return tableRows.count
    }
    
    func tableView(tableView: UITableView, cellForRowAtIndexPath indexPath: NSIndexPath) -> UITableViewCell {
        // if the row is the language row, then show the current language (if there is one)
        if (indexPath.row == 1) {
            let cell = tableView.dequeueReusableCellWithIdentifier("languageCell")
            let myFilters = MyFilters()
            if let currentFLS = myFilters.getLanguageSubScription() {
                let i18NID = FilterListSubscription.getI18NId(currentFLS.id!)
                cell!.detailTextLabel?.text = NSLocalizedString(i18NID, comment:"tab")
                cell!.textLabel?.text = NSLocalizedString(tableRows[indexPath.row], comment:"setupandhelp")
                return cell!
            }
        }
        let cell = tableView.dequeueReusableCellWithIdentifier(simpleTableIdentifier)
        cell!.textLabel?.text = NSLocalizedString(tableRows[indexPath.row], comment:"setupandhelp")
        return cell!
    }
    
    func tableView(tableView: UITableView, didSelectRowAtIndexPath indexPath: NSIndexPath) {
        tableView.deselectRowAtIndexPath(indexPath, animated: true)
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        if (indexPath.row == 0) {
            let setupHelpVC = storyboard.instantiateViewControllerWithIdentifier("setupandhelp")
            self.navigationController?.pushViewController(setupHelpVC, animated: true)
        } else if (indexPath.row == 1) {
            let languageVC = storyboard.instantiateViewControllerWithIdentifier("languageselect")
            self.navigationController?.pushViewController(languageVC, animated: true)
        } else if (indexPath.row == 2) {
            let myStat = Stats()
            UIApplication.sharedApplication().openURL(NSURL(string:"http://getadblock.com/mobile/pay?u=" + myStat.getUserId())!)
        } else if (indexPath.row == 3) {
            // Leave the goofy URL below as is...
            UIApplication.sharedApplication().openURL(NSURL(string:"http://itunes.apple.com/WebObjects/MZStore.woa/wa/viewContentsUserReviews?id=1036484810&pageNumber=0&sortOrdering=2&type=Purple+Software&mt=8")!)
        } else if (indexPath.row == 4) {
            let languageVC = storyboard.instantiateViewControllerWithIdentifier("about")
            self.navigationController?.pushViewController(languageVC, animated: true)
        }
    }
}