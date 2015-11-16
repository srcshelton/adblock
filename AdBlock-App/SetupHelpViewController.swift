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
import UIKit

class SetupHelpVC: UIViewController {

    var window: UIWindow?

    @IBOutlet weak var homePageSubTitle1Label: UILabel!
    
    @IBOutlet weak var homePageSubTitle2Label: UILabel!

    @IBOutlet weak var homePageSubTitle3Label: UILabel!
    
    @IBOutlet weak var homePageItemOneLabel: UILabel!

    @IBOutlet weak var itemOneButton: UIButton!

    @IBOutlet weak var homePageItemTwoLabel: UILabel!

    @IBOutlet weak var itemTwoButton: UIButton!
    
    @IBOutlet weak var homePageItemThreeALabel: UILabel!

    @IBOutlet weak var homePageItemThreeBLabel: UILabel!

    @IBOutlet weak var itemThreeButton: UIButton!

    @IBOutlet weak var homePageItemFourLabel: UILabel!

    override func viewDidLoad() {
        super.viewDidLoad()
        self.navigationItem.title = NSLocalizedString("supportandhelptabtext", comment:"AdBlock")
        self.navigationController?.navigationBar.tintColor = UIColor.whiteColor()
        homePageSubTitle1Label.text = NSLocalizedString("setuphelpsubtitle1", comment:"settings")
        homePageSubTitle2Label.text = NSLocalizedString("setuphelpsubtitle2", comment:"settings")
        homePageSubTitle3Label.text = NSLocalizedString("setuphelpsubtitle3", comment:"settings")
        homePageItemOneLabel.text = NSLocalizedString("setuphelppagestep1", comment:"settings")
        homePageItemTwoLabel.text = NSLocalizedString("setuphelppagestep2", comment:"settings")
        homePageItemThreeALabel.text = NSLocalizedString("setuphelppagestep3", comment:"settings")
        homePageItemThreeBLabel.text = NSLocalizedString("setuphelppagestep3text", comment:"settings")
        homePageItemFourLabel.text = NSLocalizedString("setuphelppagestep4", comment:"settings")

        itemOneButton.setTitle(NSLocalizedString("setuphelppagebutton1", comment:"buttonone"), forState: UIControlState.Normal)
        itemTwoButton.setTitle(NSLocalizedString("setuphelppagebutton2", comment:"buttontwo"), forState: UIControlState.Normal)
        itemThreeButton.setTitle(NSLocalizedString("setuphelppagebutton3", comment:"buttonthree"), forState: UIControlState.Normal)
    }

    override func preferredStatusBarStyle() -> UIStatusBarStyle {
        return UIStatusBarStyle.LightContent
    }


    @IBAction func itemOneButtonTouched(sender: UIButton) {
        //set the showupsshow to false, so that the button display / action is correct
        NSUserDefaults.standardUserDefaults().setBool(false, forKey: "setupshown")
        self.window = UIWindow(frame: UIScreen.mainScreen().bounds)
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        let initialVC = storyboard.instantiateViewControllerWithIdentifier("settingsone")
        self.window?.rootViewController = initialVC
        self.window?.makeKeyAndVisible()

    }

    @IBAction func itemTwoButtonTouched(sender: UIButton) {
        ContentBlockerManager.reload()
        let myStat = Stats()
        UIApplication.sharedApplication().openURL(NSURL(string:"http://getadblock.com/mobile/test?u=" + myStat.getUserId())!)
    }

    @IBAction func itemThreeButtonTouched(sender: UIButton) {
        UIApplication.sharedApplication().openURL(NSURL(string:"http://support.getadblock.com/")!)
    }
}

