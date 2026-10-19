import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from control_plane.database import Base, get_db
from control_plane.models import Agent, AgentStatus
from control_plane.routes.agents import router


@pytest.fixture
def client_and_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(Agent(agent_id="cleanup", name="Cleanup"))
        db.commit()
        app = FastAPI()
        app.include_router(router, prefix="/api/v1")
        app.dependency_overrides[get_db] = lambda: db
        with TestClient(app) as client:
            yield client, db
    engine.dispose()


@pytest.mark.parametrize("status", list(AgentStatus))
def test_json_status_update_is_persisted(client_and_db, status):
    client, db = client_and_db
    response = client.patch("/api/v1/agents/cleanup/status", json={"status": status.value})
    assert response.status_code == 200
    assert response.json() == {"agent_id": "cleanup", "status": status.value}
    db.expire_all()
    assert db.query(Agent).filter_by(agent_id="cleanup").one().status == status
    assert client.get("/api/v1/agents/cleanup").json()["status"] == status.value


def test_legacy_status_query_still_works(client_and_db):
    client, _ = client_and_db
    response = client.patch("/api/v1/agents/cleanup/status?status=PAUSED")
    assert response.status_code == 200
    assert response.json()["status"] == "PAUSED"


@pytest.mark.parametrize("payload, expected", [({}, 422), ({"status": "invalid"}, 400)])
def test_invalid_update_does_not_change_status(client_and_db, payload, expected):
    client, db = client_and_db
    response = client.patch("/api/v1/agents/cleanup/status", json=payload)
    assert response.status_code == expected
    db.expire_all()
    assert db.query(Agent).one().status == AgentStatus.IDLE


def test_unknown_agent_returns_404(client_and_db):
    client, _ = client_and_db
    response = client.patch("/api/v1/agents/missing/status", json={"status": "PAUSED"})
    assert response.status_code == 404


def test_missing_status_returns_422(client_and_db):
    client, _ = client_and_db
    assert client.patch("/api/v1/agents/cleanup/status").status_code == 422
