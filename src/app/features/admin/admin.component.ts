import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({ selector: 'app-admin', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './admin.component.html', styleUrls: ['./admin.component.css', './admin.forms.css'] })
export class AdminComponent implements OnInit {
  stats = { users: 0, reservations: 0, reviews: 0 };
  users: any[] = []; reservations: any[] = []; reviews: any[] = [];
  halls: any[] = []; screenings: any[] = [];
  newHall = { naziv: '', redovi: 5, sedista_po_redu: 8 };
  newScreening = { film_title: '', hall_id: '', datum: '', termin: '20:00', cena: 6.5 };
  activeTab = 'overview';
  loading = true; message = '';
  private api = 'http://localhost:5000/api/admin';
  constructor(private http: HttpClient, private router: Router, @Inject(PLATFORM_ID) private platformId: Object) {}
  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    const token = localStorage.getItem('token');
    try { const payload: any = token ? JSON.parse(atob(token.split('.')[1])) : null; if (payload?.role !== 'admin') { this.router.navigate(['/']); return; } }
    catch { this.router.navigate(['/login']); return; }
    this.loadAll();
  }
  headers() { return { headers: new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` }) }; }
  loadAll() {
    this.loading = true;
    this.http.get<any>(`${this.api}/stats`, this.headers()).subscribe({ next: v => this.stats = v, error: () => this.message = 'Niste ovlašćeni za pristup.' });
    this.http.get<any[]>(`${this.api}/users`, this.headers()).subscribe(v => this.users = v);
    this.http.get<any[]>(`${this.api}/reservations`, this.headers()).subscribe(v => this.reservations = v);
    this.http.get<any[]>(`${this.api}/reviews`, this.headers()).subscribe({ next: v => { this.reviews = v; this.loading = false; }, error: () => this.loading = false });
    this.http.get<any[]>(`${this.api}/halls`, this.headers()).subscribe(v => this.halls = v);
    this.http.get<any[]>(`${this.api}/screenings`, this.headers()).subscribe(v => this.screenings = v);
  }
  setTab(tab: string) { this.activeTab = tab; }
  goHome() { this.router.navigate(['/']); }
  changeRole(user: any) { const role = user.role === 'admin' ? 'user' : 'admin'; this.http.patch(`${this.api}/users/${user.id}/role`, { role }, this.headers()).subscribe(() => user.role = role); }
  deleteReview(review: any) { if (!confirm('Obrisati ovu recenziju?')) return; this.http.delete(`${this.api}/reviews/${review.id}`, this.headers()).subscribe(() => this.reviews = this.reviews.filter(r => r.id !== review.id)); }
  addHall() { this.http.post(`${this.api}/halls`, this.newHall, this.headers()).subscribe({ next: () => { this.newHall = { naziv: '', redovi: 5, sedista_po_redu: 8 }; this.loadAll(); }, error: (e) => this.message = e.error?.message || 'Sala nije sačuvana.' }); }
  deleteHall(hall: any) { if (confirm(`Obrisati salu ${hall.naziv}?`)) this.http.delete(`${this.api}/halls/${hall.id}`, this.headers()).subscribe({ next: () => this.loadAll(), error: (e) => this.message = e.error?.message || 'Sala nije obrisana.' }); }
  addScreening() { this.http.post(`${this.api}/screenings`, this.newScreening, this.headers()).subscribe({ next: () => { this.newScreening = { film_title: '', hall_id: '', datum: '', termin: '20:00', cena: 6.5 }; this.loadAll(); }, error: (e) => this.message = e.error?.message || 'Projekcija nije sačuvana.' }); }
  deleteScreening(screening: any) { if (confirm('Obrisati projekciju?')) this.http.delete(`${this.api}/screenings/${screening.id}`, this.headers()).subscribe(() => this.loadAll()); }
  logout() { localStorage.removeItem('token'); this.router.navigate(['/login']); }
}
