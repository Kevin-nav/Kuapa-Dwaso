# Permissions

Owns shared role and action permission logic.

Product permissions should live here rather than being scattered as inline role checks across apps.

The active role model is `farmer`, `warehouse_agent`, `buyer`, `transporter`,
and `admin`. Permission keys and transition helpers are organized around
warehouses, inventory batches, reservations, buyer orders, sales, dispatches,
fees, disputes, notifications, users, and audit logs.
