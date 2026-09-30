from .client import SalesforceClient
from .validators import (
    validate_salesforce_identifier
)


class SalesforceMetadataService:

    def __init__(self, client=None):

        self.client = (
            client
            if client is not None
            else SalesforceClient()
        )

    def describe_object(
        self,
        object_name: str
    ):

        if not object_name:
            raise ValueError(
                "object_name is required"
            )

        object_name = validate_salesforce_identifier(
            object_name
        )

        description = self.client.describe(
            object_name
        )

        fields = []

        for field in description.get(
            "fields",
            []
        ):

            fields.append({
                "name": field.get("name"),
                "label": field.get("label"),
                "type": field.get("type"),
                "length": field.get("length"),
                "precision": field.get("precision"),
                "scale": field.get("scale"),
                "nillable": field.get("nillable"),
                "createable": field.get("createable"),
                "updateable": field.get("updateable"),
                "calculated": field.get("calculated"),
                "custom": field.get("custom")
            })

        return {
            "object": description.get("name"),
            "label": description.get("label"),
            "custom": description.get("custom"),
            "fields": fields
        }