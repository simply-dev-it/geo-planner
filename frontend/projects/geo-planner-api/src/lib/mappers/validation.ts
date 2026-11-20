import type {
  SearchFilters,
  ParcelResolveResult,
  ParcelIntersectionResult,
  Preview,
  Problem,
  Project,
  SearchResult,
} from '../facade/models';

type RecordValue = Record<string, unknown>;
type Guard = (value: unknown) => boolean;

const object = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const number = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const oneOf = (value: unknown, choices: readonly string[]): boolean =>
  text(value) && choices.includes(value);
const array = (value: unknown, guard: Guard, max = Infinity): boolean =>
  Array.isArray(value) && value.length <= max && value.every(guard);
const optional = (value: unknown, guard: Guard): boolean => value === undefined || guard(value);
const nullable = (value: unknown, guard: Guard): boolean => value === null || guard(value);
const id = (value: unknown): boolean => text(value) && value.length > 0 && value.length <= 64;
const strings = (value: unknown): boolean => array(value, text);
const position = (value: unknown): boolean =>
  Array.isArray(value) && value.length === 2 && value.every(number);
const bounds = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length === 4 &&
  value.every(number) &&
  value[0] <= value[2] &&
  value[1] <= value[3];
const date = (value: unknown): boolean =>
  value === null ||
  (text(value) &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value);
const fingerprint = (value: unknown): boolean =>
  text(value) && /^v1:sha256:[a-f0-9]{64}$/.test(value);
const crs = (value: RecordValue): boolean =>
  value['crs'] === 'EPSG:2180' && value['axisOrder'] === 'easting-northing';

function ring(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 4 || !value.every(position)) return false;
  const first = value[0] as number[];
  const last = value[value.length - 1] as number[];
  return first[0] === last[0] && first[1] === last[1];
}
const polygon = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0 && value.every(ring);
function geometry(value: unknown): boolean {
  return (
    object(value) &&
    crs(value) &&
    (value['type'] === 'Polygon'
      ? polygon(value['coordinates'])
      : value['type'] === 'MultiPolygon' &&
        Array.isArray(value['coordinates']) &&
        value['coordinates'].length > 0 &&
        value['coordinates'].every(polygon))
  );
}
function extent(value: unknown): boolean {
  if (
    !object(value) ||
    value['crs'] !== 'EPSG:2180' ||
    !oneOf(value['axisOrder'], [
      'easting-northing',
      'minEasting-minNorthing-maxEasting-maxNorthing',
    ]) ||
    !bounds(value['bounds']) ||
    !number(value['widthMetres']) ||
    !number(value['heightMetres']) ||
    !number(value['envelopeAreaSquareMetres'])
  )
    return false;
  const b = value['bounds'];
  const w = b[2]! - b[0]!;
  const h = b[3]! - b[1]!;
  const close = (a: number, b: number): boolean =>
    Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
  return (
    close(value['widthMetres'], w) &&
    close(value['heightMetres'], h) &&
    close(value['envelopeAreaSquareMetres'], w * h)
  );
}
function withinLimits(value: RecordValue): boolean {
  return (
    (value['widthMetres'] as number) <= 2000 &&
    (value['heightMetres'] as number) <= 2000 &&
    (value['envelopeAreaSquareMetres'] as number) <= 4000000
  );
}
function provenance(value: unknown): boolean {
  return (
    object(value) &&
    text(value['provider']) &&
    date(value['sourceDataDate']) &&
    strings(value['limitations']) &&
    optional(value['operation'], text) &&
    optional(value['attribution'], text)
  );
}
function parcelLabels(value: RecordValue): boolean {
  return (
    optional(value['parcelNumber'], (v) => text(v) && v.length > 0 && v.length <= 64) &&
    optional(value['contextLabel'], (v) => text(v) && v.length > 0 && v.length <= 256)
  );
}
function candidate(value: unknown): boolean {
  return (
    object(value) &&
    parcelLabels(value) &&
    id(value['id']) &&
    text(value['source']) &&
    optional(value['inputId'], id) &&
    optional(value['geometry'], geometry) &&
    optional(value['crs'], (v) => v === 'EPSG:2180') &&
    optional(value['axisOrder'], (v) => v === 'easting-northing') &&
    optional(value['limitations'], strings)
  );
}
function resolved(value: unknown): boolean {
  return (
    object(value) &&
    parcelLabels(value) &&
    id(value['id']) &&
    geometry(value['geometry']) &&
    crs(value) &&
    text(value['source']) &&
    date(value['sourceDataDate']) &&
    strings(value['limitations'])
  );
}
function selected(value: unknown): boolean {
  if (
    !object(value) ||
    !parcelLabels(value) ||
    !id(value['inputId']) ||
    !oneOf(value['status'], ['resolved', 'unresolved', 'ambiguous']) ||
    !nullable(value['id'], id) ||
    !array(value['candidateIds'], id) ||
    !nullable(value['geometry'], geometry) ||
    !crs(value) ||
    !text(value['source']) ||
    !date(value['sourceDataDate'])
  )
    return false;
  return value['status'] === 'resolved'
    ? value['id'] !== null && value['geometry'] !== null
    : value['id'] === null && value['geometry'] === null;
}
function searchCandidate(value: unknown): boolean {
  return (
    object(value) &&
    optional(value['regionId'], id) &&
    optional(value['localityId'], id) &&
    optional(value['streetId'], id) &&
    text(value['id']) &&
    value['id'].length > 0 &&
    value['id'].length <= 128 &&
    oneOf(value['type'], ['voivodeship', 'locality', 'street', 'parcel', 'point_address']) &&
    text(value['label']) &&
    value['label'].length > 0 &&
    value['label'].length <= 256 &&
    optional(value['contextLabel'], (v) => text(v) && v.length > 0 && v.length <= 256) &&
    optional(value['parcelId'], id) &&
    position(value['center']) &&
    bounds(value['extent']) &&
    crs(value) &&
    text(value['source'])
  );
}

