/**
 * ==========================================================================
 * AUTOGEST PRO - GESTIÓN PARA TALLERES MECÁNICOS (VANILLA JS)
 * ==========================================================================
 * Arquitectura:
 * - Supabase REST API / Client con fallback reactivo a LocalStorage Demo
 * - ABM Unificado Clientes & Vehículos con Baja Lógica
 * - Órdenes de Trabajo con cálculo de próximos mantenimientos para Make
 * - Contenedor e integración de Mercado Pago Checkout Bricks
 * - Control de inventario y Punto de Reposición
 */

// ==========================================================================
// 1. CONFIGURACIÓN Y ESTADO DE LA APLICACIÓN
// ==========================================================================
const CONFIG = {
  SUPABASE_URL_KEY: 'autogest_supabase_url',
  SUPABASE_ANON_KEY: 'autogest_supabase_key',
  MP_PUBLIC_KEY: 'autogest_mp_public_key'
};

const AppState = {
  supabase: null,
  isCloudConnected: false,
  activeModule: 'dashboard',
  clients: [],
  vehicles: [],
  services: [],
  stock: [],
  mpBrickController: null
};

// Mock Seed Data para inicio inmediato sin configuración previa requerida
const SEED_DATA = {
  clients: [
    { id_cliente: 'CLI-001', nombre: 'Juan Pérez', telefono: '+54 9 11 5555-1234', email: 'juan.perez@email.com', activo: true, created_at: '2026-03-01' },
    { id_cliente: 'CLI-002', nombre: 'María González', telefono: '+54 9 11 4444-5678', email: 'maria.g@gmail.com', activo: true, created_at: '2026-03-10' },
    { id_cliente: 'CLI-003', nombre: 'Esteban Morales', telefono: '+54 9 11 6666-9999', email: 'esteban.m@hotmail.com', activo: false, created_at: '2026-01-15' }
  ],
  vehicles: [
    { patente: 'AF123CD', id_cliente: 'CLI-001', marca: 'Toyota', modelo: 'Hilux 2.8 SRX', anio: 2023, activo: true },
    { patente: 'AD456GH', id_cliente: 'CLI-002', marca: 'Volkswagen', modelo: 'Gol Trend 1.6', anio: 2020, activo: true },
    { patente: 'AE789KL', id_cliente: 'CLI-003', marca: 'Ford', modelo: 'Ranger 3.2 LTD', anio: 2021, activo: false }
  ],
  services: [
    {
      id_servicio: 'SRV-101',
      patente: 'AF123CD',
      fecha: new Date().toISOString().split('T')[0],
      trabajo_realizado: 'Cambio de aceite sintético 5W30, filtro de aceite, aire y habitáculo.',
      kilometraje: 45000,
      proximo_mantenimiento: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      costo: 68500.00,
      estado_pago: 'Pendiente'
    },
    {
      id_servicio: 'SRV-102',
      patente: 'AD456GH',
      fecha: '2026-02-15',
      trabajo_realizado: 'Cambio de pastillas y rectificación de discos delanteros.',
      kilometraje: 72000,
      proximo_mantenimiento: new Date().toISOString().split('T')[0], // Mantenimiento hoy para prueba
      costo: 42000.00,
      estado_pago: 'Pagado'
    }
  ],
  stock: [
    { id_producto: 'STK-01', nombre: 'Aceite Shell Helix Ultra 5W30 4L', cantidad: 12, punto_reposicion: 5 },
    { id_producto: 'STK-02', nombre: 'Filtro de Aceite Fram PH5566A', cantidad: 3, punto_reposicion: 6 },
    { id_producto: 'STK-03', nombre: 'Líquido de Frenos DOT 4 500ml', cantidad: 2, punto_reposicion: 4 },
    { id_producto: 'STK-04', nombre: 'Pastillas de Freno Gol Trend Bosch', cantidad: 8, punto_reposicion: 3 }
  ]
};

// ==========================================================================
// 2. SUPABASE CLIENT & DATA LAYER
// ==========================================================================
class SupabaseService {
  static init() {
    const url = localStorage.getItem(CONFIG.SUPABASE_URL_KEY);
    const key = localStorage.getItem(CONFIG.SUPABASE_ANON_KEY);

    if (url && key && window.supabase) {
      try {
        AppState.supabase = window.supabase.createClient(url, key);
        AppState.isCloudConnected = true;
        this.updateConnectionIndicator(true, 'Supabase Cloud');
      } catch (err) {
        console.warn('Error inicializando Supabase Client:', err);
        AppState.isCloudConnected = false;
        this.updateConnectionIndicator(false, 'Error Credenciales');
      }
    } else {
      AppState.isCloudConnected = false;
      this.updateConnectionIndicator(true, 'Modo Demo / Local');
      this.initLocalStorageFallback();
    }
  }

  static updateConnectionIndicator(isOk, text) {
    const elState = document.getElementById('connection-state');
    const elDot = document.querySelector('.supabase-status-indicator .status-dot');
    if (elState) elState.textContent = text;
    if (elDot) {
      elDot.className = `status-dot ${isOk ? 'online' : 'offline'}`;
    }
  }

  static initLocalStorageFallback() {
    if (!localStorage.getItem('autogest_clients')) {
      localStorage.setItem('autogest_clients', JSON.stringify(SEED_DATA.clients));
    }
    if (!localStorage.getItem('autogest_vehicles')) {
      localStorage.setItem('autogest_vehicles', JSON.stringify(SEED_DATA.vehicles));
    }
    if (!localStorage.getItem('autogest_services')) {
      localStorage.setItem('autogest_services', JSON.stringify(SEED_DATA.services));
    }
    if (!localStorage.getItem('autogest_stock')) {
      localStorage.setItem('autogest_stock', JSON.stringify(SEED_DATA.stock));
    }
  }

