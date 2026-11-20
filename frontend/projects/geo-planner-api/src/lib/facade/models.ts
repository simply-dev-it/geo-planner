export type Position = [number, number];
export type Bounds = [number, number, number, number];
export type SpatialGeometry = {
  crs: 'EPSG:2180';
  axisOrder: 'easting-northing';
} & (
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] }
);

export interface WorkingExtentInput {
  crs: 'EPSG:2180';
  axisOrder: 'easting-northing';
  bounds: Bounds;
}

export interface SpatialExtent {
  crs: 'EPSG:2180';
  axisOrder: 'easting-northing' | 'minEasting-minNorthing-maxEasting-maxNorthing';
  bounds: Bounds;
  widthMetres: number;
  heightMetres: number;
  envelopeAreaSquareMetres: number;
}

export interface Provenance {
  provider: string;
  operation?: string;
  sourceDataDate: string | null;
  attribution?: string;
  limitations: string[];
}

export interface SearchCandidate {
  streetId?: string;
  regionId?: string;
  localityId?: string;
  id: string;
  type: 'voivodeship' | 'locality' | 'street' | 'parcel' | 'point_address';
  label: string;
  contextLabel?: string;
  parcelId?: string;
  center: Position;
  extent: Bounds;
  crs: 'EPSG:2180';
  axisOrder: 'easting-northing';
  source: string;
}

export interface SearchResult {
  nextCursor: string | null;
  status: 'ready' | 'ambiguous' | 'no_match' | 'needs_context';
  contextPrompt?: string;
  candidates: SearchCandidate[];
  provenance: Provenance;
}

export type ParcelSelector =
  | { type: 'point'; coordinates: Position; crs: 'EPSG:2180' }
  | { type: 'identifier'; value: string };

export interface ParcelCandidate {
  parcelNumber?: string;
  contextLabel?: string;
  id: string;
  inputId?: string;
  geometry?: SpatialGeometry;
  crs?: 'EPSG:2180';
  axisOrder?: 'easting-northing';
  source: string;
  limitations?: string[];
}

export interface ResolvedParcel {
  parcelNumber?: string;
  contextLabel?: string;
  id: string;
  geometry: SpatialGeometry;
  crs: 'EPSG:2180';
  axisOrder: 'easting-northing';
  source: string;
  sourceDataDate: string | null;
  limitations: string[];
}

export type ParcelResolveResult =
  | { status: 'resolved'; parcel: ResolvedParcel; candidates: ParcelCandidate[] }
  | { status: 'ambiguous' | 'not_found'; parcel: null; candidates: ParcelCandidate[] };

export interface SelectedParcel {
  parcelNumber?: string;
  contextLabel?: string;
  inputId: string;
  status: 'resolved' | 'unresolved' | 'ambiguous';
  id: string | null;
  candidateIds: string[];
  geometry: SpatialGeometry | null;
  crs: 'EPSG:2180';
  axisOrder: 'easting-northing';
  source: string;
  sourceDataDate: string | null;
}

export type PreviewIssue =
  'UNRESOLVED_PARCEL' | 'AMBIGUOUS_PARCEL' | 'WORKING_EXTENT_EXCEEDED' | 'PARCEL_SUBJECT_EXCEEDED';

export interface PreviewWarning {
  code: 'PARCEL_OUTSIDE_WORKING_EXTENT' | 'PARCEL_PARTLY_OUTSIDE_WORKING_EXTENT';
  parcelId: string;
}

interface PreviewFields {
  issues: PreviewIssue[];
  selectedParcels: SelectedParcel[];
  parcelSubjectExtent: SpatialExtent | null;
  workingExtent: SpatialExtent;
  warnings: PreviewWarning[];
  provenance: Provenance;
}

export type Preview = PreviewFields &
  (
    | { status: 'ready'; previewFingerprint: string }
    | { status: 'incomplete' | 'outside_limits'; previewFingerprint: null }
  );

export interface PreviewRequest {
  parcelIds: string[];
  workingExtent: WorkingExtentInput;
}

export interface CreateProjectRequest extends PreviewRequest {
  name: string;
  previewFingerprint: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  parcelIds: string[];
  workingExtent: SpatialExtent;
  selectedParcels: SelectedParcel[];
  previewFingerprint: string;
  provenance: Provenance;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  errorCode: string;
  correlationId: string;
  fieldErrors?: { field: string; message: string }[];
  [extension: string]: unknown;
}

export interface ApiResponse<T> {
  data: T;
  correlationId: string | null;
}

export interface CreateProjectResponse extends ApiResponse<Project> {
  replayed: boolean;
}

export interface ParcelIntersectionResult {
  status: 'complete' | 'truncated' | 'unavailable';
  workingExtent: WorkingExtentInput;
  candidates: ResolvedParcel[];
  provenance: Provenance;
}

export interface SearchFilter {
  id: string;
  label: string;
  regionId?: string;
}
export interface SearchFilters {
  regions: SearchFilter[];
}
export interface SearchOptions {
  countyId?: string;
  communeId?: string;
  localityId?: string;
  streetId?: string;
  streetName?: string;
  countyName?: string;
  communeName?: string;
  localityName?: string;
  bounds?: string;
  regionId?: string;
  type?: 'place' | 'parcel' | 'locality' | 'street' | 'address';
  limit?: number;
  cursor?: string;
}
