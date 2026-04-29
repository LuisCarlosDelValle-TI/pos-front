import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  tipo: 'success' | 'error' | 'warning' | 'info';
  mensaje: string;
}

@Injectable({
  providedIn: 'root' // Disponible en toda la app
})
export class NotificationService {

  toasts = signal<Toast[]>([]);
  private contadorId = 0;

  mostrar(tipo: Toast['tipo'], mensaje: string) {
    const id = this.contadorId++;

    // Agregar a la lista
    this.toasts.update(actuales => [...actuales, { id, tipo, mensaje }]);

    // Quitarlo automáticamente después de 3 segundos
    setTimeout(() => this.remover(id), 3000);
  }

  remover(id: number) {
    this.toasts.update(actuales => actuales.filter(t => t.id !== id));
  }
}