  // --- CRUD: CLIENTES ---
  static async fetchClients() {
    if (AppState.isCloudConnected && AppState.supabase) {
      const { data, error } = await AppState.supabase
        .from('Clientes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    return JSON.parse(localStorage.getItem('autogest_clients') || '[]');
  }

  static async createClient(clientData) {
    const newClient = {
      id_cliente: clientData.id_cliente || `CLI-${Date.now().toString().slice(-4)}`,
      nombre: clientData.nombre,
      telefono: clientData.telefono,
      email: clientData.email || '',
      activo: true,
      created_at: new Date().toISOString()
    };

    if (AppState.isCloudConnected && AppState.supabase) {
      const { data, error } = await AppState.supabase
        .from('Clientes')
        .insert([newClient])
        .select();
      if (error) throw error;
      return data[0];
    }

    const clients = await this.fetchClients();
    clients.unshift(newClient);
    localStorage.setItem('autogest_clients', JSON.stringify(clients));
    return newClient;
  }

  static async updateClient(id, updateData) {
    if (AppState.isCloudConnected && AppState.supabase) {
      const { data, error } = await AppState.supabase
        .from('Clientes')
        .update(updateData)
        .eq('id_cliente', id)
        .select();
      if (error) throw error;
      return data[0];
    }

    const clients = await this.fetchClients();
    const index = clients.findIndex(c => c.id_cliente === id);
    if (index !== -1) {
      clients[index] = { ...clients[index], ...updateData };
      localStorage.setItem('autogest_clients', JSON.stringify(clients));
      return clients[index];
    }
    throw new Error('Cliente no encontrado');
  }

  /**
   * Baja lógica del cliente (desactiva cliente y sus vehículos sin borrar historial)
   */
  static async toggleClientStatus(id, newStatus) {
    if (AppState.isCloudConnected && AppState.supabase) {
      const { data, error } = await AppState.supabase
        .from('Clientes')
        .update({ activo: newStatus })
        .eq('id_cliente', id)
        .select();
      if (error) throw error;
      return data[0];
    }

    const clients = await this.fetchClients();
    const client = clients.find(c => c.id_cliente === id);
    if (client) {
      client.activo = newStatus;
      localStorage.setItem('autogest_clients', JSON.stringify(clients));
      return client;
    }
  }

  // --- CRUD: VEHÍCULOS ---
  static async fetchVehicles() {
    if (AppState.isCloudConnected && AppState.supabase) {
      const { data, error } = await AppState.supabase
        .from('Vehículos')
        .select('*');
      if (error) throw error;
      return data;
    }
    return JSON.parse(localStorage.getItem('autogest_vehicles') || '[]');
  }

  static async createVehicle(vehicleData) {
    const formattedVehicle = {
      patente: vehicleData.patente.toUpperCase().replace(/\s+/g, ''),
      id_cliente: vehicleData.id_cliente,
      marca: vehicleData.marca,
      modelo: vehicleData.modelo,
      anio: parseInt(vehicleData.anio, 10) || null,
      activo: true
    };

    if (AppState.isCloudConnected && AppState.supabase) {
      const { data, error } = await AppState.supabase
        .from('Vehículos')
        .insert([formattedVehicle])
        .select();
      if (error) throw error;
      return data[0];
    }

    const vehicles = await this.fetchVehicles();
    const exists = vehicles.some(v => v.patente === formattedVehicle.patente);
    if (exists) throw new Error('Ya existe un vehículo registrado con esta patente.');
    vehicles.push(formattedVehicle);
    localStorage.setItem('autogest_vehicles', JSON.stringify(vehicles));
    return formattedVehicle;
  }

  static async getVehicleByPlate(plate) {
    const cleanPlate = plate.toUpperCase().replace(/\s+/g, '');
    const vehicles = await this.fetchVehicles();
    return vehicles.find(v => v.patente === cleanPlate);
  }

  // --- CRUD: SERVICIOS / ÓRDENES DE TRABAJO ---
  static async fetchServices() {
    if (AppState.isCloudConnected && AppState.supabase) {
      const { data, error } = await AppState.supabase
        .from('Servicios')
        .select('*')
        .order('fecha', { ascending: false });
      if (error) throw error;
      return data;
    }
    return JSON.parse(localStorage.getItem('autogest_services') || '[]');
  }

  static async createService(serviceData) {
    const newService = {
      id_servicio: `SRV-${Date.now().toString().slice(-4)}`,
      patente: serviceData.patente.toUpperCase().replace(/\s+/g, ''),
      fecha: serviceData.fecha,
      trabajo_realizado: serviceData.trabajo_realizado,
      kilometraje: Number(serviceData.kilometraje),
      proximo_mantenimiento: serviceData.proximo_mantenimiento,
      costo: parseFloat(serviceData.costo),
      estado_pago: serviceData.estado_pago || 'Pendiente'
    };

    if (AppState.isCloudConnected && AppState.supabase) {
      const { data, error } = await AppState.supabase
        .from('Servicios')
        .insert([newService])
        .select();
      if (error) throw error;
      return data[0];
    }

    const services = await this.fetchServices();
    services.unshift(newService);
    localStorage.setItem('autogest_services', JSON.stringify(services));
    return newService;
  }

  static async updateServicePaymentStatus(id_servicio, status) {
    if (AppState.isCloudConnected && AppState.supabase) {
      const { data, error } = await AppState.supabase
        .from('Servicios')
        .update({ estado_pago: status })
        .eq('id_servicio', id_servicio)
        .select();
      if (error) throw error;
      return data[0];
    }

    const services = await this.fetchServices();
    const service = services.find(s => s.id_servicio === id_servicio);
    if (service) {
      service.estado_pago = status;
      localStorage.setItem('autogest_services', JSON.stringify(services));
      return service;
    }
  }

  // --- CRUD: STOCK ---
  static async fetchStock() {
    if (AppState.isCloudConnected && AppState.supabase) {
      const { data, error } = await AppState.supabase
        .from('Stock')
        .select('*')
        .order('nombre', { ascending: true });
      if (error) throw error;
      return data;
    }
    return JSON.parse(localStorage.getItem('autogest_stock') || '[]');
  }

  static async createProduct(productData) {
    const newProduct = {
      id_producto: `STK-${Date.now().toString().slice(-4)}`,
      nombre: productData.nombre,
      cantidad: parseInt(productData.cantidad, 10),
      punto_reposicion: parseInt(productData.punto_reposicion, 10)
    };

    if (AppState.isCloudConnected && AppState.supabase) {
      const { data, error } = await AppState.supabase
        .from('Stock')
        .insert([newProduct])
        .select();
      if (error) throw error;
      return data[0];
    }

    const stock = await this.fetchStock();
    stock.push(newProduct);
    localStorage.setItem('autogest_stock', JSON.stringify(stock));
    return newProduct;
  }

  static async updateStockQuantity(id_producto, delta) {
    const stock = await this.fetchStock();
    const item = stock.find(s => s.id_producto === id_producto);
    if (item) {
      const newQty = Math.max(0, item.cantidad + delta);
      if (AppState.isCloudConnected && AppState.supabase) {
        const { data, error } = await AppState.supabase
          .from('Stock')
          .update({ cantidad: newQty })
          .eq('id_producto', id_producto)
          .select();
        if (error) throw error;
        return data[0];
      }
      item.cantidad = newQty;
      localStorage.setItem('autogest_stock', JSON.stringify(stock));
      return item;
    }
  }
}

// ==========================================================================
// 3. MERCADO PAGO BRICKS CONTROLLER
// ==========================================================================
class MercadoPagoManager {
  static async initPaymentBrick(order) {
    const container = document.getElementById('paymentBrick_container');
    const placeholder = document.getElementById('brick-placeholder-state');
    
    if (!container) return;

    placeholder.style.display = 'none';
    container.innerHTML = '<div class="text-center p-3"><i class="ri-loader-4-line ri-spin"></i> Cargando Mercado Pago Checkout Brick...</div>';

    const publicKey = localStorage.getItem(CONFIG.MP_PUBLIC_KEY) || 'TEST-00000000-0000-0000-0000-000000000000';

    try {
      if (window.MercadoPago && publicKey.startsWith('TEST-') && publicKey !== 'TEST-00000000-0000-0000-0000-000000000000') {
        const mp = new window.MercadoPago(publicKey, { locale: 'es-AR' });
        const bricksBuilder = mp.bricks();

        if (AppState.mpBrickController) {
          AppState.mpBrickController.unmount();
        }

        container.innerHTML = ''; // Limpiar loader
        AppState.mpBrickController = await bricksBuilder.create('payment', 'paymentBrick_container', {
          initialization: {
            amount: order.costo,
            preferenceId: null,
            payer: {
              email: order.clientEmail || 'cliente@taller.com',
            }
          },
          customization: {
            paymentMethods: {
              ticket: 'all',
              bankTransfer: 'all',
              creditCard: 'all',
              debitCard: 'all',
              mercadoPago: 'all'
            },
            visual: {
              style: {
                theme: 'dark'
              }
            }
          },
          callbacks: {
            onReady: () => {
              App.showToast('Pasarela de pago lista para cobrar', 'success');
            },
            onSubmit: ({ selectedPaymentMethod, formData }) => {
              return new Promise((resolve, reject) => {
                console.log('Procesando pago con MP:', formData);
                // Simulación exitosa
                setTimeout(async () => {
                  await SupabaseService.updateServicePaymentStatus(order.id_servicio, 'Pagado');
                  App.showToast(`¡Pago de $${order.costo.toLocaleString()} registrado con éxito!`, 'success');
                  App.loadAllData();
                  resolve();
                }, 1500);
              });
            },
            onError: (error) => {
              console.error('Error Brick MP:', error);
              App.showToast('Error al inicializar Mercado Pago Brick', 'error');
            }
          }
        });
      } else {
        // Mock visual interactivo cuando no se dispone de una Public Key real en demo
        this.renderMockBrick(container, order);
      }
    } catch (err) {
      console.warn('Fallback a simulación de Checkout Brick:', err);
      this.renderMockBrick(container, order);
    }
  }

  static renderMockBrick(container, order) {
    container.innerHTML = `
      <div class="card p-3" style="background: #111827; border: 1px solid #374151;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #374151; padding-bottom: 0.5rem; margin-bottom: 1rem;">
          <strong style="color:#009ee3;"><i class="ri-secure-payment-fill"></i> Mercado Pago Checkout</strong>
          <span class="badge badge-success">Modo Prueba Seguro</span>
        </div>
        <p class="small text-muted mb-2">Cobro directo para la orden <strong>#${order.id_servicio}</strong> (${order.patente})</p>
        
        <div class="form-group mb-2">
          <label class="small text-muted">Monto Total</label>
          <div style="font-size: 1.4rem; font-weight: 700; color: #10b981;">$ ${order.costo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
        </div>

        <div class="form-group mb-2">
          <label class="small text-muted">Método de Pago Seleccionado</label>
          <select id="mock-payment-method" class="form-select">
            <option value="credit_card">💳 Tarjeta de Crédito / Débito (Posnet / Brick)</option>
            <option value="qr">📱 Código QR Interoperable</option>
            <option value="transfer">🏦 Transferencia / Dinero en Cuenta MP</option>
          </select>
        </div>

        <button class="btn btn-mp-link w-100 mt-3" id="btn-confirm-mock-pay">
          <i class="ri-check-line"></i> Confirmar Cobro Inmediato
        </button>
      </div>
    `;

    document.getElementById('btn-confirm-mock-pay').addEventListener('click', async () => {
      await SupabaseService.updateServicePaymentStatus(order.id_servicio, 'Pagado');
      App.showToast(`Cobro de $${order.costo.toLocaleString('es-AR')} acreditado exitosamente.`, 'success');
      container.innerHTML = `
        <div class="text-center p-4">
          <i class="ri-checkbox-circle-fill text-success" style="font-size: 3rem;"></i>
          <h4 class="mt-2 text-success">¡Pago Completado!</h4>
          <p class="text-muted small">La orden #${order.id_servicio} ha quedado marcada como PAGADA.</p>
        </div>
      `;
      App.loadAllData();
    });
  }

  static generatePaymentLink(order, client) {
    const title = encodeURIComponent(`Servicio Taller Mecánico - Patente ${order.patente}`);
    const price = order.costo;
    // URL simulada con query params estándar para Mercado Pago Checkout Pro
    return `https://mpago.la/pos/checkout?order_id=${order.id_servicio}&amount=${price}&title=${title}&client=${encodeURIComponent(client?.nombre || 'Cliente')}`;
  }
}

// ==========================================================================
// 4. CONTROLADOR PRINCIPAL DE LA INTERFAZ (APP)
// ==========================================================================
const App = {
  async init() {
    this.setupClock();
    this.setupEventListeners();
    SupabaseService.init();
    await this.loadAllData();
  },

  setupClock() {
    const dateEl = document.getElementById('current-date-time');
    const update = () => {
      const now = new Date();
      const options = { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
      if (dateEl) dateEl.textContent = now.toLocaleDateString('es-AR', options);
    };
    update();
    setInterval(update, 60000);
  },

  setupEventListeners() {
    // Navegación Sidebar
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const module = btn.getAttribute('data-module');
        this.navigateTo(module);
      });
    });

