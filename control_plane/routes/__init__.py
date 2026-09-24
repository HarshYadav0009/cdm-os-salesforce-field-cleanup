"""
CDM-OS — API Routes Package
"""

from control_plane.routes.proposals import router as proposals_router
from control_plane.routes.agents import router as agents_router
from control_plane.routes.tools import router as tools_router
from control_plane.routes.audit import router as audit_router

__all__ = ["proposals_router", "agents_router", "tools_router", "audit_router"]
