# Sketches

## Scope And Selection

Current retained legacy application: private indicative points, paths, and
areas in the configured project CRS. A user selects a sketch through its hit
area, label, or list. Selection highlights it and displays name/label,
category, geometry type, optional status, and optional description.
Coordinates, measurements, persistence origin, editability, and conflicts are
not exposed. Geometry and metadata of existing sketches cannot be edited in
the interface; there is no import action.

## Drawing

1. Choose point, line, or polygon mode and optionally enter a name.
2. Click map positions. A point completes after one click; a line needs at least
   two vertices; a polygon needs at least three user vertices.
3. Use Finish for a line or polygon. The stored polygon closes automatically.
   Too few vertices keeps the draft and reports the minimum in the sidebar.
4. Completion creates a generated ID, the entered name or `Szkic`, and category
   `manual`, then persists according to the mode below.

A bent or visually closed line remains a LineString. There is no automatic
conversion to polygon, snapping, vertex editor, validity check, metadata form
beyond name, or keyboard finish/cancel gesture. Draft previews do not clearly
explain open versus closed intent. Undo point removes only the latest draft
vertex. Switching modes or selecting from a list discards unfinished input;
reload or navigation away also loses the draft without warning.

## Remove And Export

| Action | Current result |
| --- | --- |
| Undo last feature | Removes the last item in the editable local list, which need not be the most recently created visible feature |
| Delete selected | Requires browser confirmation; removes the selected editable sketch |
| Clear all | Requires browser confirmation; removes the editable collection for the current persistence mode |
| Export GeoJSON | Downloads the merged visible collection as `manual-overlays.json` |

When nothing eligible is selected or editable, destructive actions remove
nothing and explain why in the sidebar. Export has no explicit CRS/provenance
envelope and no import counterpart.

## Persistence Modes

| Mode | Editable data and save result | Limits |
| --- | --- | --- |
| Generated file opened directly | Browser-local sketches for this project, merged with embedded sketches for display/export | Embedded-only sketches cannot be deleted; the UI directs the user to the local editor. Clear all affects only browser-local sketches. |
| Loopback editor | The merged collection becomes editable; completed draw/delete/clear/undo-last actions update browser storage and save the whole collection to the ignored local file | No revision check or conflict workflow; concurrent whole-collection saves can overwrite one another. Successful rebuilds reload the page. |

Existing local files are never replaced by initialization. Browser data is
namespaced by project ID. Invalid browser JSON is silently treated as an empty
list. A file save failure leaves the browser-local edit in place and reports
that file persistence failed; local storage is updated before server success.
There is no dedicated recovery UI for browser-storage access/quota failures.

Manual identity is taken first from `properties.id`, then normalized name or
label, then serialized geometry. Local features replace embedded features with
the same identity. A second pass collapses identical serialized geometries.
Consequently names and geometry can merge distinct user intentions. This is
observed legacy behavior; replacement immutable identity and optimistic
revision remain in [sketch requirements](../requirements/sketches.md).

The editor accepts collections up to 5 MiB with Point, LineString, Polygon,
and their Multi variants. It checks collection/feature/geometry kinds but not
coordinate shape, numeric values, CRS, properties, or polygon validity.
Existing multi-geometries can be displayed and persisted but cannot be drawn
interactively. A failed file replacement preserves the previous file. A
rebuild failure after saving can leave the file updated and the page stale.

Sketches and notes remain private user input and do not establish surveying,
planning, utility, or legal facts. There are no calculated sketch areas or
source intersections.

## Evidence

[Interface](../../mapa/map-fragment.template.html),
[editor](../../mapa/scripts/edit_map_server.py),
[builder](../../mapa/scripts/build_map.py),
[editor tests](../../tests/test_edit_map_server.py), and
[fixture round trips](../../tests/test_project_fixtures.py).
Storage keys, HTTP flow, and merge implementation evidence remain in the
[migration inventory](../research/prototype-behavior-inventory.md);
commands remain in [legacy operation](../../mapa/README.md).
