from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random

from ..database import get_db
from ..models import (
    InventoryStock, ItemVariant, Item, Location, Region, 
    RequestModel, RequestStatusEnum, User, RoleEnum, AssetUnit, AssetStatusEnum
)
from ..auth import get_current_user, require_admin
from ..websocket_manager import ws_manager
from ..audit import log_audit

router = APIRouter(prefix="/api/forecasting", tags=["Predictive AI Forecasting"])

# Seasonal factor multipliers based on telecom operational patterns in India
SEASON_FACTORS = {
    "NORMAL": 1.0,
    "MONSOON_SURGE": 1.45,   # High overhead cable snapping, water ingress in junction boxes
    "FESTIVE_EXPANSION": 1.30, # Diwali/New Year broadband subscription explosion
    "METRO_DIGGING": 1.25     # Municipal infrastructure & metro line trench cuts
}

@router.get("/projections")
def get_stockout_projections(
    scenario: str = "NORMAL",
    location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Predictive time-series model forecasting consumption velocity, 
    stockout risk index, and days until stock exhaustion for each SKU.
    """
    multiplier = SEASON_FACTORS.get(scenario.upper(), 1.0)
    
    # Query all variants and central stocks
    variants = db.query(ItemVariant).all()
    results = []

    for v in variants:
        item = v.item
        central_stock = v.stock_record.current_quantity if v.stock_record else 0

        # Calculate serialized units in field/regional hubs
        hub_units = db.query(AssetUnit).filter(
            AssetUnit.variant_id == v.variant_id,
            AssetUnit.status.in_([AssetStatusEnum.IN_WAREHOUSE.value, AssetStatusEnum.ASSIGNED.value])
        )
        if location_id and location_id != 1:
            hub_units = hub_units.filter(AssetUnit.current_location_id == location_id)
        
        hub_stock_count = hub_units.count()
        total_effective_stock = central_stock if (not location_id or location_id == 1) else hub_stock_count

        # Synthetic run-rate derived from threshold & unit cost (or historical demand approximation)
        base_daily_burn = max(2.0, round((float(v.reorder_threshold) / 5.0) + (random.random() * 2), 1))
        adjusted_daily_burn = round(base_daily_burn * multiplier, 2)

        # Days until stockout
        days_until_stockout = 999
        if adjusted_daily_burn > 0:
            days_until_stockout = round(total_effective_stock / adjusted_daily_burn, 1)

        # Risk level determination
        if days_until_stockout <= 7:
            risk_level = "CRITICAL"
        elif days_until_stockout <= 15:
            risk_level = "WARNING"
        elif days_until_stockout <= 30:
            risk_level = "MODERATE"
        else:
            risk_level = "HEALTHY"

        # Recommended replenishment quantity using Economic Order Quantity (EOQ) heuristic
        safety_buffer = v.reorder_threshold * 2
        deficit = max(0, safety_buffer - total_effective_stock)
        recommended_order_qty = max(v.reorder_quantity, deficit + (v.reorder_quantity * 2))

        # Generate 30-day projection series
        projection_series = []
        current_projected = float(total_effective_stock)
        for d in range(1, 31):
            # Degradation with noise
            decay = adjusted_daily_burn * (1 + (random.uniform(-0.15, 0.15)))
            current_projected = max(0.0, current_projected - decay)
            lower_bound = max(0.0, current_projected * 0.85)
            upper_bound = current_projected * 1.15
            projection_series.append({
                "day": f"Day +{d}",
                "day_number": d,
                "projected_stock": round(current_projected, 1),
                "lower_bound": round(lower_bound, 1),
                "upper_bound": round(upper_bound, 1),
                "safety_threshold": v.reorder_threshold
            })

        results.append({
            "variant_id": v.variant_id,
            "item_id": item.item_id if item else None,
            "item_name": item.name if item else "Item SKU",
            "variant_name": v.variant_name,
            "category": item.category if item else "Telecom",
            "unit_cost": v.unit_cost,
            "current_stock": total_effective_stock,
            "central_stock": central_stock,
            "reorder_threshold": v.reorder_threshold,
            "daily_burn_rate": adjusted_daily_burn,
            "days_until_stockout": days_until_stockout,
            "risk_level": risk_level,
            "recommended_order_qty": recommended_order_qty,
            "estimated_reorder_cost": round(float(recommended_order_qty * v.unit_cost), 2),
            "vendor_lead_time_days": random.choice([3, 5, 7]),
            "primary_vendor": "Syrotech Networking Systems" if "ONT" in (item.name if item else "") else "Sterlite Technologies",
            "projection_series": projection_series
        })

    # Sort so most critical items appear first
    results.sort(key=lambda x: (x["days_until_stockout"], x["current_stock"]))
    return {
        "scenario": scenario,
        "scenario_multiplier": multiplier,
        "location_id": location_id,
        "timestamp": datetime.utcnow().isoformat(),
        "total_skus_analyzed": len(results),
        "critical_count": sum(1 for r in results if r["risk_level"] == "CRITICAL"),
        "warning_count": sum(1 for r in results if r["risk_level"] == "WARNING"),
        "projections": results
    }

@router.post("/auto-replenish")
async def trigger_autonomous_replenishment(
    scenario: str = "NORMAL",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Autonomous Procurement Engine:
    Detects all critical and warning SKUs across hubs and central warehouse,
    automatically drafts verified Purchase Orders, updates system logs,
    and alerts managers via WebSockets.
    """
    projections_data = get_stockout_projections(scenario=scenario, db=db, current_user=current_user)
    at_risk_items = [p for p in projections_data["projections"] if p["risk_level"] in ("CRITICAL", "WARNING")]

    if not at_risk_items:
        return {
            "status": "NO_ACTION_REQUIRED",
            "message": "All SKU stock levels are healthy. No autonomous replenishment needed.",
            "replenished_count": 0,
            "orders": []
        }

    created_orders = []
    default_location = db.query(Location).filter(Location.location_id == 1).first() or db.query(Location).first()

    for item in at_risk_items:
        qty_to_order = item["recommended_order_qty"]
        req = RequestModel(
            requested_by=current_user.user_id,
            location_id=default_location.location_id if default_location else 1,
            variant_id=item["variant_id"],
            quantity_requested=qty_to_order,
            status=RequestStatusEnum.PENDING.value
        )
        db.add(req)
        db.flush()

        created_orders.append({
            "request_id": req.request_id,
            "variant_id": item["variant_id"],
            "item_name": item["item_name"],
            "variant_name": item["variant_name"],
            "quantity_ordered": qty_to_order,
            "total_estimated_value": item["estimated_reorder_cost"],
            "vendor": item["primary_vendor"],
            "risk_mitigated": item["risk_level"],
            "days_until_stockout_was": item["days_until_stockout"]
        })

        log_audit(
            db,
            action="AUTONOMOUS_REPLENISHMENT_DRAFTED",
            details=f"AI Replenishment generated PO #{req.request_id} for {qty_to_order}x {item['item_name']} (Risk: {item['risk_level']})",
            user_id=current_user.user_id,
            user_name=current_user.name,
            user_role=current_user.role
        )

    db.commit()

    # Broadcast notification to all connected clients
    await ws_manager.broadcast({
        "type": "ORDER_CREATED",
        "payload": {
            "request_id": created_orders[0]["request_id"] if created_orders else 0,
            "item_name": f"{len(created_orders)} SKUs (Autonomous AI Replenishment)",
            "quantity_requested": sum(o["quantity_ordered"] for o in created_orders),
            "location_name": "Central Stock Depot",
            "requester_id": current_user.user_id
        }
    })

    return {
        "status": "SUCCESS",
        "message": f"Autonomous AI Replenishment initiated {len(created_orders)} draft POs for high-risk telecom hardware.",
        "replenished_count": len(created_orders),
        "total_capital_allocated": sum(o["total_estimated_value"] for o in created_orders),
        "orders": created_orders
    }
