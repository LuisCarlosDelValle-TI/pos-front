import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './ajustes.html',
  styleUrls: ['./ajustes.css']
})
export class AjustesComponent implements OnInit { // <-- Agregamos implements OnInit

  pestanas = [
    { id: 'general', nombre: 'General', icono: 'storefront' },
    { id: 'ticket', nombre: 'Configuración de Ticket', icono: 'receipt_long' },
    { id: 'usuarios', nombre: 'Usuarios y Roles', icono: 'manage_accounts' },
    { id: 'sistema', nombre: 'Sistema y Seguridad', icono: 'security' }
  ];

  pestanaActiva = signal<string>('sistema'); // Lo pongo en sistema para que lo pruebes rápido

  config = {
    // ... (Tus datos de negocio y ticket se quedan igual) ...
    negocio: { nombre: 'Mi Papelería y Ciber', propietario: 'Luis Carlos del Valle', telefono: '2291234567', direccion: 'Av. Principal #123, Veracruz', rfc: 'XAXX010101000' },
    ticket: { mensajeAgradecimiento: '¡Gracias por tu compra!', mostrarLogo: true, mostrarTelefono: true, impresoraPorDefecto: 'EPSON TM-T20III' },

    sistema: {
      temaOscuro: false, // <-- Esto lo controlaremos ahora
      notificacionesStock: true,
      respaldoAutomatico: true
    }
  };

  // Al cargar la pantalla, revisamos si el modo oscuro ya estaba prendido
  ngOnInit() {
    this.config.sistema.temaOscuro = document.body.classList.contains('dark-theme');
  }

  // Esta función enciende o apaga las luces
  toggleTema() {
    if (this.config.sistema.temaOscuro) {
      document.body.classList.add('dark-theme');
      // Opcional: Guardarlo en localStorage para que no se borre al recargar la página
      localStorage.setItem('temaPreferido', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('temaPreferido', 'light');
    }
  }

  cambiarPestana(id: string) {
    this.pestanaActiva.set(id);
  }

  guardarCambios() {
    alert('✅ Configuraciones guardadas correctamente.');
  }
}