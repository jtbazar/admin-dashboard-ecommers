# Order and delivery workflow

- JTBazar-owned items are identified by `order_items.seller_id IS NULL`.
- Vendor-owned items are identified by a non-null `seller_id`.
- Vendor products must remain out of customer delivery batches until the matching `vendor_order_pickups.status` is `picked_up`.
- Admins should confirm vendor collection before selecting those items for a delivery batch.
- The driver assignment and customer-delivery lifecycle remains separate from vendor preparation and JTBazar collection.
- Keep each customer order and its accounting records separate when multiple orders share one delivery batch.
