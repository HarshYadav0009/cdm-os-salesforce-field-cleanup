"""
CDM-OS — API Routes: Tools

Read-only endpoints for browsing registered tool definitions and their tiers.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from control_plane.database import get_db
from control_plane.models import ToolDefinition
from control_plane.schemas import ToolResponse

router = APIRouter(prefix="/tools", tags=["Tools"])


@router.get("/", response_model=list[ToolResponse])
def list_tools(db: Session = Depends(get_db)):
    """List all registered tools with their tier classifications."""
    return db.query(ToolDefinition).order_by(ToolDefinition.tier).all()
