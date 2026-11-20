# Backend API Implementation Queue

This technical queue tracks accepted product API slices needed by the frontend
that the repository owner still needs to implement manually in the backend. It
is not a product requirement and does not add entries to the requirements
portfolio. Add a slice only after both its frontend capability and API contract
are accepted. The accepted OpenAPI contract is authoritative for operations and
schemas; do not invent or duplicate methods, paths, or payloads here.

| Frontend capability | Frontend entry point | Accepted contract | Backend state |
| --- | --- | --- | --- |

The frontend currently exercises a provisional interactive project/search/map
slice against the simulator. The [provisional OpenAPI](../architecture/contracts/interactive-v1.openapi.yaml)
and [provider integration handoff](../architecture/public-api-integration.md)
are available for owner-backend implementation and review. They are not recorded
as an accepted production slice until contract acceptance. Source integration,
provider limits, imagery normalization and durable persistence remain backend
work; passing simulator checks does not establish those capabilities.

Update this queue when an accepted frontend slice enters delivery and when its
backend implementation is completed or the slice no longer needs it. Each
entry should link to the frontend use and accepted OpenAPI operation(s), and
note that manual backend implementation is pending, including any blocker.
Remove completed or obsolete entries after implementation has been verified
against its contract; keep the contract itself in its authoritative artifact.