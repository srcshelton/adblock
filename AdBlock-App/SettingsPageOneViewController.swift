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

import Foundation
import UIKit

class SettingsPageOneVC: UIViewController   {

    @IBOutlet weak var viewTitleLabel: UILabel!
    @IBOutlet weak var lineOneTextLabel: UILabel!
    @IBOutlet weak var lineTwoTextLabel: UILabel!
    @IBOutlet weak var lineThreeTextLabel: UILabel!
    @IBOutlet weak var lineFourTextLabel: UILabel!
    @IBOutlet weak var lineFiveTextLabel: UILabel!
    @IBOutlet weak var lineSixTextLabel: UILabel!
    @IBOutlet weak var nextButton: UIButton!

    override func viewDidLoad() {
        super.viewDidLoad()

        nextButton.setTitle(NSLocalizedString("settingsonenextbutton", comment:"next page"), forState: UIControlState.Normal)

        viewTitleLabel.text = NSLocalizedString("settingsonepagetitle", comment:"lineone")

        lineOneTextLabel.text = NSLocalizedString("settingsonelineone", comment:"lineone")
        lineTwoTextLabel.text = NSLocalizedString("settingsonelinetwo", comment:"linetwo")
        lineThreeTextLabel.text = NSLocalizedString("settingsonelinethree", comment:"linethree")
        lineFourTextLabel.text = NSLocalizedString("settingsonelinefour", comment:"linefour")
        lineFiveTextLabel.text = NSLocalizedString("settingsonelinefive", comment:"linefive")
        lineSixTextLabel.text = NSLocalizedString("settingsonelinesix", comment:"linesix")

    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()

    }

    override func preferredStatusBarStyle() -> UIStatusBarStyle {
        return UIStatusBarStyle.LightContent
    }

}
