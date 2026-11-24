import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { RuntimeConfigService } from '../runtime-config/runtime-config';
import { PROJECT_API, baseMapTileTemplate } from './project-api';

describe('PROJECT_API', () => {
  it('shares one client bound to the runtime base URL and exposes the base map template', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: RuntimeConfigService, useValue: { value: { apiBaseUrl: '/api/' } } },
      ],
    });
    const api = TestBed.inject(PROJECT_API);
    expect(TestBed.inject(PROJECT_API)).toBe(api);
    expect(baseMapTileTemplate(api)).toBe('/api/v1/map/layers/base-map/tiles/{z}/{x}/{y}');
  });
});
