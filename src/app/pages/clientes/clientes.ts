import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  comprasTotales: number;
  saldoPendiente: number;
  estado: 'Activo' | 'Inactivo';
}

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './clientes.html',
  styleUrls: ['./clientes.css']
})
export class ClientesComponent {

  clientes = signal<Cliente[]>([
    { id: 'CLI-001', nombre: 'Ana García', telefono: '2291234567', email: 'ana.g@email.com', comprasTotales: 1250.00, saldoPendiente: 0, estado: 'Activo' },
    { id: 'CLI-002', nombre: 'Escuela Técnica 4', telefono: '2299876543', email: 'contacto@est4.edu.mx', comprasTotales: 5400.00, saldoPendiente: 450.00, estado: 'Activo' },
    { id: 'CLI-003', nombre: 'Carlos Ruiz', telefono: '2295551122', email: 'carlos.r@email.com', comprasTotales: 800.00, saldoPendiente: 120.00, estado: 'Activo' },
  ]);

  terminoBusqueda = signal<string>('');

  clientesFiltrados = computed(() => {
    const termino = this.terminoBusqueda().toLowerCase().trim();
    if (!termino) return this.clientes();
    return this.clientes().filter(c => c.nombre.toLowerCase().includes(termino) || c.telefono.includes(termino));
  });

  totalClientes = computed(() => this.clientes().length);
  deudaTotal = computed(() => this.clientes().reduce((acc, c) => acc + c.saldoPendiente, 0));

  obtenerIniciales(nombre: string): string {
    return nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }
}