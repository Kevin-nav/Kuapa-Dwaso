# Main Product App

This app is for the main authenticated product served from a subdomain such as `app.domain.com`.

It owns farmer, buyer, and transporter self-service workflows. Warehouse-agent operations belong in `apps/ops`. It should prioritize low-bandwidth pages, route-level loading, simple farmer-facing UI, and shared packages for UI, validation, permissions, and domain types.
