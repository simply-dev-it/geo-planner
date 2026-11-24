import { HttpClient } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { ProjectApi } from 'geo-planner-api';

import { RuntimeConfigService } from '../runtime-config/runtime-config';

/** Application-wide project API client bound to the runtime-configured base URL. */
export const PROJECT_API = new InjectionToken<ProjectApi>('project-api', {
  providedIn: 'root',
  factory: () =>
    new ProjectApi(inject(HttpClient), {
      apiBaseUrl: `${inject(RuntimeConfigService).value.apiBaseUrl.replace(/\/$/, '')}/v1`,
    }),
});

/** Same-origin XYZ template for the configured base map layer. */
export function baseMapTileTemplate(api: ProjectApi): string {
  return api.mapTileUrl('base-map', 0, 0, 0).replace(/0\/0\/0$/, '{z}/{x}/{y}');
}
