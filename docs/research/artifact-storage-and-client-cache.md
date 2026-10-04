# Artifact Delivery And Client Cache

## Status And Decision Trace

- Status: DEFERRED
- Evidence checked: 2026-07-28.
- Question: how should a hosted deployment deliver large spatial artifacts and
  use browser storage without making an evictable cache authoritative?
- Completed outputs: the
  [local data-root contract](../architecture/data-root.md) owns storage
  ports and local artifact safety; the
  [target architecture](../architecture/target-product.md) owns
  authoritative PostgreSQL/object-storage boundaries; and
  [ACQUIRE-001](../requirements/layer-acquisition.md) owns bounded acquisition
  and controlled artifact delivery.
- Remaining decision: select COG/range delivery, a tile pyramid, or a justified
  combination, together with cache quotas, retention, and offline packaging.
- Return before: implementing hosted artifact delivery, persistent offline
  access, automatic retention cleanup, or a pricing model based on reuse.

Browser and provider behavior must be rechecked against current documentation
and measured on supported clients before implementation.

## Browser Cache Boundary

OPFS, IndexedDB, and Cache API can hold a recoverable offline or hot-tile cache,
but quota, persistence, eviction, private-browsing behavior, origin scoping, and
site-data clearing remain outside application control.

Any selected cache design must:

- inspect estimated usage/quota and request persistence only when appropriate;
- enforce per-project and global limits with explicit cleanup behavior;
- contain only reconstructible artifacts or deliberate offline packages;
- expose download, offline-availability, eviction, and quota-failure states;
- never become the only copy of project state, overlays, manifests, or accepted
  acquisition records.

## Hosted Raster Delivery Candidates

| Candidate | Main value | Cost or constraint to validate |
| --- | --- | --- |
| Cloud Optimized GeoTIFF with overviews and HTTP Range | Preserves one georeferenced artifact while clients request needed byte ranges and overview levels. | Client support, authorization/range behavior, overview generation, CDN caching, and inefficient range patterns. |
| Derived XYZ/WMTS-style pyramid | Straightforward viewport requests, authorization, CDN use, and browser caching. | Creates many derived objects and requires a defined tile matrix, lifecycle, and invalidation model. |

Both may remain behind one frontend layer descriptor. Large vector sources need
the same bounded-delivery principle through AOI responses or vector tiles, not
unbounded nationwide GeoJSON.

## Reuse And Capacity Assumption

Capacity and pricing must assume no cross-user deduplication. AOI-specific
artifacts may share nothing unless their complete content is identical. Reuse
is more plausible on a stable provider-aligned tile grid keyed by source,
layer/style, source version, CRS, resolution or zoom, and tile coordinate.

Geographic clustering, upstream determinism, licence, and update cadence decide
the actual hit rate. Content-addressed or provider-grid reuse is an optimization
only after measurement; it must not justify an otherwise unaffordable baseline.

## Open Validation

- per-user and per-project quotas and their pricing boundary;
- retention, cold cleanup, and whether deleted artifacts are regenerated or
  archived;
- measured provider-grid/content-addressed reuse;
- exact range/tile authorization and cache policy;
- explicit offline export/import format and lifecycle.

Primary references:

- `https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria`
- `https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system`
- `https://web.dev/articles/origin-private-file-system`
- `https://docs.ogc.org/is/21-026/21-026.html`
- `https://openlayers.org/en/latest/examples/cog-overviews.html`
- `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RangeGETs.html`
