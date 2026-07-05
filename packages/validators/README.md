# Validators

Owns shared validation schemas for forms, API routes, Convex mutations, webhook payloads, and SMS command boundaries.

Validation should be reused across layers where practical.

The foundation validators expose role, status, fee, quantity, and money guards
for the warehouse-domain contracts. Two-way SMS command validation is not part of
the MVP foundation.
