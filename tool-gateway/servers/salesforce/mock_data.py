"""
Realistic Salesforce Mock Metadata & Datastore for Local Testing & Development.
Provides schemas, records, Apex classes, Flows, and field permissions.
"""

MOCK_SOBJECTS = {
    "Account": {
        "name": "Account",
        "label": "Account",
        "custom": False,
        "total_records": 120,
        "fields": [
            {
                "name": "Id",
                "label": "Account ID",
                "type": "id",
                "custom": False,
                "nillable": False,
                "createable": False,
                "updateable": False,
                "description": "System Record ID"
            },
            {
                "name": "Name",
                "label": "Account Name",
                "type": "string",
                "custom": False,
                "nillable": False,
                "createable": True,
                "updateable": True,
                "description": "Name of the account"
            },
            {
                "name": "AccountNumber",
                "label": "Account Number",
                "type": "string",
                "custom": False,
                "nillable": True,
                "createable": True,
                "updateable": True,
                "description": "Standard account number"
            },
            {
                "name": "Industry",
                "label": "Industry",
                "type": "picklist",
                "custom": False,
                "nillable": True,
                "createable": True,
                "updateable": True,
                "description": "Primary industry"
            },
            {
                "name": "CreatedDate",
                "label": "Created Date",
                "type": "datetime",
                "custom": False,
                "nillable": False,
                "createable": False,
                "updateable": False,
                "description": "Record creation timestamp"
            },
            {
                "name": "Legacy_Cleanup_Test__c",
                "label": "Legacy Cleanup Test",
                "type": "textarea",
                "custom": True,
                "nillable": True,
                "createable": True,
                "updateable": True,
                "description": "Old temporary test field from 2021 migration",
                "populated_records": 0
            },
            {
                "name": "Legacy_Notes__c",
                "label": "Legacy Notes",
                "type": "textarea",
                "custom": True,
                "nillable": True,
                "createable": True,
                "updateable": True,
                "description": "Notes from legacy CRM",
                "populated_records": 0
            },
            {
                "name": "Sync_Status__c",
                "label": "Sync Status",
                "type": "string",
                "custom": True,
                "nillable": True,
                "createable": True,
                "updateable": True,
                "description": "ETL sync status flag",
                "populated_records": 0
            },
            {
                "name": "Active_Discount__c",
                "label": "Active Discount",
                "type": "percent",
                "custom": True,
                "nillable": True,
                "createable": True,
                "updateable": True,
                "description": "Active negotiated customer discount percentage",
                "populated_records": 105
            }
        ]
    },
    "Contact": {
        "name": "Contact",
        "label": "Contact",
        "custom": False,
        "total_records": 85,
        "fields": [
            {
                "name": "Id",
                "label": "Contact ID",
                "type": "id",
                "custom": False,
                "nillable": False,
                "createable": False,
                "updateable": False
            },
            {
                "name": "FirstName",
                "label": "First Name",
                "type": "string",
                "custom": False,
                "nillable": True,
                "createable": True,
                "updateable": True
            },
            {
                "name": "LastName",
                "label": "Last Name",
                "type": "string",
                "custom": False,
                "nillable": False,
                "createable": True,
                "updateable": True
            },
            {
                "name": "Old_Fax_Number__c",
                "label": "Old Fax Number",
                "type": "phone",
                "custom": True,
                "nillable": True,
                "createable": True,
                "updateable": True,
                "description": "Obsolete fax number",
                "populated_records": 0
            }
        ]
    },
    "Opportunity": {
        "name": "Opportunity",
        "label": "Opportunity",
        "custom": False,
        "total_records": 210,
        "fields": [
            {
                "name": "Id",
                "label": "Opportunity ID",
                "type": "id",
                "custom": False,
                "nillable": False,
                "createable": False,
                "updateable": False
            },
            {
                "name": "Name",
                "label": "Opportunity Name",
                "type": "string",
                "custom": False,
                "nillable": False,
                "createable": True,
                "updateable": True
            },
            {
                "name": "Amount",
                "label": "Amount",
                "type": "currency",
                "custom": False,
                "nillable": True,
                "createable": True,
                "updateable": True
            },
            {
                "name": "Obsolete_Campaign_Code__c",
                "label": "Obsolete Campaign Code",
                "type": "string",
                "custom": True,
                "nillable": True,
                "createable": True,
                "updateable": True,
                "description": "Old Q1-2019 campaign tracker",
                "populated_records": 0
            }
        ]
    },
    "Custom_Invoice__c": {
        "name": "Custom_Invoice__c",
        "label": "Custom Invoice",
        "custom": True,
        "total_records": 45,
        "fields": [
            {
                "name": "Id",
                "label": "Invoice ID",
                "type": "id",
                "custom": False,
                "nillable": False,
                "createable": False,
                "updateable": False
            },
            {
                "name": "Invoice_Number__c",
                "label": "Invoice Number",
                "type": "string",
                "custom": True,
                "nillable": False,
                "createable": True,
                "updateable": True,
                "description": "Invoice number sequence",
                "populated_records": 45
            },
            {
                "name": "Temporary_Tax_Flag__c",
                "label": "Temporary Tax Flag",
                "type": "boolean",
                "custom": True,
                "nillable": True,
                "createable": True,
                "updateable": True,
                "description": "Temporary tax exempt indicator from 2022",
                "populated_records": 0
            }
        ]
    }
}

MOCK_APEX_CLASSES = [
    {
        "Id": "01p000000001AAA",
        "Name": "AccountService",
        "Body": """
public class AccountService {
    public static void processAccount(Account acc) {
        if (acc.Name != null) {
            System.debug('Processing ' + acc.Name);
            // Reference to Legacy_Notes__c
            String notes = acc.Legacy_Notes__c;
            System.debug('Found legacy notes: ' + notes);
        }
    }
}
"""
    },
    {
        "Id": "01p000000002BBB",
        "Name": "DiscountCalculator",
        "Body": """
public class DiscountCalculator {
    public static Decimal compute(Account a) {
        return a.Active_Discount__c != null ? a.Active_Discount__c * 100 : 0;
    }
}
"""
    }
]

MOCK_APEX_TRIGGERS = [
    {
        "Id": "01q000000001AAA",
        "Name": "AccountTrigger",
        "TableEnumOrId": "Account",
        "Body": """
trigger AccountTrigger on Account (before update) {
    for (Account acc : Trigger.new) {
        if (acc.Active_Discount__c > 50) {
            acc.addError('Discount too high');
        }
    }
}
"""
    }
]

MOCK_FLOWS = [
    {
        "Id": "301000000001AAA",
        "DeveloperName": "Account_Status_Automation",
        "Description": "Flow that reads and updates Sync_Status__c on Account updates",
        "Metadata": {
            "elements": [
                {"field": "Sync_Status__c", "operator": "EqualTo", "value": "PENDING"}
            ]
        }
    }
]

MOCK_LWCS = [
    {
        "Id": "0Rb000000001AAA",
        "DeveloperName": "accountHeaderCard",
        "Source": """
import { LightningElement, api } from 'lwc';
export default class AccountHeaderCard extends LightningElement {
    @api recordId;
    // Uses Active_Discount__c
    discountField = 'Active_Discount__c';
}
"""
    }
]
