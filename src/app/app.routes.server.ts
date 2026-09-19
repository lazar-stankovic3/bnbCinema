import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    // Dynamic routes such as /rezervacija/:title cannot be prerendered
    // without a finite list of titles. Render them on the server instead.
    renderMode: RenderMode.Server
  }
];
