"""Database setup — SQLite for dev, PostgreSQL for production.

SQLite works immediately with zero config. Switch to PostgreSQL by
changing DATABASE_URL in .env to:
  DATABASE_URL=postgresql://user:pass@localhost:5432/atlas
  pip install asyncpg
"""
import os
import json
from datetime import datetime
from typing import Optional
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./atlas.db")

# SQLite needs check_same_thread=False
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="planner")  # admin, planner, viewer
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)


class PlanningRecord(Base):
    __tablename__ = "planning_records"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)  # nullable for unauthenticated requests
    user_email = Column(String(255), nullable=True)

    # Request
    location = Column(String(500))
    premises = Column(Integer, nullable=True)
    budget = Column(Float)
    timeline = Column(String(50))
    priority = Column(String(50))
    terrain_type = Column(String(50))
    polygon_json = Column(Text, nullable=True)  # JSON string of polygon coords

    # Results summary
    total_cost = Column(Float, nullable=True)
    cost_per_premise = Column(Float, nullable=True)
    route_length_km = Column(Float, nullable=True)
    premises_connected = Column(Integer, nullable=True)
    risk_score = Column(Float, nullable=True)
    recommended_scenario = Column(String(255), nullable=True)
    building_source = Column(String(100), nullable=True)
    detected_buildings = Column(Integer, nullable=True)

    # Full result (JSON)
    full_result_json = Column(Text, nullable=True)

    # Status
    status = Column(String(50), default="pending")  # pending, running, completed, failed, approved, rejected
    error_message = Column(Text, nullable=True)

    # Approval
    approval_status = Column(String(50), default="pending_review")  # pending_review, approved, rejected
    approved_by = Column(String(255), nullable=True)
    approval_comment = Column(Text, nullable=True)
    approved_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    user_email = Column(String(255), nullable=True)
    action = Column(String(100))  # plan_created, plan_completed, price_edited, report_exported, etc.
    resource_id = Column(Integer, nullable=True)  # planning_record id
    details = Column(Text, nullable=True)  # JSON
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for FastAPI endpoints."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def save_planning_record(db: Session, request_data: dict, result_data: dict = None,
                         user_id: int = None, user_email: str = None,
                         status: str = "completed", error: str = None,
                         duration: float = None) -> PlanningRecord:
    """Save a planning request and its result to the database."""
    record = PlanningRecord(
        user_id=user_id,
        user_email=user_email,
        location=request_data.get("location", ""),
        premises=request_data.get("premises"),
        budget=request_data.get("budget", 0),
        timeline=request_data.get("timeline", "standard"),
        priority=request_data.get("priority", ""),
        terrain_type=request_data.get("terrain_type", "urban"),
        polygon_json=json.dumps(request_data.get("polygon")) if request_data.get("polygon") else None,
        status=status,
        error_message=error,
        duration_seconds=duration,
        created_at=datetime.utcnow(),
    )

    if result_data:
        record.total_cost = result_data.get("cost", {}).get("total_cost")
        record.cost_per_premise = result_data.get("cost", {}).get("cost_per_premise")
        record.route_length_km = result_data.get("route", {}).get("route_length_km")
        record.premises_connected = result_data.get("route", {}).get("premises_connected")
        record.risk_score = result_data.get("risk", {}).get("overall_risk_score")
        record.recommended_scenario = result_data.get("decision", {}).get("recommended_scenario", {}).get("name")
        area = result_data.get("route", {}).get("area_analysis") or {}
        record.building_source = area.get("building_source")
        record.detected_buildings = area.get("detected_buildings")
        record.full_result_json = json.dumps(result_data)
        record.completed_at = datetime.utcnow()

    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def log_audit(db: Session, action: str, user_id: int = None, user_email: str = None,
              resource_id: int = None, details: dict = None, ip: str = None):
    """Log an action for audit trail."""
    entry = AuditLog(
        user_id=user_id, user_email=user_email, action=action,
        resource_id=resource_id,
        details=json.dumps(details) if details else None,
        ip_address=ip,
    )
    db.add(entry)
    db.commit()
