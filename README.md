# CRC Platform (Monorepo)

Refonte big-bang en monorepo:
- `apps/web`: frontend React + Vite
- `apps/api`: backend Express + TypeScript
- `packages/db`: Prisma schema/client/seed
- `packages/types`: types partagés
- `packages/config`: configuration partagée

## Installation

```bash
pnpm install
```

## Configuration

- Copier `apps/api/.env.example` vers `apps/api/.env`
- Copier `apps/web/.env.example` vers `apps/web/.env`

## Base de données

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Lancement

```bash
pnpm dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:4000`

Comptes seed:
- `admin@2cconseil.com` / `crc2026`
- `superviseur@2cconseil.com` / `crc2026`
- `teleconseiller@2cconseil.com` / `crc2026`
