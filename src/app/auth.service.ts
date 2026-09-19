import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:5000/api/auth'; 
  private isBrowser: boolean;
  private userSubject: BehaviorSubject<boolean>; 
  user$: Observable<boolean>;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.userSubject = new BehaviorSubject<boolean>(this.isAuthenticated());
    this.user$ = this.userSubject.asObservable();
  }

  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials, { withCredentials: true });
  }

  signup(user: { name: string; email: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/signup`, user, { withCredentials: true });
  }

  logout() {
    this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).subscribe({
      next: () => {
        if (this.isBrowser) {
          localStorage.removeItem('token');
        }
        this.userSubject.next(false);
        this.router.navigate(['/login']);
      },
      error: err => {
        console.error('Logout failed:', err);
      }
    });
  }

  isAuthenticated(): boolean {
    if (!this.isBrowser) return false;
    return !!localStorage.getItem('token');
  }

  updateUser(email: string, updatedData: { username?: string; password?: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/update-user`, { email, ...updatedData });
  }
}
