# Provisional interactive API boundary

This library targets the owner-authorized interactive simulator contract at
`/api/v1`. It does not assert that a production backend implements this contract.
The generated transport is internal and must only be regenerated using the
documented generator task. Import application-facing exports from `geo-planner-api`.

```ts
new ProjectApi(http: HttpClient, config: ProjectApiConfig)
// ProjectApiConfig = { apiBaseUrl: string; timeoutMs?: number }
// apiBaseUrl must be a same-origin absolute path, e.g. '/api/v1'.

mapTileUrl(layerId: string, z: number, x: number, y: number): string
search(query: string, options?: RequestOptions, filters?: SearchOptions): Observable<ApiResponse<SearchResult>>
resolveParcel(selector: ParcelSelector, options?: RequestOptions): Observable<ApiResponse<ParcelResolveResult>>
findIntersectingParcels(workingExtent: WorkingExtentInput, options?: RequestOptions): Observable<ApiResponse<ParcelIntersectionResult>>
preview(request: PreviewRequest, options?: RequestOptions): Observable<ApiResponse<Preview>>
create(request: CreateProjectRequest, idempotencyKey: string, options?: RequestOptions): Observable<CreateProjectResponse>
get(projectId: string, options?: RequestOptions): Observable<ApiResponse<Project>>
```

`RequestOptions` is `{ correlationId?: string }`; `ApiResponse<T>` contains
`data: T` and `correlationId: string | null`. `CreateProjectResponse` adds
`replayed: boolean`. Types for inputs, geometries, extents, candidate ambiguity,
warnings, and provenance are exported alongside the facade. `Preview` is a
discriminated union: only `ready` contains a fingerprint. The caller must
invalidate a preview when its inputs change and may create only from its current
ready result. Tile URLs identify only a configured server layer; this method does
not fetch or validate image bytes.

The [canonical provisional contract](../../../docs/architecture/contracts/interactive-v1.openapi.yaml)
owns transport shapes; regenerate through `api:generate` after contract changes.
`searchFilters()` exposes the bounded region catalogue for future advanced clients;
the current simple workspace does not request it. Search options include
`regionId`, `type`, `limit` (1-5), opaque `cursor`, county/commune/locality names,
source identity filters (`countyId`, `communeId`, `localityId`, `streetId`),
selected `streetName` for address composition, and
`bounds` (EPSG:2180 easting/northing CSV, maximum 2 × 2 km).
The API accepts nonempty queries. Guided UI steps send explicit `locality`, `street`, `address` or `parcel`
intent. Address-number lookup passes the selected locality/street context for
backend composition. Other than dynamic street fragments, inputs use submit. Short numbers use a qualified
visible-map scope; full identities bypass it. No smart method detection occurs.
`needs_context` includes a validated `contextPrompt` with no candidates/cursor.
`SearchResult.nextCursor` is null on the last page. Reset continuation on every
query/filter/view change; append only an explicit next-page response. Candidate
`localityId` and `streetId` preserve source identity in contextual lookup.
See the [provider handoff](../../../docs/architecture/public-api-integration.md)
and [fixture catalogue](../../../docs/architecture/simulator-fixtures.md).

`findIntersectingParcels` is read-only discovery, also used for independent
viewport outlines at the same 2 × 2 km / 100-feature limit. Its bounded result echoes the
requested extent and distinguishes `complete`, `truncated`, and `unavailable`
source coverage. Suggestions are not selected project subjects; only explicit
user confirmation changes the selection. Cancel old discovery on rectangle
edits. Completeness refers to the declared source, not real cadastral coverage.

Failures are `ProjectApiError` with `kind`, `status`, validated `problem`,
`correlationId`, and `outcomeUnknown`. A timed-out, disconnected, invalid, or
server-failed create may already have succeeded. Cancellation can also leave its
outcome unknown but, because it unsubscribes, emits no error. No requests are
automatically retried; every subscription sends a request. Keep the same key and
exact payload for an explicit retry of the same attempt, but durable idempotency,
retention, and restart recovery are not guaranteed. Timeout defaults to 15 seconds.
Parcel records may include `parcelNumber` and `contextLabel` for presentation;
full `id` / `inputId` values retain identity. The synthetic search supports a
fractional number plus locality/precinct words; production matching requires
provider validation. Source metadata and limitations are informational, not cadastral or legal proof.
