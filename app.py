import dash
from dash import html, dcc, Input, Output, State
import dash_bootstrap_components as dbc
import pandas as pd
import plotly.express as px
from datetime import datetime
import os
import base64
import shutil

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

def is_csv_file(filename):
    """Vérifie si le fichier est un CSV"""
    return filename.lower().endswith('.csv')

def save_file(content, filename):
    """Sauvegarde un fichier uploadé dans le dossier uploads"""
    if content is not None and is_csv_file(filename):
        content_type, content_string = content.split(',')
        decoded = base64.b64decode(content_string)
        
        date_str = datetime.now().strftime("%Y%m%d")
        new_filename = f"data_{date_str}.csv"
        
        filepath = os.path.join(UPLOAD_DIRECTORY, new_filename)
        with open(filepath, 'wb') as f:
            f.write(decoded)
        return filepath
    return None

def list_uploaded_files():
    """Liste tous les fichiers dans le dossier uploads"""
    files = []
    for filename in os.listdir(UPLOAD_DIRECTORY):
        if filename.endswith('.csv'):
            path = os.path.join(UPLOAD_DIRECTORY, filename)
            if os.path.isfile(path):
                date_str = filename.split('_')[1][:8]
                date = datetime.strptime(date_str, "%Y%m%d").strftime("%d-%m-%Y")
                files.append({'name': filename, 'date': date, 'path': path})
    return sorted(files, key=lambda x: x['date'], reverse=True)

def load_data(file_path):
    try:
        # Lecture du fichier CSV avec encodage UTF-8 avec BOM
        df = pd.read_csv(file_path, encoding='utf-8-sig', sep=';')
        
        # Traitement des données pour les dispositifs
        df['ville'] = df['Titre'].apply(lambda x: 'Saint-Denis' if '[Saint-Denis]' in str(x) 
                                      else ('Saint-Pierre' if '[Saint-Pierre]' in str(x) else 'Autre'))
        
        # Nettoyage des titres (enlever les préfixes de ville)
        df['dispositif'] = df['Titre'].apply(lambda x: str(x).replace('[Saint-Denis] - ', '')
                                           .replace('[Saint-Pierre] - ', ''))
        
        # Remplacer les catégories partenaires
        df['Catégorie'] = df['Catégorie'].replace({
            'Agence de voyage': 'Partenaire',
            'Préfecture': 'Partenaire'
        })
        
        return df
    except Exception as e:
        print(f"Erreur lors du chargement des données: {e}")
        return pd.DataFrame()

def create_home_layout():
    files = list_uploaded_files()
    
    file_list = []
    if files:
        for file in files:
            file_list.append(
                dbc.Card(
                    dbc.CardBody([
                        html.Div([
                            html.Div([
                                html.I(className="fas fa-file-csv me-2", style={'color': '#28a745'}),
                                html.H5(f"Données du {file['date']}", className="d-inline"),
                            ]),
                            html.Small(file['name'], className="text-muted d-block"),
                            dbc.Button(
                                [html.I(className="fas fa-chart-bar me-2"), "Voir les statistiques"],
                                color="primary",
                                size="sm",
                                href=f"/journalier?file={file['name']}",
                                className="mt-2"
                            )
                        ])
                    ]),
                    className="mb-3 hover-shadow"
                )
            )
    else:
        file_list.append(
            dbc.Card(
                dbc.CardBody([
                    html.I(className="fas fa-info-circle me-2"),
                    "Aucun fichier CSV uploadé"
                ]),
                className="text-center text-muted"
            )
        )

    return html.Div([
        dbc.Container([
            html.H1([
                html.I(className="fas fa-tachometer-alt me-3"),
                "Tableau de Bord GLPI"
            ], className="text-center mt-4 mb-5"),
            
            dbc.Row([
                dbc.Col([
                    dbc.Card([
                        dbc.CardHeader(html.H4([
                            html.I(className="fas fa-upload me-2"),
                            "Importer un nouveau fichier"
                        ])),
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
                    ], style=CUSTOM_STYLE)
                ], md=6),
                
                dbc.Col([
                    dbc.Card([
                        dbc.CardHeader(html.H4([
                            html.I(className="fas fa-folder-open me-2"),
                            "Fichiers disponibles"
                        ])),
                        dbc.CardBody(file_list)
                    ], style=CUSTOM_STYLE)
                ], md=6)
            ])
        ], fluid=True)
    ])

