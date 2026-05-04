# Guide Utilisateur - CRM Reporting 2C Conseil

> **Destinataires** : Tous les utilisateurs du système de reporting  
> **Version** : 1.0  
> **Date** : Mai 2026

---

## 📋 Sommaire

1. [Introduction](#introduction)
2. [Connexion](#connexion)
3. [Navigation (Menu Latéral)](#navigation)
4. [Rôles et Accès](#rôles)
5. [Fonctionnalités par Rôle](#fonctionnalités)
6. [Procédures Pas à Pas](#procédures)
7. [FAQ et Dépannage](#faq)

---

## 1. Introduction {#introduction}

Le **CRM Reporting 2C Conseil** est un outil de gestion et de suivi des activités téléphoniques. Il permet de :
- Saisir vos rapports quotidiens d'appels
- Valider les rapports de votre équipe
- Analyser les statistiques par campagne
- Exporter des données pour la direction

### Les 4 Rôles Utilisateur

| Rôle | Description |
|------|-------------|
| **Téléconseiller** | Saisit ses rapports quotidiens, consulte ses stats |
| **Superviseur** | Gère une équipe, valide les rapports, voit les stats d'équipe |
| **Coach Qualité** | Supervise la qualité, accès complet aux stats et administration |
| **Administrateur** | Gestion complète : utilisateurs, campagnes, équipes |

---

## 2. Connexion {#connexion}

### Première Connexion

1. Ouvrez votre navigateur et allez sur l'URL du CRM
2. Entrez votre **email** (@2cconseil.com)
3. Entrez votre **mot de passe** temporaire (reçu par email)
4. Cliquez sur **Connexion**
5. **Important** : Vous devez changer votre mot de passe immédiatement

### Mot de Passe Oublié

1. Sur la page de connexion, cliquez sur **"Mot de passe oublié ?"**
2. Entrez votre email
3. Consultez votre boîte mail et cliquez sur le lien reçu
4. Définissez un nouveau mot de passe

### Changer son Mot de Passe

1. Dans le menu latéral, cliquez sur **"Changer le mot de passe"**
2. Entrez votre mot de passe actuel
3. Entrez votre nouveau mot de passe (minimum 6 caractères)
4. Confirmez le nouveau mot de passe
5. Cliquez sur **"Mettre à jour"**

---

## 3. Navigation (Menu Latéral) {#navigation}

Le menu latéral est organisé en **3 sections** selon votre rôle :

### Section 1 : Mon Espace
Accessible à tous les rôles.

| Menu | Description |
|------|-------------|
| **Dashboard** | Vue d'ensemble de vos statistiques (personnelles ou d'équipe) |
| **Mon rapport** | Saisir votre rapport quotidien d'appels |
| **Mes saisies** | Historique de vos rapports déjà saisis |
| **Notifications** | Messages et alertes du système |

### Section 2 : Gestion & Validation
Accessible aux **Superviseurs**, **Coach Qualité** et **Admin**.

| Menu | Description |
|------|-------------|
| **Tous les rapports** | Voir tous les rapports de l'équipe avec détails |
| **Validation** | Valider ou rejeter les rapports en attente |
| **Reporting Campagnes** | Tableau récapitulatif des stats par campagne (pour la direction) |

### Section 3 : Administration
Accessible au **Coach Qualité** et **Admin**.

| Menu | Description |
|------|-------------|
| **Campagnes** | Créer, modifier, assigner les campagnes |
| **Équipes** | Gérer la composition des équipes |
| **Utilisateurs** | Inviter, modifier, désactiver les utilisateurs |
| **Export Excel** | Exporter les rapports en fichier Excel |

---

## 4. Rôles et Accès {#rôles}

### 🔵 Téléconseiller

**Accès :**
- Dashboard (mode Personnel uniquement)
- Mon rapport
- Mes saisies
- Notifications
- Changer mot de passe

**Actions possibles :**
- Saisir son rapport quotidien
- Modifier son brouillon
- Soumettre son rapport
- Voir ses statistiques personnelles

---

### 🟢 Superviseur

**Accès :**
- Tout ce que le Téléconseiller voit
- Plus : Tous les rapports, Validation, Reporting Campagnes, Export Excel

**Actions possibles :**
- Voir les rapports de son équipe
- Valider ou rejeter les rapports soumis
- Voir les statistiques d'équipe
- Générer le reporting campagnes pour la direction
- Exporter les données en Excel

---

### 🟠 Coach Qualité

**Accès :**
- Tout ce que le Superviseur voit
- Plus : Campagnes, Équipes, Utilisateurs (gestion complète)

**Actions possibles :**
- **Supervision** : Voir TOUTES les stats de TOUTES les équipes (sans être assigné)
- **Validation** : Valider/rejeter tous les rapports
- **Administration** : Gérer campagnes, équipes, utilisateurs
- **Rapports** : Exporter toutes les données

**Particularité** : Le Coach Qualité voit tout comme un Admin, sans restriction de campagne.

---

### 🔴 Administrateur

**Accès :** Toutes les fonctionnalités

**Actions possibles :**
- Tout ce que le Coach Qualité fait
- Gestion complète des utilisateurs (création, suppression, rôles)
- Configuration des campagnes
- Accès à toutes les données sans restriction

---

## 5. Fonctionnalités par Rôle {#fonctionnalités}

### 5.1 Saisir son Rapport (Téléconseiller / Superviseur)

1. Allez dans **Mon rapport**
2. Sélectionnez la **date** (par défaut : aujourd'hui)
3. Sélectionnez la **campagne** sur laquelle vous avez travaillé
4. Remplissez les champs :
   - **Appels reçus** : Nombre total d'appels entrants
   - **Appels émis** : Nombre d'appels sortants
   - **Traités** : Appels aboutis/conclus
   - **Manqués** : Appels non décrochés ou abandonnés
   - **RDV** : Nombre de rendez-vous pris
   - **SMS** : Nombre de SMS envoyés
   - **Observations** : Commentaires éventuels
5. Cliquez sur **"Enregistrer comme brouillon"** ou **"Soumettre"**

**Important :**
- **Brouillon** : Vous pouvez modifier plus tard
- **Soumettre** : Le rapport part en validation, vous ne pouvez plus modifier

---

### 5.2 Valider des Rapports (Superviseur / Coach / Admin)

1. Allez dans **Validation**
2. Vous voyez la liste des rapports en attente (statut **SOUMIS**)
3. Pour chaque rapport :
   - Cliquez sur **👁️ Voir** pour consulter les détails
   - Cliquez sur **✅ Valider** pour approuver
   - Cliquez sur **❌ Rejeter** pour refuser (avec motif)
4. Les rapports validés deviennent visibles dans les statistiques

---

### 5.3 Dashboard - Voir les Statistiques

1. Allez dans **Dashboard**
2. Choisissez le mode :
   - **Mon Dashboard** ( Personnel ) : Vos stats uniquement
   - **Tableau de bord Équipe** : Stats de toute l'équipe
3. Filtres disponibles :
   - **Campagne** : Sélectionner une campagne spécifique ou "Toutes"
   - **Période** : Choisir dates de début et fin (par défaut : toute la période)
   - **Conseiller** (mode Équipe) : Filtrer par personne
4. Les statistiques s'affichent automatiquement :
   - Résumé global
   - Graphiques de tendance
   - Comparaison avec période précédente

---

### 5.4 Reporting Campagnes (Superviseur / Coach / Admin)

Ce tableau est destiné à être transmis à la direction.

1. Allez dans **Reporting Campagnes**
2. Sélectionnez la **période** (Du / Au)
3. Cliquez sur **"Actualiser"**
4. Le tableau affiche par campagne :
   - Reçus, Émis, Traités, Manqués
   - RDV, SMS
5. Pour exporter : Cliquez sur **"Export CSV"**

Le fichier CSV peut s'ouvrir dans Excel.

---

### 5.5 Gérer les Utilisateurs (Coach / Admin)

1. Allez dans **Utilisateurs**
2. **Inviter un nouvel utilisateur** :
   - Cliquez sur **"Inviter un utilisateur"**
   - Entrez l'email, nom, prénom
   - Choisissez le rôle
   - Cliquez **"Envoyer l'invitation"**
   - Un email avec lien de connexion est envoyé
3. **Modifier un rôle** :
   - Dans la liste, changez le rôle dans le menu déroulant
4. **Désactiver** : Décochez "Actif" pour bloquer l'accès
5. **Supprimer** : Cliquez sur la 🗑️ poubelle (admin uniquement)

---

### 5.6 Gérer les Campagnes (Coach / Admin)

1. Allez dans **Campagnes**
2. **Créer une campagne** :
   - Cliquez sur **"Nouvelle campagne"**
   - Entrez le nom, description, dates début/fin
   - Cliquez **"Créer"**
3. **Assigner des utilisateurs** :
   - Cliquez sur **"Assigner"** dans la liste
   - Sélectionnez les téléconseillers à assigner
   - Cliquez **"Confirmer"**
4. **Modifier** : Cliquez sur ✏️
5. **Supprimer** : Cliquez sur 🗑️ (attention, cela supprime aussi les rapports associés)

---

### 5.7 Exporter en Excel (Superviseur / Coach / Admin)

1. Allez dans **Export Excel**
2. Choisissez :
   - **Campagne** : Une spécifique ou "Toutes ensemble"
   - **Période** : Dates de début et fin
   - **Groupement** : Par campagne ou Tout ensemble
3. Cliquez sur **"Exporter en Excel"**
4. Le fichier se télécharge automatiquement

---

## 6. Procédures Pas à Pas {#procédures}

### 📌 Cas 1 : Première saisie du jour (Téléconseiller)

1. Connectez-vous
2. Menu latéral → **"Mon rapport"**
3. Vérifiez que la date = aujourd'hui
4. Sélectionnez votre campagne du jour
5. Remplissez les chiffres :
   - Reçus : 45
   - Émis : 12
   - Traités : 38
   - Manqués : 7
   - RDV : 5
   - SMS : 8
6. Cliquez **"Soumettre"**
7. Attendez la validation de votre superviseur

---

### 📌 Cas 2 : Validation quotidienne (Superviseur)

1. Connectez-vous
2. Menu latéral → **"Validation"**
3. Vérifiez les rapports "Soumis" en attente
4. Pour chaque rapport :
   - Cliquez 👁️ pour voir les détails
   - Si OK → Cliquez ✅
   - Si erreur → Cliquez ❌ et indiquez le motif
5. Les rapports validés apparaissent dans le Dashboard Équipe

---

### 📌 Cas 3 : Envoyer le reporting hebdo à la direction (Superviseur)

1. Menu latéral → **"Reporting Campagnes"**
2. Mettez la période : Lundi dernier → Vendredi dernier
3. Cliquez **"Actualiser"**
4. Vérifiez les chiffres par campagne
5. Cliquez **"Export CSV"**
6. Envoyez le fichier téléchargé par email à la direction

---

### 📌 Cas 4 : Inviter un nouveau collaborateur (Admin)

1. Menu latéral → **"Utilisateurs"**
2. Bouton **"Inviter un utilisateur"**
3. Remplissez :
   - Email : nouveau@2cconseil.com
   - Nom : Dupont
   - Prénom : Jean
   - Rôle : Téléconseiller
4. Cliquez **"Envoyer l'invitation"**
5. Le collaborateur recevra un email pour créer son mot de passe

---

### 📌 Cas 5 : Créer une nouvelle campagne (Admin)

1. Menu latéral → **"Campagnes"**
2. Bouton **"Nouvelle campagne"**
3. Remplissez :
   - Nom : "Campagne Été 2026"
   - Description : "Promotion produits estivaux"
   - Date début : 01/06/2026
   - Date fin : 31/08/2026
4. Cliquez **"Créer"**
5. Puis cliquez **"Assigner"** pour ajouter les téléconseillers

---

## 7. FAQ et Dépannage {#faq}

### ❓ Je ne vois pas mes rapports dans le Dashboard

**Solution :**
- Vérifiez que vos rapports sont bien **soumis** (pas en brouillon)
- Si vous êtes en mode Équipe, passez en mode Personnel
- Vérifiez les filtres de dates (remettez à vide pour voir tout)

---

### ❓ Le Coach Qualité ne voit pas les stats

**Vérifications :**
1. L'admin doit vérifier que le rôle est bien "COACH_QUALITE" dans la base
2. Se déconnecter et reconnecter
3. Vérifier la politique RLS (voir section Admin du guide technique)

---

### ❓ Je ne peux pas saisir de rapport (erreur RLS)

**Causes possibles :**
- Vous n'êtes pas assigné à cette campagne → Demandez à votre superviseur de vous assigner
- La campagne est terminée → Contactez l'admin

---

### ❓ Le fichier Excel ne s'ouvre pas

**Solutions :**
- Utilisez Microsoft Excel (pas LibreOffice Calc)
- Le fichier est au format XML Excel compatible
- Si erreur, essayez l'export CSV à la place

---

### ❓ J'ai oublié mon mot de passe

1. Sur la page de connexion, cliquez **"Mot de passe oublié"**
2. Entrez votre email
3. Suivez le lien reçu par mail (vérifiez vos spams)
4. Créez un nouveau mot de passe

---

### ❓ Comment changer mon rôle ?

Seul un **Administrateur** ou **Coach Qualité** peut changer votre rôle. Contactez-les.

---

## 📞 Support

En cas de problème technique :
1. Vérifiez ce guide
2. Contactez votre superviseur
3. Si nécessaire, contactez l'administrateur système

---

**Fin du Guide Utilisateur**

*Dernière mise à jour : Mai 2026*
