
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
