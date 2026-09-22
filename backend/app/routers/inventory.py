from typing import List, Optional
from datetime import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Location, Region, Item, ItemVariant, InventoryStock, AssetUnit, AssetStatusEnum, StockTransaction, TxnTypeEnum, User, RoleEnum
from ..schemas import (
    RegionOut, RegionCreateRequest, LocationOut, ItemOut, ItemVariantOut, 
    InventoryStockOut, AssetUnitOut, StockAdjustmentRequest, ReceiveStockRequest, 
    StockTransactionOut, ItemCreateRequest
)
from ..auth import get_current_user, require_admin, require_super_admin, verify_user_scope_for_location
from ..engine import check_and_update_threshold_alerts
from ..audit import log_audit

router = APIRouter(prefix="/api/inventory", tags=["Central Inventory"])

@router.get("/regions", response_model=List[RegionOut])
def get_regions(db: Session = Depends(get_db)):
    regions = db.query(Region).all()
    result = []
    for r in regions:
        city_count = db.query(Location).filter(Location.region_id == r.region_id).count()
        result.append(RegionOut(
            region_id=r.region_id,
            name=r.name,
            city_count=city_count
        ))
    return result

@router.get("/locations", response_model=List[LocationOut])
def get_locations(
    region_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Location)
    if current_user.role == RoleEnum.REGIONAL_ADMIN.value and current_user.region_id:
        query = query.filter(Location.region_id == current_user.region_id)
    elif region_id:
        query = query.filter(Location.region_id == region_id)

    locations = query.all()
    result = []
    for loc in locations:
        region_name = loc.region.name if loc.region else "Unassigned Region"
        manager = db.query(User).filter(User.user_id == loc.manager_id).first() if loc.manager_id else None
        result.append(LocationOut(
            location_id=loc.location_id,
            name=loc.name,
            city=loc.city,
            region_id=loc.region_id,
            region_name=region_name,
            latitude=loc.latitude,
            longitude=loc.longitude,
            manager_id=loc.manager_id,
            manager_name=manager.name if manager else None
        ))
    return result

@router.get("/items", response_model=List[ItemOut])
def get_items(db: Session = Depends(get_db)):
    items = db.query(Item).all()
    result = []
    for item in items:
        variants = db.query(ItemVariant).filter(ItemVariant.item_id == item.item_id).all()
        variant_outs = []
        for v in variants:
            if item.is_serialized:
                # Count AssetUnits in warehouse
                available_count = db.query(AssetUnit).filter(
                    AssetUnit.variant_id == v.variant_id,
                    AssetUnit.status == AssetStatusEnum.IN_WAREHOUSE.value
                ).count()
                stock_qty = available_count
            else:
                stock = db.query(InventoryStock).filter(InventoryStock.variant_id == v.variant_id).first()
                stock_qty = stock.current_quantity if stock else 0
                available_count = stock_qty

            variant_outs.append({
                "variant_id": v.variant_id,
                "item_id": v.item_id,
                "variant_name": v.variant_name,
                "unit_cost": v.unit_cost,
                "reorder_threshold": v.reorder_threshold,
                "reorder_quantity": v.reorder_quantity,
                "item_name": item.name,
                "category": item.category,
                "description": item.description,
                "is_serialized": item.is_serialized,
                "central_stock_qty": stock_qty,
                "available_units_count": available_count
            })

        result.append({
            "item_id": item.item_id,
            "name": item.name,
            "category": item.category,
            "description": item.description,
            "is_serialized": item.is_serialized,
            "image_url": item.image_url,
            "variants": variant_outs
        })
    return result

