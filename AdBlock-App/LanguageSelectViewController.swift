//
//  LanguageSelectViewController.swift
//  AdBlock
//
//  Created by Brent Montrose on 10/7/15.
//  Copyright © 2015 AdBlock. All rights reserved.
//

//
//  ViewController.swift
//  SwiftUIPickerFormatted
//
//  Created by Steven Lipton on 10/20/14.
//  Copyright (c) 2014 MakeAppPie.Com. All rights reserved.
//  Updated to Swift 2.0  9/15/15 SJL

import UIKit

class LanguageSelectVC: UIViewController, UITableViewDataSource, UITableViewDelegate {
    
    var window: UIWindow?
    
    var selectedRow:NSIndexPath?
    
    let myFilters = MyFilters()

    var tableRows:[(displayText: String, id: String)] = []
    
    override func viewWillDisappear(animated: Bool) {
        super.viewWillDisappear(animated)
        if (self.isMovingFromParentViewController()) {
            if let currentRow = selectedRow {
                if ((currentRow.row > 0) && (tableRows[currentRow.row].id != "none")) {
                    myFilters.setNewLanguageByFilterListID(tableRows[currentRow.row].id)
                } else {
                    myFilters.setNewLanguageByFilterListID(nil)
                }
                let stack = self.navigationController?.viewControllers.count
                if stack >= 1 {
                    // The first item on the stack is the SettingsVC (not self), so we only use 0 to access it
                    // then reload the data in the table to show the updated language
                    if let tempSettingsVC = self.navigationController?.viewControllers[0] as? SettingsVC {
                        tempSettingsVC.tableView.reloadData()
                    }
                }
            }
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        self.navigationItem.title = NSLocalizedString("languages", comment:"languagesetting")
        self.navigationController?.navigationBar.tintColor = UIColor.whiteColor()
    
        tableRows.append((displayText: NSLocalizedString("filtereasylist_plus_bulgarian", comment:"language"), id: "easylist_plus_bulgarian"))
        tableRows.append((displayText: NSLocalizedString("filterczech", comment:"language"),id: "czech"))
        tableRows.append((displayText: NSLocalizedString("filterdanish", comment:"language"),id: "danish"))
        tableRows.append((displayText: NSLocalizedString("filtereasylist_plus_german", comment:"language"),id: "easylist_plus_german"))
        tableRows.append((displayText: NSLocalizedString("filtereasylist_plus_greek", comment:"language"),id: "easylist_plus_greek"))
        tableRows.append((displayText: NSLocalizedString("filtereasylist_plus_finnish", comment:"language"),id: "easylist_plus_finnish"))
        tableRows.append((displayText: NSLocalizedString("filtereasylist_plus_french", comment:"language"),id: "easylist_plus_french"))
        tableRows.append((displayText: NSLocalizedString("filterisraeli", comment:"language"),id: "israeli"))
        tableRows.append((displayText: NSLocalizedString("filterhungarian", comment:"language"),id: "hungarian"))
        tableRows.append((displayText: NSLocalizedString("filteritalian", comment:"language"),id: "italian"))
        tableRows.append((displayText: NSLocalizedString("filtereasylist_plus_indonesian", comment:"language"),id: "easylist_plus_indonesian"))
        tableRows.append((displayText: NSLocalizedString("filterjapanese", comment:"language"),id: "japanese"))
        tableRows.append((displayText: NSLocalizedString("filtereasylist_plun_korean", comment:"language"),id: "easylist_plun_korean"))
        tableRows.append((displayText: NSLocalizedString("filterlatvian", comment:"language"),id: "latvian"))
        tableRows.append((displayText: NSLocalizedString("filterdutch", comment:"language"),id: "dutch"))
        tableRows.append((displayText: NSLocalizedString("filtereasylist_plus_polish", comment:"language"),id: "easylist_plus_polish"))
        tableRows.append((displayText: NSLocalizedString("filtereasylist_plus_romanian", comment:"language"),id: "easylist_plus_romanian"))
        tableRows.append((displayText: NSLocalizedString("filterrussian", comment:"language"),id: "russian"))
        tableRows.append((displayText: NSLocalizedString("filterswedish", comment:"language"),id: "swedish"))
        tableRows.append((displayText: NSLocalizedString("filterturkish", comment:"language"),id: "turkish"))
        tableRows.append((displayText: NSLocalizedString("filterchinese", comment:"language"), id: "chinese"))
        tableRows.sortInPlace { $0.0 == $1.0 ? $0.1 < $1.1 : $0.0 < $1.0 }
        //add "None" to the begging no matter what
        tableRows.insert((displayText: NSLocalizedString("None", comment:"language"), id: "none"), atIndex: 0)
    }
    
    override func preferredStatusBarStyle() -> UIStatusBarStyle {
        return UIStatusBarStyle.LightContent
    }
    
    //MARK: - Delegates and data sources
    //MARK: Data Sources
    func tableView(tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return tableRows.count
    }
    
    func tableView(tableView: UITableView, cellForRowAtIndexPath indexPath: NSIndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCellWithIdentifier("textCell")
        cell!.textLabel?.text = tableRows[indexPath.row].displayText
        // if there is a selected row, add a checkmark
        if let currentRow = selectedRow {
            if (indexPath.row == currentRow.row) {
                cell?.accessoryType = UITableViewCellAccessoryType.Checkmark
            } else {
                cell?.accessoryType = UITableViewCellAccessoryType.None
            }
        } else {
            // if there isn't a selected row, add a checkmark for the current language
            if let currentFLS = myFilters.getLanguageSubScription() {
                if (currentFLS.id == tableRows[indexPath.row].id) {
                    cell?.accessoryType = UITableViewCellAccessoryType.Checkmark
                    selectedRow = indexPath
                }
            } else {
                if (tableRows[indexPath.row].id == "none") {
                    selectedRow = indexPath
                    cell?.accessoryType = UITableViewCellAccessoryType.Checkmark
                }
            }
        }
        return cell!
    }
    
    // add a checkmark and save the index
    func tableView(tableView: UITableView, didSelectRowAtIndexPath indexPath: NSIndexPath) {
        if let currentRow = selectedRow {
            // remove the old check mark, if it is set
            tableView.cellForRowAtIndexPath(currentRow)?.accessoryType = UITableViewCellAccessoryType.None
        }
        tableView.cellForRowAtIndexPath(indexPath)?.accessoryType = UITableViewCellAccessoryType.Checkmark
        selectedRow = indexPath
    }
}
