import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NotificationService } from '../../servicios/notification';
import { HttpClient } from '@angular/common/http';

export interface Producto {
  id: number;
  nombre: string;
  precio: number;
  categoria: string;
  imagenUrl: string;
}

export interface ItemCarrito {
  id: number;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
}

@Component({
  selector: 'app-punto-de-venta',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './punto-de-venta.html',
  styleUrls: ['./punto-de-venta.css']
})
export class PuntoDeVentaComponent implements OnInit {

  notificacionSvc = inject(NotificationService);
  private http = inject(HttpClient);

  productos = signal<Producto[]>([]);

  ngOnInit() {
    this.cargarProductosDeBD();
  }

  cargarProductosDeBD() {
    this.http.get<any[]>('https://pos-backend-nz8u.onrender.com/api/productos').subscribe({
      next: (datosBackend) => {
        const mapeados: Producto[] = datosBackend
          .filter(db => db.activo !== false)
          .map(db => {
            const tieneFotoReal = db.imagen_url && db.imagen_url !== 'null' && db.imagen_url.length > 100;

            return {
              id: db.id,
              nombre: db.nombre,
              precio: Number(db.precio_venta),
              categoria: db.categoria_id === 1 ? 'Papelería' : (db.categoria_id === 2 ? 'Ciber' : 'Recargas'),
              imagenUrl: tieneFotoReal
                ? db.imagen_url
                : `https://via.placeholder.com/150/0284c7/FFFFFF?text=${db.nombre.charAt(0)}`
            };
          });

        this.productos.set(mapeados);
      },
      error: (err) => this.notificacionSvc.mostrar('error', 'Error al cargar los productos de la base de datos.')
    });
  }

  carrito = signal<ItemCarrito[]>([]);
  terminoBusqueda = signal<string>('');
  categoriaSeleccionada = signal<string>('Todos');

  // === VARIABLES PARA EL TICKET DE IMPRESIÓN ===
  fechaActual = new Date();
  carritoTicket: ItemCarrito[] = [];
  totalFinalTicket: number = 0;
  efectivoTicket: number = 0;
  cambioTicket: number = 0;

  categorias = computed(() => {
    const cats = this.productos().map(p => p.categoria);
    return ['Todos', ...new Set(cats)];
  });

  productosFiltrados = computed(() => {
    const termino = this.terminoBusqueda().toLowerCase().trim();
    const cat = this.categoriaSeleccionada();

    return this.productos().filter(p => {
      const coincideBusqueda = termino === '' || p.nombre.toLowerCase().includes(termino);
      const coincideCategoria = cat === 'Todos' || p.categoria === cat;
      return coincideBusqueda && coincideCategoria;
    });
  });

  subtotal = computed(() => this.carrito().reduce((acc, item) => acc + item.subtotal, 0));
  totalFinal = computed(() => this.subtotal());

  seleccionarCategoria(cat: string) {
    this.categoriaSeleccionada.set(cat);
  }

  agregarAlCarrito(producto: Producto) {
    this.carrito.update(items => {
      const itemExistente = items.find(i => i.id === producto.id);
      if (itemExistente) {
        return items.map(i => i.id === producto.id
          ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio }
          : i);
      } else {
        return [...items, { id: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad: 1, subtotal: producto.precio }];
      }
    });
  }

  actualizarCantidad(itemId: number, cambio: number) {
    this.carrito.update(items => {
      return items.map(item => {
        if (item.id === itemId) {
          const nuevaCantidad = item.cantidad + cambio;
          if (nuevaCantidad > 0) {
            return { ...item, cantidad: nuevaCantidad, subtotal: nuevaCantidad * item.precio };
          }
        }
        return item;
      });
    });
  }

  eliminarDelCarrito(itemId: number) {
    this.carrito.update(items => items.filter(item => item.id !== itemId));
  }

  // === LÓGICA DEL MODAL DE PAGO Y ÉXITO ===
  mostrarModalPago = signal(false);
  mostrarModalExito = signal(false); // <-- NUEVA SEÑAL
  montoRecibido = signal<number | null>(null);
  billetesRapidos = [50, 100, 200, 500];

  cambio = computed(() => {
    const recibido = this.montoRecibido() || 0;
    const total = this.totalFinal();
    return recibido >= total ? recibido - total : 0;
  });

  faltaPorPagar = computed(() => {
    const recibido = this.montoRecibido() || 0;
    const total = this.totalFinal();
    return recibido < total ? total - recibido : 0;
  });

  abrirModalPago() {
    if (this.carrito().length === 0) {
      this.notificacionSvc.mostrar('warning', 'Agrega al menos un producto al carrito para cobrar.');
      return;
    }
    this.montoRecibido.set(null);
    this.mostrarModalPago.set(true);
  }

  cerrarModalPago() {
    this.mostrarModalPago.set(false);
  }

  cerrarModalExito() {
    this.mostrarModalExito.set(false);
  }

  imprimirDesdeExito() {
    window.print();
  }

  cobroExacto() {
    this.montoRecibido.set(this.totalFinal());
  }

  seleccionarBillete(monto: number) {
    this.montoRecibido.set(monto);
  }

  procesarPago() {
    const recibido = this.montoRecibido() || 0;
    if (recibido < this.totalFinal()) {
      this.notificacionSvc.mostrar('error', 'El monto recibido no cubre el total de la compra.');
      return;
    }

    // AHORA SÍ ENVIAMOS EL CARRITO PARA DESCONTAR STOCK
    const payloadVenta = {
      total: this.totalFinal(),
      metodo_pago: 'efectivo',
      detalles: this.carrito().map(item => ({ id: item.id, cantidad: item.cantidad, precio: item.precio }))
    };

    this.http.post('https://pos-backend-nz8u.onrender.com/api/ventas', payloadVenta).subscribe({
      next: (res) => {
        // Congelamos datos para el ticket y el modal de éxito
        this.carritoTicket = [...this.carrito()];
        this.totalFinalTicket = this.totalFinal();
        this.efectivoTicket = recibido;
        this.cambioTicket = this.cambio();
        this.fechaActual = new Date();

        this.cerrarModalPago();
        this.carrito.set([]); // Vaciamos el carrito

        // Abrimos la pantalla de éxito
        this.mostrarModalExito.set(true);
      },
      error: (err) => {
        console.error(err);
        this.notificacionSvc.mostrar('error', 'Error al guardar la venta en la base de datos.');
      }
    });
  }
}