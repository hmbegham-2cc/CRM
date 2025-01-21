import dash
from dash import html, dcc, Input, Output, State
import dash_bootstrap_components as dbc
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime
import os
import base64

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

# Créer le dossier pour stocker les fichiers
UPLOAD_DIRECTORY = "uploads"
if not os.path.exists(UPLOAD_DIRECTORY):
    os.makedirs(UPLOAD_DIRECTORY)

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
    brand=html.Span([html.I(className="fas fa-tachometer-alt me-2"), "Tableau de Bord GLPI"]),
    brand_href="/",
    color="primary",
    dark=True,
    className="mb-4"
)

def create_stat_table(df, title, header_color="#edf2f7", add_total=True):
    """Crée un tableau de statistiques avec le style du template"""
    if add_total and not df.empty:
        # Créer une copie pour ne pas modifier le DataFrame original
        df = df.copy()
        
        # Pour les colonnes numériques, ajouter une ligne de total
        numeric_cols = df.select_dtypes(include=['int64', 'float64']).columns
        if not numeric_cols.empty:
            total_row = pd.DataFrame([{
                col: df[col].sum() if col in numeric_cols else 'TOTAL'
                for col in df.columns
            }])
            df = pd.concat([df, total_row], ignore_index=True)
    
    return dbc.Table(
        [
            html.Thead(
                html.Tr(
                    [html.Th(col, style={"background-color": header_color}) for col in df.columns],
                ),
            ),
            html.Tbody([
                html.Tr([
                    html.Td(
                        df.iloc[i][col],
                        style={
                            "font-weight": "bold" if i == len(df) - 1 and add_total else "normal",
                            "background-color": "#f8f9fa" if i == len(df) - 1 and add_total else "white"
                        }
                    ) for col in df.columns
                ]) for i in range(len(df))
            ]),
        ],
        bordered=True,
        hover=True,
        responsive=True,
        striped=True,
        className="mb-3",
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
    try:
        # Lecture du fichier CSV avec encodage UTF-8 avec BOM
        df = pd.read_csv(file_path, encoding='utf-8-sig', sep=';')
        
        # Créer une liste pour stocker les nouvelles lignes
        new_rows = []
        
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
            
            # Séparer les dispositifs s'il y en a plusieurs (séparés par une virgule)
            dispositifs = [disp.strip() for disp in titre.split(',')]
            
            # Créer une nouvelle ligne pour chaque dispositif
            for dispositif in dispositifs:
                if dispositif:  # Ignorer les chaînes vides
                    new_row = row.copy()
                    new_row['ville'] = ville
                    new_row['dispositif'] = dispositif
                    new_rows.append(new_row)
        
        # Créer un nouveau DataFrame avec les lignes traitées
        df_new = pd.DataFrame(new_rows)
        return df_new
        
    except Exception as e:
        print(f"Erreur lors du chargement des données: {e}")
        return pd.DataFrame()

def create_kpi_card(title, value, icon, color):
    """Crée une carte KPI avec une valeur et une icône"""
    return dbc.Card(
        dbc.CardBody([
            html.Div([
                html.I(className=f"fas {icon} fa-2x", style={"color": color}),
                html.H4(title, className="mt-2"),
                html.H2(value, className="text-center", style={"color": color}),
            ], className="text-center")
        ]),
        className="mb-4 hover-shadow",
        style={"height": "200px"}
    )

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
        'dispositifs_uniques': df['dispositif'].nunique()
    }

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
                    "#28a745"
                )
            ], md=4),
            dbc.Col([
                create_kpi_card(
                    "Appels Saint-Denis",
                    kpis['appels_saint_denis'],
                    "fa-building",
                    "#007bff"
                )
            ], md=4),
            dbc.Col([
                create_kpi_card(
                    "Appels Saint-Pierre",
                    kpis['appels_saint_pierre'],
                    "fa-building",
                    "#17a2b8"
                )
            ], md=4),
        ]),
        dbc.Row([
            dbc.Col([
                create_kpi_card(
                    "Catégories",
                    kpis['categories_uniques'],
                    "fa-tags",
                    "#6f42c1"
                )
            ], md=6),
            dbc.Col([
                create_kpi_card(
                    "Dispositifs",
                    kpis['dispositifs_uniques'],
                    "fa-cogs",
                    "#fd7e14"
                )
            ], md=6),
        ]),
    ], fluid=True, className="mb-4")