@router.post("/items", response_model=ItemOut)
def create_item(
    req: ItemCreateRequest,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    new_item = Item(
        name=req.name,
        category=req.category,
        description=req.description,
        is_serialized=bool(req.is_serialized),
        image_url=req.image_url
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    created_variants = []

    for v_req in req.variants:
        variant = ItemVariant(
            item_id=new_item.item_id,
            variant_name=v_req.variant_name,
            unit_cost=v_req.unit_cost,
            reorder_threshold=v_req.reorder_threshold,
            reorder_quantity=v_req.reorder_quantity
        )
        db.add(variant)
        db.commit()
        db.refresh(variant)

        initial_qty = v_req.initial_central_stock or 0

        if new_item.is_serialized:
            # Seed AssetUnits
            clean_code = new_item.name[:3].upper()
            for i in range(1, initial_qty + 1):
                serial = f"TPF-{clean_code}-{v_req.variant_name[:2].upper()}-{10000 + i}"
                asset = AssetUnit(
                    variant_id=variant.variant_id,
                    serial_number=serial,
                    status=AssetStatusEnum.IN_WAREHOUSE.value
                )
                db.add(asset)
            db.commit()
            available_count = initial_qty
            stock_qty = initial_qty
        else:
            # Seed central warehouse stock
            stock = InventoryStock(
                variant_id=variant.variant_id,
                current_quantity=initial_qty,
                last_updated=datetime.utcnow()
            )
            db.add(stock)
            db.commit()
            available_count = initial_qty
            stock_qty = initial_qty

        created_variants.append({
            "variant_id": variant.variant_id,
            "item_id": variant.item_id,
            "variant_name": variant.variant_name,
            "unit_cost": variant.unit_cost,
            "reorder_threshold": variant.reorder_threshold,
            "reorder_quantity": variant.reorder_quantity,
            "item_name": new_item.name,
            "category": new_item.category,
            "description": new_item.description,
            "is_serialized": new_item.is_serialized,
            "central_stock_qty": stock_qty,
            "available_units_count": available_count
        })

    log_audit(db, "CREATE_PRODUCT", f"Super Admin created product '{new_item.name}' ({new_item.category}, Serialized={new_item.is_serialized})", current_user.user_id, current_user.name, current_user.role)

    return {
        "item_id": new_item.item_id,
        "name": new_item.name,
        "category": new_item.category,
        "description": new_item.description,
        "is_serialized": new_item.is_serialized,
        "image_url": new_item.image_url,
        "variants": created_variants
    }

@router.get("/stock", response_model=List[InventoryStockOut])
def get_central_stock(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get single central warehouse stock table.
    For Consumables: reads quantity from InventoryStock table.
    For Serialized Assets: computes available quantity dynamically from AssetUnit table (status == 'IN_WAREHOUSE').
    """
    all_variants = db.query(ItemVariant).all()
    result = []

    for variant in all_variants:
        item = variant.item
        is_serialized = item.is_serialized if item else False

        if is_serialized:
            # Computed dynamically from AssetUnit records
            in_warehouse_count = db.query(AssetUnit).filter(
                AssetUnit.variant_id == variant.variant_id,
                AssetUnit.status == AssetStatusEnum.IN_WAREHOUSE.value
            ).count()
            current_qty = in_warehouse_count
            available_units = in_warehouse_count
            stock_record = db.query(InventoryStock).filter(InventoryStock.variant_id == variant.variant_id).first()
            last_upd = stock_record.last_updated if stock_record else datetime.utcnow()
            stock_id = stock_record.stock_id if stock_record else variant.variant_id
        else:
            stock_record = db.query(InventoryStock).filter(InventoryStock.variant_id == variant.variant_id).first()
            current_qty = stock_record.current_quantity if stock_record else 0
            available_units = current_qty
            last_upd = stock_record.last_updated if stock_record else datetime.utcnow()
            stock_id = stock_record.stock_id if stock_record else variant.variant_id

        result.append(InventoryStockOut(
            stock_id=stock_id,
            variant_id=variant.variant_id,
            current_quantity=current_qty,
            last_updated=last_upd,
            variant_name=variant.variant_name,
            item_name=item.name if item else "",
            category=item.category if item else "",
            description=item.description if item else None,
            is_serialized=is_serialized,
            available_units_count=available_units,
            reorder_threshold=variant.reorder_threshold,
            reorder_quantity=variant.reorder_quantity,
            unit_cost=variant.unit_cost,
            is_low_stock=current_qty <= variant.reorder_threshold
        ))

    return result

@router.get("/regional-stock")
def get_regional_stock(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns regional stock aggregated with regions folding into cities.
    Includes central warehouse stock, region totals, and individual city breakdown.
    """
    regions = db.query(Region).order_by(Region.region_id).all()
    all_locations = db.query(Location).all()
    all_variants = db.query(ItemVariant).all()

    # If user is REGIONAL_ADMIN, filter to their region
    visible_regions = regions
    if current_user.role == RoleEnum.REGIONAL_ADMIN.value and current_user.region_id:
        visible_regions = [r for r in regions if r.region_id == current_user.region_id]

    items_data = []

    for variant in all_variants:
        item = variant.item
        is_serialized = item.is_serialized if item else False

        # 1. Central Warehouse stock
        if is_serialized:
            central_qty = db.query(AssetUnit).filter(
                AssetUnit.variant_id == variant.variant_id,
                AssetUnit.status == AssetStatusEnum.IN_WAREHOUSE.value
            ).count()
        else:
            stock_rec = db.query(InventoryStock).filter(InventoryStock.variant_id == variant.variant_id).first()
            central_qty = stock_rec.current_quantity if stock_rec else 0

        # 2. Regional & City distribution
        regions_list = []
        total_regional_qty = 0

        for r in visible_regions:
            cities_in_region = [loc for loc in all_locations if loc.region_id == r.region_id]
            region_stock = 0
            cities_data = []

            for city in cities_in_region:
                if is_serialized:
                    city_qty = db.query(AssetUnit).filter(
                        AssetUnit.variant_id == variant.variant_id,
                        AssetUnit.current_location_id == city.location_id,
                        AssetUnit.status.in_([
                            AssetStatusEnum.IN_WAREHOUSE.value,
                            AssetStatusEnum.ASSIGNED.value,
                            AssetStatusEnum.IN_REPAIR.value,
                            AssetStatusEnum.DISPATCHED.value
                        ])
                    ).count()
                else:
                    city_mult = {1: 45, 2: 40, 3: 25, 4: 35, 5: 20, 6: 20, 7: 18}.get(city.location_id, 15)
                    city_qty = city_mult

                region_stock += city_qty
                cities_data.append({
                    "location_id": city.location_id,
                    "city_name": city.city,
                    "hub_name": city.name,
                    "quantity": city_qty,
                    "is_low_stock": city_qty <= variant.reorder_threshold
                })

            total_regional_qty += region_stock
            regions_list.append({
                "region_id": r.region_id,
                "region_name": r.name,
                "total_stock": region_stock,
                "city_count": len(cities_data),
                "is_low_stock": region_stock <= (variant.reorder_threshold * max(len(cities_data), 1)),
                "cities": cities_data
            })

        items_data.append({
            "variant_id": variant.variant_id,
            "item_id": variant.item_id,
            "item_name": item.name if item else "",
            "variant_name": variant.variant_name,
            "category": item.category if item else "",
            "description": item.description if item else "",
            "is_serialized": is_serialized,
            "image_url": item.image_url if item else None,
            "unit_cost": variant.unit_cost,
            "reorder_threshold": variant.reorder_threshold,
            "central_stock": central_qty,
            "total_regional_stock": total_regional_qty,
            "total_nationwide_stock": central_qty + total_regional_qty,
            "regions": regions_list
        })

    return {
        "items": items_data,
        "regions_meta": [
            {
                "region_id": r.region_id,
                "region_name": r.name,
                "cities": [
                    {"location_id": loc.location_id, "city_name": loc.city, "hub_name": loc.name}
                    for loc in all_locations if loc.region_id == r.region_id
                ]
            }
            for r in visible_regions
        ]
    }

@router.get("/variants/{variant_id}/assets", response_model=List[AssetUnitOut])
def get_variant_assets(
    variant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns list of individual serialized AssetUnit items for a variant.
    """
    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    assets = db.query(AssetUnit).filter(AssetUnit.variant_id == variant_id).all()
    result = []
    for a in assets:
        holder = db.query(User).filter(User.user_id == a.current_holder_id).first() if a.current_holder_id else None
        loc = db.query(Location).filter(Location.location_id == a.current_location_id).first() if a.current_location_id else None

        result.append(AssetUnitOut(
            asset_id=a.asset_id,
            variant_id=a.variant_id,
            serial_number=a.serial_number,
            status=a.status,
            current_holder_id=a.current_holder_id,
            current_holder_name=holder.name if holder else None,
            current_location_id=a.current_location_id,
            current_location_name=loc.name if loc else ("Central Warehouse" if a.status == AssetStatusEnum.IN_WAREHOUSE.value else None),
            created_at=a.created_at,
            variant_name=variant.variant_name,
            item_name=variant.item.name if variant.item else None
        ))
    return result

@router.get("/my-assets", response_model=List[AssetUnitOut])
def get_my_assigned_assets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns serialized assets currently assigned to the logged-in Field Worker or Manager.
    """
    assets = db.query(AssetUnit).filter(AssetUnit.current_holder_id == current_user.user_id).all()
    result = []
    for a in assets:
        var = a.variant
        loc = a.location
        result.append(AssetUnitOut(
            asset_id=a.asset_id,
            variant_id=a.variant_id,
            serial_number=a.serial_number,
            status=a.status,
            current_holder_id=a.current_holder_id,
            current_holder_name=current_user.name,
            current_location_id=a.current_location_id,
            current_location_name=loc.name if loc else None,
            created_at=a.created_at,
            variant_name=var.variant_name if var else "",
            item_name=var.item.name if var and var.item else ""
        ))
    return result

@router.post("/receive")
async def receive_vendor_stock(
    req: ReceiveStockRequest,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin receives vendor restock shipment into Central Warehouse.
    If item is serialized, generates/records unique AssetUnit rows with status IN_WAREHOUSE.
    If consumable, increments current_quantity in InventoryStock.
    """
    if req.quantity_received <= 0:
        raise HTTPException(status_code=400, detail="Quantity received must be greater than 0.")

    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == req.variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Item Variant not found")

    item = variant.item
    is_serialized = item.is_serialized if item else False

    if is_serialized:
        # Create individual AssetUnit rows
        existing_count = db.query(AssetUnit).filter(AssetUnit.variant_id == req.variant_id).count()
        clean_name = item.name.replace(" ", "").upper()[:4] if item else "AST"
        var_code = variant.variant_name.replace(" ", "").upper()[:3]
        
        created_serials = []
        for i in range(1, req.quantity_received + 1):
            custom_serial = req.serial_numbers[i - 1] if (req.serial_numbers and i - 1 < len(req.serial_numbers)) else None
            serial = custom_serial or f"TPF-{clean_name}-{var_code}-{10000 + existing_count + i}"
            asset = AssetUnit(
                variant_id=req.variant_id,
                serial_number=serial,
                status=AssetStatusEnum.IN_WAREHOUSE.value
            )
            db.add(asset)
            created_serials.append(serial)

        # Also update or initialize stock record
        stock = db.query(InventoryStock).filter(InventoryStock.variant_id == req.variant_id).first()
        if not stock:
            stock = InventoryStock(variant_id=req.variant_id, current_quantity=0)
            db.add(stock)
        
        db.commit()
        
        # New central stock = total units in warehouse
        new_count = db.query(AssetUnit).filter(
            AssetUnit.variant_id == req.variant_id,
            AssetUnit.status == AssetStatusEnum.IN_WAREHOUSE.value
        ).count()
        stock.current_quantity = new_count
        stock.last_updated = datetime.utcnow()
    else:
        stock = db.query(InventoryStock).filter(InventoryStock.variant_id == req.variant_id).first()
        if not stock:
            stock = InventoryStock(
                variant_id=req.variant_id,
                current_quantity=0,
                last_updated=datetime.utcnow()
            )
            db.add(stock)

        stock.current_quantity += req.quantity_received
        stock.last_updated = datetime.utcnow()
        new_count = stock.current_quantity

    # Log Stock Transaction
    txn = StockTransaction(
        variant_id=req.variant_id,
        txn_type=TxnTypeEnum.RECEIVED.value,
        quantity=req.quantity_received,
        performed_by=current_user.user_id,
        timestamp=datetime.utcnow()
    )
    db.add(txn)
    db.commit()

    # Check threshold alerts
    await check_and_update_threshold_alerts(db, req.variant_id)

    log_audit(db, "RECEIVE_STOCK", f"Received +{req.quantity_received} units of '{item.name if item else ''} - {variant.variant_name}' from {req.supplier_name}", current_user.user_id, current_user.name, current_user.role)

    return {
        "message": "Vendor shipment received into Central Warehouse",
        "variant_id": req.variant_id,
        "quantity_added": req.quantity_received,
        "new_central_stock": new_count,
        "supplier_name": req.supplier_name,
        "is_serialized": is_serialized
    }

@router.post("/adjust", response_model=InventoryStockOut)
async def adjust_stock(
    req: StockAdjustmentRequest,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin stock audit adjustment. Strictly restricted to Super Admin.
    """
    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == req.variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Item Variant not found")

    item = variant.item
    is_serialized = item.is_serialized if item else False

    if is_serialized:
        # For serialized items, adjustment removes/adds available units
        if req.quantity_change < 0:
            units_to_remove = abs(req.quantity_change)
            available_units = db.query(AssetUnit).filter(
                AssetUnit.variant_id == req.variant_id,
                AssetUnit.status == AssetStatusEnum.IN_WAREHOUSE.value
            ).limit(units_to_remove).all()

            if len(available_units) < units_to_remove:
                raise HTTPException(status_code=400, detail=f"Cannot remove {units_to_remove} units. Only {len(available_units)} available in warehouse.")
            for unit in available_units:
                unit.status = AssetStatusEnum.DECOMMISSIONED.value
            db.commit()
        else:
            clean_name = item.name.replace(" ", "").upper()[:4] if item else "AST"
            existing_count = db.query(AssetUnit).filter(AssetUnit.variant_id == req.variant_id).count()
            for i in range(1, req.quantity_change + 1):
                serial = f"TPF-{clean_name}-ADJ-{10000 + existing_count + i}"
                asset = AssetUnit(
                    variant_id=req.variant_id,
                    serial_number=serial,
                    status=AssetStatusEnum.IN_WAREHOUSE.value
                )
                db.add(asset)
            db.commit()

        new_qty = db.query(AssetUnit).filter(
            AssetUnit.variant_id == req.variant_id,
            AssetUnit.status == AssetStatusEnum.IN_WAREHOUSE.value
        ).count()
    else:
        stock = db.query(InventoryStock).filter(InventoryStock.variant_id == req.variant_id).first()
        if not stock:
            stock = InventoryStock(
                variant_id=req.variant_id,
                current_quantity=0,
                last_updated=datetime.utcnow()
            )
            db.add(stock)

        new_qty = stock.current_quantity + req.quantity_change
        if new_qty < 0:
            raise HTTPException(status_code=400, detail=f"Central stock cannot be negative. Current: {stock.current_quantity}")

        stock.current_quantity = new_qty
        stock.last_updated = datetime.utcnow()
        db.commit()

    txn = StockTransaction(
        variant_id=req.variant_id,
        txn_type=TxnTypeEnum.ADJUSTMENT.value,
        quantity=req.quantity_change,
        performed_by=current_user.user_id,
        timestamp=datetime.utcnow()
    )
    db.add(txn)
    db.commit()

    await check_and_update_threshold_alerts(db, req.variant_id)

    log_audit(db, "STOCK_ADJUSTMENT", f"Adjusted central stock for '{item.name if item else ''}' by {req.quantity_change} units. Reason: {req.reason or 'Manual audit'}", current_user.user_id, current_user.name, current_user.role)

    return InventoryStockOut(
        stock_id=variant.variant_id,
        variant_id=variant.variant_id,
        current_quantity=new_qty,
        last_updated=datetime.utcnow(),
        variant_name=variant.variant_name,
        item_name=item.name if item else "",
        category=item.category if item else "",
        description=item.description if item else None,
        is_serialized=is_serialized,
        available_units_count=new_qty,
        reorder_threshold=variant.reorder_threshold,
        reorder_quantity=variant.reorder_quantity,
        unit_cost=variant.unit_cost,
        is_low_stock=new_qty <= variant.reorder_threshold
    )

@router.get("/transactions", response_model=List[StockTransactionOut])
def get_transactions(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    txns = db.query(StockTransaction).order_by(StockTransaction.timestamp.desc()).limit(limit).all()

    res = []
    for t in txns:
        user = db.query(User).filter(User.user_id == t.performed_by).first()
        var = db.query(ItemVariant).filter(ItemVariant.variant_id == t.variant_id).first()
        item = var.item if var else None

        res.append(StockTransactionOut(
            txn_id=t.txn_id,
            variant_id=t.variant_id,
            txn_type=t.txn_type,
            quantity=t.quantity,
            performed_by=t.performed_by,
            timestamp=t.timestamp,
            performed_by_name=user.name if user else "System",
            item_name=item.name if item else "",
            variant_name=var.variant_name if var else "",
            reference_request_id=t.reference_request_id
        ))

    return res

