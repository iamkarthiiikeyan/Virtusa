"""ATLAS v2 — FastAPI Application with Auth, DB, PDF, Queue support."""
import logging
import time
import json
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import ALLOWED_ORIGINS
from app.models.schemas import PlanningRequest, PlanningResponse
from app.graph.workflow import PlanningPipeline
from app.db.database import init_db, get_db, save_planning_record, log_audit, PlanningRecord, AuditLog, User
from app.auth.auth import (
    hash_password, verify_password, create_token, get_current_user,
    require_role, create_default_admin,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

pipeline = PlanningPipeline()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ATLAS v2 Backend starting...")
    init_db()
    db = next(get_db())
    if create_default_admin(db):
        logger.info("Default admin created: admin@atlas.local / admin123")
    db.close()
    yield
    logger.info("ATLAS v2 Backend shutting down...")


app = FastAPI(title="ATLAS AI Backend", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health ───

@app.get("/")
async def root():
    return {"message": "ATLAS AI Backend Running", "version": "2.0.0",
            "endpoints": {"plan": "POST /api/v1/plan", "routes": "POST /api/v1/routes/compare",
                          "auth": "POST /api/v1/auth/login", "records": "GET /api/v1/records",
                          "report": "GET /api/v1/report/{id}/pdf", "health": "GET /health"}}

@app.get("/health")
async def health(db: Session = Depends(get_db)):
    record_count = db.query(PlanningRecord).count()
    user_count = db.query(User).count()
    return {"status": "healthy", "version": "2.0.0", "records": record_count, "users": user_count}


# ─── Authentication ───

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str
    role: str = "planner"

@app.post("/api/v1/auth/login")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")
    user.last_login = datetime.utcnow()
    db.commit()
    token = create_token({"sub": user.email, "role": user.role, "name": user.name})
    log_audit(db, "login", user.id, user.email)
    return {"token": token, "user": {"email": user.email, "name": user.name, "role": user.role}}

@app.post("/api/v1/auth/register")
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=req.email, name=req.name, hashed_password=hash_password(req.password), role=req.role)
    db.add(user)
    db.commit()
    log_audit(db, "register", user.id, user.email)
    token = create_token({"sub": user.email, "role": user.role, "name": user.name})
    return {"token": token, "user": {"email": user.email, "name": user.name, "role": user.role}}

@app.get("/api/v1/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    if not user:
        return {"user": None, "authenticated": False}
    return {"user": {"email": user.email, "name": user.name, "role": user.role}, "authenticated": True}

@app.get("/api/v1/auth/users")
async def list_users(admin: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    users = db.query(User).all()
    return {"users": [{"id": u.id, "email": u.email, "name": u.name, "role": u.role,
                        "is_active": u.is_active, "last_login": str(u.last_login) if u.last_login else None}
                       for u in users]}


# ─── Planning API (with DB storage) ───

@app.post("/api/v1/plan")
async def plan_network(request: PlanningRequest, req: Request,
                       user: Optional[User] = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """Run the full AI planning pipeline. Results are stored in the database."""
    start = time.time()
    request_data = request.model_dump()

    logger.info(f"Planning: {request.location}, {request.premises} premises, ₹{request.budget:,.0f}"
                f" [user: {user.email if user else 'anonymous'}]")

    # Save initial record
    record = save_planning_record(db, request_data, user_id=user.id if user else None,
                                   user_email=user.email if user else None, status="running")

    try:
        result = await pipeline.run(request)
        duration = time.time() - start

        # Update record with results
        record.status = "completed"
        record.duration_seconds = round(duration, 2)
        record.total_cost = result.get("cost", {}).get("total_cost")
        record.cost_per_premise = result.get("cost", {}).get("cost_per_premise")
        record.route_length_km = result.get("route", {}).get("route_length_km")
        record.premises_connected = result.get("route", {}).get("premises_connected")
        record.risk_score = result.get("risk", {}).get("overall_risk_score")
        record.recommended_scenario = result.get("decision", {}).get("recommended_scenario", {}).get("name")
        area_info = result.get("route", {}).get("area_analysis") or {}
        record.building_source = area_info.get("building_source")
        record.detected_buildings = area_info.get("detected_buildings")
        record.full_result_json = json.dumps(result)
        record.completed_at = datetime.utcnow()
        db.commit()

        log_audit(db, "plan_completed", user.id if user else None, user.email if user else None,
                  record.id, {"duration": duration, "cost": record.total_cost})

        # Add record ID to result for frontend reference
        result["record_id"] = record.id
        return result
    except Exception as e:
        duration = time.time() - start
        record.status = "failed"
        record.error_message = str(e)
        record.duration_seconds = round(duration, 2)
        db.commit()
        logger.error(f"Pipeline failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Legacy endpoint
@app.post("/plan-network")
async def plan_legacy(request: PlanningRequest, req: Request,
                      user: Optional[User] = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    return await plan_network(request, req, user, db)


# ─── Records (history with audit trail) ───

@app.get("/api/v1/records")
async def list_records(limit: int = 50, offset: int = 0,
                       user: Optional[User] = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    query = db.query(PlanningRecord)
    # Non-admin users only see their own records
    if user and user.role != "admin":
        query = query.filter(PlanningRecord.user_email == user.email)
    records = query.order_by(PlanningRecord.created_at.desc()).offset(offset).limit(limit).all()
    total = query.count()
    return {
        "records": [{
            "id": r.id, "location": r.location, "premises": r.premises_connected,
            "total_cost": r.total_cost, "route_km": r.route_length_km,
            "risk_score": r.risk_score, "recommended": r.recommended_scenario,
            "building_source": r.building_source, "detected_buildings": r.detected_buildings,
            "status": r.status, "user_email": r.user_email,
            "approval_status": r.approval_status, "approved_by": r.approved_by,
            "approval_comment": r.approval_comment,
            "duration": r.duration_seconds, "created_at": str(r.created_at),
        } for r in records],
        "total": total, "limit": limit, "offset": offset,
    }

@app.get("/api/v1/records/all")
async def list_all_records(limit: int = 50, offset: int = 0,
                           admin: User = Depends(require_role("admin")),
                           db: Session = Depends(get_db)):
    """Admin-only: returns ALL records from all users."""
    records = db.query(PlanningRecord).order_by(PlanningRecord.created_at.desc()).offset(offset).limit(limit).all()
    total = db.query(PlanningRecord).count()
    return {
        "records": [{
            "id": r.id, "location": r.location, "premises": r.premises_connected,
            "total_cost": r.total_cost, "route_km": r.route_length_km,
            "risk_score": r.risk_score, "recommended": r.recommended_scenario,
            "building_source": r.building_source, "detected_buildings": r.detected_buildings,
            "status": r.status, "user_email": r.user_email,
            "approval_status": r.approval_status, "approved_by": r.approved_by,
            "approval_comment": r.approval_comment,
            "duration": r.duration_seconds, "created_at": str(r.created_at),
        } for r in records],
        "total": total, "limit": limit, "offset": offset,
    }

@app.get("/api/v1/records/{record_id}")
async def get_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(PlanningRecord).filter(PlanningRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    result = json.loads(record.full_result_json) if record.full_result_json else None
    return {"record": {"id": record.id, "location": record.location, "status": record.status,
                        "approval_status": record.approval_status, "approved_by": record.approved_by,
                        "approval_comment": record.approval_comment,
                        "created_at": str(record.created_at), "user_email": record.user_email},
            "result": result}


# ─── Approval API ───

class ApprovalRequest(BaseModel):
    action: str  # "approve" or "reject"
    comment: str = ""

@app.post("/api/v1/records/{record_id}/approve")
async def approve_record(record_id: int, req: ApprovalRequest,
                         admin: User = Depends(require_role("admin")),
                         db: Session = Depends(get_db)):
    """Admin approves or rejects a planning record."""
    record = db.query(PlanningRecord).filter(PlanningRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if req.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    record.approval_status = "approved" if req.action == "approve" else "rejected"
    record.approved_by = admin.email
    record.approval_comment = req.comment
    record.approved_at = datetime.utcnow()
    db.commit()

    log_audit(db, f"plan_{req.action}d", admin.id, admin.email, record_id,
              {"comment": req.comment})

    return {"message": f"Record {record_id} {req.action}d", "approval_status": record.approval_status}


# ─── PDF Report Export ───

@app.get("/api/v1/report/{record_id}/pdf")
async def export_pdf(record_id: int, db: Session = Depends(get_db),
                     user: Optional[User] = Depends(get_current_user)):
    record = db.query(PlanningRecord).filter(PlanningRecord.id == record_id).first()
    if not record or not record.full_result_json:
        raise HTTPException(status_code=404, detail="Record not found or no results")

    result = json.loads(record.full_result_json)
    request_data = {"location": record.location, "premises": record.premises,
                    "budget": record.budget, "terrain_type": record.terrain_type}

    try:
        from app.reports.pdf_report import generate_report_pdf
        pdf_bytes = generate_report_pdf(result, request_data)
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab not installed. Run: pip install reportlab")

    log_audit(db, "report_exported", user.id if user else None, user.email if user else None, record_id)

    filename = f"ATLAS_Report_{record.location.replace(' ', '_')}_{record.id}.pdf"
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})

# Also allow PDF export from current result (without saving to DB first)
@app.post("/api/v1/report/pdf")
async def export_pdf_direct(result: dict):
    """Generate PDF from a result dict directly (no DB record needed)."""
    try:
        from app.reports.pdf_report import generate_report_pdf
        pdf_bytes = generate_report_pdf(result, {})
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab not installed")
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": 'attachment; filename="ATLAS_Report.pdf"'})


# ─── Audit Log ───

@app.get("/api/v1/audit")
async def get_audit_log(limit: int = 100, admin: User = Depends(require_role("admin")),
                        db: Session = Depends(get_db)):
    entries = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return {"entries": [{"id": e.id, "user_email": e.user_email, "action": e.action,
                          "resource_id": e.resource_id, "created_at": str(e.created_at)}
                         for e in entries]}


# ─── Route Comparison ───

@app.post("/api/v1/routes/compare")
async def compare_routes(request: dict):
    from app.agents.route_comparison_agent import RouteComparisonAgent
    agent = RouteComparisonAgent()
    origin_lat = request.get("origin_lat")
    origin_lon = request.get("origin_lon")
    dest_lat = request.get("dest_lat")
    dest_lon = request.get("dest_lon")
    if not all([origin_lat, origin_lon, dest_lat, dest_lon]):
        raise HTTPException(status_code=400, detail="origin_lat, origin_lon, dest_lat, dest_lon required")
    return await agent.execute(origin_lat, origin_lon, dest_lat, dest_lon, request.get("terrain_type", "urban"))


# ─── Scenario Templates & Risk Factors ───

@app.get("/api/v1/scenarios/templates")
async def get_scenario_templates():
    from app.agents.scenario_agent import ScenarioAgent
    return {"templates": [{"id": k, "name": v["name"], "description": v["description"]}
                           for k, v in ScenarioAgent.TEMPLATES.items()]}

@app.get("/api/v1/risk/factors")
async def get_risk_factors():
    from app.agents.risk_agent import RiskAgent
    return {"factors": [{"id": k, "base_score": v["base_score"]} for k, v in RiskAgent.RISK_RULES.items()]}


# ─── Hardware Catalog Management ───

@app.get("/api/v1/catalog")
async def get_catalog():
    """Get current hardware catalog prices."""
    import json as j
    from pathlib import Path
    catalog_path = Path(__file__).parent / "data" / "hardware_catalog_inr.json"
    with open(catalog_path) as f:
        return j.load(f)

@app.put("/api/v1/catalog")
async def update_catalog(updates: dict, admin: User = Depends(require_role("admin")),
                         db: Session = Depends(get_db)):
    """Admin updates hardware catalog prices."""
    import json as j
    from pathlib import Path
    catalog_path = Path(__file__).parent / "data" / "hardware_catalog_inr.json"
    with open(catalog_path) as f:
        catalog = j.load(f)

    # Apply updates: {category: {item_key: {price_inr: new_price}}}
    changed = 0
    for category, items in updates.items():
        if category in catalog.get("catalog", {}):
            for item_key, new_data in items.items():
                if item_key in catalog["catalog"][category]:
                    if "price_inr" in new_data:
                        old_price = catalog["catalog"][category][item_key].get("price_inr")
                        catalog["catalog"][category][item_key]["price_inr"] = new_data["price_inr"]
                        changed += 1

    with open(catalog_path, 'w') as f:
        j.dump(catalog, f, indent=2)

    log_audit(db, "catalog_updated", admin.id, admin.email, details={"changes": changed})
    return {"message": f"Updated {changed} items", "catalog": catalog}


# ─── Queue Status (for monitoring) ───

@app.get("/api/v1/queue/status")
async def queue_status(db: Session = Depends(get_db)):
    pending = db.query(PlanningRecord).filter(PlanningRecord.status == "pending").count()
    running = db.query(PlanningRecord).filter(PlanningRecord.status == "running").count()
    completed = db.query(PlanningRecord).filter(PlanningRecord.status == "completed").count()
    failed = db.query(PlanningRecord).filter(PlanningRecord.status == "failed").count()
    return {"pending": pending, "running": running, "completed": completed, "failed": failed,
            "total": pending + running + completed + failed}
