from .metadata import SalesforceMetadataService


def main():

    service = SalesforceMetadataService()

    result = service.describe_object("Account")

    print(f"Object: {result['object']}")
    print(f"Label: {result['label']}")
    print(f"Total fields: {len(result['fields'])}")
    print()

    target_field = "Legacy_Cleanup_Test__c"

    found = False

    for field in result["fields"]:
        if field["name"] == target_field:
            found = True

            print("FIELD FOUND")
            print("===========")
            print(f"Name: {field['name']}")
            print(f"Label: {field['label']}")
            print(f"Type: {field['type']}")
            print(f"Custom: {field['custom']}")
            print(f"Createable: {field['createable']}")
            print(f"Updateable: {field['updateable']}")

            break

    if not found:
        print("FIELD NOT FOUND")
        print("================")
        print(
            f"{target_field} does not exist "
            "on Account in the connected Salesforce org."
        )


if __name__ == "__main__":
    main()