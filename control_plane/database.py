"""
CDM-OS — Database Connection & Session Management

Provides:
- SQLAlchemy engine and session factory
- Dependency injection for FastAPI route handlers
- Direct session context manager for non-API code (agent runtime, scripts)
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase
from contextlib import contextmanager
from typing import Generator

from control_plane.config import settings


# ── Engine & Session Factory ──────────────────────────────────
engine = create_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Auto-reconnect stale connections
    echo=(settings.CDM_ENV == "development"),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── ORM Base ──────────────────────────────────────────────────
class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


# ── FastAPI Dependency ────────────────────────────────────────
def get_db() -> Generator[Session, None, None]:
    """
    Yield a DB session for a single request, then close it.
    Usage in FastAPI:
        @router.get("/")
        def read(db: Session = Depends(get_db)): ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Context Manager for scripts / agent runtime ──────────────
@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """
    Usage:
        with get_db_session() as db:
            db.query(...)
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
