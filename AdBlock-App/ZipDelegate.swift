//
//  ZipDelegate.swift
//  AdBlock
//
//  Created by Brent Montrose on 9/24/15.
//  Copyright © 2015 AdBlock. All rights reserved.
//

import Foundation

class UnZipDelegate: NSObject, ZipArchiveDelegate {
    
    var unzippedJSONFilePath: String = ""
    
    func zipArchiveDidUnzipFileAtIndex(fileIndex: NSInteger, totalFiles: NSInteger, archivePath: String?, unzippedFilePath: String?) {
        NSLog("zipArchiveDidUnzipFileAtIndex fileInformation: \(unzippedFilePath) ")
        if let tempFilePath = unzippedFilePath {
            unzippedJSONFilePath = tempFilePath
        }
    }

}