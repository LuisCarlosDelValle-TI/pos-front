import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

export interface Transaccion {
  id: string;
  tipo: 'Venta' | 'Recarga' | 'Servicio';
  descripcion: string;
  monto: number;
  hora: string;
  estado: 'Completado' | 'Pendiente';
}

export interface DatoGrafico {
  dia: string;
  monto: number;
  porcentaje: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);

  // === 1. SECCIÓN: ENCARGOS (Lo tuyo, intacto) ===
  gananciasHoy = signal({ invertido: 0, cobrado: 0, libre: 0 });
  gananciasSemana = signal({ invertido: 0, cobrado: 0, libre: 0 });
  gananciasMes = signal({ invertido: 0, cobrado: 0, libre: 0 });

  // === 2. SECCIÓN: PUNTO DE VENTA (Lo Nuevo) ===
  ventasPOS = signal<any[]>([]);

  // Datos del Usuario
  nombreUsuario = 'Luis Carlos';
  fechaActual = new Date();

  ngOnInit() {
    this.cargarGananciasPedidos(); // Carga tus encargos
    this.cargarVentasPOS();        // Carga tus ventas del POS
  }

  // --- LÓGICA DE ENCARGOS (No se tocó nada) ---
  cargarGananciasPedidos() {
    this.http.get<any[]>('https://pos-backend-nz8u.onrender.com/api/pedidos-encargo').subscribe({
      next: (pedidos) => {
        let hoyInv = 0, hoyCob = 0, hoyLib = 0;
        let semInv = 0, semCob = 0, semLib = 0;
        let mesInv = 0, mesCob = 0, mesLib = 0;

        const fechaActual = new Date();
        const lunesDeEstaSemana = new Date(fechaActual);
        const diaSemana = lunesDeEstaSemana.getDay();
        const diferencia = lunesDeEstaSemana.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
        lunesDeEstaSemana.setDate(diferencia);
        lunesDeEstaSemana.setHours(0, 0, 0, 0);

        pedidos.forEach(p => {
          if (p.estado === 'Cancelado') return;

          const fechaPedido = new Date(p.fecha_registro);
          const costoMercancia = Number(p.costo_producto) + Number(p.costo_envio_app);

          let comision = 0;
          if (p.tipo_comision === 'Fija') {
            comision = Number(p.valor_comision);
          } else {
            comision = costoMercancia * (Number(p.valor_comision) / 100);
          }

          const cobroTotal = costoMercancia + comision;

          if (fechaPedido.getMonth() === fechaActual.getMonth() && fechaPedido.getFullYear() === fechaActual.getFullYear()) {
            mesInv += costoMercancia; mesCob += cobroTotal; mesLib += comision;
          }
          if (fechaPedido >= lunesDeEstaSemana) {
            semInv += costoMercancia; semCob += cobroTotal; semLib += comision;
          }
          if (fechaPedido.toDateString() === fechaActual.toDateString()) {
            hoyInv += costoMercancia; hoyCob += cobroTotal; hoyLib += comision;
          }
        });

        this.gananciasHoy.set({ invertido: hoyInv, cobrado: hoyCob, libre: hoyLib });
        this.gananciasSemana.set({ invertido: semInv, cobrado: semCob, libre: semLib });
        this.gananciasMes.set({ invertido: mesInv, cobrado: mesCob, libre: mesLib });
      },
      error: (err) => console.error('Error al cargar pedidos para dashboard:', err)
    });
  }

  // --- LÓGICA DEL PUNTO DE VENTA (NUEVO) ---
  cargarVentasPOS() {
    this.http.get<any[]>('https://pos-backend-nz8u.onrender.com/api/ventas').subscribe({
      next: (ventas) => this.ventasPOS.set(ventas),
      error: (err) => console.error('Error al cargar ventas POS:', err)
    });
  }

  // Tarjetas Rápidas de Hoy para el Punto de Venta
  ventasHoyPOS = computed(() => {
    const hoy = new Date().toDateString();
    const ventasDeHoy = this.ventasPOS().filter(v => new Date(v.fecha_venta).toDateString() === hoy);
    const total = ventasDeHoy.reduce((acc, v) => acc + Number(v.total), 0);
    return { tickets: ventasDeHoy.length, dinero: total };
  });

  // Gráfica conectada a las ventas reales del POS
  datosSemana = computed<DatoGrafico[]>(() => {
    const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const resultados = dias.map(d => ({ dia: d, monto: 0, porcentaje: 0 }));

    const fechaActual = new Date();
    const lunesDeEstaSemana = new Date(fechaActual);
    const diaSemana = lunesDeEstaSemana.getDay();
    const diferencia = lunesDeEstaSemana.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    lunesDeEstaSemana.setDate(diferencia);
    lunesDeEstaSemana.setHours(0, 0, 0, 0);

    this.ventasPOS().forEach(v => {
      const fechaVenta = new Date(v.fecha_venta);
      if (fechaVenta >= lunesDeEstaSemana) {
        let indexDia = fechaVenta.getDay() - 1;
        if (indexDia === -1) indexDia = 6;
        resultados[indexDia].monto += Number(v.total);
      }
    });

    const maxMonto = Math.max(...resultados.map(r => r.monto), 1);
    resultados.forEach(r => r.porcentaje = (r.monto / maxMonto) * 100);
    return resultados;
  });

  // Últimos Movimientos conectados a las ventas reales del POS
  transacciones = computed<Transaccion[]>(() => {
    const ventasOrdenadas = [...this.ventasPOS()].sort((a, b) =>
      new Date(b.fecha_venta).getTime() - new Date(a.fecha_venta).getTime()
    );

    return ventasOrdenadas.slice(0, 5).map(v => ({
      id: `TRX-${v.id}`,
      tipo: 'Venta',
      descripcion: `Ticket #${v.id} (Punto de Venta)`,
      monto: Number(v.total),
      hora: new Date(v.fecha_venta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      estado: 'Completado'
    }));
  });
}