def create_daily_stats(df):
    if df.empty:
        return dbc.Alert([
            html.I(className="fas fa-exclamation-triangle me-2"),
            "Aucune donnée disponible. Veuillez charger un fichier CSV valide."
        ], color="warning", className="m-4")
    
    # 1. Tableau Statistiques Dispositif
    dispositifs_stats = df.groupby(['dispositif', 'ville']).size().unstack(fill_value=0)
    dispositifs_stats['Total'] = dispositifs_stats.sum(axis=1)
    dispositifs_stats['Pourcentage (%)'] = (dispositifs_stats['Total'] / dispositifs_stats['Total'].sum() * 100).round(2)
    dispositifs_stats = dispositifs_stats.reset_index()
    
    # 2. Tableau Statistiques Appels
    appels_stats = pd.DataFrame({
        'Type': ['Appels reçus', 'Appels traités', 'Appels escaladés', 'Tickets créés', 
                'Appels abandonnés', 'Attente la plus longue', 'Attente moyenne', 
                'Temps de parole moyen', 'Résolution au premier contact'],
        'Saint-Denis': [len(df[df['ville'] == 'Saint-Denis']), 0, 0, 
                       len(df[df['ville'] == 'Saint-Denis']), 0, '', '', '', ''],
        'Saint-Pierre': [len(df[df['ville'] == 'Saint-Pierre']), 0, 0,
                        len(df[df['ville'] == 'Saint-Pierre']), 0, '', '', '', ''],
    })
    appels_stats['Total'] = appels_stats[['Saint-Denis', 'Saint-Pierre']].apply(
        lambda x: sum(v for v in x if isinstance(v, (int, float))), axis=1
    )
    
    # 3. Tableau Statistiques Catégories
    categories_stats = df.groupby(['Catégorie', 'ville']).size().unstack(fill_value=0)
    categories_stats['Total'] = categories_stats.sum(axis=1)
    categories_stats = categories_stats.reset_index()

    return dbc.Container([
        html.H2([
            html.I(className="fas fa-chart-line me-3"),
            f"Rapport Journalier du {datetime.now().strftime('%d-%m-%Y')}"
        ], className="text-center my-4"),
        
        # Nouveau ! Ajout du tableau de bord
        create_dashboard(df),
        
        # Section 1: Statistiques Dispositif
        dbc.Card([
            dbc.CardHeader(html.H3("STATISTIQUES DISPOSITIF", className="text-center")),
            dbc.CardBody([
                create_stat_table(
                    dispositifs_stats,
                    "Statistiques des Dispositifs"
                ),
                dcc.Graph(figure=create_bar_chart(
                    df.groupby(['dispositif', 'ville']).size().reset_index(name='count'),
                    'dispositif', 'count', 'ville',
                    "Statistiques des Dispositifs"
                ))
            ])
        ], className="mb-4"),
        
        # Section 2: Statistiques Appels
        dbc.Card([
            dbc.CardHeader(html.H3("STATISTIQUES APPELS", className="text-center")),
            dbc.CardBody([
                create_stat_table(
                    appels_stats,
                    "Statistiques des Appels"
                ),
                dcc.Graph(figure=create_bar_chart(
                    appels_stats[appels_stats['Type'].isin(['Appels reçus', 'Appels traités', 'Tickets créés'])],
                    'Type', 'Total', 'Type',
                    "Statistiques des Appels"
                ))
            ])
        ], className="mb-4"),
        
        # Section 3: Statistiques Catégories
        dbc.Card([
            dbc.CardHeader(html.H3("STATISTIQUES CATÉGORIES", className="text-center")),
            dbc.CardBody([
                create_stat_table(
                    categories_stats,
                    "Statistiques des Catégories"
                ),
                dcc.Graph(figure=create_bar_chart(
                    df.groupby(['Catégorie', 'ville']).size().reset_index(name='count'),
                    'Catégorie', 'count', 'ville',
                    "Statistiques des Catégories"
                ))
            ])
        ])
    ], fluid=True)

