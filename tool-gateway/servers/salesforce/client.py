import os

from dotenv import load_dotenv
from simple_salesforce import Salesforce


class SalesforceClient:

    def __init__(self):
        # Load .env from:
        # tool-gateway/servers/.env
        env_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            ".env"
        )

        load_dotenv(env_path)

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