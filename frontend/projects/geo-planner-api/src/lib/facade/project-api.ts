import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { catchError, map, Observable, throwError, timeout, TimeoutError } from 'rxjs';
import { ProjectsService } from '../generated/api/projects.service';
import { SearchService, type SearchLocationsRequestParams } from '../generated/api/search.service';
import type { CreateProjectRequest as TransportCreate } from '../generated/model/createProjectRequest';
import type { ParcelIntersectionRequest as TransportIntersections } from '../generated/model/parcelIntersectionRequest';
import type { ParcelResolveRequest as TransportResolve } from '../generated/model/parcelResolveRequest';
import type { PreviewRequest as TransportPreview } from '../generated/model/previewRequest';
import {
  isParcelResolveResult,
  isParcelIntersectionResult,
  isPreview,
  isProblem,
  isProject,
  isSearchResult,
  isSearchFilters,
} from '../mappers/validation';
import type {
  ApiResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  ParcelResolveResult,
  ParcelIntersectionResult,
  WorkingExtentInput,
  ParcelSelector,
  Preview,
  PreviewRequest,
  Problem,
  Project,
  SearchResult,
  SearchFilters,
  SearchOptions,
} from './models';

export interface ProjectApiConfig {
  apiBaseUrl: string;
  timeoutMs?: number;
}

export interface RequestOptions {
  correlationId?: string;
}

export type ApiErrorKind = 'timeout' | 'network' | 'http' | 'invalid_response';

export class ProjectApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number | null,
    readonly problem: Problem | null,
    readonly correlationId: string | null,
    readonly outcomeUnknown: boolean,
  ) {
    super(problem?.detail ?? `Project API ${kind}`);
    this.name = 'ProjectApiError';
  }
}

function basePath(value: string): string {
  if (!/^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)\/?$/.test(value)) {
    throw new Error(
      'apiBaseUrl must be a same-origin absolute path without query, fragment, or dot segments',
    );
  }
  return value.replace(/\/$/, '');
}

function correlation(options?: RequestOptions): string | undefined {
  const value = options?.correlationId;
  if (value !== undefined && (value.length > 128 || /[\r\n]/.test(value))) {
    throw new Error('Invalid correlation ID');
  }
  return value;
}

function jsonContentType(response: HttpResponse<unknown>): boolean {
  return /^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('Content-Type') ?? '');
}

function matchesInput(result: Preview | Project, input: PreviewRequest): boolean {
  const expected = [...input.parcelIds].sort();
  const actual = result.selectedParcels.map((parcel) => parcel.inputId).sort();
  return (
    expected.length === actual.length &&
    expected.every((id, i) => id === actual[i]) &&
    result.workingExtent.bounds.every(
      (coordinate, i) => coordinate === input.workingExtent.bounds[i],
    )
  );
}

function copyInput(request: PreviewRequest): PreviewRequest {
  return {
    parcelIds: [...request.parcelIds],
    workingExtent: { ...request.workingExtent, bounds: [...request.workingExtent.bounds] },
  };
}

export class ProjectApi {
  private readonly base: string;
  private readonly timeoutMs: number;
  private readonly searchService: SearchService;
  private readonly projectsService: ProjectsService;

  constructor(http: HttpClient, config: ProjectApiConfig) {
    this.base = basePath(config.apiBaseUrl);
    this.timeoutMs = config.timeoutMs ?? 15000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new Error('Invalid timeout');
    this.searchService = new SearchService(http, this.base);
    this.projectsService = new ProjectsService(http, this.base);
  }

  mapTileUrl(layerId: string, z: number, x: number, y: number): string {
    if (
      !layerId ||
      layerId.length > 64 ||
      layerId === '.' ||
      layerId === '..' ||
      !Number.isInteger(z) ||
      z < 0 ||
      z > 18 ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      y < 0 ||
      x >= 2 ** z ||
      y >= 2 ** z
    )
      throw new Error('Invalid tile coordinates or layer ID');
    return `${this.base}/map/layers/${encodeURIComponent(layerId)}/tiles/${z}/${x}/${y}`;
  }

  search(
    query: string,
    options?: RequestOptions,
    filters: SearchOptions = {},
  ): Observable<ApiResponse<SearchResult>> {
    return this.request(
      this.searchService.searchLocations(
        {
          query,
          ...filters,
          xCorrelationId: correlation(options),
        } as unknown as SearchLocationsRequestParams,
        'response',
      ),
      isSearchResult,
      [200],
    );
  }
  searchFilters(): Observable<ApiResponse<SearchFilters>> {
    return this.request(this.searchService.getSearchFilters('response'), isSearchFilters, [200]);
  }