def create_home_layout():
    """Crée le layout de la page d'accueil"""
    # Liste des fichiers récents
    files = []
    if os.path.exists(UPLOAD_DIRECTORY):
        for filename in os.listdir(UPLOAD_DIRECTORY):
            if filename.endswith('.csv'):
                path = os.path.join(UPLOAD_DIRECTORY, filename)
                if os.path.isfile(path):
                    date_str = filename.split('_')[1][:8]
                    date = datetime.strptime(date_str, "%Y%m%d").strftime("%d-%m-%Y")
                    files.append({'name': filename, 'date': date, 'path': path})
    
    files = sorted(files, key=lambda x: x['date'], reverse=True)
    
    return html.Div([
        # Hero Section
        dbc.Container([
            dbc.Row([
                dbc.Col([
                    html.Div([
                        html.H1([
                            html.I(className="fas fa-tachometer-alt me-3"),
                            "Tableau de Bord GLPI"
                        ], className="display-4 mb-4"),
                        html.P(
                            "Analysez vos données d'appels et générez des rapports détaillés",
                            className="lead mb-4"
                        ),
                        html.Hr(className="my-4"),
                    ], className="text-center py-5")
                ])
            ], className="mb-5")
        ], fluid=True, className="bg-light py-3"),
        
        # Main Content
        dbc.Container([
            dbc.Row([
                # Section Upload
                dbc.Col([
                    dbc.Card([
                        dbc.CardHeader([
                            html.H4([
                                html.I(className="fas fa-upload me-2"),
                                "Importer un fichier"
                            ], className="mb-0")
                        ], className="bg-primary text-white"),
                        dbc.CardBody([
                            dcc.Upload(
                                id='upload-data',
                                children=html.Div([
                                    html.I(className="fas fa-cloud-upload-alt fa-3x mb-3"),
                                    html.Div("Glissez-déposez un fichier CSV ici ou"),
                                    dbc.Button(
                                        "Parcourir",
                                        color="primary",
                                        size="sm",
                                        className="mt-2"
                                    ),
                                ], className="text-center"),
                                style=UPLOAD_STYLE,
                                multiple=False,
                                accept='.csv'
                            ),
                            html.Div(id='output-data-upload'),
                            dbc.Alert([
                                html.I(className="fas fa-info-circle me-2"),
                                "Seuls les fichiers CSV sont acceptés"
                            ], color="info", className="mt-3")
                        ])
                    ], className="mb-4 hover-shadow")
                ], md=6),
                
                # Section Fichiers Récents
                dbc.Col([
                    dbc.Card([
                        dbc.CardHeader([
                            html.H4([
                                html.I(className="fas fa-history me-2"),
                                "Fichiers Récents"
                            ], className="mb-0")
                        ], className="bg-success text-white"),
                        dbc.CardBody([
                            html.Div([
                                dbc.ListGroup([
                                    dbc.ListGroupItem([
                                        dbc.Row([
                                            dbc.Col([
                                                html.I(className="fas fa-file-csv me-2 text-success"),
                                                f"Rapport du {file['date']}"
                                            ], width=8),
                                            dbc.Col([
                                                dbc.Button([
                                                    html.I(className="fas fa-chart-bar me-2"),
                                                    "Voir"
                                                ], 
                                                color="success",
                                                size="sm",
                                                href=f"/journalier?file={file['name']}")
                                            ], width=4, className="text-end")
                                        ])
                                    ], className="hover-light") for file in files[:5]
                                ] if files else [
                                    dbc.ListGroupItem([
                                        html.I(className="fas fa-info-circle me-2"),
                                        "Aucun fichier récent"
                                    ], className="text-muted text-center")
                                ])
                            ], style={"maxHeight": "300px", "overflowY": "auto"})
                        ])
                    ], className="mb-4 hover-shadow")
                ], md=6)
            ]),
            
            # Section Guide
            dbc.Row([
                dbc.Col([
                    dbc.Card([
                        dbc.CardHeader([
                            html.H4([
                                html.I(className="fas fa-book me-2"),
                                "Guide d'utilisation"
                            ], className="mb-0")
                        ], className="bg-info text-white"),
                        dbc.CardBody([
                            dbc.Row([
                                dbc.Col([
                                    html.Div([
                                        html.I(className="fas fa-file-upload fa-2x mb-3 text-info"),
                                        html.H5("1. Import", className="mb-2"),
                                        html.P("Uploadez votre fichier CSV via le formulaire", className="text-muted")
                                    ], className="text-center")
                                ], md=3),
                                dbc.Col([
                                    html.Div([
                                        html.I(className="fas fa-chart-pie fa-2x mb-3 text-info"),
                                        html.H5("2. Analyse", className="mb-2"),
                                        html.P("Visualisez les statistiques générées", className="text-muted")
                                    ], className="text-center")
                                ], md=3),
                                dbc.Col([
                                    html.Div([
                                        html.I(className="fas fa-filter fa-2x mb-3 text-info"),
                                        html.H5("3. Filtrage", className="mb-2"),
                                        html.P("Filtrez les données par catégorie", className="text-muted")
                                    ], className="text-center")
                                ], md=3),
                                dbc.Col([
                                    html.Div([
                                        html.I(className="fas fa-download fa-2x mb-3 text-info"),
                                        html.H5("4. Export", className="mb-2"),
                                        html.P("Exportez vos rapports en PDF", className="text-muted")
                                    ], className="text-center")
                                ], md=3),
                            ])
                        ])
                    ], className="mb-4 hover-shadow")
                ])
            ])
        ], fluid=True)
    ])

