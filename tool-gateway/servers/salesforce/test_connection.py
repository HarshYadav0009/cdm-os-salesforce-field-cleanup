try:
    from .client import SalesforceClient
except ImportError:
    from client import SalesforceClient



def main():

    print("Connecting to Salesforce...")

    client = SalesforceClient()

    print("Salesforce connection successful!")

    result = client.query(
        "SELECT Id, Name FROM Account LIMIT 5"
    )

    print()
    print("Account records:")
    print(result)


if __name__ == "__main__":
    main()