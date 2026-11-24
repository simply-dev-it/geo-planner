import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RuntimeConfigService } from '../../core/runtime-config/runtime-config';
import { ProjectDetailState } from './project-detail-state';

describe('ProjectDetailState', () => {
  let state: ProjectDetailState;
  let http: HttpTestingController;
  const id = '0b6a9a3e-2c1d-4f5e-8a7b-1c2d3e4f5a6b';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ProjectDetailState,
        { provide: RuntimeConfigService, useValue: { value: { apiBaseUrl: '/api' } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    state = TestBed.inject(ProjectDetailState);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    http.verify({ ignoreCancelled: true });
  });

  it('rejects a missing or malformed identifier without a request', () => {
    state.open(null);
    expect(state.error()).toBe('Nieprawidłowy identyfikator projektu.');
    state.open('not-a-uuid');
    expect(state.error()).toBe('Nieprawidłowy identyfikator projektu.');
    expect(state.loading()).toBe(false);
    http.expectNone(() => true);
  });

  it('reports a failed load and cancels a superseded request', () => {
    state.open(id);
    expect(state.loading()).toBe(true);
    const first = http.expectOne(`/api/v1/projects/${id}`);
    state.open(id);
    expect(first.cancelled).toBe(true);
    http
      .expectOne(`/api/v1/projects/${id}`)
      .flush({ title: 'Not found' }, { status: 404, statusText: 'Not Found' });
    expect(state.loading()).toBe(false);
    expect(state.project()).toBeNull();
    expect(state.error()).toBe('Nie udało się otworzyć projektu.');
  });

  it('exposes the shared base map tile template', () => {
    expect(state.tileUrl).toBe('/api/v1/map/layers/base-map/tiles/{z}/{x}/{y}');
  });
});
