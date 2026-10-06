# 🚗 AutoGest PRO - Sistema de Gestión para Talleres Mecánicos

Sistema web ágil y moderno para la administración integral de talleres mecánicos, lubricentros y gomerías. Diseñado para optimizar las tareas diarias con una interfaz intuitiva y mínima cantidad de clics.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** HTML5 semántico, CSS3 moderno (CSS Grid + Flexbox), Vanilla JavaScript (ES6+).
- **Iconos & Tipografía:** [Remix Icon](https://remixicon.com/), Inter Font (Google Fonts).
- **Base de Datos & Backend:** [Supabase](https://supabase.com/) (PostgreSQL + REST API).
- **Pasarela de Pagos:** [Mercado Pago SDK V2](https://www.mercadopago.com.ar/developers) (Checkout Bricks y Links dinámicos de pago).
- **Automatizaciones & Notificaciones:** Preparado para [Make](https://www.make.com/) (consultas periódicas para alertas de WhatsApp / Email).
- **Turnos & Agenda:** Compatible con [Calendly](https://calendly.com/) y agenda integrada.

---

## 📋 Módulos del Sistema

1. **Dashboard:** Indicadores clave (KPIs) en tiempo real, alertas automáticas de mantenimientos para hoy y control de stock bajo.
2. **Clientes y Vehículos (ABM):** Formulario unificado de alta simultánea de cliente y vehículo, con sistema de **baja lógica** (desactivación sin perder el historial).
3. **Órdenes de Trabajo (Taller):** Búsqueda ágil por patente, registro de kilometraje, trabajos realizados, costo y cálculo de próximo mantenimiento.
4. **Cobros & Mercado Pago:** Generación de enlaces de pago para WhatsApp y cobro presencial en mostrador con **Checkout Bricks**.
5. **Stock e Insumos:** Control de repuestos, lubricantes y fluidos con indicador de punto de reposición y ajustes rápidos.
6. **Turnos & Agenda:** Agendamiento online directo para clientes.

---

## 🚀 Puesta en Marcha

### 1. Clonar o Descargar el Proyecto
```bash
git clone https://github.com/tu-usuario/autogest-pro.git
cd autogest-pro
```

### 2. Ejecutar Localmente
Abre el archivo `index.html` en cualquier navegador web moderno (Google Chrome, Edge, Firefox, Safari).

### 3. Conectar con Supabase (Opcional)
1. Crea un nuevo proyecto en [Supabase](https://supabase.com/).
2. En el **SQL Editor**, copia y ejecuta el contenido del archivo `supabase_schema.sql`.
3. En la aplicación web, haz clic en **"Configurar API"** en la barra lateral e ingresa tu **URL** y **Anon Key**.

---

## 📄 Estructura del Proyecto

```text
├── index.html            # Estructura principal y contenedores semánticos
├── styles.css            # Estilos CSS3, CSS Grid, variables y diseño responsivo
├── app.js                # Lógica del cliente, CRUD asíncrono y Mercado Pago
├── supabase_schema.sql   # Script SQL con tablas, claves foráneas y RLS
└── README.md             # Documentación del proyecto
```

---

## 📄 Licencia

Distribuido bajo la Licencia MIT.
