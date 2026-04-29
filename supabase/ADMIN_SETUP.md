# Création du premier administrateur

> **Note :** l'ancienne approche `admin_seed.sql` ne fonctionnait pas car
> insérer manuellement dans `auth.users` ne crée pas la ligne associée dans
> `auth.identities`, ce qui faisait planter le login en `HTTP 500`
> (`Database error querying schema`). On utilise désormais l'UI Supabase
> qui gère toutes les tables `auth.*` correctement.

## Procédure

### 1. Créer l'utilisateur via Supabase Studio

1. Ouvrir le [Dashboard Authentication](https://supabase.com/dashboard/project/_/auth/users)
2. Cliquer sur **Add user → Create new user**
3. Remplir :
   - **Email** : `admin@2cconseil.com`
   - **Password** : (choisir un mot de passe fort, à communiquer à l'admin)
   - ☑️ **Auto Confirm User** (cocher impérativement)
4. **Create user**

> Le trigger `on_auth_user_created` (défini dans `migration.sql`) crée
> automatiquement la ligne correspondante dans `public."User"` avec le
> rôle par défaut `TELECONSEILLER`.

### 2. Promouvoir l'utilisateur en ADMIN via le SQL Editor

```sql
UPDATE public."User"
SET role = 'ADMIN', name = 'Admin CRC'
WHERE email = 'admin@2cconseil.com';

-- Vérification
SELECT id::text, email, role::text, name
FROM public."User"
WHERE email = 'admin@2cconseil.com';
```

Tu dois voir une ligne avec `role = 'ADMIN'`.

### 3. Tester le login

Va sur l'URL frontend (ex. `https://crm-api-rose.vercel.app/login`) et
connecte-toi avec l'email + mot de passe créés à l'étape 1.

---

## Réinitialiser un admin (si besoin)

Si tu dois nettoyer pour repartir à zéro :

```sql
-- Suppression CASCADE : grâce à la FK User_id_fkey, supprimer dans auth.users
-- supprime aussi automatiquement la ligne dans public."User".
DELETE FROM auth.users WHERE email = 'admin@2cconseil.com';
```

Puis recommencer à l'étape 1.
