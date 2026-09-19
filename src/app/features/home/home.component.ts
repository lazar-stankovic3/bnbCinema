import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FilmoviService } from '../filmovi/filmovi.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  randomFilmovi: any[] = [];
  preporuceniFilmovi: any[] = [];
  imaIstoriju = false;

  constructor(private filmoviService: FilmoviService, private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    this.filmoviService.getFilmovi().subscribe((data: any[]) => {
      this.randomFilmovi = this.getRandomFilms(data, 5);
      this.ucitajPreporuke(data);
    });
  }

  private ucitajPreporuke(filmovi: any[]): void {
    if (!isPlatformBrowser(this.platformId)) { this.preporuceniFilmovi = this.getRandomFilms(filmovi, 6); return; }
    const token = localStorage.getItem('token');
    if (!token) { this.preporuceniFilmovi = this.getRandomFilms(filmovi, 6); return; }
    this.http.get<any[]>('http://localhost:5000/api/rezervacije', { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }).subscribe({
      next: reservations => {
        const watched = new Set(reservations.map(r => String(r.film_title).toLowerCase()));
        const genres = reservations.map(r => filmovi.find(f => f.title?.toLowerCase() === String(r.film_title).toLowerCase()))
          .flatMap(f => f?.genre || f?.genres || []).map((g: any) => String(g).toLowerCase());
        this.imaIstoriju = watched.size > 0;
        const similar = filmovi.filter(f => !watched.has(String(f.title).toLowerCase()) && this.filmImaZanr(f, genres));
        this.preporuceniFilmovi = this.getRandomFilms(similar.length ? similar : filmovi.filter(f => !watched.has(String(f.title).toLowerCase())), 6);
      },
      error: () => this.preporuceniFilmovi = this.getRandomFilms(filmovi, 6)
    });
  }

  private filmImaZanr(film: any, genres: string[]): boolean {
    const values = (film.genre || film.genres || []).map((g: any) => String(g).toLowerCase());
    return values.some((g: string) => genres.some(preference => g.includes(preference) || preference.includes(g)));
  }

  getRandomFilms(films: any[], count: number): any[] {
    let shuffled = films.sort(() => 0.5 - Math.random()); 
    return shuffled.slice(0, count); 
  }
}
