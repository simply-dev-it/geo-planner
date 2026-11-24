export * from './map.service';
import { MapService } from './map.service';
export * from './projects.service';
import { ProjectsService } from './projects.service';
export * from './search.service';
import { SearchService } from './search.service';
export const APIS = [MapService, ProjectsService, SearchService];