# Layout principal
app.layout = html.Div([
    navbar,
    dcc.Location(id='url', refresh=False),
    html.Div(id='page-content')
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
        return dbc.Alert([
            html.I(className="fas fa-info-circle me-2"),
            "Sélectionnez un fichier sur la page d'accueil"
        ], color="info", className="m-4")
    
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
    Output('output-data-upload', 'children'),
    Input('upload-data', 'contents'),
    State('upload-data', 'filename')
)
def update_output(contents, filename):
    if contents is not None:
        try:
            content_type, content_string = contents.split(',')
            decoded = base64.b64decode(content_string)
            
            date_str = datetime.now().strftime("%Y%m%d")
            new_filename = f"data_{date_str}.csv"
            
            filepath = os.path.join(UPLOAD_DIRECTORY, new_filename)
            with open(filepath, 'wb') as f:
                f.write(decoded)
            
            return dbc.Alert([
                html.I(className="fas fa-check-circle me-2"),
                f"Fichier sauvegardé avec succès ! ",
                dbc.Button("Voir les statistiques", 
                          href=f"/journalier?file={new_filename}",
                          color="success",
                          size="sm",
                          className="ms-2")
            ], color="success", className="mt-3")
            
        except Exception as e:
            return dbc.Alert([
                html.I(className="fas fa-exclamation-triangle me-2"),
                f"Erreur lors du traitement du fichier: {str(e)}"
            ], color="danger", className="mt-3")

if __name__ == '__main__':
    app.run_server(debug=True)
