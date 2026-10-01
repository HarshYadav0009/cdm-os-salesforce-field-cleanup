import os

from dotenv import load_dotenv
from simple_salesforce import Salesforce


class SalesforceClient:

    def __init__(self):
        # Walk up to the project root to find .env
        current = os.path.dirname(os.path.abspath(__file__))
        for _ in range(5):  # max 5 levels up
            candidate = os.path.join(current, ".env")
            if os.path.isfile(candidate):
                load_dotenv(candidate)
                break
            current = os.path.dirname(current)
        else:
            load_dotenv()


        username = os.getenv("SF_USERNAME")
        password = os.getenv("SF_PASSWORD")
        security_token = os.getenv("SF_SECURITY_TOKEN")
        domain = os.getenv("SF_DOMAIN", "login")

        if not username:
            raise ValueError(
                "SF_USERNAME is missing from .env"
            )

        if not password:
            raise ValueError(
                "SF_PASSWORD is missing from .env"
            )

        if not security_token:
            raise ValueError(
                "SF_SECURITY_TOKEN is missing from .env"
            )

        self.sf = Salesforce(
            username=username,
            password=password,
            security_token=security_token,
            domain=domain
        )

    def query(self, soql: str):
        """
        Execute a read-only SOQL query.
        """
        return self.sf.query(soql)

    def describe(self, object_name: str):
        """
        Return Salesforce object metadata.
        """
        return getattr(
            self.sf,
            object_name
        ).describe()

    def tooling_query(self, soql: str) -> dict:
        """
        Execute a read-only SOQL query against the Salesforce Tooling API.
        Used to discover Apex, Flow, and other metadata dependencies.
        """
        return self.sf.toolingexecute(
            f"query/?q={soql.replace(' ', '+')}"
        )

    def search_apex_source(self, search_string: str) -> dict:
        """
        Search Apex class/trigger source bodies for a string using SOSL.
        Returns matching ApexClass and ApexTrigger records.
        """
        sosl = (
            f"FIND {{{search_string}}} IN ALL FIELDS "
            f"RETURNING ApexClass(Name, Body), ApexTrigger(Name, Body)"
        )
        return self.sf.search(sosl)