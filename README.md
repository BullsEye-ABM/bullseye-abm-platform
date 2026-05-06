# 🎯 BullsEye ABM Platform

Plataforma de generación hiperpersonalizada de mensajes B2B (LinkedIn / Email / WhatsApp) con Claude.
Migración del Artifact original de Jaime → app standalone.

## Stack
- **Frontend:** Vite + React 18 + TypeScript + Tailwind
- **Backend:** Vercel Serverless Functions
- **DB:** Supabase (compartido con `prospector-app`)
- **IA:** Anthropic API (Claude Sonnet 4)
- **Outreach:** Lemlist (multi-cliente, una API key por cliente)

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                  Vercel (este repo)                     │
│  ┌──────────────┐         ┌──────────────────────┐      │
│  │ Vite React   │ ──API─→ │ Serverless Functions │      │
│  │ Frontend     │         │ /api/anthropic       │      │
│  └──────────────┘         │ /api/lemlist/*       │      │
└────────────│──────────────┴──────────│──────────────────┘
             │                         │
             ▼                         ▼
       ┌──────────────┐         ┌─────────────────┐
       │   Supabase   │←────────│   prospector-   │
       │ (compartido) │         │   app (Streamlit│
       └──────────────┘         └─────────────────┘
```

## Setup local

```bash
# 1. Instalar deps
npm install

# 2. Copiar variables de entorno
cp .env.example .env.local
# Llenar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (mismas que prospector-app)

# 3. Aplicar migrations en Supabase (1 sola vez)
# Abrir Supabase Dashboard → SQL Editor → pegar contenido de:
#   supabase/migrations/001_bullseye_schema.sql

# 4. Correr en dev
npm run dev
```

## Deploy en Vercel

1. Push a GitHub: `BullsEye-ABM/bullseye-abm-platform`
2. En Vercel: Import Project → seleccionar repo
3. Configurar Environment Variables:
   - `VITE_SUPABASE_URL` (público)
   - `VITE_SUPABASE_ANON_KEY` (público)
   - `ANTHROPIC_API_KEY` (privado, server-side)
   - `SUPABASE_SERVICE_ROLE_KEY` (privado)
   - `ENCRYPTION_KEY` (privado, 32+ chars random)

## Integración con prospector-app

El botón **"📤 Enviar a BullsEye"** en el último paso del pipeline de prospector-app:
1. Crea un `bullseye_segment` con los contactos finales aprobados
2. Inserta `bullseye_contacts` con FK a los contactos del prospector
3. Redirige a `https://bullseye-abm.vercel.app/segment/{id}` listo para generar mensajes

## Estructura

```
src/
  components/   # UI reutilizables
  views/        # Dashboard, Clients, Campaign, Segment, Simulation, Settings
  lib/
    supabase.ts # Cliente Supabase
    api.ts      # Wrapper de /api/*
  types/
    db.ts       # Tipos TypeScript del schema
api/
  anthropic.ts          # POST proxy a Claude
  lemlist/[...path].ts  # Proxy genérico a Lemlist
supabase/
  migrations/   # SQL versionado
```

## Estado actual (mayo 2026)
- ✅ Estructura base del repo
- ✅ Schema SQL inicial
- ⏳ Backend serverless
- ⏳ Migración UI desde código de Jaime
- ⏳ Multi-cliente Lemlist
- ⏳ Integración prospector-app
- ⏳ Deploy producción

## Crédito
UI/UX original: Jaime Guajardo (`@jguajardo`) — Artifact "BullsEye ABM Platform"
Migración a standalone: SOi Digital
