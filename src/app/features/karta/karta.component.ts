import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
@Component({selector:'app-karta',standalone:true,imports:[CommonModule],templateUrl:'./karta.component.html',styleUrls:['./karta.component.css']})
export class KartaComponent implements OnInit {
  ticket:any; qr='';
  constructor(private router:Router,@Inject(PLATFORM_ID) private platformId:Object){}
  async ngOnInit(){ if(!isPlatformBrowser(this.platformId)) return; this.ticket=JSON.parse(localStorage.getItem('lastTicket')||'null'); if(this.ticket) this.qr=await QRCode.toDataURL(JSON.stringify({kod:this.ticket.kod,film:this.ticket.film.title,datum:this.ticket.datum,termin:this.ticket.termin,sedista:this.ticket.sedista}),{width:220,margin:1}); }
  downloadPdf(){ const pdf=new jsPDF(); pdf.setFillColor(8,9,13); pdf.rect(0,0,210,297,'F'); pdf.setTextColor(255,255,255); pdf.setFontSize(26); pdf.text('KLIKNI FILM',20,30); pdf.setFontSize(18); pdf.text('Digitalna karta',20,52); pdf.setFontSize(13); pdf.text(`Film: ${this.ticket.film.title}`,20,80); pdf.text(`Datum: ${this.ticket.datum}`,20,92); pdf.text(`Termin: ${this.ticket.termin}`,20,104); pdf.text(`Sedišta: ${this.ticket.sedista.join(', ')}`,20,116); pdf.text(`Sala: ${this.ticket.sala}`,20,128); pdf.text(`Kod: ${this.ticket.kod}`,20,145); pdf.addImage(this.qr,'PNG',20,160,55,55); pdf.save(`${this.ticket.kod}.pdf`); }
  goMovies(){this.router.navigate(['/filmovi']);}
}
