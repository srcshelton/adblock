//
//  Reachability.swift
//  AdBlock2
//
//  Created by Brent Montrose on 8/6/15.
//  Copyright © 2015 AdBlock. All rights reserved.
//

import Foundation
import SystemConfiguration

public class Reachability {

    //check if there's a WIFI connection
    //returns true or false
    func connectedToWIFINetwork() -> Bool {

        var zeroAddress = sockaddr_in()
        zeroAddress.sin_len = UInt8(sizeofValue(zeroAddress))
        zeroAddress.sin_family = sa_family_t(AF_INET)
        
        guard let defaultRouteReachability = withUnsafePointer(&zeroAddress, {
            SCNetworkReachabilityCreateWithAddress(nil, UnsafePointer($0))
        }) else {
            return false
        }
        
        var flags : SCNetworkReachabilityFlags = []
        if !SCNetworkReachabilityGetFlags(defaultRouteReachability, &flags)  {
            return false
        }
        
        let isReachable = flags.contains(.Reachable)
        let needsConnection = flags.contains(.ConnectionRequired)
        let isWWAN = flags.contains(.IsWWAN)
        if (isReachable && !needsConnection && !isWWAN){
            return true
        }
        return false
    }

    //check if there's a WAN / Celluar connection
    //returns true or false
    func connectedToWWANNetwork() -> Bool {

        var zeroAddress = sockaddr_in()
        zeroAddress.sin_len = UInt8(sizeofValue(zeroAddress))
        zeroAddress.sin_family = sa_family_t(AF_INET)

        guard let defaultRouteReachability = withUnsafePointer(&zeroAddress, {
            SCNetworkReachabilityCreateWithAddress(nil, UnsafePointer($0))
        }) else {
            return false
        }

        var flags : SCNetworkReachabilityFlags = []
        if !SCNetworkReachabilityGetFlags(defaultRouteReachability, &flags)  {
            return false
        }

        let isReachable = flags.contains(.Reachable)
        let needsConnection = flags.contains(.ConnectionRequired)
        let isWWAN = flags.contains(.IsWWAN)
        if (isReachable && !needsConnection && isWWAN){
            return true
        }
        return false
    }
}