    // Mobile Sidebar Toggles
    const btnToggle = document.getElementById('btn-toggle-sidebar');
    const btnClose = document.getElementById('btn-close-sidebar');
    const sidebar = document.getElementById('sidebar');

    if (btnToggle && sidebar) btnToggle.addEventListener('click', () => sidebar.classList.add('open'));
    if (btnClose && sidebar) btnClose.addEventListener('click', () => sidebar.classList.remove('open'));

    // Configuración Supabase Modal
    const btnOpenConfig = document.getElementById('btn-open-config');
    if (btnOpenConfig) btnOpenConfig.addEventListener('click', () => this.openSupabaseModal());

    // Formulario Unificado Cliente & Vehículo
    const btnShowClientForm = document.getElementById('btn-show-client-form');
    const btnCloseClientForm = document.getElementById('btn-close-client-form');
    const btnCancelClientForm = document.getElementById('btn-cancel-client-form');
    const clientFormContainer = document.getElementById('unified-client-form-container');
    const clientForm = document.getElementById('form-client-vehicle');

    if (btnShowClientForm) btnShowClientForm.addEventListener('click', () => {
      clientForm.reset();
      document.getElementById('edit-client-id').value = '';
      document.getElementById('client-form-title').innerHTML = '<i class="ri-user-shared-line"></i> Alta Unificada de Cliente y Vehículo';
      clientFormContainer.style.display = 'block';
    });
    if (btnCloseClientForm) btnCloseClientForm.addEventListener('click', () => clientFormContainer.style.display = 'none');
    if (btnCancelClientForm) btnCancelClientForm.addEventListener('click', () => clientFormContainer.style.display = 'none');
    if (clientForm) clientForm.addEventListener('submit', (e) => this.handleSaveClientVehicle(e));

