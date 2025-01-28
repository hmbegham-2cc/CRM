import dash
from dash import html, dcc, Input, Output, State, callback, MATCH
import dash_bootstrap_components as dbc
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime
import os
import base64
from dash import dash_table
from dash.exceptions import PreventUpdate
import json
from dash.dash_table import Format
import sqlite3
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from io import BytesIO

# Styles personnalisés
CUSTOM_STYLE = {
    'box-shadow': '0 4px 8px 0 rgba(0,0,0,0.2)',
    'transition': '0.3s',
    'border-radius': '5px',
    'padding': '20px',
    'margin-bottom': '20px',
    'background-color': 'white'
}

UPLOAD_STYLE = {
    'width': '100%',
    'height': '120px',
    'lineHeight': '60px',
    'borderWidth': '2px',
    'borderStyle': 'dashed',
    'borderRadius': '10px',
    'textAlign': 'center',
    'margin': '10px',
    'transition': 'border 0.3s ease-in-out',
    'background-color': '#fafafa',
    'cursor': 'pointer'
}

# Chemin vers le dossier pour stocker les fichiers
UPLOAD_DIRECTORY = "uploads"
if not os.path.exists(UPLOAD_DIRECTORY):
    os.makedirs(UPLOAD_DIRECTORY)

# Chemin vers la base de données SQLite
DB_FILE = 'data/modifications.db'

