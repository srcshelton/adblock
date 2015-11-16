//
//  stats.swift
//  AdBlock2
//
//  Created by Brent Montrose on 8/5/15.
//  Copyright © 2015 AdBlock. All rights reserved.
//
import Foundation


/*
 Stats class
 - responsible for pinging us weekly and on app start up with user info
 - creates a unique ID when app is installed
 - keeps track of the number of pings (ping count)
 - pings on installation, then when iOS calls the background fetch function on the app
*/
class Stats:  NSObject, NSURLSessionDelegate, NSURLSessionDownloadDelegate {
    
    let userDefaultsKey = "userid"
    
    let pingCountKey = "pingcount"
    
    let statsURL = "https://ping.getadblock.com/stats/"
    
    let alphanums = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","0","1","2","3","4","5","6","7","8","9"]

    //Create a random userID 
    //Should only be called when the app is installed.
    func createUserId()->String {
        let time_suffix = String(Int(Double(floor(NSDate().timeIntervalSince1970 * 1000)) % 1e8)) // 8 digits from end of timestamp
        var result = ""
        for (var i = 0; i < 8; i++) {
            let j = Int(arc4random_uniform(UInt32(alphanums.count)))
            result = result + alphanums[j]
        }
        return result + time_suffix
    }
    
    func getUserId()->String {
         return NSUserDefaults.standardUserDefaults().valueForKey(userDefaultsKey) as! String
    }
    
    func getPingCount()->Int {
        return NSUserDefaults.standardUserDefaults().integerForKey(pingCountKey)
    }
    
    func incrementPingCount() {
        NSUserDefaults.standardUserDefaults().setInteger((getPingCount() + 1), forKey: pingCountKey)
    }
    
    func initialize() {
        NSUserDefaults.standardUserDefaults().setValue(self.createUserId(), forKey: userDefaultsKey)
        NSUserDefaults.standardUserDefaults().setInteger(0, forKey: pingCountKey)
        pingNow(true)
    }
    
    func pingNow(appLaunched: Bool=false) {
        incrementPingCount()
        let os = NSProcessInfo().operatingSystemVersion
        let versionObject: AnyObject? = NSBundle.mainBundle().infoDictionary!["CFBundleShortVersionString"]
        let appIDObject: AnyObject? = NSBundle.mainBundle().infoDictionary!["CFBundleIdentifier"]
        var postString = "cmd=ping"
        
        if let version = versionObject {
            postString = postString + "&v=" + version.description
        }
        let reachabilityUtil = Reachability()
        if reachabilityUtil.connectedToWIFINetwork() {
            postString = postString + "&ct=w"
        } else if reachabilityUtil.connectedToWWANNetwork() {
            postString = postString + "&ct=c"
        }
        postString = postString + "&u=" + getUserId()
        postString = postString + "&o=ios"
        //if the user launched the app, the 'pt (ping type)' = u (user)
        //else pt = b (background)
        if (appLaunched) {
            postString = postString + "&pt=u"
        } else {
            postString = postString + "&pt=b"
        }
        postString = postString + "&f=i"
        postString = postString + "&pc=" + String(getPingCount())
        postString = postString + "&ov=" + String(os.majorVersion) + "." + String(os.minorVersion) + "." + String(os.patchVersion)
        postString = postString + "&l=" + NSLocale.preferredLanguages()[0]
        
        if let appID = appIDObject {
            postString = postString + "&extid=" + appID.description
        }
        let escapedString = postString.stringByAddingPercentEncodingWithAllowedCharacters(.URLHostAllowedCharacterSet())
        let url = NSURL(string:statsURL)
        let request = NSMutableURLRequest(URL: url!)
        let configuration = NSURLSessionConfiguration.backgroundSessionConfigurationWithIdentifier("ping" + "_" + NSUUID().UUIDString)
        configuration.allowsCellularAccess = true
        let backgroundSession = NSURLSession(configuration: configuration, delegate: self, delegateQueue: nil)
        request.HTTPMethod = "POST"
        request.HTTPBody = escapedString!.dataUsingEncoding(NSUTF8StringEncoding)

        let downloadTask = backgroundSession.downloadTaskWithRequest(request)
        downloadTask.resume()
    }
    
    //MARK: session delegate
    func URLSession(session: NSURLSession, didBecomeInvalidWithError error: NSError?) {
        if error != nil {
            NSLog("ping session error: \(error?.localizedDescription).")
        }
    }
    
    func URLSessions(session: NSURLSession,
        didReceiveChallenge challenge:
        NSURLAuthenticationChallenge,
        completionHandler:
        (NSURLSessionAuthChallengeDisposition,
        NSURLCredential!) -> Void) {
            completionHandler(
                NSURLSessionAuthChallengeDisposition.UseCredential,
                NSURLCredential(forTrust:
                    challenge.protectionSpace.serverTrust!))
    }
    
    func URLSessions(session: NSURLSession,
        task: NSURLSessionTask,
        willPerformHTTPRedirection response:
        NSHTTPURLResponse,
        newRequest request: NSURLRequest,
        completionHandler: (NSURLRequest!) -> Void) {
            let newRequest : NSURLRequest? = request
            completionHandler(newRequest)
    }
    
    func URLSession(session: NSURLSession, downloadTask: NSURLSessionDownloadTask, didFinishDownloadingToURL location: NSURL) {
        session.finishTasksAndInvalidate()
    }
    
    func URLSession(session: NSURLSession, downloadTask: NSURLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {

    }
    
    func URLSession(session: NSURLSession, downloadTask: NSURLSessionDownloadTask, didResumeAtOffset fileOffset: Int64, expectedTotalBytes: Int64) {

    }
    
    func URLSession(session: NSURLSession, task: NSURLSessionTask, didCompleteWithError error: NSError?) {
        if error != nil {
            NSLog("ping session download failed with error \(error?.localizedDescription) response \(task.response)")
        }
    }
    
    func URLSessionDidFinishEventsForBackgroundURLSession(session: NSURLSession) {

    }
}