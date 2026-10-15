import os
import re
import logging
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

logger = logging.getLogger("salesforce.client")

# Attempt simple-salesforce import
try:
    from simple_salesforce import Salesforce, SalesforceLogin
    HAS_SIMPLE_SALESFORCE = True
except ImportError:
    HAS_SIMPLE_SALESFORCE = False

from .mock_data import (
    MOCK_SOBJECTS,
    MOCK_APEX_CLASSES,
    MOCK_APEX_TRIGGERS,
    MOCK_FLOWS,
    MOCK_LWCS,
)


class SalesforceClient:
    """
    Governed Salesforce Client.
    Supports:
    - Username + Password + Security Token (OAuth flow)
    - Connected App / JWT Bearer flow
    - Automated Mock / Local Sandbox mode when credentials are not configured,
      allowing tests and local development without cloud dependencies.
    """

    def __init__(self, mock_mode: Optional[bool] = None):
        # Load environment from root .env or servers/.env
        server_env = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), ".env"
        )
        root_env = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ".env"
        )
        if os.path.exists(server_env):
            load_dotenv(server_env)
        if os.path.exists(root_env):
            load_dotenv(root_env)

        env_mock = os.getenv("SF_MOCK_MODE", "").lower() in ("true", "1", "yes")
        if mock_mode is not None:
            self._mock_mode = mock_mode
        else:
            self._mock_mode = env_mock

        self.username = os.getenv("SF_USERNAME")
        self.password = os.getenv("SF_PASSWORD")
        self.security_token = os.getenv("SF_SECURITY_TOKEN")
        self.domain = os.getenv("SF_DOMAIN", "login")
        self.login_url = os.getenv("SF_LOGIN_URL", "https://login.salesforce.com")
        self.consumer_key = os.getenv("SF_CONSUMER_KEY")
        self.private_key_path = os.getenv("SF_PRIVATE_KEY_PATH")

        # In-memory mock state for mutations (backup, deprecation, rollback)
        self._mock_objects = {k: dict(v) for k, v in MOCK_SOBJECTS.items()}
        # Deep copy fields list
        for obj_name, obj_data in self._mock_objects.items():
            self._mock_objects[obj_name]["fields"] = [
                dict(f) for f in obj_data.get("fields", [])
            ]
        self._mock_fls_records: Dict[str, Dict[str, Any]] = {}

        self.sf = None

        # Check if real credentials exist
        has_user_pass = bool(self.username and self.password and self.security_token)
        has_jwt = bool(self.username and self.consumer_key and self.private_key_path and os.path.exists(self.private_key_path or ""))

        if not self._mock_mode and (has_user_pass or has_jwt):
            try:
                self._init_real_connection(has_jwt)
                logger.info(f"Connected to Salesforce org as {self.username}")
            except Exception as e:
                logger.warning(
                    f"Failed to connect to real Salesforce ({e}). Falling back to local Mock Sandbox mode."
                )
                self._mock_mode = True
        else:
            self._mock_mode = True
            logger.info("SalesforceClient initialized in Local Mock Sandbox mode.")

    def _init_real_connection(self, use_jwt: bool):
        if not HAS_SIMPLE_SALESFORCE:
            raise ImportError("simple-salesforce is required for live Salesforce connections.")

        if use_jwt:
            import jwt
            import datetime
            import requests

            with open(self.private_key_path, "r") as f:
                private_key = f.read()

            now = datetime.datetime.now(datetime.timezone.utc)
            claim = {
                "iss": self.consumer_key,
                "sub": self.username,
                "aud": self.login_url,
                "exp": int((now + datetime.timedelta(minutes=5)).timestamp()),
            }
            assertion = jwt.encode(claim, private_key, algorithm="RS256")
            token_url = f"{self.login_url.rstrip('/')}/services/oauth2/token"
            resp = requests.post(
                token_url,
                data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": assertion,
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            self.sf = Salesforce(
                instance_url=data["instance_url"],
                session_id=data["access_token"],
            )
        else:
            self.sf = Salesforce(
                username=self.username,
                password=self.password,
                security_token=self.security_token,
                domain=self.domain,
            )

    @property
    def is_mock(self) -> bool:
        return self._mock_mode

    def get_org_type(self) -> str:
        """Return the configured label or classify the connected Salesforce org."""
        return self.get_org_details()["org_type"]

    def get_org_details(self) -> Dict[str, Optional[str]]:
        """Return the configured type and Salesforce organization's display name."""
        configured_type = os.getenv("SF_ORG_TYPE", "").strip().casefold()
        org_type_labels = {
            "developer": "Developer",
            "uat": "UAT",
            "sandbox": "Sandbox",
            "production": "Production",
        }
        if configured_type:
            if configured_type not in org_type_labels:
                raise ValueError(
                    "SF_ORG_TYPE must be Developer, UAT, Sandbox, or Production."
                )
            org_type = org_type_labels[configured_type]
        elif self._mock_mode or self.sf is None:
            org_type = "Mock"
        else:
            org_type = ""

        if self._mock_mode or self.sf is None:
            return {"org_type": org_type or "Mock", "org_name": None}

        organizations = self.sf.query(
            "SELECT Name, IsSandbox, OrganizationType FROM Organization LIMIT 1"
        ).get("records", [])
        if not organizations:
            raise RuntimeError("Salesforce did not return organization details.")

        organization = organizations[0]
        if not org_type:
            if organization.get("IsSandbox"):
                org_type = "Sandbox"
            elif organization.get("OrganizationType") == "Developer Edition":
                org_type = "Developer"
            else:
                org_type = "Production"
        org_name = organization.get("Name")
        return {
            "org_type": org_type,
            "org_name": org_name.strip() if isinstance(org_name, str) and org_name.strip() else None,
        }

    def get_org_user_name(self) -> str | None:
        """Return the name of the user authenticated to this Salesforce session."""
        if self._mock_mode or self.sf is None:
            return None

        queries = []
        user_id = getattr(self.sf, "user_id", None)
        if isinstance(user_id, str) and re.fullmatch(
            r"[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?", user_id
        ):
            queries.append(f"SELECT Name FROM User WHERE Id = '{user_id}' LIMIT 1")

        if isinstance(self.username, str) and self.username.strip():
            escaped_username = self.username.strip().replace("\\", "\\\\").replace("'", "\\'")
            queries.append(
                "SELECT Name FROM User "
                f"WHERE Username = '{escaped_username}' LIMIT 1"
            )

        for soql in queries:
            try:
                records = self.sf.query(soql).get("records", [])
            except Exception as error:
                logger.warning("Unable to query the logged-in Salesforce user's name: %s", error)
                continue
            if records and isinstance(records[0].get("Name"), str):
                return records[0]["Name"]

        logger.warning("Salesforce did not return the logged-in user's full name.")
        return None

    def query(self, soql: str) -> Dict[str, Any]:
        """Execute a read-only SOQL query."""
        if not self._mock_mode and self.sf:
            return self.sf.query(soql)

        # Handle Mock SOQL queries
        soql_clean = soql.strip()

        # 1. Total records: SELECT COUNT(Id) total FROM Account
        count_match = re.search(
            r"SELECT\s+COUNT\((?:Id)?\)\s*(?:total|populated)?\s*FROM\s+([A-Za-z0-9_]+)(?:\s+WHERE\s+(.+))?",
            soql_clean,
            re.IGNORECASE,
        )
        if count_match:
            obj_name = count_match.group(1)
            where_clause = count_match.group(2)
            obj_data = self._mock_objects.get(obj_name)
            if not obj_data:
                return {"totalSize": 0, "done": True, "records": []}

            if not where_clause:
                total = obj_data.get("total_records", 0)
                return {
                    "totalSize": 1,
                    "done": True,
                    "records": [{"total": total}],
                }

            # Populated count query: WHERE Field__c != NULL
            field_match = re.search(r"([A-Za-z0-9_]+)\s*!=\s*NULL", where_clause, re.IGNORECASE)
            if field_match:
                f_name = field_match.group(1)
                for fld in obj_data.get("fields", []):
                    if fld.get("name", "").lower() == f_name.lower():
                        pop_count = fld.get("populated_records", 0)
                        return {
                            "totalSize": 1,
                            "done": True,
                            "records": [{"populated": pop_count}],
                        }
            return {"totalSize": 1, "done": True, "records": [{"populated": 0}]}

        # Standard record query fallback
        limit_match = re.search(r"FROM\s+([A-Za-z0-9_]+)", soql_clean, re.IGNORECASE)
        if limit_match:
            obj_name = limit_match.group(1)
            obj_data = self._mock_objects.get(obj_name)
            if obj_data:
                sample = [{"Id": f"00100000000{i}AAA", "Name": f"Sample {obj_name} {i}"} for i in range(1, 4)]
                return {"totalSize": len(sample), "done": True, "records": sample}

        return {"totalSize": 0, "done": True, "records": []}

    def tooling_query(self, soql: str) -> Dict[str, Any]:
        """Execute a SOQL query against Salesforce Tooling API."""
        if not self._mock_mode and self.sf:
            return self.sf.restful(f"tooling/query/?q={soql}")

        soql_clean = soql.strip()
        if "ApexClass" in soql_clean:
            return {"totalSize": len(MOCK_APEX_CLASSES), "done": True, "records": MOCK_APEX_CLASSES}
        if "ApexTrigger" in soql_clean:
            return {"totalSize": len(MOCK_APEX_TRIGGERS), "done": True, "records": MOCK_APEX_TRIGGERS}
        if "Flow" in soql_clean:
            return {"totalSize": len(MOCK_FLOWS), "done": True, "records": MOCK_FLOWS}
        if "LightningComponentBundle" in soql_clean or "AuraDefinition" in soql_clean:
            return {"totalSize": len(MOCK_LWCS), "done": True, "records": MOCK_LWCS}

        return {"totalSize": 0, "done": True, "records": []}

    def describe(self, object_name: str) -> Dict[str, Any]:
        """Return Salesforce object metadata."""
        if not self._mock_mode and self.sf:
            return getattr(self.sf, object_name).describe()

        for name, data in self._mock_objects.items():
            if name.lower() == object_name.lower():
                return data

        raise ValueError(f"SObject '{object_name}' not found in Salesforce org.")

    def describe_global(self) -> Dict[str, Any]:
        """Return global list of all SObjects."""
        if not self._mock_mode and self.sf:
            return self.sf.describe()

        sobjects_summary = []
        for name, data in self._mock_objects.items():
            sobjects_summary.append({
                "name": data["name"],
                "label": data["label"],
                "custom": data["custom"],
                "queryable": True,
                "updateable": True,
                "createable": True,
            })
        return {"sobjects": sobjects_summary}

    def delete_custom_field(self, object_name: str, field_name: str) -> None:
        """Delete a custom field using Salesforce Metadata API."""
        if not self._mock_mode and self.sf:
            self.sf.mdapi.CustomField.delete([f"{object_name}.{field_name}"])
            return

        object_data = self._mock_objects.get(object_name)
        if object_data is None:
            raise ValueError(f"SObject '{object_name}' not found in Salesforce org.")

        fields = object_data.get("fields", [])
        matching_field = next(
            (field for field in fields if field.get("name", "").lower() == field_name.lower()),
            None,
        )
        if matching_field is None:
            raise ValueError(
                f"Field '{field_name}' not found on object '{object_name}'."
            )
        if not matching_field.get("custom", False):
            raise ValueError(f"Standard Salesforce field '{field_name}' cannot be deleted.")

        fields.remove(matching_field)

    def update_field_description(self, object_name: str, field_name: str, new_description: str) -> bool:
        """Update field description (used for deprecation tagging)."""
        if not self._mock_mode and self.sf:
            full_name = f"{object_name}.{field_name}"
            metadata = self.sf.mdapi.CustomField.read([full_name])
            if not metadata:
                return False
            metadata.description = new_description
            self.sf.mdapi.CustomField.update([metadata])
            return True

        # In-memory mock update
        obj_data = self._mock_objects.get(object_name)
        if obj_data:
            for fld in obj_data.get("fields", []):
                if fld["name"].lower() == field_name.lower():
                    fld["description"] = new_description
                    return True
        return False

    def update_field_permissions(self, object_name: str, field_name: str, readable: bool, editable: bool) -> bool:
        """Update mock Field-Level Security state; live updates are not implemented."""
        if not self._mock_mode and self.sf:
            raise NotImplementedError(
                "Live Salesforce field-level security updates are not implemented."
            )

        key = f"{object_name}.{field_name}"
        self._mock_fls_records[key] = {
            "readable": readable,
            "editable": editable,
        }
        return True