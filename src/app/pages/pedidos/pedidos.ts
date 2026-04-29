import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../servicios/notification';
import { HttpClient } from '@angular/common/http';
import html2canvas from 'html2canvas';

export interface PedidoEncargo {
  id: string;
  fechaRegistro: Date;
  cliente: string;
  telefono: string;
  plataforma: 'Mercado Libre' | 'Amazon' | 'AliExpress' | 'Otro';
  productoDescripcion: string;
  costoProducto: number;
  costoEnvioApp: number;
  tipoComision: 'Porcentaje' | 'Fija';
  valorComision: number;
  anticipoDado: number;
  estado: 'Pendiente de Compra' | 'En Tránsito' | 'Recibido en Local' | 'Entregado al Cliente' | 'Cancelado';
  guiaRastreo?: string;
}

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './pedidos.html',
  styleUrls: ['./pedidos.css']
})
export class PedidosComponent implements OnInit {

  // --- SERVICIOS ---
  notificacionSvc = inject(NotificationService);
  private http = inject(HttpClient);

  // --- BASE DE DATOS ---
  pedidos = signal<PedidoEncargo[]>([]);

  ngOnInit() {
    this.cargarPedidosReales();
  }

  cargarPedidosReales() {
    this.http.get<any[]>('https://pos-backend-nz8u.onrender.com/api/pedidos-encargo').subscribe({
      next: (datosBackend) => {
        // Traducimos los datos de la BD al formato que entiende tu Angular
        const pedidosMapeados: PedidoEncargo[] = datosBackend.map(db => ({
          id: db.folio, // Usamos el folio como tu ID
          fechaRegistro: db.fecha_registro,
          cliente: db.nombre_cliente,
          telefono: db.telefono,
          plataforma: db.plataforma,
          productoDescripcion: db.producto_descripcion,
          costoProducto: Number(db.costo_producto),
          costoEnvioApp: Number(db.costo_envio_app),
          tipoComision: db.tipo_comision,
          valorComision: Number(db.valor_comision),
          anticipoDado: Number(db.anticipo_dado),
          estado: db.estado,
          guiaRastreo: db.guia_rastreo
        }));

        // Llenamos tu tabla con la información real
        this.pedidos.set(pedidosMapeados);
      },
      error: (err) => {
        console.error('Error al jalar los pedidos:', err);
        this.notificacionSvc.mostrar('error', 'No se pudieron cargar los pedidos de la base de datos.');
      }
    });
  }

  // --- FILTROS ---
  terminoBusqueda = signal<string>('');
  filtroEstado = signal<string>('Todos');

  pedidosFiltrados = computed(() => {
    let filtrados = this.pedidos();
    const termino = this.terminoBusqueda().toLowerCase().trim();

    if (this.filtroEstado() !== 'Todos') {
      filtrados = filtrados.filter(p => p.estado === this.filtroEstado());
    }

    if (termino) {
      filtrados = filtrados.filter(p =>
        p.cliente.toLowerCase().includes(termino) ||
        p.id.toLowerCase().includes(termino) ||
        p.productoDescripcion.toLowerCase().includes(termino)
      );
    }
    return filtrados;
  });

  pedidosActivos = computed(() => this.pedidos().filter(p => p.estado !== 'Entregado al Cliente' && p.estado !== 'Cancelado').length);
  paquetesEnLocal = computed(() => this.pedidos().filter(p => p.estado === 'Recibido en Local').length);

  // --- LÓGICA FINANCIERA ---
  calcularComisionTotal(pedido: PedidoEncargo): number {
    if (pedido.tipoComision === 'Fija') {
      return pedido.valorComision;
    } else {
      return (pedido.costoProducto + pedido.costoEnvioApp) * (pedido.valorComision / 100);
    }
  }

  calcularTotalCobrarCliente(pedido: PedidoEncargo): number {
    return pedido.costoProducto + pedido.costoEnvioApp + this.calcularComisionTotal(pedido);
  }

  calcularSaldoPendiente(pedido: PedidoEncargo): number {
    return this.calcularTotalCobrarCliente(pedido) - pedido.anticipoDado;
  }

