import re


def validate_salesforce_identifier(
    value: str
) -> str:

    if not value:
        raise ValueError(
            "Salesforce identifier cannot be empty"
        )

    value = value.strip()

    if not re.match(
        r"^[A-Za-z][A-Za-z0-9_]*$",
        value
    ):
        raise ValueError(
            f"Invalid Salesforce identifier: {value}"
        )

    return value