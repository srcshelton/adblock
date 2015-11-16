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

//Responsible for loading the 'gab/installed' page view
class SupportUsVC: UIViewController, UIWebViewDelegate   {

    var payURL:String = ""
    
    @IBOutlet weak var installedView: UIWebView!
    
    @IBOutlet weak var progressIndicator: UIActivityIndicatorView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        let myStat = Stats()
        payURL = "https://getadblock.com/mobile/pay/?u=" + myStat.getUserId()
        let request = NSMutableURLRequest(URL: NSURL(string: payURL )!)
        self.installedView.loadRequest(request)
        self.installedView.delegate = self
    }
    
    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
    }
    
    func webViewDidFinishLoad(webView: UIWebView) {
        self.progressIndicator.stopAnimating()
        
    }
    
    func webViewDidStartLoad(webView: UIWebView) {
        self.progressIndicator.startAnimating()
    }

    //the webview will load the initial page, and any subsequent user actions will be handled by external browser
    func webView(webView: UIWebView, shouldStartLoadWithRequest request: NSURLRequest, navigationType: UIWebViewNavigationType) -> Bool {
        if let url = request.URL {
            let urlPath = String(url)
            if (urlPath == payURL) {
                return true
            } else {
                UIApplication.sharedApplication().openURL(request.URL!)
            }
        } else {
            UIApplication.sharedApplication().openURL(request.URL!)
        }
        return false
    }


    override func preferredStatusBarStyle() -> UIStatusBarStyle {
        return UIStatusBarStyle.LightContent
    }

}
