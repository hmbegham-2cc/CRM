# Tableau de Bord GLPI

Application de tableau de bord pour la visualisation des données GLPI, développée avec Dash.

## Fonctionnalités

- Import de fichiers CSV (avec validation)
- Visualisation des statistiques journalières
- Graphiques interactifs
- Interface moderne et responsive
- Stockage organisé des fichiers

## Installation

1. Cloner le dépôt :
```bash
git clone <URL_DU_REPO>
cd DashApp
```

2. Installer les dépendances :
```bash
pip install -r requirements.txt
```

3. Lancer l'application :
```bash
python app.py
```

L'application sera accessible à l'adresse : http://127.0.0.1:8050/

## Structure des fichiers

- `app.py` : Application principale
- `requirements.txt` : Liste des dépendances
- `uploads/` : Dossier de stockage des fichiers CSV (créé automatiquement)

## Utilisation

1. Accédez à la page d'accueil
2. Uploadez un fichier CSV via le formulaire
3. Visualisez les statistiques dans l'onglet "Journalier"
4. Naviguez entre les différentes vues avec la barre de navigation

## Format des fichiers CSV

Les fichiers CSV doivent être encodés en UTF-8 avec BOM et contenir les colonnes suivantes :
- Titre
- Catégorie
- Et autres colonnes nécessaires pour les statistiques

## Développement

Pour contribuer au projet :
1. Créez une branche pour votre fonctionnalité
2. Committez vos changements
3. Créez une Pull Request

## License

Ce projet est sous licence MIT.
