import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NotificationService } from '../../servicios/notification';
import { HttpClient } from '@angular/common/http';

export interface ProductoInventario {
  id: number;
  codigoBarras: string;
  nombre: string;
  categoria: string;
  precioCompra: number;
  precioVenta: number;
  stock: number;
  stockMinimo: number;
  imagenUrl: string; // <-- NUEVA PROPIEDAD PARA LA FOTO
}

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './inventario.html',
  styleUrls: ['./inventario.css']
})
export class InventarioComponent implements OnInit {

  notificacionSvc = inject(NotificationService);
  private http = inject(HttpClient);

  // --- BASE DE DATOS REAL ---
  productos = signal<ProductoInventario[]>([]);

  ngOnInit() {
    this.cargarProductosReales();
  }

  cargarProductosReales() {
    this.http.get<any[]>('https://pos-backend-nz8u.onrender.com/api/productos').subscribe({
      next: (datosBackend) => {
        // Traducimos los datos de PostgreSQL al formato de Angular
        const mapeados: ProductoInventario[] = datosBackend.map(db => ({
          id: db.id,
          codigoBarras: db.codigo_barras,
          nombre: db.nombre,
          // Traductor inverso: de ID a Texto
          categoria: db.categoria_id === 1 ? 'Papelería' : (db.categoria_id === 2 ? 'Ciber' : 'Otro'),
          precioCompra: Number(db.precio_compra),
          precioVenta: Number(db.precio_venta),
          stock: Number(db.stock),
          stockMinimo: Number(db.stock_minimo),
          imagenUrl: db.imagen_url || '' // <-- RECIBIMOS LA FOTO DE LA BD (O dejamos vacío)
        }));
        this.productos.set(mapeados);
      },
      error: (err) => {
        console.error('Error al cargar productos:', err);
        this.notificacionSvc.mostrar('error', 'No se pudieron cargar los productos de la base de datos.');
      }
    });
  }

  // --- BÚSQUEDA Y FILTROS ---
  terminoBusqueda = signal<string>('');

  productosFiltrados = computed(() => {
    const termino = this.terminoBusqueda().toLowerCase().trim();
    if (!termino) return this.productos();

    return this.productos().filter(p =>
      p.nombre.toLowerCase().includes(termino) ||
      p.codigoBarras.includes(termino) ||
      p.categoria.toLowerCase().includes(termino)
    );
  });

  // --- ESTADÍSTICAS SUPERIORES ---
  totalProductos = computed(() => this.productos().length);
  valorInventario = computed(() => this.productos().reduce((acc, p) => acc + (p.precioCompra * p.stock), 0));
  productosBajos = computed(() => this.productos().filter(p => p.stock <= p.stockMinimo).length);

  // --- CONTROL DEL MODAL (NUEVO/EDITAR) ---
  mostrarModal = signal(false);
  modoEdicion = signal(false);

  // Añadimos imagenUrl vacía por defecto
  productoNuevo = signal<ProductoInventario>({
    id: 0, codigoBarras: '', nombre: '', categoria: 'Papelería',
    precioCompra: 0, precioVenta: 0, stock: 0, stockMinimo: 5, imagenUrl: ''
  });

  abrirModalNuevo() {
    this.modoEdicion.set(false);
    this.productoNuevo.set({ id: 0, codigoBarras: '', nombre: '', categoria: 'Papelería', precioCompra: 0, precioVenta: 0, stock: 0, stockMinimo: 5, imagenUrl: '' });
    this.mostrarModal.set(true);
  }

  editarProducto(producto: ProductoInventario) {
    this.modoEdicion.set(true);
    this.productoNuevo.set({ ...producto });
    this.mostrarModal.set(true);
  }

  cerrarModal() {
    this.mostrarModal.set(false);
  }

  // --- PROCESAMIENTO DE LA FOTO (NUEVO) ---
  procesarImagen(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        // Guardamos el código de la foto en nuestra variable temporal
        this.productoNuevo.set({ ...this.productoNuevo(), imagenUrl: base64String });
      };
      reader.readAsDataURL(file);
    }
  }

  guardarProductoNuevo() {
    const p = this.productoNuevo();

    if (!p.nombre || !p.codigoBarras || p.precioVenta <= 0) {
      this.notificacionSvc.mostrar('error', 'Llena los campos obligatorios: Nombre, Código y Precio Venta.');
      return;
    }

    // Traductor: Armamos el paquete exactamente como lo pide tu DTO de NestJS
    const payloadParaBackend = {
      codigo_barras: p.codigoBarras,
      nombre: p.nombre,
      precio_compra: p.precioCompra,
      precio_venta: p.precioVenta,
      stock: p.stock,
      stock_minimo: p.stockMinimo,
      categoria_id: p.categoria === 'Papelería' ? 1 : (p.categoria === 'Ciber' ? 2 : 3),
      imagen_url: p.imagenUrl // <-- ENVIAMOS LA FOTO A LA BASE DE DATOS
    };

    if (this.modoEdicion()) {
      // PETICIÓN PUT (ACTUALIZAR)
      this.http.put(`https://pos-backend-nz8u.onrender.com/api/productos/${p.id}`, payloadParaBackend).subscribe({
        next: () => {
          this.productos.update(items => items.map(item => item.id === p.id ? { ...p } : item));
          this.notificacionSvc.mostrar('success', `Producto "${p.nombre}" actualizado.`);
          this.cerrarModal();
        },
        error: (err) => {
          console.error(err);
          this.notificacionSvc.mostrar('error', 'Error al actualizar el producto en BD.');
        }
      });

    } else {
      // PETICIÓN POST (CREAR NUEVO)
      this.http.post('https://pos-backend-nz8u.onrender.com/api/productos', payloadParaBackend).subscribe({
        next: (respuestaBackend: any) => {
          // Tomamos el ID autoincremental que le dio Postgres
          const nuevo = { ...p, id: respuestaBackend.id };
          this.productos.update(actuales => [...actuales, nuevo]);
          this.notificacionSvc.mostrar('success', `Producto "${p.nombre}" registrado exitosamente.`);
          this.cerrarModal();
        },
        error: (err) => {
          console.error(err);
          this.notificacionSvc.mostrar('error', 'Error al guardar el producto en BD.');
        }
      });
    }
  }

  // --- LÓGICA DEL MODAL DE ELIMINACIÓN ---
  mostrarModalEliminar = signal(false);
  productoAEliminar = signal<ProductoInventario | null>(null);

  eliminarProducto(producto: ProductoInventario) {
    this.productoAEliminar.set(producto);
    this.mostrarModalEliminar.set(true);
  }

  cerrarModalEliminar() {
    this.mostrarModalEliminar.set(false);
    this.productoAEliminar.set(null);
  }

  ejecutarEliminacion() {
    const prod = this.productoAEliminar();
    if (prod) {
      // PETICIÓN DELETE
      this.http.delete(`https://pos-backend-nz8u.onrender.com/api/productos/${prod.id}`).subscribe({
        next: () => {
          this.productos.update(items => items.filter(item => item.id !== prod.id));
          this.notificacionSvc.mostrar('warning', `Producto "${prod.nombre}" eliminado permanentemente.`);
          this.cerrarModalEliminar();
        },
        error: (err) => {
          console.error(err);
          this.notificacionSvc.mostrar('error', 'Error al eliminar de la base de datos.');
        }
      });
    }
  }
}