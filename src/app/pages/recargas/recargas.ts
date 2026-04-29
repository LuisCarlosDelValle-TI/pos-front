import { Component, computed, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

// Interfaces para tipar nuestros datos
export interface Proveedor {
  id: string;
  nombre: string;
  tipo: 'recarga' | 'servicio';
  color: string;
  icono: string;
  comision: number;
}

@Component({
  selector: 'app-recargas',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './recargas.html',
  styleUrls: ['./recargas.css']
})
export class RecargasComponent {

  // 1. Catálogo de Proveedores (Simulando la API de MTCenter o Smarter)
  proveedores = signal<Proveedor[]>([
    { id: 'telcel', nombre: 'Telcel', tipo: 'recarga', color: '#00285A', icono: 'smartphone', comision: 0 },
    { id: 'movistar', nombre: 'Movistar', tipo: 'recarga', color: '#019DF4', icono: 'phone_android', comision: 0 },
    { id: 'att', nombre: 'AT&T', tipo: 'recarga', color: '#00A8E0', icono: 'cell_tower', comision: 0 },
    { id: 'cfe', nombre: 'CFE', tipo: 'servicio', color: '#007A33', icono: 'lightbulb', comision: 12 },
    { id: 'telmex', nombre: 'Telmex', tipo: 'servicio', color: '#00529B', icono: 'router', comision: 12 },
    { id: 'megacable', nombre: 'Megacable', tipo: 'servicio', color: '#E31837', icono: 'tv', comision: 15 },
  ]);

  // 2. Estado del Formulario
  tipoActivo = signal<'recarga' | 'servicio'>('recarga');
  proveedorSeleccionado = signal<Proveedor | null>(null);

  // Datos ingresados por el usuario
  referencia = signal<string>(''); // Número de teléfono o cuenta
  monto = signal<number | null>(null);

  // 3. Opciones de montos rápidos para recargas
  montosRecarga = [20, 30, 50, 100, 150, 200, 500];

  // 4. Computed Signals para la interfaz
  proveedoresFiltrados = computed(() => {
    return this.proveedores().filter(p => p.tipo === this.tipoActivo());
  });

  totalACobrar = computed(() => {
    const m = this.monto() || 0;
    const c = this.proveedorSeleccionado()?.comision || 0;
    return m + c;
  });

  formularioValido = computed(() => {
    const prov = this.proveedorSeleccionado();
    const ref = this.referencia();
    const mon = this.monto();

    if (!prov || !mon || mon <= 0) return false;
    // Validar 10 dígitos para teléfonos, longitud libre para servicios
    if (this.tipoActivo() === 'recarga' && ref.length !== 10) return false;
    if (this.tipoActivo() === 'servicio' && ref.length < 5) return false;

    return true;
  });

  // 5. Funciones de interacción
  cambiarTipo(tipo: 'recarga' | 'servicio') {
    this.tipoActivo.set(tipo);
    this.resetearFormulario();
  }

  seleccionarProveedor(prov: Proveedor) {
    this.proveedorSeleccionado.set(prov);
  }

  seleccionarMontoRapido(monto: number) {
    this.monto.set(monto);
  }

  resetearFormulario() {
    this.proveedorSeleccionado.set(null);
    this.referencia.set('');
    this.monto.set(null);
  }

  procesarTransaccion() {
    if (this.formularioValido()) {
      const prov = this.proveedorSeleccionado();
      alert(`✅ Procesando ${this.tipoActivo()} de ${prov?.nombre}\nReferencia: ${this.referencia()}\nMonto: $${this.monto()}`);
      this.resetearFormulario();
    }
  }
}