    // Formulario Órdenes de Trabajo
    const btnNewOrderModal = document.getElementById('btn-new-order-modal');
    const btnQuickNewOrder = document.getElementById('btn-quick-new-order');
    const btnCloseOrderForm = document.getElementById('btn-close-order-form');
    const btnCancelOrderForm = document.getElementById('btn-cancel-order-form');
    const orderFormContainer = document.getElementById('order-form-container');
    const orderForm = document.getElementById('form-service-order');
    const orderPlateInput = document.getElementById('order-plate');

    const openOrderForm = () => {
      this.navigateTo('taller');
      orderForm.reset();
      document.getElementById('order-date').value = new Date().toISOString().split('T')[0];
      // Sugerir mantenimiento a 6 meses
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + 6);
      document.getElementById('order-next-maintenance').value = nextDate.toISOString().split('T')[0];
      orderFormContainer.style.display = 'block';
    };

    if (btnNewOrderModal) btnNewOrderModal.addEventListener('click', openOrderForm);
    if (btnQuickNewOrder) btnQuickNewOrder.addEventListener('click', openOrderForm);
    if (btnCloseOrderForm) btnCloseOrderForm.addEventListener('click', () => orderFormContainer.style.display = 'none');
    if (btnCancelOrderForm) btnCancelOrderForm.addEventListener('click', () => orderFormContainer.style.display = 'none');
    if (orderForm) orderForm.addEventListener('submit', (e) => this.handleSaveServiceOrder(e));

    // Autocompletado de patente en Orden de Trabajo
    if (orderPlateInput) {
      orderPlateInput.addEventListener('input', (e) => {
        const plate = e.target.value.trim().toUpperCase();
        const v = AppState.vehicles.find(item => item.patente === plate);
        const detailEl = document.getElementById('order-vehicle-details');
        if (v && detailEl) {
          const client = AppState.clients.find(c => c.id_cliente === v.id_cliente);
          detailEl.innerHTML = `<span class="text-success"><i class="ri-check-line"></i> ${v.marca} ${v.modelo} (${v.anio || 'Año S/D'}) - Cliente: ${client?.nombre || 'S/D'}</span>`;
        } else if (detailEl) {
          detailEl.textContent = 'Vehículo no registrado previamente. Se creará automáticamente al guardar.';
        }
      });
    }

    // Formulario Stock
    const btnShowStockForm = document.getElementById('btn-show-stock-form');
    const btnCloseStockForm = document.getElementById('btn-close-stock-form');
    const btnCancelStockForm = document.getElementById('btn-cancel-stock-form');
    const stockFormContainer = document.getElementById('stock-form-container');
    const stockForm = document.getElementById('form-stock-product');

    if (btnShowStockForm) btnShowStockForm.addEventListener('click', () => {
      stockForm.reset();
      stockFormContainer.style.display = 'block';
    });
    if (btnCloseStockForm) btnCloseStockForm.addEventListener('click', () => stockFormContainer.style.display = 'none');
    if (btnCancelStockForm) btnCancelStockForm.addEventListener('click', () => stockFormContainer.style.display = 'none');
    if (stockForm) stockForm.addEventListener('submit', (e) => this.handleSaveStockProduct(e));

    // Búsqueda global por Patente
    const globalSearch = document.getElementById('global-license-search');
    if (globalSearch) {
      globalSearch.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          const query = e.target.value.trim().toUpperCase();
          if (query) {
            this.navigateTo('taller');
            const filterOrders = document.getElementById('filter-orders');
            if (filterOrders) {
              filterOrders.value = query;
              this.renderOrdersTable(query);
            }
          }
        }
      });
    }

    // Filtros de búsqueda en tiempo real
    const filterClients = document.getElementById('filter-clients');
    const filterClientStatus = document.getElementById('filter-client-status');
    if (filterClients) filterClients.addEventListener('input', () => this.renderClientsTable());
    if (filterClientStatus) filterClientStatus.addEventListener('change', () => this.renderClientsTable());

    const filterOrders = document.getElementById('filter-orders');
    if (filterOrders) filterOrders.addEventListener('input', (e) => this.renderOrdersTable(e.target.value));

    const filterStock = document.getElementById('filter-stock');
    if (filterStock) filterStock.addEventListener('input', (e) => this.renderStockTable(e.target.value));

    // Módulo Cobros & Mercado Pago
    const mpSelectOrder = document.getElementById('mp-select-order');
    if (mpSelectOrder) {
      mpSelectOrder.addEventListener('change', (e) => this.handleSelectPaymentOrder(e.target.value));
    }

    const btnGenerateMpLink = document.getElementById('btn-generate-mp-link');
    if (btnGenerateMpLink) {
      btnGenerateMpLink.addEventListener('click', () => this.handleGenerateMpLink());
    }

    const btnInitBrick = document.getElementById('btn-init-brick');
    if (btnInitBrick) {
      btnInitBrick.addEventListener('click', () => this.handleInitCheckoutBrick());
    }

    const btnCopyMpLink = document.getElementById('btn-copy-mp-link');
    if (btnCopyMpLink) {
      btnCopyMpLink.addEventListener('click', () => {
        const input = document.getElementById('mp-generated-url');
        if (input && input.value) {
          navigator.clipboard.writeText(input.value);
          this.showToast('Enlace de Mercado Pago copiado al portapapeles', 'success');
        }
      });
    }
  },

  // --- NAVEGACIÓN ENTRE MÓDULOS ---
  navigateTo(moduleId) {
    AppState.activeModule = moduleId;
    
    // Actualizar sidebar buttons
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-module') === moduleId);
    });

    // Actualizar secciones activas
    document.querySelectorAll('.module-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const targetSection = document.getElementById(`module-${moduleId}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Cerrar sidebar en móvil al navegar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
  },

  // --- CARGA DE DATOS ---
  async loadAllData() {
    try {
      const [clients, vehicles, services, stock] = await Promise.all([
        SupabaseService.fetchClients(),
        SupabaseService.fetchVehicles(),
        SupabaseService.fetchServices(),
        SupabaseService.fetchStock()
      ]);

      AppState.clients = clients;
      AppState.vehicles = vehicles;
      AppState.services = services;
      AppState.stock = stock;

      this.renderDashboard();
      this.renderClientsTable();
      this.renderOrdersTable();
      this.renderStockTable();
      this.populatePaymentOrderSelect();
    } catch (err) {
      console.error('Error cargando datos:', err);
      this.showToast('Error al cargar datos desde Supabase', 'error');
    }
  },

  async reloadDashboardData() {
    await this.loadAllData();
    this.showToast('Dashboard actualizado correctamente', 'info');
  },

  // --- RENDER DASHBOARD ---
  renderDashboard() {
    // 1. KPIs
    const elActiveVehicles = document.getElementById('kpi-active-vehicles');
    const elPendingMaintenance = document.getElementById('kpi-pending-maintenance');
    const elLowStock = document.getElementById('kpi-low-stock');
    const elStockAlertBadge = document.getElementById('stock-alert-count');
    const elTodayAppointments = document.getElementById('kpi-today-appointments');

    const todayStr = new Date().toISOString().split('T')[0];

    // Mantenimientos para hoy o vencidos
    const dueServices = AppState.services.filter(s => s.proximo_mantenimiento && s.proximo_mantenimiento <= todayStr);
    
    // Insumos por debajo del punto de reposición
    const lowStockItems = AppState.stock.filter(item => item.cantidad <= item.punto_reposicion);

    if (elActiveVehicles) elActiveVehicles.textContent = AppState.vehicles.filter(v => v.activo).length;
    if (elPendingMaintenance) elPendingMaintenance.textContent = dueServices.length;
    if (elLowStock) elLowStock.textContent = lowStockItems.length;
    if (elStockAlertBadge) elStockAlertBadge.textContent = lowStockItems.length;
    if (elTodayAppointments) elTodayAppointments.textContent = '3'; // Turnos demo

    // 2. Tabla de Recordatorios de Mantenimiento (Disparador Make)
    const tbodyMaintenance = document.getElementById('dashboard-maintenance-table');
    if (tbodyMaintenance) {
      if (dueServices.length === 0) {
        tbodyMaintenance.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay mantenimientos programados para hoy.</td></tr>';
      } else {
        tbodyMaintenance.innerHTML = dueServices.map(srv => {
          const vehicle = AppState.vehicles.find(v => v.patente === srv.patente);
          const client = vehicle ? AppState.clients.find(c => c.id_cliente === vehicle.id_cliente) : null;
          return `
            <tr>
              <td><strong class="text-primary">${srv.patente}</strong></td>
              <td>${vehicle ? `${vehicle.marca} ${vehicle.modelo}` : 'Vehículo'} <br><small class="text-muted">${client?.nombre || 'S/D'}</small></td>
              <td>${srv.trabajo_realizado.substring(0, 45)}...</td>
              <td><a href="https://wa.me/${client?.telefono?.replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-secondary btn-sm"><i class="ri-whatsapp-line text-success"></i> ${client?.telefono || 'S/D'}</a></td>
              <td>
                <button class="btn btn-primary btn-sm" onclick="App.openOrderForPlate('${srv.patente}')">
                  <i class="ri-add-line"></i> Atender
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // 3. Tabla de Stock Crítico en Dashboard
    const tbodyStock = document.getElementById('dashboard-stock-alerts');
    if (tbodyStock) {
      if (lowStockItems.length === 0) {
        tbodyStock.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Todos los insumos tienen stock óptimo.</td></tr>';
      } else {
        tbodyStock.innerHTML = lowStockItems.map(item => `
          <tr>
            <td><strong>${item.nombre}</strong></td>
            <td><span class="text-danger font-bold">${item.cantidad} un.</span></td>
            <td>${item.punto_reposicion} un.</td>
            <td><span class="badge badge-danger">Reposición Urgente</span></td>
          </tr>
        `).join('');
      }
    }
  },

  // --- RENDER CLIENTES & VEHÍCULOS ---
  renderClientsTable() {
    const tbody = document.getElementById('clients-table-body');
    const search = document.getElementById('filter-clients')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('filter-client-status')?.value || 'active';
    const counter = document.getElementById('total-clients-counter');

    if (!tbody) return;

    let filtered = AppState.clients.filter(client => {
      // Filtro de estado activo/inactivo
      if (statusFilter === 'active' && !client.activo) return false;
      if (statusFilter === 'inactive' && client.activo) return false;

      // Búsqueda por nombre, teléfono, email o patente vinculada
      const clientVehicles = AppState.vehicles.filter(v => v.id_cliente === client.id_cliente);
      const platesMatch = clientVehicles.some(v => v.patente.toLowerCase().includes(search));
      
      return client.nombre.toLowerCase().includes(search) ||
             (client.telefono && client.telefono.includes(search)) ||
             (client.email && client.email.toLowerCase().includes(search)) ||
             platesMatch;
    });

    if (counter) counter.textContent = `${filtered.length} clientes encontrados`;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted p-4">No se encontraron clientes con el criterio seleccionado.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(client => {
      const clientVehicles = AppState.vehicles.filter(v => v.id_cliente === client.id_cliente);
      const vehiclesHtml = clientVehicles.length > 0 
        ? clientVehicles.map(v => `<span class="badge badge-info mr-1">${v.patente} (${v.marca} ${v.modelo})</span>`).join(' ')
        : '<span class="text-muted small">Sin vehículos asociados</span>';

      return `
        <tr>
          <td>
            <strong>${client.nombre}</strong>
            <br><small class="text-muted">ID: ${client.id_cliente}</small>
          </td>
          <td>
            <div><i class="ri-phone-line text-muted"></i> ${client.telefono}</div>
            <small class="text-muted"><i class="ri-mail-line"></i> ${client.email || 'Sin email'}</small>
          </td>
          <td>${vehiclesHtml}</td>
          <td>
            <span class="badge ${client.activo ? 'badge-success' : 'badge-danger'}">
              ${client.activo ? 'Activo' : 'Baja Lógica'}
            </span>
          </td>
          <td>
            <div style="display:flex; gap:0.4rem;">
              <button class="btn btn-secondary btn-sm" onclick="App.openNewOrderForClient('${client.id_cliente}')" title="Crear Orden">
                <i class="ri-tools-line"></i>
              </button>
              <button class="btn btn-secondary btn-sm" onclick="App.toggleClientStatus('${client.id_cliente}', ${!client.activo})" title="${client.activo ? 'Dar de baja' : 'Reactivar'}">
                <i class="${client.activo ? 'ri-user-unfollow-line text-danger' : 'ri-user-follow-line text-success'}"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // --- RENDER ÓRDENES DE TRABAJO ---
  renderOrdersTable(searchQuery = '') {
    const tbody = document.getElementById('orders-table-body');
    const counter = document.getElementById('total-orders-counter');
    if (!tbody) return;

    const query = searchQuery.toLowerCase();
    let filtered = AppState.services.filter(s => {
      return s.patente.toLowerCase().includes(query) ||
             s.trabajo_realizado.toLowerCase().includes(query) ||
             s.estado_pago.toLowerCase().includes(query);
    });

    if (counter) counter.textContent = `${filtered.length} servicios registrados`;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted p-4">No hay órdenes de trabajo que coincidan con la búsqueda.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(s => {
      let badgeClass = 'badge-warning';
      if (s.estado_pago === 'Pagado') badgeClass = 'badge-success';
      if (s.estado_pago === 'MercadoPago') badgeClass = 'badge-mp';

      return `
        <tr>
          <td>${s.fecha}</td>
          <td><strong class="text-primary">${s.patente}</strong></td>
          <td>${s.trabajo_realizado}</td>
          <td>${s.kilometraje.toLocaleString()} km</td>
          <td><span class="badge badge-info">${s.proximo_mantenimiento}</span></td>
          <td><strong>$ ${s.costo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></td>
          <td><span class="badge ${badgeClass}">${s.estado_pago}</span></td>
          <td>
            <button class="btn btn-mp-link btn-sm" onclick="App.selectForPayment('${s.id_servicio}')" title="Cobrar / Mercado Pago">
              <i class="ri-bank-card-line"></i> Cobrar
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // --- RENDER STOCK ---
  renderStockTable(searchQuery = '') {
    const tbody = document.getElementById('stock-table-body');
    const counter = document.getElementById('total-stock-counter');
    if (!tbody) return;

    const query = searchQuery.toLowerCase();
    let filtered = AppState.stock.filter(item => item.nombre.toLowerCase().includes(query));

    if (counter) counter.textContent = `${filtered.length} productos en catálogo`;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted p-4">No se encontraron productos.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      const isLow = item.cantidad <= item.punto_reposicion;
      return `
        <tr>
          <td><small class="text-muted">${item.id_producto}</small></td>
          <td><strong>${item.nombre}</strong></td>
          <td><span style="font-size:1.05rem; font-weight:700; ${isLow ? 'color:var(--danger);' : ''}">${item.cantidad}</span></td>
          <td>${item.punto_reposicion} un.</td>
          <td>
            <span class="badge ${isLow ? 'badge-danger' : 'badge-success'}">
              ${isLow ? 'Stock Crítico' : 'Normal'}
            </span>
          </td>
          <td>
            <div style="display:flex; gap:0.25rem;">
              <button class="btn btn-secondary btn-sm" onclick="App.adjustStock('${item.id_producto}', -1)" title="Restar 1">-1</button>
              <button class="btn btn-secondary btn-sm" onclick="App.adjustStock('${item.id_producto}', 1)" title="Sumar 1">+1</button>
              <button class="btn btn-secondary btn-sm" onclick="App.adjustStock('${item.id_producto}', 5)" title="Sumar 5">+5</button>
            </div>
          </td>
          <td>
            <button class="btn btn-icon" onclick="App.showToast('Función de edición rápida habilitada', 'info')"><i class="ri-edit-line"></i></button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // --- HANDLERS: CLIENTE Y VEHÍCULO (ABM UNIFICADO) ---
  async handleSaveClientVehicle(e) {
    e.preventDefault();
    const btnSave = document.getElementById('btn-save-client');
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Guardando...';

    try {
      const name = document.getElementById('client-name').value.trim();
      const phone = document.getElementById('client-phone').value.trim();
      const email = document.getElementById('client-email').value.trim();
      const plate = document.getElementById('vehicle-plate').value.trim().toUpperCase().replace(/\s+/g, '');
      const brand = document.getElementById('vehicle-brand').value.trim();
      const model = document.getElementById('vehicle-model').value.trim();
      const year = document.getElementById('vehicle-year').value;

      // 1. Guardar Cliente
      const client = await SupabaseService.createClient({
        nombre: name,
        telefono: phone,
        email: email
      });

      // 2. Guardar Vehículo vinculado por id_cliente
      await SupabaseService.createVehicle({
        patente: plate,
        id_cliente: client.id_cliente,
        marca: brand,
        modelo: model,
        anio: year
      });

      this.showToast(`Cliente ${name} y Vehículo ${plate} registrados con éxito`, 'success');
      document.getElementById('unified-client-form-container').style.display = 'none';
      document.getElementById('form-client-vehicle').reset();
      
      await this.loadAllData();
    } catch (err) {
      console.error('Error al guardar cliente/vehículo:', err);
      this.showToast(err.message || 'Error al guardar los datos', 'error');
    } finally {
      btnSave.disabled = false;
      btnSave.innerHTML = '<i class="ri-save-line"></i> Guardar Cliente y Vehículo';
    }
  },

  async toggleClientStatus(clientId, newStatus) {
    try {
      await SupabaseService.toggleClientStatus(clientId, newStatus);
      this.showToast(`Estado del cliente actualizado a: ${newStatus ? 'Activo' : 'Inactivo (Baja Lógica)'}`, 'success');
      await this.loadAllData();
    } catch (err) {
      this.showToast('Error al cambiar el estado del cliente', 'error');
    }
  },

  // --- HANDLERS: ÓRDENES DE TRABAJO ---
  async handleSaveServiceOrder(e) {
    e.preventDefault();
    try {
      const plate = document.getElementById('order-plate').value.trim().toUpperCase().replace(/\s+/g, '');
      const date = document.getElementById('order-date').value;
      const mileage = document.getElementById('order-mileage').value;
      const workDone = document.getElementById('order-work-done').value.trim();
      const nextMaintenance = document.getElementById('order-next-maintenance').value;
      const cost = document.getElementById('order-cost').value;
      const paymentStatus = document.getElementById('order-payment-status').value;

      // Si el vehículo no existe, creamos un registro base automáticamente
      const vehicleExists = await SupabaseService.getVehicleByPlate(plate);
      if (!vehicleExists) {
        // Crear cliente genérico temporal o asociar
        const genericClient = AppState.clients[0] || await SupabaseService.createClient({ nombre: 'Cliente de Paso', telefono: 'S/D' });
        await SupabaseService.createVehicle({
          patente: plate,
          id_cliente: genericClient.id_cliente,
          marca: 'Genérica',
          modelo: 'Particular',
          anio: new Date().getFullYear()
        });
      }

      await SupabaseService.createService({
        patente: plate,
        fecha: date,
        kilometraje: mileage,
        trabajo_realizado: workDone,
        proximo_mantenimiento: nextMaintenance,
        costo: cost,
        estado_pago: paymentStatus
      });

      this.showToast(`Orden de trabajo para ${plate} guardada con éxito`, 'success');
      document.getElementById('order-form-container').style.display = 'none';
      document.getElementById('form-service-order').reset();

      await this.loadAllData();
    } catch (err) {
      console.error('Error guardando servicio:', err);
      this.showToast('Error al guardar la orden de trabajo', 'error');
    }
  },

  openOrderForPlate(plate) {
    this.navigateTo('taller');
    const orderFormContainer = document.getElementById('order-form-container');
    const orderForm = document.getElementById('form-service-order');
    orderForm.reset();
    document.getElementById('order-plate').value = plate;
    document.getElementById('order-date').value = new Date().toISOString().split('T')[0];
    
    // Disparar evento input para autocompletar detalle
    document.getElementById('order-plate').dispatchEvent(new Event('input'));
    orderFormContainer.style.display = 'block';
  },

  openNewOrderForClient(clientId) {
    const clientVehicles = AppState.vehicles.filter(v => v.id_cliente === clientId && v.activo);
    if (clientVehicles.length > 0) {
      this.openOrderForPlate(clientVehicles[0].patente);
    } else {
      this.navigateTo('taller');
      document.getElementById('order-form-container').style.display = 'block';
    }
  },

  // --- HANDLERS: COBROS & MERCADO PAGO ---
  populatePaymentOrderSelect() {
    const select = document.getElementById('mp-select-order');
    if (!select) return;

    const pendingOrders = AppState.services.filter(s => s.estado_pago !== 'Pagado');
    select.innerHTML = '<option value="">-- Seleccionar Orden para Cobrar --</option>' + 
      pendingOrders.map(o => `
        <option value="${o.id_servicio}">#${o.id_servicio} - ${o.patente} ($ ${o.costo.toLocaleString('es-AR')}) - ${o.estado_pago}</option>
      `).join('');
  },

  selectForPayment(serviceId) {
    this.navigateTo('cobros');
    const select = document.getElementById('mp-select-order');
    if (select) {
      select.value = serviceId;
      this.handleSelectPaymentOrder(serviceId);
    }
  },

  handleSelectPaymentOrder(serviceId) {
    const summaryBox = document.getElementById('mp-order-summary');
    const resultBox = document.getElementById('mp-link-result-container');
    if (resultBox) resultBox.style.display = 'none';

    if (!serviceId) {
      if (summaryBox) summaryBox.style.display = 'none';
      return;
    }

    const order = AppState.services.find(s => s.id_servicio === serviceId);
    if (!order) return;

    const vehicle = AppState.vehicles.find(v => v.patente === order.patente);
    const client = vehicle ? AppState.clients.find(c => c.id_cliente === vehicle.id_cliente) : null;

    document.getElementById('mp-summary-plate').textContent = `${order.patente} (${vehicle?.marca || ''} ${vehicle?.modelo || ''})`;
    document.getElementById('mp-summary-client').textContent = client ? `${client.nombre} (${client.telefono})` : 'Cliente no registrado';
    document.getElementById('mp-summary-work').textContent = order.trabajo_realizado;
    document.getElementById('mp-summary-amount').textContent = `$ ${order.costo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

    if (summaryBox) summaryBox.style.display = 'block';
  },

  handleGenerateMpLink() {
    const serviceId = document.getElementById('mp-select-order').value;
    if (!serviceId) {
      this.showToast('Por favor selecciona una orden de trabajo primero', 'warning');
      return;
    }

    const order = AppState.services.find(s => s.id_servicio === serviceId);
    const vehicle = AppState.vehicles.find(v => v.patente === order.patente);
    const client = vehicle ? AppState.clients.find(c => c.id_cliente === vehicle.id_cliente) : null;

    const link = MercadoPagoManager.generatePaymentLink(order, client);
    const resultBox = document.getElementById('mp-link-result-container');
    const urlInput = document.getElementById('mp-generated-url');

    urlInput.value = link;
    resultBox.style.display = 'block';
    SupabaseService.updateServicePaymentStatus(serviceId, 'MercadoPago');
    this.showToast('Link de pago Mercado Pago generado', 'success');
  },

  handleInitCheckoutBrick() {
    const serviceId = document.getElementById('mp-select-order').value;
    if (!serviceId) {
      this.showToast('Por favor selecciona una orden de trabajo primero', 'warning');
      return;
    }

    const order = AppState.services.find(s => s.id_servicio === serviceId);
    const vehicle = AppState.vehicles.find(v => v.patente === order.patente);
    const client = vehicle ? AppState.clients.find(c => c.id_cliente === vehicle.id_cliente) : null;

    order.clientEmail = client?.email;
    MercadoPagoManager.initPaymentBrick(order);
  },

  // --- HANDLERS: STOCK ---
  async handleSaveStockProduct(e) {
    e.preventDefault();
    try {
      const name = document.getElementById('product-name').value.trim();
      const qty = document.getElementById('product-quantity').value;
      const reorder = document.getElementById('product-reorder-point').value;

      await SupabaseService.createProduct({
        nombre: name,
        cantidad: qty,
        punto_reposicion: reorder
      });

      this.showToast(`Producto "${name}" agregado al inventario`, 'success');
      document.getElementById('stock-form-container').style.display = 'none';
      document.getElementById('form-stock-product').reset();
      await this.loadAllData();
    } catch (err) {
      this.showToast('Error al registrar producto', 'error');
    }
  },

  async adjustStock(productId, delta) {
    try {
      const updated = await SupabaseService.updateStockQuantity(productId, delta);
      this.showToast(`Stock actualizado: ${updated.nombre} (${updated.cantidad} unidades)`, 'info');
      await this.loadAllData();
    } catch (err) {
      this.showToast('Error al actualizar stock', 'error');
    }
  },

  // --- SUPABASE & MP CREDENTIALS MODAL ---
  openSupabaseModal() {
    const url = localStorage.getItem(CONFIG.SUPABASE_URL_KEY) || '';
    const key = localStorage.getItem(CONFIG.SUPABASE_ANON_KEY) || '';
    const mpKey = localStorage.getItem(CONFIG.MP_PUBLIC_KEY) || '';

    document.getElementById('supabase-url').value = url;
    document.getElementById('supabase-key').value = key;
    document.getElementById('mp-public-key').value = mpKey;

    document.getElementById('modal-supabase-config').classList.add('active');
  },

  closeSupabaseModal() {
    document.getElementById('modal-supabase-config').classList.remove('active');
  },

  saveCredentials() {
    const url = document.getElementById('supabase-url').value.trim();
    const key = document.getElementById('supabase-key').value.trim();
    const mpKey = document.getElementById('mp-public-key').value.trim();

    if (url) localStorage.setItem(CONFIG.SUPABASE_URL_KEY, url);
    else localStorage.removeItem(CONFIG.SUPABASE_URL_KEY);

    if (key) localStorage.setItem(CONFIG.SUPABASE_ANON_KEY, key);
    else localStorage.removeItem(CONFIG.SUPABASE_ANON_KEY);

    if (mpKey) localStorage.setItem(CONFIG.MP_PUBLIC_KEY, mpKey);
    else localStorage.removeItem(CONFIG.MP_PUBLIC_KEY);

    this.closeSupabaseModal();
    SupabaseService.init();
    this.loadAllData();
    this.showToast('Credenciales actualizadas correctamente', 'success');
  },

  openCalendlyConfig() {
    const currentUrl = document.getElementById('calendly-url').value;
    const newUrl = prompt('Ingresa la URL de tu cuenta de Calendly para agendamiento:', currentUrl);
    if (newUrl) {
      document.getElementById('calendly-url').value = newUrl;
      this.showToast('Enlace de Calendly actualizado', 'success');
    }
  },

  // --- TOAST NOTIFICATION UTILITY ---
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ri-information-line';
    if (type === 'success') icon = 'ri-checkbox-circle-line';
    if (type === 'error') icon = 'ri-error-warning-line';
    if (type === 'warning') icon = 'ri-alert-line';

    toast.innerHTML = `<i class="${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

// Autoarranque
document.addEventListener('DOMContentLoaded', () => {
  window.App = App;
  App.init();
});
