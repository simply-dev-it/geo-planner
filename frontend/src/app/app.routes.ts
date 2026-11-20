import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'projects/new',
  },
  {
    path: 'projects/new',
    loadComponent: () =>
      import('./features/project-creation/project-creation-page').then(
        ({ ProjectCreationPage }) => ProjectCreationPage,
      ),
    title: 'Nowy projekt — Geo Planner',
  },
  {
    path: 'projects/:id',
    loadComponent: () =>
      import('./features/project-detail/project-detail-page').then(
        ({ ProjectDetailPage }) => ProjectDetailPage,
      ),
    title: 'Projekt — Geo Planner',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
