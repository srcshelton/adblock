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
//  TabBarViewController.swift
//  AdBlock
//
//

import UIKit

class TabBarVC: UITabBarController, UITabBarControllerDelegate {
    override func viewDidLoad() {
        super.viewDidLoad()
        delegate = self
    }

    override func viewWillAppear(animated: Bool) {
        super.viewWillAppear(animated)

        //set up text & icons on the tab bar
        let tabBarRootViewControllers: Array = self.viewControllers!
        //AdBlock - Red
        self.tabBar.tintColor = UIColor(red: 0xF6, green: 0x35, blue: 0x35)
        for viewController in tabBarRootViewControllers {
            if let id = viewController.restorationIdentifier {
                if id == "home" {
                    let icon = UITabBarItem(title: NSLocalizedString("adblocktabtext", comment:"tab") , image: UIImage(named: "AdBlockTabInactive"), selectedImage: UIImage(named: "AdBlockTabActive"))
                    viewController.tabBarItem = icon
                } else if id == "settingstab" {
                    let icon = UITabBarItem(title: NSLocalizedString("settingstabtext", comment:"tab") , image: UIImage(named: "SetupHelpTabInActive"), selectedImage: UIImage(named: "SetupHelpTabActive"))
                    viewController.tabBarItem = icon
                }
            }
        }
    }

    //Delegate methods
    func tabBarController(tabBarController: UITabBarController, shouldSelectViewController viewController: UIViewController) -> Bool {
        return true;
    }

}

extension UIColor {

    convenience init(red: Int, green: Int, blue: Int) {
        assert(red >= 0 && red <= 255, "Invalid red component")
        assert(green >= 0 && green <= 255, "Invalid green component")
        assert(blue >= 0 && blue <= 255, "Invalid blue component")

        self.init(red: CGFloat(red) / 255.0, green: CGFloat(green) / 255.0, blue: CGFloat(blue) / 255.0, alpha: 1.0)
    }

    convenience init(netHex:Int) {
        self.init(red:(netHex >> 16) & 0xff, green:(netHex >> 8) & 0xff, blue:netHex & 0xff)
    }
}