def init_db():
    """Initialise la base de données"""
    os.makedirs('data', exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS modifications
                 (table_id TEXT, date TEXT, data TEXT,
                  PRIMARY KEY (table_id, date))''')
    conn.commit()
    conn.close()

def save_modifications(data, table_id):
    """Sauvegarde les modifications dans SQLite avec la date du fichier"""
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        
        # Convertir les données en JSON
        data_json = json.dumps(data)
        
        # Utiliser la date du fichier stockée dans les attributs du DataFrame
        if isinstance(data, pd.DataFrame) and hasattr(data, 'attrs') and 'file_date' in data.attrs:
            current_date = data.attrs['file_date']
            print(f"Date du fichier utilisée pour la sauvegarde: {current_date}")  # Journal
            unique_id = f"{table_id}_{current_date}"
        else:
            raise ValueError("La date du fichier n'est pas disponible pour la sauvegarde des modifications.")
        
        # Supprimer l'ancienne entrée si elle existe
        c.execute('DELETE FROM modifications WHERE table_id = ?', (unique_id,))
        
        # Insérer les nouvelles données
        c.execute('INSERT INTO modifications (table_id, date, data) VALUES (?, ?, ?)',
                 (unique_id, current_date, data_json))
        print(f"Modifications sauvegardées pour: {unique_id}")  # Journal
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Erreur lors de la sauvegarde dans la base de données: {e}")

def load_modifications(table_id, file_date=None):
    """Charge les modifications depuis SQLite pour une date spécifique"""
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        
        if file_date:
            date_to_load = file_date
            unique_id = f"{table_id}_{date_to_load}"
        else:
            date_to_load = datetime.now().strftime('%d-%m-%Y')
            unique_id = f"{table_id}_{date_to_load}"
        
        # Charger les modifications pour cette date
        c.execute('SELECT data FROM modifications WHERE table_id = ?', (unique_id,))
        result = c.fetchone()
        
        conn.close()
        
        if result:
            print(f"Modifications chargées pour la date: {date_to_load}")
            return json.loads(result[0])
    except Exception as e:
        print(f"Erreur lors du chargement depuis la base de données: {e}")
    return None

def update_table_data(timestamp, data, table_id=None):
    """Mise à jour des données du tableau"""
    if not data:
        raise PreventUpdate
    
    df = pd.DataFrame(data)
    
    # Conserver la date du fichier lors de la mise à jour
    if table_id and isinstance(table_id, str):
        save_modifications(df, table_id)
    
    return data

# Initialiser la base de données au démarrage
init_db()

# Initialisation de l'application Dash
app = dash.Dash(
    __name__,
    external_stylesheets=[
        dbc.themes.BOOTSTRAP,
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
    ],
    suppress_callback_exceptions=True
)

# Layout de la navigation
navbar = dbc.NavbarSimple(
    children=[
        dbc.NavItem(dbc.NavLink([html.I(className="fas fa-home me-2"), "Accueil"], href="/", active="exact")),
        dbc.NavItem(dbc.NavLink([html.I(className="fas fa-chart-line me-2"), "Journalier"], href="/journalier", active="exact")),
        dbc.NavItem(dbc.NavLink([html.I(className="fas fa-chart-bar me-2"), "Hebdomadaire"], href="/hebdomadaire", active="exact")),
        dbc.NavItem(dbc.NavLink([html.I(className="fas fa-chart-pie me-2"), "Mensuel"], href="/mensuel", active="exact")),
    ],
    brand=html.Span([html.I(className="fas fa-tachometer-alt me-2"), "Tableau de Bord LADOM"]),
    brand_href="/",
    color="primary",
    dark=True,
    className="mb-4"
)

def create_stat_table(df, title, header_color="#edf2f7", add_total=True):
    """Crée un tableau de statistiques éditable avec le style du template"""
    if isinstance(df, pd.DataFrame):
        # Si le DataFrame contient des colonnes de villes, ajouter le total
        ville_cols = [col for col in df.columns if col in ['Saint-Denis', 'Saint-Pierre']]
        if ville_cols and add_total:
            df = df.copy()
            df['Total'] = ''  # Initialiser avec des chaînes vides
            
            # Pour le tableau des appels, ne pas calculer le total pour les lignes 6-9
            if 'Type' in df.columns:
                for idx in df.index:
                    if idx < 5:  # Calculer le total seulement pour les 5 premières lignes
                        values = [df.loc[idx, col] for col in ville_cols]
                        if all(isinstance(v, (int, float)) for v in values):
                            df.loc[idx, 'Total'] = sum(values)
            else:
                # Pour les autres tableaux, calculer normalement
                df['Total'] = df[ville_cols].sum(axis=1)
    
    table_id = f'table-{title.lower().replace(" ", "-")}'
    
    # Charger les modifications sauvegardées
    file_date = df.attrs.get('file_date') if hasattr(df, 'attrs') else None
    saved_data = load_modifications(table_id, file_date)
    if saved_data:
        df = pd.DataFrame(saved_data)
        if file_date:
            df.attrs['file_date'] = file_date
    
    data = df.to_dict('records')
    
    # Définir quelles colonnes sont éditables
    columns = []
    for col in df.columns:
        if (title == "Statistiques des Appels" and col == 'Type') or \
           (title == "Statistiques des Dispositifs" and col == 'dispositif') or \
           (title == "Statistiques des Catégories" and col == 'Catégorie'):
            columns.append({"name": col, "id": col, "editable": False})
        else:
            columns.append({"name": col, "id": col, "editable": True})
    
    # Style conditionnel pour les cellules non éditables pour les lignes 6-9
    non_editable_style = {
        'if': {
            'filter_query': '{Type} = "Attente la plus longue" || {Type} = "Attente moyenne" || {Type} = "Temps de parole moyen" || {Type} = "Résolution au premier contact"',
            'column_id': ['Saint-Denis', 'Total']
        },
        'backgroundColor': '#f8f9fa',
        'color': '#6c757d'
    }
    
    # Ajouter une validation pour le format hh:mm:ss pour les lignes 6 à 9 de la colonne 'Saint-Pierre'
    time_format_style = {
        'if': {
            'filter_query': '{Type} = "Attente la plus longue" || {Type} = "Attente moyenne" || {Type} = "Temps de parole moyen" || {Type} = "Résolution au premier contact"',
            'column_id': 'Saint-Pierre'
        },
        'type': 'text',
        'textAlign': 'center',
        'backgroundColor': 'rgb(248, 248, 248)',
        'border': '1px solid black'
    }
    
    return dash_table.DataTable(
        id=table_id,
        data=data,
        columns=columns,
        editable=True,
        row_deletable=False,
        style_table={'overflowX': 'auto'},
        style_header={
            'backgroundColor': header_color,
            'fontWeight': 'bold',
            'textAlign': 'center'
        },
        style_cell={
            'textAlign': 'center',
            'padding': '10px',
            'backgroundColor': 'white',
            'minWidth': '100px'
        },
        style_data_conditional=[
            {
                'if': {'row_index': 'odd'},
                'backgroundColor': 'rgb(248, 248, 248)'
            },
            non_editable_style,
            time_format_style
        ],
        style_as_list_view=True
    )

def create_bar_chart(data, x, y, color, title, orientation='v'):
    """Crée un graphique à barres avec le style du template"""
    fig = go.Figure()
    
    if orientation == 'v':
        for ville in data[color].unique():
            df_ville = data[data[color] == ville]
            fig.add_trace(go.Bar(
                x=df_ville[x],
                y=df_ville[y],
                name=ville,
                text=df_ville[y],
                textposition='auto',
            ))
    else:
        for ville in data[color].unique():
            df_ville = data[data[color] == ville]
            fig.add_trace(go.Bar(
                y=df_ville[x],
                x=df_ville[y],
                name=ville,
                text=df_ville[y],
                textposition='auto',
                orientation='h'
            ))

    fig.update_layout(
        title=title,
        barmode='group',
        plot_bgcolor='white',
        showlegend=True,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        )
    )
    return fig

def load_data(file_path):
    global current_df
    try:
        # Lecture du fichier CSV avec encodage UTF-8 avec BOM
        df = pd.read_csv(file_path, encoding='utf-8-sig', sep=';')
        print(f"Fichier chargé: {file_path}")  # Journal
        
        # Extraire la date de la colonne 'Dernière modification'
        if 'Dernière modification' in df.columns:
            # Convertir la date en format datetime avec dayfirst=True et garder seulement la date
            file_date = pd.to_datetime(
                df['Dernière modification'].iloc[0],
                format='%d-%m-%Y %H:%M',
                dayfirst=True
            ).strftime('%d-%m-%Y')  # Retirer les heures
            print(f"Date extraite du fichier: {file_date}")  # Journal
        else:
            file_date = datetime.now().strftime('%d-%m-%Y')  # Retirer les heures
            print("Colonne 'Dernière modification' manquante, date actuelle utilisée.")  # Journal
        
        # Créer le nom du fichier avec la date (sans les heures)
        file_name = f"data_{file_date.replace('/', '-')}.csv"
        upload_path = os.path.join(UPLOAD_DIRECTORY, file_name)
        df.to_csv(upload_path, index=False, sep=';', encoding='utf-8-sig')
        print(f"Fichier sauvegardé: {upload_path}")  # Journal
        
        # Stocker la date dans les attributs du DataFrame
        df.attrs['file_date'] = file_date
        
        # Dictionnaire pour compter les dispositifs par ville
        dispositifs_count = {
            'Saint-Denis': {},
            'Saint-Pierre': {},
            'Autre': {}
        }
        
        # Liste pour stocker les données d'appels
        appels_data = []
        
        for _, row in df.iterrows():
            # Déterminer la ville
            if '[Saint-Denis]' in str(row['Titre']):
                ville = 'Saint-Denis'
            elif '[Saint-Pierre]' in str(row['Titre']):
                ville = 'Saint-Pierre'
            else:
                ville = 'Autre'
            
            # Nettoyer le titre en enlevant le préfixe de la ville
            titre = str(row['Titre'])
            titre = titre.replace('[Saint-Denis] - ', '').replace('[Saint-Pierre] - ', '')
            
            # Compter chaque dispositif séparément
            dispositifs = [disp.strip() for disp in titre.split(',')]
            for dispositif in dispositifs:
                if dispositif:
                    dispositifs_count[ville][dispositif] = dispositifs_count[ville].get(dispositif, 0) + 1
            
            # Ajouter la ligne pour les statistiques d'appels
            new_row = row.copy()
            new_row['ville'] = ville
            appels_data.append(new_row)
        
        # Créer le DataFrame des appels
        appels_df = pd.DataFrame(appels_data)
        appels_df.attrs['file_date'] = file_date
        
        # Créer le DataFrame des dispositifs
        dispositifs_data = []
        for ville, dispositifs in dispositifs_count.items():
            for dispositif, count in dispositifs.items():
                dispositifs_data.append({
                    'ville': ville,
                    'dispositif': dispositif,
                    'count': count
                })
        
        dispositifs_df = pd.DataFrame(dispositifs_data)
        
        # Ajouter les compteurs de dispositifs au DataFrame principal
        appels_df.attrs['dispositifs'] = dispositifs_df
        
        # Stocker le DataFrame actuel
        current_df = appels_df
        
        return appels_df
        
    except Exception as e:
        print(f"Erreur lors du chargement des données: {e}")
        return pd.DataFrame()

def create_kpi_card(title, value, icon, color):
    """Crée une carte KPI avec une valeur et une icône"""
    return dbc.Card([
        dbc.CardBody([
            html.Div([
                # Cercle d'icône avec effet de fond
                html.Div([
                    html.I(className=f"fas {icon} fa-2x")
                ], style={
                    "background": f"linear-gradient(45deg, {color}22, {color}44)",
                    "borderRadius": "50%",
                    "width": "60px",
                    "height": "60px",
                    "display": "flex",
                    "alignItems": "center",
                    "justifyContent": "center",
                    "marginBottom": "15px",
                    "color": color
                }),
                html.H4(title, 
                    className="mb-2",
                    style={
                        "color": "#5a5c69",
                        "fontSize": "1.1rem",
                        "fontWeight": "bold"
                    }
                ),
                html.H2(
                    value, 
                    className="mb-0",
                    style={
                        "color": color,
                        "fontSize": "2rem",
                        "fontWeight": "bold"
                    }
                )
            ], className="text-center")
        ])
    ], className="mb-4", style={
        "height": "100%",
        "borderRadius": "15px",
        "border": "none",
        "boxShadow": "0 0.15rem 1.75rem 0 rgba(58, 59, 69, 0.15)",
        "transition": "transform 0.2s",
        ":hover": {
            "transform": "translateY(-5px)"
        }
    })

def create_dashboard(df):
    """Crée un tableau de bord avec les KPIs principaux"""
    if df.empty:
        return html.Div()
    
    kpis = calculate_kpis(df)
    
    return dbc.Container([
        dbc.Row([
            dbc.Col([
                create_kpi_card(
                    "Total Appels",
                    kpis['total_appels'],
                    "fa-phone",
                    "#4e73df"  # Bleu
                )
            ], md=4),
            dbc.Col([
                create_kpi_card(
                    "Saint-Denis",
                    kpis['appels_saint_denis'],
                    "fa-building",
                    "#1cc88a"  # Vert
                )
            ], md=4),
            dbc.Col([
                create_kpi_card(
                    "Saint-Pierre",
                    kpis['appels_saint_pierre'],
                    "fa-building",
                    "#36b9cc"  # Cyan
                )
            ], md=4),
        ], className="mb-4"),
        dbc.Row([
            dbc.Col([
                create_kpi_card(
                    "Catégories",
                    kpis['categories_uniques'],
                    "fa-tags",
                    "#f6c23e"  # Jaune
                )
            ], md=6),
            dbc.Col([
                create_kpi_card(
                    "Dispositifs",
                    kpis['dispositifs_uniques'],
                    "fa-cogs",
                    "#e74a3b"  # Rouge
                )
            ], md=6),
        ])
    ], fluid=True, className="mb-4")

def calculate_kpis(df):
    """Calcule les KPIs principaux"""
    total_appels = len(df)
    appels_saint_denis = len(df[df['ville'] == 'Saint-Denis'])
    appels_saint_pierre = len(df[df['ville'] == 'Saint-Pierre'])
    
    return {
        'total_appels': total_appels,
        'appels_saint_denis': appels_saint_denis,
        'appels_saint_pierre': appels_saint_pierre,
        'categories_uniques': df['Catégorie'].nunique(),
        'dispositifs_uniques': df.attrs['dispositifs'].shape[0]
    }

def create_daily_stats(df):
    """Crée les statistiques journalières"""
    if df.empty:
        return html.Div()
    
    # Extraire la date du nom du fichier si disponible
    if 'filename' in df.attrs:
        date_stats = df.attrs['filename'].replace('data_', '').replace('.csv', '')
    else:
        date_stats = datetime.now().strftime('%d-%m-%Y')
    
    # Créer le DataFrame des catégories avec le total
    categories_df = df.groupby(['Catégorie', 'ville']).size().unstack(fill_value=0).reset_index()
    categories_df['Total'] = categories_df[['Saint-Denis', 'Saint-Pierre']].sum(axis=1)
    
    # Créer le DataFrame des dispositifs avec le total
    dispositifs_df = df.attrs['dispositifs'].pivot_table(
        index='dispositif',
        columns='ville',
        values='count',
        aggfunc='sum',
        fill_value=0
    ).reset_index()
    dispositifs_df['Total'] = dispositifs_df[['Saint-Denis', 'Saint-Pierre']].sum(axis=1)
    
    return html.Div([
        # En-tête avec date et bouton export
        html.Div([
            html.Div([
                html.H2([
                    html.I(className="fas fa-calendar-alt me-3", style={"color": "#4e73df"}),
                    f"Statistiques du {date_stats}"
                ], className="mb-0", style={
                    "color": "#2c3e50",
                    "fontWeight": "bold",
                    "fontSize": "2.5rem",
                    "textTransform": "uppercase",
                    "letterSpacing": "2px"
                }),
                # Bouton Export PDF
                dbc.Button([
                    html.I(className="fas fa-file-pdf me-2"),
                    "Exporter en PDF"
                ], 
                id="btn-export-pdf",
                color="primary",
                className="ms-3",
                style={
                    "backgroundColor": "#4e73df",
                    "border": "none",
                    "boxShadow": "0 2px 4px rgba(0,0,0,0.1)"
                })
            ], className="d-flex align-items-center justify-content-center mb-4"),
            dcc.Download(id="download-pdf")
        ], style={
            "background": "linear-gradient(120deg, #f8f9fa 0%, #e9ecef 100%)",
            "padding": "2rem",
            "borderRadius": "15px",
            "marginBottom": "2rem",
            "boxShadow": "0 0.15rem 1.75rem 0 rgba(58, 59, 69, 0.15)"
        }),
        
        # Tableau de bord
        create_dashboard(df),
        
        # Graphiques et tableaux
        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader(
                        html.H3("STATISTIQUES DISPOSITIF", className="text-center mb-0"),
                        style={"background": "#4e73df", "color": "white"}
                    ),
                    dbc.CardBody([
                        create_stat_table(dispositifs_df, "Statistiques des Dispositifs"),
                        dcc.Graph(
                            figure=create_bar_chart(
                                df.attrs['dispositifs'],
                                'dispositif', 'count', 'ville',
                                "Répartition par Dispositif"
                            ),
                            config={'displayModeBar': False}
                        )
                    ])
                ])
            ], md=12, className="mb-4"),
            
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader(
                        html.H3("STATISTIQUES APPELS", className="text-center mb-0"),
                        style={"background": "#1cc88a", "color": "white"}
                    ),
                    dbc.CardBody([
                        create_stat_table(
                            pd.DataFrame({
                                'Type': ['Appels reçus', 'Appels traités', 'Appels escaladés', 'Tickets créés', 
                                        'Appels abandonnés', 'Attente la plus longue', 'Attente moyenne', 
                                        'Temps de parole moyen', 'Résolution au premier contact'],
                                'Saint-Denis': [len(df[df['ville'] == 'Saint-Denis']), 0, 0, 
                                            len(df[df['ville'] == 'Saint-Denis']), 0, '', '', '', ''],
                                'Saint-Pierre': [len(df[df['ville'] == 'Saint-Pierre']), 0, 0,
                                            len(df[df['ville'] == 'Saint-Pierre']), 0, '', '', '', '']
                            }),
                            "Statistiques des Appels"
                        )
                    ])
                ])
            ], md=12, className="mb-4"),
            
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader(
                        html.H3("STATISTIQUES CATÉGORIES", className="text-center mb-0"),
                        style={"background": "#36b9cc", "color": "white"}
                    ),
                    dbc.CardBody([
                        create_stat_table(categories_df, "Statistiques des Catégories"),
                        dcc.Graph(
                            figure=create_bar_chart(
                                df.groupby(['Catégorie', 'ville']).size().reset_index(name='count'),
                                'Catégorie', 'count', 'ville',
                                "Répartition par Catégorie"
                            ),
                            config={'displayModeBar': False}
                        )
                    ])
                ])
            ], md=12)
        ])
    ], className="container-fluid py-4")

def get_recent_files():
    """Récupère la liste des 10 fichiers les plus récents dans le dossier upload"""
    files = []
    for file in os.listdir(UPLOAD_DIRECTORY):
        if file.endswith('.csv') and file.startswith('data_'):
            try:
                file_path = os.path.join(UPLOAD_DIRECTORY, file)
                # Extraire la date complète du nom du fichier (format: data_DD-MM-YYYY.csv)
                date_str = file.replace('data_', '').replace('.csv', '')
                files.append({
                    'path': file_path,
                    'date': date_str,
                    'name': file
                })
            except Exception as e:
                print(f"Erreur lors du traitement du fichier {file}: {e}")
                continue
    
    # Trier par date décroissante et prendre les 10 plus récents
    return sorted(files, key=lambda x: x['date'], reverse=True)[:10]

def create_home_layout():
    """Crée le layout de la page d'accueil"""
    recent_files = get_recent_files()
    
    recent_files_list = html.Div([
        html.H3("Fichiers récents"),
        html.Ul([
            html.Li(
                html.A(
                    f"Statistiques du {file['date']}", 
                    href=f"/journalier?file={file['name']}"
                )
            ) for file in recent_files
        ])
    ]) if recent_files else html.Div("Aucun fichier récent")
    
    return html.Div([
        # Hero Section avec un fond plus moderne
        dbc.Container([
            dbc.Row([
                dbc.Col([
                    html.Div([
                        html.H1([
                            html.I(className="fas fa-tachometer-alt me-3", style={"color": "#1cc88a"}),
                            "Tableau de bord LADOM"
                        ], className="display-3 mb-4", style={"color": "#2c3e50", "font-weight": "bold"}),
                        html.P([
                            "Plateforme de gestion et d'analyse des appels ",
                            html.Strong("LADOM Saint-Denis et Saint-Pierre")
                        ], className="lead mb-4", style={"color": "#34495e", "font-size": "1.5rem"}),
                        html.Hr(className="my-4", style={"border-color": "#1cc88a", "border-width": "2px"}),
                    ], className="text-center py-5", style={
                        "background": "linear-gradient(120deg, #f8f9fa 0%, #e9ecef 100%)",
                        "border-radius": "15px",
                        "box-shadow": "0 4px 15px rgba(0,0,0,0.1)"
                    })
                ])
            ], className="mb-5")
        ], fluid=True, className="py-5"),
        
        # Main Content
        dbc.Container([
            dbc.Row([
                # Section Upload avec style amélioré
                dbc.Col([
                    dbc.Card([
                        dbc.CardHeader([
                            html.H4([
                                html.I(className="fas fa-upload me-2", style={"color": "#4e73df"}),
                                "Importer un fichier"
                            ], className="mb-0")
                        ], style={"background": "#4e73df", "color": "white"}),
                        dbc.CardBody([
                            dcc.Upload(
                                id='upload-data',
                                children=html.Div([
                                    html.I(className="fas fa-cloud-upload-alt fa-3x mb-3", style={"color": "#4e73df"}),
                                    html.Div("Glissez-déposez un fichier CSV ici ou", style={"color": "#5a5c69"}),
                                    dbc.Button(
                                        "Parcourir",
                                        color="primary",
                                        size="sm",
                                        className="mt-3 px-4",
                                        style={"background": "#4e73df"}
                                    ),
                                ], className="text-center"),
                                style={
                                    'width': '100%',
                                    'height': '200px',
                                    'lineHeight': '60px',
                                    'borderWidth': '2px',
                                    'borderStyle': 'dashed',
                                    'borderRadius': '10px',
                                    'borderColor': '#4e73df',
                                    'textAlign': 'center',
                                    'margin': '10px 0',
                                    'display': 'flex',
                                    'flexDirection': 'column',
                                    'justifyContent': 'center',
                                    'alignItems': 'center',
                                    'backgroundColor': '#f8f9fc'
                                },
                                multiple=False,
                                accept='.csv'
                            ),
                            html.Div(id='output-data-upload'),
                            dbc.Alert([
                                html.I(className="fas fa-info-circle me-2"),
                                "Format accepté : fichier CSV exporté depuis GLPI"
                            ], color="info", className="mt-3")
                        ], style={"background": "white"})
                    ], className="mb-4", style={"box-shadow": "0 0.15rem 1.75rem 0 rgba(58, 59, 69, 0.15)"})
                ], md=6),
                
                # Section Fichiers Récents avec style amélioré
                dbc.Col([
                    dbc.Card([
                        dbc.CardHeader([
                            html.H4([
                                html.I(className="fas fa-history me-2", style={"color": "#1cc88a"}),
                                "Fichiers Récents"
                            ], className="mb-0")
                        ], style={"background": "#1cc88a", "color": "white"}),
                        dbc.CardBody([
                            recent_files_list
                        ], style={"background": "white"})
                    ], className="mb-4", style={"box-shadow": "0 0.15rem 1.75rem 0 rgba(58, 59, 69, 0.15)"})
                ], md=6)
            ]),
            
            # Guide d'utilisation mis à jour
            dbc.Row([
                dbc.Col([
                    dbc.Card([
                        dbc.CardHeader([
                            html.H4([
                                html.I(className="fas fa-book me-2", style={"color": "#36b9cc"}),
                                "Guide d'utilisation LADOM"
                            ], className="mb-0")
                        ], style={"background": "#36b9cc", "color": "white"}),
                        dbc.CardBody([
                            dbc.Row([
                                dbc.Col([
                                    html.Div([
                                        html.I(className="fas fa-file-upload fa-2x mb-3", style={"color": "#36b9cc"}),
                                        html.H5("1. Import des données", className="mb-2"),
                                        html.P([
                                            "Importez votre fichier CSV exporté depuis GLPI",
                                            html.Br(),
                                            "Format requis : données d'appels LADOM"
                                        ], className="text-muted")
                                    ], className="text-center")
                                ], md=3),
                                dbc.Col([
                                    html.Div([
                                        html.I(className="fas fa-chart-bar fa-2x mb-3", style={"color": "#36b9cc"}),
                                        html.H5("2. Statistiques journalières", className="mb-2"),
                                        html.P([
                                            "Visualisez les statistiques par site",
                                            html.Br(),
                                            "Saint-Denis et Saint-Pierre"
                                        ], className="text-muted")
                                    ], className="text-center")
                                ], md=3),
                                dbc.Col([
                                    html.Div([
                                        html.I(className="fas fa-clock fa-2x mb-3", style={"color": "#36b9cc"}),
                                        html.H5("3. Temps d'appels", className="mb-2"),
                                        html.P([
                                            "Suivez les temps d'attente",
                                            html.Br(),
                                            "et de traitement des appels"
                                        ], className="text-muted")
                                    ], className="text-center")
                                ], md=3),
                                dbc.Col([
                                    html.Div([
                                        html.I(className="fas fa-tasks fa-2x mb-3", style={"color": "#36b9cc"}),
                                        html.H5("4. Catégories", className="mb-2"),
                                        html.P([
                                            "Analysez la répartition",
                                            html.Br(),
                                            "des appels par catégorie"
                                        ], className="text-muted")
                                    ], className="text-center")
                                ], md=3),
                            ])
                        ], style={"background": "white"})
                    ], className="mb-4", style={"box-shadow": "0 0.15rem 1.75rem 0 rgba(58, 59, 69, 0.15)"})
                ])
            ])
        ], fluid=True)
    ])

@app.callback(
    Output('page-content', 'children'),
    [Input('url', 'pathname'),
     Input('url', 'search')]
)
def display_page(pathname, search):
    if pathname == '/':
        return create_home_layout()
    
    elif pathname == '/journalier':
        if search:
            filename = search.split('=')[1]
            filepath = os.path.join(UPLOAD_DIRECTORY, filename)
            if os.path.exists(filepath):
                df = load_data(filepath)
                return create_daily_stats(df)
        
        # Si pas de fichier spécifié, montrer la liste des fichiers
        files = get_recent_files()
        return html.Div([
            html.H3("Fichiers Disponibles", className="text-center mb-4"),
            dbc.Row([
                dbc.Col([
                    dbc.Card([
                        dbc.CardBody([
                            html.H5(f"Statistiques du {file['date']}", className="card-title"),
                            html.P(f"Fichier: {file['name']}", className="text-muted small"),
                            dbc.Button(
                                [html.I(className="fas fa-chart-bar me-2"), "Voir les Statistiques"],
                                href=f"/journalier?file={file['name']}", 
                                color="primary",
                                className="mt-2 w-100"
                            )
                        ])
                    ], className="mb-3")
                ], md=4) for file in files
            ])
        ], className="container py-4")
    
    elif pathname == '/hebdomadaire':
        return dbc.Alert([
            html.I(className="fas fa-tools me-2"),
            "Statistiques Hebdomadaires - En développement"
        ], color="secondary", className="m-4")
    
    elif pathname == '/mensuel':
        return dbc.Alert([
            html.I(className="fas fa-tools me-2"),
            "Statistiques Mensuelles - En développement"
        ], color="secondary", className="m-4")
    
    return html.Div("404 - Page non trouvée")

@app.callback(
    Output('table-statistiques-des-appels', 'data'),
    Input('table-statistiques-des-appels', 'data_timestamp'),
    State('table-statistiques-des-appels', 'data')
)
def update_table_data(timestamp, data):
    """Callback pour mettre à jour les données du tableau"""
    if timestamp is None:
        raise PreventUpdate
    
    # Convertir les données en DataFrame
    df = pd.DataFrame(data)
    
    # Calculer les totaux
    df['Total'] = df[['Saint-Denis', 'Saint-Pierre']].apply(
        lambda x: sum(float(v) if isinstance(v, str) and v.replace('.', '').isdigit() else (v if isinstance(v, (int, float)) else 0) for v in x),
        axis=1
    )
    
    # Sauvegarder les modifications
    save_modifications(df.to_dict('records'), 'table-statistiques-des-appels')
    
    return df.to_dict('records')

@app.callback(
    Output('output-data-upload', 'children'),
    Input('upload-data', 'contents'),
    State('upload-data', 'filename')
)
def update_output(contents, filename):
    if contents is not None:
        try:
            # Décoder le contenu du fichier
            content_type, content_string = contents.split(',')
            decoded = base64.b64decode(content_string)
            
            # Sauvegarder temporairement le fichier pour le lire
            temp_file = os.path.join(UPLOAD_DIRECTORY, "temp.csv")
            with open(temp_file, 'wb') as f:
                f.write(decoded)
            
            # Lire le fichier pour obtenir la date
            df = pd.read_csv(temp_file, encoding='utf-8-sig', sep=';')
            print(f"Fichier chargé: {temp_file}")  # Journal
            
            # Extraire la date de la colonne 'Dernière modification'
            if 'Dernière modification' in df.columns:
                file_date = pd.to_datetime(
                    df['Dernière modification'].iloc[0],
                    format='%d-%m-%Y %H:%M',
                    dayfirst=True
                ).strftime('%d-%m-%Y')  # Retirer les heures
                print(f"Date extraite du fichier: {file_date}")  # Journal
            else:
                raise ValueError("Colonne 'Dernière modification' manquante dans le fichier CSV.")
            
            # Créer le nom de fichier avec la date (sans les heures)
            new_filename = f"data_{file_date.replace('/', '-')}.csv"
            filepath = os.path.join(UPLOAD_DIRECTORY, new_filename)
            
            # Déplacer le fichier temporaire vers son emplacement final
            os.rename(temp_file, filepath)
            
            # Sauvegarder les modifications avec la date correcte
            df.attrs['file_date'] = file_date  # Stocker la date dans les attributs
            save_modifications(df, new_filename)
            
            return dbc.Alert([
                html.I(className="fas fa-check-circle me-2"),
                f"Fichier du {file_date} sauvegardé avec succès ! ",
                dbc.Button("Voir les statistiques", 
                          href=f"/journalier?file={new_filename}",
                          color="success",
                          size="sm",
                          className="ms-2")
            ], color="success", className="mt-3")
            
        except Exception as e:
            # En cas d'erreur, supprimer le fichier temporaire s'il existe
            if os.path.exists(temp_file):
                os.remove(temp_file)
            return dbc.Alert([
                html.I(className="fas fa-exclamation-triangle me-2"),
                f"Erreur lors du traitement du fichier: {str(e)}"
            ], color="danger", className="mt-3")

current_df = None

@app.callback(
    Output("download-pdf", "data"),
    Input("btn-export-pdf", "n_clicks"),
    prevent_initial_call=True
)
def export_pdf(n_clicks):
    global current_df
    if n_clicks and current_df is not None:
        print("Export PDF demandé")
        try:
            # Récupérer la date depuis le nom du fichier
            filename = current_df.attrs.get('filename', '')
            date_stats = filename.replace('data_', '').replace('.csv', '')
            print(f"Génération du PDF pour la date: {date_stats}")
            
            # Générer le PDF
            pdf_content = generate_pdf(current_df, date_stats)
            print("PDF généré avec succès")
            
            return dict(
                content=base64.b64encode(pdf_content).decode('utf-8'),
                filename=f"statistiques_{date_stats}.pdf",
                type="application/pdf",
                base64=True
            )
        except Exception as e:
            print(f"Erreur lors de la génération du PDF: {str(e)}")
    else:
        print("Aucune donnée disponible pour générer le PDF")
    return None

def generate_pdf(df, date_stats):
    """Génère un PDF avec les statistiques"""
    # Créer un buffer pour stocker le PDF
    buffer = BytesIO()
    
    # Créer le document PDF en mode paysage
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30
    )
    
    # Liste des éléments à ajouter au PDF
    elements = []
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        alignment=1  # Centre
    )
    
    # Titre
    elements.append(Paragraph(f"Statistiques du {date_stats}", title_style))
    elements.append(Spacer(1, 20))
    
    # Statistiques principales
    kpis = calculate_kpis(df)
    kpi_data = [
        ["Total Appels", "Saint-Denis", "Saint-Pierre", "Catégories", "Dispositifs"],
        [str(kpis['total_appels']), str(kpis['appels_saint_denis']), 
         str(kpis['appels_saint_pierre']), str(kpis['categories_uniques']), 
         str(kpis['dispositifs_uniques'])]
    ]
    
    kpi_table = Table(kpi_data, colWidths=[doc.width/5.0]*5)
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4e73df')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 14),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#f8f9fc')),
        ('TEXTCOLOR', (0, 1), (-1, 1), colors.HexColor('#5a5c69')),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, 1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('BOX', (0, 0), (-1, -1), 2, colors.black),
        ('LINEBELOW', (0, 0), (-1, 0), 2, colors.black),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 30))
    
    # Statistiques Dispositifs
    elements.append(Paragraph("STATISTIQUES DISPOSITIF", styles['Heading2']))
    elements.append(Spacer(1, 10))
    
    dispositifs_data = df.attrs['dispositifs'].pivot_table(
        index='dispositif',
        columns='ville',
        values='count',
        aggfunc='sum',
        fill_value=0
    ).reset_index().values.tolist()
    
    dispositifs_data.insert(0, ['Dispositif', 'Saint-Denis', 'Saint-Pierre'])
    dispositifs_table = Table(dispositifs_data)
    dispositifs_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1cc88a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('BOX', (0, 0), (-1, -1), 2, colors.black),
    ]))
    elements.append(dispositifs_table)
    elements.append(Spacer(1, 30))
    
    # Statistiques Catégories
    elements.append(Paragraph("STATISTIQUES CATÉGORIES", styles['Heading2']))
    elements.append(Spacer(1, 10))
    
    # Créer le DataFrame des catégories avec le total
    categories_df = df.groupby(['Catégorie', 'ville']).size().unstack(fill_value=0)
    categories_df['Total'] = categories_df.sum(axis=1)
    categories_data = categories_df.reset_index().values.tolist()
    categories_data.insert(0, ['Catégorie', 'Saint-Denis', 'Saint-Pierre', 'Total'])
    
    categories_table = Table(categories_data)
    categories_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#36b9cc')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('BOX', (0, 0), (-1, -1), 2, colors.black),
    ]))
    elements.append(categories_table)
    
    # Statistiques Appels
    elements.append(Paragraph("STATISTIQUES APPELS", styles['Heading2']))
    elements.append(Spacer(1, 10))
    
    appels_data = [
        ['Type', 'Saint-Denis', 'Saint-Pierre'],
        ['Appels reçus', str(len(df[df['ville'] == 'Saint-Denis'])), str(len(df[df['ville'] == 'Saint-Pierre']))],
        ['Appels traités', '0', '0'],
        ['Appels escaladés', '0', '0'],
        ['Tickets créés', str(len(df[df['ville'] == 'Saint-Denis'])), str(len(df[df['ville'] == 'Saint-Pierre']))],
        ['Appels abandonnés', '0', '0'],
        ['Attente la plus longue', '00:00:00', '00:00:00'],
        ['Attente moyenne', '00:00:00', '00:00:00'],
        ['Temps de parole moyen', '00:00:00', '00:00:00']
    ]
    
    appels_table = Table(appels_data)
    appels_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#36b9cc')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('BOX', (0, 0), (-1, -1), 2, colors.black),
    ]))
    elements.append(appels_table)
    
    # Générer le PDF
    doc.build(elements)
    
    # Récupérer le contenu du buffer
    pdf = buffer.getvalue()
    buffer.close()
    
    return pdf

# Layout principal
app.layout = html.Div([
    navbar,
    dcc.Location(id='url', refresh=False),
    dcc.Download(id="download-pdf"),
    html.Div(id='page-content')
])

if __name__ == '__main__':
    app.run_server(debug=True)
