import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        // Cambiamos 'punto-venta' por 'dashboard' para que sea tu página de inicio
        redirectTo: 'dashboard',
        pathMatch: 'full'
    },
    {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardComponent)
    },
    {
        path: 'punto-venta',
        loadComponent: () => import('./pages/punto-de-venta/punto-de-venta').then(m => m.PuntoDeVentaComponent)
    },
    {
        path: 'recargas',
        loadComponent: () => import('./pages/recargas/recargas').then(m => m.RecargasComponent)
    },
    {
        path: 'inventario',
        loadComponent: () => import('./pages/inventario/inventario').then(m => m.InventarioComponent)
    },

    {
        path: 'clientes',
        loadComponent: () => import('./pages/clientes/clientes').then(m => m.ClientesComponent)
    },
    {
        path: 'reportes',
        loadComponent: () => import('./pages/reportes/reportes').then(m => m.ReportesComponent)
    },
    {
        path: 'ajustes',
        loadComponent: () => import('./pages/ajustes/ajustes').then(m => m.AjustesComponent)
    },
    {
        path: 'pedidos',
        loadComponent: () => import('./pages/pedidos/pedidos').then(m => m.PedidosComponent)
    }
];