def create_daily_stats(df):
    if df.empty:
        return dbc.Alert([
            html.I(className="fas fa-exclamation-triangle me-2"),
            "Aucune donnée disponible. Veuillez charger un fichier CSV valide."
        ], color="warning", className="m-4")
    
    # Statistiques des dispositifs
    dispositifs_stats = df.groupby(['ville', 'dispositif']).size().reset_index(name='count')
    fig_dispositifs = px.bar(
        dispositifs_stats,
        x='dispositif',
        y='count',
        color='ville',
        title='Statistiques des Dispositifs',
        template='plotly_white',
        barmode='group'
    )
    fig_dispositifs.update_layout(
        legend_title_text='Ville',
        xaxis_title="Dispositif",
        yaxis_title="Nombre",
        plot_bgcolor='rgba(0,0,0,0)'
    )
    
    # Statistiques des catégories
    categories_stats = df.groupby(['ville', 'Catégorie']).size().reset_index(name='count')
    fig_categories = px.bar(
        categories_stats,
        x='Catégorie',
        y='count',
        color='ville',
        title='Statistiques des Catégories',
        template='plotly_white',
        barmode='group'
    )
    fig_categories.update_layout(
        legend_title_text='Ville',
        xaxis_title="Catégorie",
        yaxis_title="Nombre",
        plot_bgcolor='rgba(0,0,0,0)'
    )
    
    return dbc.Container([
        html.H2([
            html.I(className="fas fa-chart-line me-3"),
            f"Rapport Journalier du {datetime.now().strftime('%d-%m-%Y')}"
        ], className="text-center my-4"),
        
        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader(html.H3([
                        html.I(className="fas fa-table me-2"),
                        "Statistiques Dispositifs"
                    ], className="text-center h5")),
                    dbc.CardBody(
                        dbc.Table.from_dataframe(
                            dispositifs_stats,
                            striped=True,
                            bordered=True,
                            hover=True,
                            className="table-sm"
                        )
                    )
                ], style=CUSTOM_STYLE)
            ], width=6),
            
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader(html.H3([
                        html.I(className="fas fa-table me-2"),
                        "Statistiques Catégories"
                    ], className="text-center h5")),
                    dbc.CardBody(
                        dbc.Table.from_dataframe(
                            categories_stats,
                            striped=True,
                            bordered=True,
                            hover=True,
                            className="table-sm"
                        )
                    )
                ], style=CUSTOM_STYLE)
            ], width=6),
        ]),
        
        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardBody(dcc.Graph(figure=fig_dispositifs))
                ], style=CUSTOM_STYLE)
            ], width=6),
            
            dbc.Col([
                dbc.Card([
                    dbc.CardBody(dcc.Graph(figure=fig_categories))
                ], style=CUSTOM_STYLE)
            ], width=6),
        ])
    ], fluid=True)

# Layout principal
app.layout = html.Div([
    navbar,
    dcc.Location(id='url', refresh=False),
    html.Div(id='page-content')
])

@app.callback(
    Output('output-data-upload', 'children'),
    Input('upload-data', 'contents'),
    State('upload-data', 'filename')
)
def update_output(contents, filename):
    if contents is not None:
        if not is_csv_file(filename):
            return dbc.Alert([
                html.I(className="fas fa-exclamation-circle me-2"),
                "Erreur : Seuls les fichiers CSV sont acceptés"
            ], color="danger", className="mt-3")
            
        try:
            filepath = save_file(contents, filename)
            if filepath:
                return dbc.Alert([
                    html.I(className="fas fa-check-circle me-2"),
                    "Fichier CSV sauvegardé avec succès !"
                ], color="success", className="mt-3")
        except Exception as e:
            return dbc.Alert([
                html.I(className="fas fa-exclamation-triangle me-2"),
                f"Erreur lors du traitement du fichier: {str(e)}"
            ], color="danger", className="mt-3")

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
    
    return create_home_layout()

if __name__ == '__main__':
    app.run_server(debug=True)
