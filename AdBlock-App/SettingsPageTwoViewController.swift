//
//  SettingsPageTwoViewController.swift
//  AdBlock
//
//  Created by Brent Montrose on 9/14/15.
//  Copyright © 2015 AdBlock. All rights reserved.
//
import Foundation
import UIKit


class SettingsPageTwoVC: UIViewController   {

    var window: UIWindow?

    var setupshown:Bool = false

    @IBOutlet weak var settingsPageTwoTitleLabel: UILabel!

    @IBOutlet weak var settingsPageNextButton: UIButton!

    @IBOutlet weak var settingPageTwoStepOne: UILabel!

    @IBOutlet weak var settingPageTwoStepTwo: UILabel!

    @IBOutlet weak var settingPageTwoStepThree: UILabel!

    @IBOutlet weak var settingPageTwoStepFour: UILabel!


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
        settingPageTwoStepOne.text = NSLocalizedString("settingstwostepone", comment:"step one")
        settingPageTwoStepTwo.text = NSLocalizedString("settingstwosteptwo", comment:"step two")
        settingPageTwoStepThree.text = NSLocalizedString("settingstwostepthree", comment:"step three")
        settingPageTwoStepFour.text = NSLocalizedString("settingstwostepfour", comment:"step four")
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
}