  // --- CONTROL DEL MODAL NUEVO ---
  mostrarModal = signal(false);

  pedidoNuevo = signal<Partial<PedidoEncargo>>({
    cliente: '', telefono: '', plataforma: 'Mercado Libre', productoDescripcion: '',
    costoProducto: 0, costoEnvioApp: 0, tipoComision: 'Fija', valorComision: 50,
    anticipoDado: 0, estado: 'Pendiente de Compra', guiaRastreo: ''
  });

  abrirModalNuevo() {
    this.pedidoNuevo.set({
      cliente: '', telefono: '', plataforma: 'Mercado Libre', productoDescripcion: '',
      costoProducto: null as any, costoEnvioApp: 0, tipoComision: 'Fija', valorComision: 50,
      anticipoDado: 0, estado: 'Pendiente de Compra', guiaRastreo: ''
    });
    this.mostrarModal.set(true);
  }

  cerrarModal() {
    this.mostrarModal.set(false);
  }

  guardarPedidoNuevo() {
    const p = this.pedidoNuevo() as PedidoEncargo;

    if (!p.cliente || !p.productoDescripcion || !p.costoProducto) {
      this.notificacionSvc.mostrar('error', 'Por favor, llena el cliente, descripción y el costo del producto.');
      return;
    }

    const nuevoFolio = 'PED-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');

    const payloadParaBackend = {
      folio: nuevoFolio,
      nombre_cliente: p.cliente,
      telefono: p.telefono,
      plataforma: p.plataforma,
      producto_descripcion: p.productoDescripcion,
      costo_producto: p.costoProducto,
      costo_envio_app: p.costoEnvioApp,
      tipo_comision: p.tipoComision,
      valor_comision: p.valorComision,
      anticipo_dado: p.anticipoDado,
      estado: p.estado,
      guia_rastreo: p.guiaRastreo || null
    };

