import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, throwError, tap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class FilmoviService {
  private externalApiUrl = 'https://movie.pequla.com/api/movie?director=&actor=&search=&genre=';
  private localApiUrl = 'http://localhost:5000';
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  getFilmovi(): Observable<any[]> {
    return this.http.get<any[]>(this.externalApiUrl);
  }

  getReviews(movieId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.localApiUrl}/reviews?filmId=${movieId}`).pipe(
      catchError(error => {
        console.error('Greška pri učitavanju recenzija:', error);
        return throwError(() => new Error('Greška pri učitavanju recenzija'));
      })
    );
  }

  getOccupiedSeats(title: string, datum: string, termin: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.localApiUrl}/api/seats`, { params: { film: title, datum, termin } });
  }

  getScreenings(title: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.localApiUrl}/api/screenings`, { params: { film: title } });
  }

  submitReview(review: { filmId: number; rating: number; comment: string }): Observable<any> {
    let headers = new HttpHeaders();

    if (this.isBrowser) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return this.http.post(`${this.localApiUrl}/reviews`, review, { headers }).pipe(
      tap(() => console.log("Recenzija poslata!")),
      catchError(error => {
        console.error('Greška pri slanju recenzije:', error);
        return throwError(() => new Error('Greška pri slanju recenzije'));
      })
    );
  }

  deleteReviews(movieId: number): Observable<any> {
    return this.http.delete(`${this.localApiUrl}/reviews?filmId=${movieId}`).pipe(
      tap(() => console.log("Recenzije obrisane.")),
      catchError(error => {
        console.error('Greška pri brisanju recenzija:', error);
        return throwError(() => new Error('Greška pri brisanju recenzija'));
      })
    );
  }
}
