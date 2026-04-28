# CRC Platform (Monorepo)

Application de reporting pour centre d'appels - 2cconseil.com

## Architecture

- `apps/web`: Frontend React + Vite + TypeScript
- `apps/api`: Backend Express + TypeScript
- `packages/db`: Prisma schema/client
- `packages/types`: Types partagés
- `packages/config`: Configuration partagée

## Stack technique

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Recharts
- **Backend**: Express, Prisma ORM, JWT Auth, Brevo (emails)
- **Database**: PostgreSQL (Supabase)
- **Déploiement**: Vercel (frontend + API serverless)

---

## Développement local

### Installation

```bash
pnpm install
```

### Configuration

1. Copier `apps/api/.env.example` vers `apps/api/.env`
2. Configurer les variables (DATABASE_URL, JWT_SECRET, BREVO_API_KEY, etc.)

### Base de données

```bash
pnpm db:generate  # Générer le client Prisma
pnpm db:migrate   # Appliquer les migrations
```

### Lancement

```bash
pnpm dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

---

## Déploiement sur Vercel

### 1. Prérequis

- Compte Supabase avec base de données PostgreSQL
- Compte Brevo pour l'envoi d'emails
- Repo sur GitHub

### 2. Variables d'environnement (Vercel)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL de connexion Supabase (pooler recommandé) |
| `JWT_SECRET` | Secret pour les tokens JWT (long et aléatoire) |
| `BREVO_API_KEY` | Clé API Brevo pour les emails |
| `FRONTEND_URL` | URL du frontend (ex: `https://crm.vercel.app`) |
| `CORS_ORIGIN` | URL du frontend pour CORS |

### 3. Déployer

1. Importer le repo sur Vercel
2. Configurer les variables d'environnement
3. Déployer

---

## Comptes de démonstration

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| `admin@2cconseil.com` | `admin@2cconseil.com` | ADMIN |
| `superviseur@2cconseil.com` | `crc2026` | SUPERVISEUR |
| `teleconseiller@2cconseil.com` | `crc2026` | TELECONSEILLER |

---

## Fonctionnalités

- **Authentification**: Login, invitation, réinitialisation mot de passe
- **Rapports journaliers**: Saisie, soumission, validation/rejet
- **Campagnes**: Gestion des campagnes et affectation des équipes
- **Dashboard**: Vue personnelle et équipe (superviseur/admin)
- **Notifications**: Alertes pour rapports manquants, validations, rejets
- **Export Excel**: Export des rapports par campagne et période

---

## Rôles

- **TELECONSEILLER**: Saisie de ses rapports uniquement
- **SUPERVISEUR**: Validation des rapports de ses campagnes
- **ADMIN**: Accès complet, gestion des utilisateurs et campagnes
