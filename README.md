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

## Déploiement

### Architecture de déploiement

- **Frontend** → Vercel (gratuit)
- **API** → Render (gratuit)
- **Database** → Supabase (gratuit)

### 1. Déployer l'API sur Render

1. Aller sur https://render.com et créer un compte
2. Cliquer sur **New +** → **Web Service**
3. Connecter ton repo GitHub `hmbegham-2cc/CRM`
4. Configurer:

| Champ | Valeur |
|-------|--------|
| **Name** | `crc-api` |
| **Region** | Frankfurt (ou le plus proche) |
| **Branch** | master |
| **Root Directory** | `apps/api` |
| **Build Command** | `pnpm install && pnpm --filter @crc/db db:generate && pnpm build` |
| **Start Command** | `pnpm start` |
| **Plan** | Free |

5. Ajouter les variables d'environnement:

| Variable | Valeur |
|----------|--------|
| `DATABASE_URL` | `postgresql://postgres.mssihzqvxdndovvohqch:rUaCylwq3Ags0F3N@aws-0-eu-central-1.pooler.supabase.com:6543/postgres` |
| `JWT_SECRET` | (générer une chaîne aléatoire longue) |
| `BREVO_API_KEY` | `xkeysib-ta-cle-api-brevo-ici` |
| `FRONTEND_URL` | `https://ton-app.vercel.app` |
| `CORS_ORIGIN` | `https://ton-app.vercel.app` |

6. Cliquer sur **Deploy**

### 2. Déployer le Frontend sur Vercel

1. Aller sur https://vercel.com/new
2. Importer le repo `hmbegham-2cc/CRM`
3. Configurer:

| Champ | Valeur |
|-------|--------|
| **Root Directory** | `./` (laisser vide) |
| **Framework Preset** | Vite |

4. Ajouter la variable d'environnement:

| Variable | Valeur |
|----------|--------|
| `VITE_API_URL` | `https://crc-api.onrender.com/api/v1` |

5. Cliquer sur **Deploy**

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