    this.http.post('https://pos-backend-nz8u.onrender.com/api/pedidos-encargo', payloadParaBackend).subscribe({
      next: (respuestaBackend: any) => {
        const nuevoPedidoCompletado: PedidoEncargo = {
          ...p,
          id: respuestaBackend.folio,
          fechaRegistro: respuestaBackend.fecha_registro
        };

        this.pedidos.update(actuales => [nuevoPedidoCompletado, ...actuales]);
        this.cerrarModal();
        this.notificacionSvc.mostrar('success', `Pedido de ${p.cliente} registrado en la BD.`);
      },
      error: (err: any) => {
        console.error('Error al guardar:', err);
        this.notificacionSvc.mostrar('error', 'Error al guardar en el servidor.');
      }
    });
  }

  // --- ACCIONES DE TARJETA ---

  // Variables para el Modal de Actualización
  mostrarModalActualizar = signal(false);
  pedidoAActualizar = signal<PedidoEncargo | null>(null);
  nuevoEstado = signal<PedidoEncargo['estado']>('Pendiente de Compra');
  nuevaGuia = signal<string>('');

  cambiarEstado(pedido: PedidoEncargo) {
    this.pedidoAActualizar.set(pedido);
    this.nuevoEstado.set(pedido.estado);
    this.nuevaGuia.set(pedido.guiaRastreo || '');
    this.mostrarModalActualizar.set(true);
  }

  cerrarModalActualizar() {
    this.mostrarModalActualizar.set(false);
    this.pedidoAActualizar.set(null);
  }

  guardarActualizacionEstado() {
    const pedido = this.pedidoAActualizar();
    if (!pedido) return;

    // Preparamos los datos para enviar al backend
    const payloadActualizacion = {
      estado: this.nuevoEstado(),
      guia_rastreo: this.nuevaGuia()
    };

    // Petición PUT para actualizar en PostgreSQL
    this.http.put(`https://pos-backend-nz8u.onrender.com/api/pedidos-encargo/${pedido.id}`, payloadActualizacion).subscribe({
      next: () => {
        // Actualizamos visualmente solo si el backend confirmó
        this.pedidos.update(actuales =>
          actuales.map(p =>
            p.id === pedido.id
              ? { ...p, estado: this.nuevoEstado(), guiaRastreo: this.nuevaGuia() }
              : p
          )
        );
        this.notificacionSvc.mostrar('success', `Estado de ${pedido.id} actualizado a "${this.nuevoEstado()}"`);
        this.cerrarModalActualizar();
      },
      error: (err) => {
        console.error('Error al actualizar:', err);
        this.notificacionSvc.mostrar('error', 'Error al guardar el nuevo estado en la base de datos.');
      }
    });
  }

  // Función de Cancelar / Eliminar
  // Función de Cancelar (Borrado Lógico)
  cancelarPedido(pedido: PedidoEncargo) {
    const confirmar = confirm(`¿Estás seguro de que quieres cancelar el pedido de ${pedido.cliente}?`);

    if (confirmar) {
      // Mandamos un PUT para cambiar el estado, sin destruir el registro
      const payloadActualizacion = { estado: 'Cancelado' };

      this.http.put(`https://pos-backend-nz8u.onrender.com/api/pedidos-encargo/${pedido.id}`, payloadActualizacion).subscribe({
        next: () => {
          // Actualizamos la tarjeta visualmente al instante
          this.pedidos.update(actuales =>
            actuales.map(p =>
              p.id === pedido.id ? { ...p, estado: 'Cancelado' as any } : p
            )
          );
          this.notificacionSvc.mostrar('success', `El pedido de ${pedido.cliente} ha sido cancelado.`);
        },
        error: (err) => {
          console.error('Error al cancelar:', err);
          this.notificacionSvc.mostrar('error', 'Error al cancelar el pedido en el servidor.');
        }
      });
    }
  }
  // Variables para el Ticket
  pedidoAImprimir = signal<PedidoEncargo | null>(null);
  fechaImpresion = new Date();

  imprimirTicket(pedido: PedidoEncargo) {
    this.pedidoAImprimir.set(pedido);
    this.fechaImpresion = new Date();

    setTimeout(() => {
      window.print();
      this.notificacionSvc.mostrar('success', `Comprobante impreso para ${pedido.cliente}`);
    }, 500);
  }

  // --- CALCULADORAS EN TIEMPO REAL PARA EL MODAL ---
  calcularComisionVistaPrevia(): number {
    const p = this.pedidoNuevo();
    const costo = p.costoProducto || 0;
    const envio = p.costoEnvioApp || 0;
    const valorComision = p.valorComision || 0;

    if (p.tipoComision === 'Fija') {
      return valorComision;
    } else {
      return (costo + envio) * (valorComision / 100);
    }
  }

  calcularTotalVistaPrevia(): number {
    const costo = this.pedidoNuevo().costoProducto || 0;
    const envio = this.pedidoNuevo().costoEnvioApp || 0;
    return costo + envio + this.calcularComisionVistaPrevia();
  }

  async compartirTicketMagico(pedido: PedidoEncargo) {
    if (!pedido.telefono) {
      this.notificacionSvc.mostrar('error', 'El cliente no tiene teléfono registrado.');
      return;
    }

    // 1. Preparamos el HTML oculto
    this.pedidoAImprimir.set(pedido);
    this.notificacionSvc.mostrar('success', 'Generando comprobante digital...');

    // 2. Esperamos un instante a que Angular lo dibuje
    setTimeout(async () => {
      const elemento = document.getElementById('comprobante-digital');
      if (!elemento) return;

      try {
        // 3. Tomamos la "foto"
        const canvas = await html2canvas(elemento, { scale: 2 });

        // 4. Convertimos la foto a un archivo virtual (Blob)
        canvas.toBlob(async (blob) => {
          if (!blob) return;

          const telefonoLimpio = pedido.telefono.replace(/\D/g, '');
          const urlWhatsApp = `https://wa.me/52${telefonoLimpio}?text=Hola%20${pedido.cliente},%20aquí%20tienes%20el%20comprobante%20de%20tu%20encargo.%20¡Excelente%20día!`;

          try {
            // INTENTO 1: Dispositivos Móviles / Tablets (Web Share API)
            // Si estás en un celular, esto abre el menú nativo de compartir (WhatsApp, Messenger, etc) con la imagen ya pegada.
            if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
              const file = new File([blob], `Ticket_${pedido.id}.png`, { type: 'image/png' });
              await navigator.share({
                title: 'Comprobante',
                files: [file]
              });
              this.pedidoAImprimir.set(null);
              return;
            }

            // INTENTO 2: Computadoras de Escritorio (Portapapeles + WhatsApp Web)
            // Copiamos la imagen al portapapeles
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);

            this.notificacionSvc.mostrar('success', '¡Imagen copiada! Abriendo WhatsApp... Solo dale a Pegar (Ctrl + V)');

            // Abrimos WhatsApp Web
            setTimeout(() => window.open(urlWhatsApp, '_blank'), 1500);

          } catch (err) {
            console.error('No se pudo copiar/compartir:', err);
            this.notificacionSvc.mostrar('error', 'Error. Asegúrate de dar permisos de portapapeles al navegador.');
          }

          this.pedidoAImprimir.set(null); // Limpiamos el molde
        }, 'image/png');

      } catch (error) {
        console.error('Error html2canvas:', error);
        this.pedidoAImprimir.set(null);
      }
    }, 150);
  }

  notificarEstadoWhatsApp(pedido: PedidoEncargo) {
    if (!pedido.telefono) {
      this.notificacionSvc.mostrar('error', 'Este cliente no tiene teléfono registrado.');
      return;
    }

    // Usando tu nombre de marca "Luis Carlos Creative Click"
    let mensaje = `Hola *${pedido.cliente}*, te saludamos de *Luis Carlos Creative Click* 👋\n\n`;
    mensaje += `Te escribimos para actualizarte sobre tu encargo: *${pedido.productoDescripcion}* (Folio: ${pedido.id}).\n\n`;

    // Evaluamos el estado
    switch (pedido.estado) {
      case 'Pendiente de Compra':
        mensaje += `⏳ *Estado Actual:* Tu pedido está en lista de espera. Te avisaremos en cuanto se procese el pago.\n`;
        mensaje += `\n*Saldo pendiente a la entrega:* $${this.calcularSaldoPendiente(pedido).toFixed(2)}`;
        break;

      case 'En Tránsito':
        mensaje += `🚚 *Estado Actual:* ¡Tu pedido ya viene en camino!\n`;
        if (pedido.guiaRastreo) {
          mensaje += `📍 *Guía de Rastreo:* ${pedido.guiaRastreo}\n`;
        }
        mensaje += `Te avisaremos en cuanto lo recibamos.`;
        break;

      case 'Recibido en Local':
        // Aquí está exactamente la redacción que me mostraste en tu captura
        mensaje += `🎉 *¡TU PEDIDO YA ESTÁ AQUÍ!* 🎉\n\n`;
        mensaje += `Le informamos que su pedido ya se encuentra disponible para ser recogido en nuestro local dentro del horario de atención establecido.\n\n`;
        mensaje += `En caso de que no le sea posible pasar por él, le notificamos que realizaremos la entrega directamente a su domicilio, por lo que estará recibiéndolo en la puerta de su casa entre el día de hoy y mañana.`;
        break;

      case 'Entregado al Cliente':
        mensaje += `✅ *Estado Actual:* Entregado.\n\n`;
        mensaje += `¡Muchas gracias por tu preferencia y por confiar en nosotros! Esperamos verte pronto.`;
        break;

      case 'Cancelado':
        mensaje += `❌ *Estado Actual:* Cancelado.\n\n`;
        mensaje += `Lamentamos informarte que este pedido ha sido cancelado.`;
        break;

      default:
        mensaje += `🔍 *Estado Actual:* ${pedido.estado}`;
    }

    // Limpiamos el teléfono
    const telefonoLimpio = pedido.telefono.replace(/\D/g, '');

    // EL TRUCO: Usar la API completa de WhatsApp en lugar de wa.me para evitar que se rompa la codificación
    const urlWhatsApp = `https://api.whatsapp.com/send?phone=52${telefonoLimpio}&text=${encodeURIComponent(mensaje)}`;

    // Abrimos WhatsApp Web
    window.open(urlWhatsApp, '_blank');

    this.notificacionSvc.mostrar('success', 'Abriendo WhatsApp para notificar al cliente...');
  }
}