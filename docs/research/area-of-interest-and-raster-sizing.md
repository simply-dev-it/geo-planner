# Area Of Interest And Raster Sizing

## Status And Decision Trace

- Status: DEFERRED
- Evidence checked: 2026-07-28, without downloading map snapshots.
- Question: which provider limits, calculations, and failure cases must inform
  bounded parcel-based AOI resolution and raster acquisition?
- Completed outputs:
  [PROJECT-001](../requirements/projects-and-aoi.md) owns parcel AOI behavior;
  [ACQUIRE-001](../requirements/layer-acquisition.md) owns raster acquisition;
  [Spatial Evidence domain](../domain/spatial-evidence.md) owns AOI meaning;
  and [acquisition flow](../architecture/acquisition-and-artifact.md) owns
  streaming, validation, and artifact promotion boundaries.
- Remaining questions: whether users manipulate an expert bbox directly or
  only context geometry, and how surrounding parcels are displayed without
  becoming project subjects.
- Return before: implementing the first ULDK/WMS acquisition slice, changing a
  provider descriptor, or relying on capabilities newer than this evidence.

Provider capabilities and operational behavior must be checked again against
the exact service version before implementation. The values below are dated
evidence, not permanent provider guarantees.

## Provider Metadata Evidence

| Service checked | Advertised image dimensions | Consequence |
| --- | --- | --- |
| GUGiK ORTO WMS 1.3.0 | `MaxWidth=4096`, `MaxHeight=4096` | A product may use a lower tile cap but must not exceed the advertised limit. |
| KIEG WMS 1.3.0 | `MaxWidth=4096`, `MaxHeight=4096` | Bind limits to the exact descriptor and capabilities version used. |
| KIUT WMS 1.3.0 | `MaxWidth=4096`, `MaxHeight=4096` | Bind limits to the exact descriptor and capabilities version used. |
| KINA WMS 1.1.1 | No maximum width/height advertised | Treat dimensions as unknown and apply a conservative product cap; do not inherit another provider's limit. |

The ORTO catalog contained source datasets with different native ground sample
distances, including 0.25 and 0.5 metre pixels. Resolution therefore belongs
to the selected layer or coverage descriptor, not one universal project value.
ULDK documentation described parcel lookup and aggregate-area operations but
did not publish a throughput budget. Parcel count, timeout, retry, and
concurrency still require product-owned bounds and implementation validation.

Evidence sources:

- `https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`
- `https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`
- `https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaUzbrojeniaTerenu?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`
- `https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaNumeracjiAdresowej?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1`
- `https://uldk.gugik.gov.pl/opis.html`
- `https://www.geoportal.gov.pl/pl/dane/ortofotomapa-orto/`

## Raster Calculation

For an acquisition bbox `[minX, minY, maxX, maxY]` in a metric CRS and target
resolution `r` metres per pixel:

```text
widthPx  = ceil((maxX - minX) / r)
heightPx = ceil((maxY - minY) / r)
```

The request planner then applies the exact source descriptor's supported CRS
and axis order, width and height, total pixels, area, response bytes, request
rate, format, transparency, and permitted resolution range. Requests exceeding
an accepted limit require deterministic aligned tiling. Different layers may
have different limits and resolutions for the same project extent.

## Implementation Evidence Cases

| Condition | Required outcome to validate |
| --- | --- |
| Adjacent parcels | Preserve one union subject and derive one buffered extent when it fits accepted limits. |
| Disconnected nearby parcels | Show the unused envelope/context area before accepting the project. |
| Dispersed parcels over a hard limit | Reject before buffering or acquisition and require separate projects. |
| Partial parcel lookup failure | Preserve the resolved input for correction, identify failures, and do not create or acquire an ambiguous partial project. |
| Source lacks the project CRS | Use an explicitly supported reprojection path or mark the layer unavailable; never guess axis order. |
| One raster tile fails | Preserve the last complete artifact and do not promote a partial mosaic as ready. |
| Context or resolution exceeds a budget | Identify the limiting budget and offer only accepted smaller-extent, smaller-context, or coarser-resolution choices. |
| Layer has no AOI data | Distinguish valid no-data from provider failure and unsupported coverage. |

These cases supplement the accepted requirements with provider-validation
evidence; they do not redefine the product limits owned by those requirements.
