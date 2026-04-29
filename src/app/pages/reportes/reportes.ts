import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';

export interface ProductoTop {
  nombre: string;
  cantidadVendida: number;
  ingresoGenerado: number;
  porcentaje: number;
  color: string;
}

export interface DesgloseFinanciero {
  categoria: string;
  ingresos: number;
  costos: number;
  gananciaNeta: number;
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './reportes.html',
  styleUrls: ['./reportes.css']
})
export class ReportesComponent implements OnInit {

  private http = inject(HttpClient);

  // Filtro de tiempo activo
  periodoActivo = signal<'Hoy' | 'Semana' | 'Mes'>('Semana');

  // Signals para la pantalla
  topProductos = signal<ProductoTop[]>([]);
  desglose = signal<DesgloseFinanciero[]>([]);

  // Bases de datos en crudo
  dbProductos: any[] = [];
  dbVentas: any[] = [];
  dbDetalles: any[] = [];

  // Totales Calculados
  ingresosTotales = computed(() => this.desglose().reduce((acc, item) => acc + item.ingresos, 0));
  costosTotales = computed(() => this.desglose().reduce((acc, item) => acc + item.costos, 0));
  gananciaNetaTotal = computed(() => this.ingresosTotales() - this.costosTotales());
  margenGanancia = computed(() => {
    if (this.ingresosTotales() === 0) return 0;
    return (this.gananciaNetaTotal() / this.ingresosTotales()) * 100;
  });

  ngOnInit() {
    this.cargarDatosBD();
  }

  cargarDatosBD() {
    // forkJoin nos permite hacer 3 peticiones a la BD al mismo tiempo y esperar a que terminen
    forkJoin({
      productos: this.http.get<any[]>('https://pos-backend-nz8u.onrender.com/api/productos'),
      ventas: this.http.get<any[]>('https://pos-backend-nz8u.onrender.com/api/ventas'),
      detalles: this.http.get<any[]>('https://pos-backend-nz8u.onrender.com/api/detalle-ventas')
    }).subscribe({
      next: (res) => {
        this.dbProductos = res.productos;
        this.dbVentas = res.ventas;
        this.dbDetalles = res.detalles;
        this.procesarReporte(); // Ejecuta las matemáticas
      },
      error: (err) => console.error('Error cargando reportes', err)
    });
  }

  cambiarPeriodo(periodo: 'Hoy' | 'Semana' | 'Mes') {
    this.periodoActivo.set(periodo);
    this.procesarReporte();
  }

  procesarReporte() {
    const hoy = new Date();

    // 1. Filtramos las VENTAS dependiendo del botón que elegiste (Hoy, Semana, Mes)
    const ventasValidas = this.dbVentas.filter(v => {
      const fechaVenta = new Date(v.fecha_venta);

      if (this.periodoActivo() === 'Hoy') {
        return fechaVenta.toDateString() === hoy.toDateString();
      } else if (this.periodoActivo() === 'Semana') {
        const lunes = new Date(hoy);
        const diaSemana = lunes.getDay();
        const diferencia = lunes.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
        lunes.setDate(diferencia);
        lunes.setHours(0, 0, 0, 0);
        return fechaVenta >= lunes;
      } else {
        return fechaVenta.getMonth() === hoy.getMonth() && fechaVenta.getFullYear() === hoy.getFullYear();
      }
    });

    // 2. Agarramos todos los IDs de esas ventas y buscamos sus DETALLES
    const idsVentas = ventasValidas.map(v => v.id);
    const detallesValidos = this.dbDetalles.filter(d => idsVentas.includes(d.venta_id));

    // 3. Variables de agrupación
    const mapaTop: Record<number, ProductoTop> = {};
    const mapaDesglose: Record<number, DesgloseFinanciero> = {};
    const colores = ['#FF7A00', '#1565C0', '#2E7D32', '#7B1FA2', '#E66E00'];

    // 4. Recorremos cada detalle vendido y lo sumamos a sus categorías
    detallesValidos.forEach(detalle => {
      const producto = this.dbProductos.find(p => p.id === detalle.producto_id);
      if (!producto) return;

      const ingreso = Number(detalle.subtotal);
      // El costo real es lo que te costó a ti multiplicado por las unidades vendidas
      const costoReal = Number(producto.precio_compra) * Number(detalle.cantidad);

      // --- ACUMULAR PARA TOP PRODUCTOS ---
      if (!mapaTop[producto.id]) {
        mapaTop[producto.id] = { nombre: producto.nombre, cantidadVendida: 0, ingresoGenerado: 0, porcentaje: 0, color: '' };
      }
      mapaTop[producto.id].cantidadVendida += Number(detalle.cantidad);
      mapaTop[producto.id].ingresoGenerado += ingreso;

      // --- ACUMULAR PARA DESGLOSE FINANCIERO ---
      const catId = producto.categoria_id;
      if (!mapaDesglose[catId]) {
        mapaDesglose[catId] = {
          categoria: catId === 1 ? 'Papelería' : (catId === 2 ? 'Ciber e Impresiones' : 'Recargas y Otros'),
          ingresos: 0, costos: 0, gananciaNeta: 0
        };
      }
      mapaDesglose[catId].ingresos += ingreso;
      mapaDesglose[catId].costos += costoReal;
      mapaDesglose[catId].gananciaNeta += (ingreso - costoReal);
    });

    // 5. Ordenar el Top de Productos de mayor a menor y asignar porcentajes de la barra visual
    let arrayTop = Object.values(mapaTop).sort((a, b) => b.ingresoGenerado - a.ingresoGenerado).slice(0, 5);
    if (arrayTop.length > 0) {
      const maxIngresoProducto = arrayTop[0].ingresoGenerado;
      arrayTop.forEach((p, index) => {
        p.porcentaje = (p.ingresoGenerado / maxIngresoProducto) * 100;
        p.color = colores[index % colores.length];
      });
    }

    // 6. Finalmente, pintar la pantalla
    this.topProductos.set(arrayTop);
    this.desglose.set(Object.values(mapaDesglose));
  }

  exportarReporte() {
    alert(`Generando Excel del periodo: ${this.periodoActivo()}`);
  }
}