# LinkedSound - Backend API

Servicio backend para la plataforma LinkedSound desarrollado con Node.js, Express y TypeScript.

## Requisitos previos

- Node.js (version 20 o superior recomendada)
- npm

## Instalacion

```bash
npm install
```

## Variables de entorno

Crear un archivo `.env` en la raiz del backend tomando como base `.env.example`:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

## Scripts disponibles

- `npm run dev`: Inicia el servidor en modo desarrollo con recarga automatica via `tsx watch`.
- `npm run build`: Compila el codigo TypeScript a JavaScript en el directorio `dist/`.
- `npm run start`: Ejecuta el servidor compilado en produccion.

## Endpoints base

- `GET /api/health`: Estado del servicio y verificacion de disponibilidad.