export function isSearchResult(value: unknown): value is SearchResult {
  return (
    object(value) &&
    oneOf(value['status'], ['ready', 'ambiguous', 'no_match', 'needs_context']) &&
    array(value['candidates'], searchCandidate, 5) &&
    nullable(value['nextCursor'], (v) => text(v) && v.length > 0 && v.length <= 256) &&
    provenance(value['provenance']) &&
    optional(value['contextPrompt'], (v) => text(v) && v.length > 0 && v.length <= 512) &&
    (value['status'] !== 'needs_context' ||
      (text(value['contextPrompt']) && value['contextPrompt'].length > 0)) &&
    (['no_match', 'needs_context'].includes(String(value['status']))
      ? (value['candidates'] as unknown[]).length === 0 && value['nextCursor'] === null
      : (value['candidates'] as unknown[]).length > 0)
  );
}
export function isParcelResolveResult(value: unknown): value is ParcelResolveResult {
  return (
    object(value) &&
    oneOf(value['status'], ['resolved', 'ambiguous', 'not_found']) &&
    array(value['candidates'], candidate) &&
    (value['status'] === 'resolved' ? resolved(value['parcel']) : value['parcel'] === null) &&
    (value['status'] !== 'ambiguous' || (value['candidates'] as unknown[]).length > 0)
  );
}
export function isPreview(value: unknown): value is Preview {
  if (
    !object(value) ||
    !oneOf(value['status'], ['ready', 'incomplete', 'outside_limits']) ||
    !array(value['issues'], (v) =>
      oneOf(v, [
        'UNRESOLVED_PARCEL',
        'AMBIGUOUS_PARCEL',
        'WORKING_EXTENT_EXCEEDED',
        'PARCEL_SUBJECT_EXCEEDED',
      ]),
    ) ||
    !array(value['selectedParcels'], selected, 100) ||
    !nullable(value['parcelSubjectExtent'], extent) ||
    !extent(value['workingExtent']) ||
    !array(
      value['warnings'],
      (v) =>
        object(v) &&
        oneOf(v['code'], [
          'PARCEL_OUTSIDE_WORKING_EXTENT',
          'PARCEL_PARTLY_OUTSIDE_WORKING_EXTENT',
        ]) &&
        id(v['parcelId']),
    ) ||
    !provenance(value['provenance'])
  )
    return false;
  if (value['status'] !== 'ready') return value['previewFingerprint'] === null;
  const working = value['workingExtent'] as RecordValue;
  const subject = value['parcelSubjectExtent'] as RecordValue | null;
  const parcels = value['selectedParcels'] as RecordValue[];
  return (
    fingerprint(value['previewFingerprint']) &&
    (value['issues'] as unknown[]).length === 0 &&
    parcels.every((p) => p['status'] === 'resolved') &&
    withinLimits(working) &&
    (subject === null ? parcels.length === 0 : parcels.length > 0 && withinLimits(subject))
  );
}
export function isProject(value: unknown): value is Project {
  if (!(
    object(value) &&
    text(value['id']) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value['id'],
    ) &&
    text(value['name']) &&
    value['name'].length > 0 &&
    value['name'].length <= 160 &&
    text(value['createdAt']) &&
    !Number.isNaN(Date.parse(value['createdAt'])) &&
    array(value['parcelIds'], id, 100) &&
    extent(value['workingExtent']) &&
    array(value['selectedParcels'], selected, 100) &&
    (value['selectedParcels'] as RecordValue[]).every((p) => p['status'] === 'resolved') &&
    fingerprint(value['previewFingerprint']) &&
    provenance(value['provenance'])
  ))
    return false;
  const parcelIds = value['parcelIds'] as string[];
  const inputIds = (value['selectedParcels'] as RecordValue[])
    .map((parcel) => parcel['inputId'] as string)
    .sort();
  return (
    withinLimits(value['workingExtent'] as RecordValue) &&
    new Set(parcelIds).size === parcelIds.length &&
    parcelIds.length === inputIds.length &&
    [...parcelIds].sort().every((id, i) => id === inputIds[i])
  );
}
export function isProblem(value: unknown, status: number): value is Problem {
  return (
    object(value) &&
    text(value['type']) &&
    text(value['title']) &&
    value['status'] === status &&
    text(value['detail']) &&
    text(value['errorCode']) &&
    text(value['correlationId']) &&
    optional(value['fieldErrors'], (v) =>
      array(v, (entry) => object(entry) && text(entry['field']) && text(entry['message'])),
    )
  );
}

export function isParcelIntersectionResult(value: unknown): value is ParcelIntersectionResult {
  if (
    !object(value) ||
    !oneOf(value['status'], ['complete', 'truncated', 'unavailable']) ||
    !object(value['workingExtent']) ||
    !crs(value['workingExtent']) ||
    !bounds(value['workingExtent']['bounds']) ||
    !array(value['candidates'], resolved, 100) ||
    !provenance(value['provenance'])
  )
    return false;
  const candidates = value['candidates'] as RecordValue[];
  const b = value['workingExtent']['bounds'];
  return (
    b[0]! < b[2]! &&
    b[1]! < b[3]! &&
    b[2]! - b[0]! <= 2000 &&
    b[3]! - b[1]! <= 2000 &&
    new Set(candidates.map((p) => p['id'])).size === candidates.length &&
    (value['status'] !== 'unavailable' || candidates.length === 0)
  );
}

export function isSearchFilters(value: unknown): value is SearchFilters {
  const filter = (v: unknown) =>
    object(v) &&
    id(v['id']) &&
    text(v['label']) &&
    v['label'].length > 0 &&
    v['label'].length <= 256 &&
    optional(v['regionId'], id);
  return object(value) && array(value['regions'], filter, 100);
}
