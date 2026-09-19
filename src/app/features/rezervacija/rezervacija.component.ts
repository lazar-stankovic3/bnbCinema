import { Component, OnInit, Output, EventEmitter, Inject, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilmoviService } from '../filmovi/filmovi.service';

@Component({
  selector: 'app-rezervacija',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rezervacija.component.html',
  styleUrls: ['./rezervacija.component.css']
})
export class RezervacijaComponent implements OnInit {
  @Output() korpaOsvezena = new EventEmitter<void>();

  film: any = null;
  korisnickoIme: string = '';
  brojKarata: number = 1;
  datum: string = '';
  termin: string = '';
  cenaKarte = 6.5;
  projekcije: any[] = [];
  selectedProjekcija: any = null;
  selectedSeats: string[] = [];
  occupiedSeats = ['A3', 'B6', 'C2', 'C7', 'D4', 'E1', 'E8'];
  seatRows = ['A', 'B', 'C', 'D', 'E'];
  seatNumbers = [1, 2, 3, 4, 5, 6, 7, 8];

  isBrowser: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private filmoviService: FilmoviService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    const filmTitle = this.route.snapshot.paramMap.get('title');

    this.filmoviService.getFilmovi().subscribe((filmovi) => {
      this.film = filmovi.find((f: any) => f.title.toLowerCase() === filmTitle?.toLowerCase());
      if (this.film) this.ucitajProjekcije();
    });
  }

  potvrdiRezervaciju(): void {
    if (!this.film || !this.korisnickoIme.trim() || !this.datum || this.selectedSeats.length === 0) {
      alert('Molimo popunite sva polja!');
      return;
    }

    const kod = `BNB-${Date.now().toString(36).toUpperCase()}`;
    const rezervacija = {
      film: this.film,
      korisnickoIme: this.korisnickoIme.trim(),
      brojKarata: this.brojKarata,
      datum: this.datum,
      termin: this.termin,
      sedista: this.selectedSeats,
      kod,
      sala: this.selectedProjekcija?.sala || 'Sala 1',
      cenaKarte: this.cenaKarte
    };

    if (this.isBrowser) {
      const korpa = JSON.parse(localStorage.getItem('korpa') || '[]');
      korpa.push(rezervacija);
      localStorage.setItem('korpa', JSON.stringify(korpa));
    }

    this.korpaOsvezena.emit();
    alert(`"${this.film.title}" je dodat u korpu!`);
    this.router.navigate(['/filmovi']);
  }

  toggleSeat(seat: string): void {
    if (this.occupiedSeats.includes(seat)) return;
    if (this.selectedSeats.includes(seat)) this.selectedSeats = this.selectedSeats.filter(s => s !== seat);
    else if (this.selectedSeats.length < this.brojKarata) this.selectedSeats = [...this.selectedSeats, seat];
    else alert(`Izabrali ste maksimalno ${this.brojKarata} sedišta.`);
  }

  isOccupied(seat: string): boolean { return this.occupiedSeats.includes(seat); }
  isSelected(seat: string): boolean { return this.selectedSeats.includes(seat); }
  promeniBrojKarata(): void { this.selectedSeats = this.selectedSeats.slice(0, Math.max(1, this.brojKarata)); }
  goBack(): void { this.router.navigate(['/filmovi']); }
  ucitajZauzetaSedista(): void {
    if (!this.film || !this.datum || !this.termin) return;
    this.filmoviService.getOccupiedSeats(this.film.title, this.datum, this.termin).subscribe({
      next: seats => { this.occupiedSeats = seats; this.selectedSeats = []; },
      error: () => { this.occupiedSeats = []; }
    });
  }

  ucitajProjekcije(): void {
    this.filmoviService.getScreenings(this.film.title).subscribe({
      next: projekcije => { this.projekcije = projekcije; if (projekcije.length) this.izaberiProjekciju(projekcije[0]); },
      error: () => { this.projekcije = []; }
    });
  }

  izaberiProjekciju(projekcija: any): void {
    this.selectedProjekcija = projekcija;
    this.datum = String(projekcija.datum).split('T')[0];
    this.termin = projekcija.termin;
    this.cenaKarte = Number(projekcija.cena);
    this.seatRows = Array.from({ length: projekcija.redovi }, (_, index) => String.fromCharCode(65 + index));
    this.seatNumbers = Array.from({ length: projekcija.sedista_po_redu }, (_, index) => index + 1);
    this.ucitajZauzetaSedista();
  }
}