  resolveParcel(
    selector: ParcelSelector,
    options?: RequestOptions,
  ): Observable<ApiResponse<ParcelResolveResult>> {
    const body = { selector } as unknown as TransportResolve;
    return this.request(
      this.searchService.resolveParcel(
        { parcelResolveRequest: body, xCorrelationId: correlation(options) },
        'response',
      ),
      isParcelResolveResult,
      [200],
    );
  }

  findIntersectingParcels(
    workingExtent: WorkingExtentInput,
    options?: RequestOptions,
  ): Observable<ApiResponse<ParcelIntersectionResult>> {
    const snapshot = {
      ...workingExtent,
      bounds: [...workingExtent.bounds] as WorkingExtentInput['bounds'],
    };
    return this.request(
      this.searchService.findIntersectingParcels(
        {
          parcelIntersectionRequest: {
            workingExtent: snapshot,
          } as unknown as TransportIntersections,
          xCorrelationId: correlation(options),
        },
        'response',
      ),
      (value): value is ParcelIntersectionResult =>
        isParcelIntersectionResult(value) &&
        value.workingExtent.bounds.every((coordinate, i) => coordinate === snapshot.bounds[i]),
      [200],
    );
  }

  preview(request: PreviewRequest, options?: RequestOptions): Observable<ApiResponse<Preview>> {
    const snapshot = copyInput(request);
    const body = snapshot as unknown as TransportPreview;
    return this.request(
      this.projectsService.previewProjectArea(
        { previewRequest: body, xCorrelationId: correlation(options) },
        'response',
      ),
      (value): value is Preview => isPreview(value) && matchesInput(value, snapshot),
      [200],
    );
  }

  create(
    request: CreateProjectRequest,
    idempotencyKey: string,
    options?: RequestOptions,
  ): Observable<CreateProjectResponse> {
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128 || /[\r\n]/.test(idempotencyKey))
      throw new Error('Invalid idempotency key');
    const snapshot = {
      ...copyInput(request),
      name: request.name,
      previewFingerprint: request.previewFingerprint,
    };
    const body = snapshot as unknown as TransportCreate;
    return this.request(
      this.projectsService.createProject(
        { createProjectRequest: body, idempotencyKey, xCorrelationId: correlation(options) },
        'response',
      ),
      (value): value is Project =>
        isProject(value) &&
        matchesInput(value, snapshot) &&
        value.name === snapshot.name &&
        value.previewFingerprint === snapshot.previewFingerprint,
      [200, 201],
      true,
    ).pipe(
      map((response) => ({
        data: response.data,
        correlationId: response.correlationId,
        replayed: response.status === 200,
      })),
    );
  }

  get(projectId: string, options?: RequestOptions): Observable<ApiResponse<Project>> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)
    ) {
      throw new Error('Invalid project ID');
    }
    return this.request(
      this.projectsService.getProject(
        { projectId, xCorrelationId: correlation(options) },
        'response',
      ),
      (value): value is Project =>
        isProject(value) && value.id.toLowerCase() === projectId.toLowerCase(),
      [200],
    );
  }

  private request<T>(
    source: Observable<HttpResponse<unknown>>,
    valid: (body: unknown) => body is T,
    statuses: number[],
    mutation = false,
  ): Observable<ApiResponse<T> & { status: number }> {
    return source.pipe(
      timeout({ first: this.timeoutMs }),
      map((response) => {
        const correlationId = response.headers.get('X-Correlation-Id');
        if (
          !statuses.includes(response.status) ||
          !jsonContentType(response) ||
          !valid(response.body)
        ) {
          throw new ProjectApiError(
            'invalid_response',
            response.status,
            null,
            correlationId,
            mutation,
          );
        }
        return { data: response.body, correlationId, status: response.status };
      }),
      catchError((error: unknown) => {
        if (error instanceof ProjectApiError) return throwError(() => error);
        if (error instanceof TimeoutError)
          return throwError(() => new ProjectApiError('timeout', null, null, null, mutation));
        if (error instanceof HttpErrorResponse) {
          const correlationId = error.headers.get('X-Correlation-Id');
          const isProblemContent = /^application\/problem\+json(?:\s*;|\s*$)/i.test(
            error.headers.get('Content-Type') ?? '',
          );
          const problem =
            isProblemContent && isProblem(error.error, error.status) ? error.error : null;
          const kind = error.status === 0 ? 'network' : problem ? 'http' : 'invalid_response';
          return throwError(
            () =>
              new ProjectApiError(
                kind,
                error.status || null,
                problem,
                correlationId ?? problem?.correlationId ?? null,
                mutation && (error.status === 0 || error.status >= 500 || !problem),
              ),
          );
        }
        return throwError(() => new ProjectApiError('network', null, null, null, mutation));
      }),
    );
  }
}
