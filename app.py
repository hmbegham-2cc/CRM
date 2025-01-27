from flask import Flask, request, render_template, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from datetime import datetime
import pandas as pd
import re
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///glpi_data.db'
app.config['UPLOAD_FOLDER'] = 'uploads'
db = SQLAlchemy(app)
migrate = Migrate(app, db)

# Modèles de données
class Dispositif(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(200), nullable=False)
    abbreviation = db.Column(db.String(50))
    tickets = db.relationship('Ticket', backref='dispositif', lazy=True)

    def __repr__(self):
        return f'<Dispositif {self.nom}>'

class UniteTraitement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(100), nullable=False, unique=True)
    call_statistics = db.relationship('CallStatistics', backref='unite_traitement', lazy=True)

class CallStatistics(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    appels_traites = db.Column(db.Integer, nullable=False)
    appels_escalades = db.Column(db.Integer, nullable=False)
    appels_abandonnes = db.Column(db.Integer, nullable=False)
    day_record_id = db.Column(db.Integer, db.ForeignKey('day_record.id'), nullable=False)
    unite_traitement_id = db.Column(db.Integer, db.ForeignKey('unite_traitement.id'), nullable=False)
    tickets = db.relationship('Ticket', backref='call_statistics', lazy=True)

class DayRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date_ouverture = db.Column(db.Date, nullable=False, unique=True)
    attente_plus_longue = db.Column(db.Integer)  # En secondes
    attente_moyenne = db.Column(db.Integer)  # En secondes
    temps_parole_moyen = db.Column(db.Integer)  # En secondes
    call_statistics = db.relationship('CallStatistics', backref='day_record', lazy=True)

class Ticket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    numero_ticket = db.Column(db.String(50), unique=True, nullable=False)
    call_statistics_id = db.Column(db.Integer, db.ForeignKey('call_statistics.id'), nullable=False)
    dispositif_id = db.Column(db.Integer, db.ForeignKey('dispositif.id'), nullable=False)
    categorie = db.Column(db.String(100))
    timestamp = db.Column(db.DateTime)

    def __repr__(self):
        return f'<Ticket {self.numero_ticket}>'

def extraire_info_titre(titre):
    """Extrait l'unité de traitement et le dispositif du titre
    Format: '[UnitéTraitement] - Dispositif (ABBREVIATION)'
    """
    pattern = r'\[(.*?)\]\s*-\s*(.*?)(?:\((.*?)\))?$'
    match = re.match(pattern, titre)
    
    if match:
        unite = match.group(1).strip()
        dispositif = match.group(2).strip()
        abbreviation = match.group(3).strip() if match.group(3) else None
        
        # Si pas d'abréviation, on la crée à partir du nom du dispositif
        if not abbreviation:
            # Prend les premières lettres des mots significatifs
            mots = [mot for mot in dispositif.split() if len(mot) > 2]  # Ignore les petits mots
            if mots:
                abbreviation = ''.join(word[0].upper() for word in mots)
            else:
                # Si pas de mots significatifs, prend les 3 premières lettres
                abbreviation = dispositif[:3].upper()
            
        return unite, dispositif, abbreviation
    return None, None, None

def get_or_create_dispositif(nom, abbreviation):
    """Récupère ou crée un dispositif"""
    dispositif = Dispositif.query.filter_by(nom=nom).first()
    if not dispositif:
        dispositif = Dispositif(nom=nom, abbreviation=abbreviation)
        db.session.add(dispositif)
        db.session.commit()
    return dispositif

def get_or_create_unite_traitement(nom):
    """Récupère ou crée une unité de traitement"""
    unite_traitement = UniteTraitement.query.filter_by(nom=nom).first()
    if not unite_traitement:
        unite_traitement = UniteTraitement(nom=nom)
        db.session.add(unite_traitement)
        db.session.commit()
    return unite_traitement

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/tickets')
def get_tickets():
    # Paramètres de DataTables
    start = request.args.get('start', type=int, default=0)
    length = request.args.get('length', type=int, default=10)
    search = request.args.get('search[value]', '')
    
    # Paramètres de tri
    order_column = request.args.get('order[0][column]', type=int, default=4)  # Par défaut, tri sur date
    order_dir = request.args.get('order[0][dir]', default='desc')
    
    # Mapping des colonnes pour le tri
    columns = {
        0: Ticket.numero_ticket,
        1: UniteTraitement.nom,
        2: Dispositif.nom,
        3: Ticket.categorie,
        4: Ticket.timestamp
    }
    
    query = Ticket.query.join(CallStatistics).join(UniteTraitement).join(Dispositif)
    
    # Recherche
    if search:
        query = query.filter(
            db.or_(
                Ticket.numero_ticket.contains(search),
                UniteTraitement.nom.contains(search),
                Dispositif.nom.contains(search),
                Ticket.categorie.contains(search)
            )
        )
    
    # Application du tri
    sort_column = columns.get(order_column)
    if sort_column is not None:
        if order_dir == 'desc':
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
    
    # Total des enregistrements sans filtre
    total_records = Ticket.query.count()
    
    # Total des enregistrements après filtre
    filtered_records = query.count()
    
    # Pagination
    tickets = query.offset(start).limit(length).all()
    
    data = [{
        'numero_ticket': ticket.numero_ticket,
        'unite_traitement': ticket.call_statistics.unite_traitement.nom,
        'dispositif': ticket.dispositif.nom,
        'categorie': ticket.categorie,
        'date_ouverture': ticket.timestamp.strftime('%d-%m-%Y %H:%M')
    } for ticket in tickets]
    
    return jsonify({
        'data': data,
        'recordsTotal': total_records,
        'recordsFiltered': filtered_records,
        'draw': request.args.get('draw', type=int)
    })

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'Aucun fichier n\'a été envoyé'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Aucun fichier sélectionné'}), 400
        
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'Le fichier doit être au format CSV'}), 400

    try:
        # Lecture du fichier CSV
        df = pd.read_csv(file, sep=';')
        
        # Traitement des données
        for _, row in df.iterrows():
            unite, dispositif_nom, abbreviation = extraire_info_titre(row['Titre'])
            
            if not all([unite, dispositif_nom]):
                continue
                
            # Création ou récupération de l'unité de traitement
            unite_traitement = get_or_create_unite_traitement(unite)
            
            # Création ou récupération du dispositif
            dispositif = get_or_create_dispositif(dispositif_nom, abbreviation)
            
            # Corriger l'analyse de la date pour inclure l'heure
            try:
                date_ouverture = datetime.strptime(row['Date d\'ouverture'], '%d-%m-%Y %H:%M')
            except ValueError:
                # Essayer un autre format possible
                date_ouverture = datetime.strptime(row['Date d\'ouverture'], '%Y-%m-%d %H:%M:%S')
            
            # Vérifier si le jour existe déjà dans DayRecord
            day_record = DayRecord.query.filter_by(date_ouverture=date_ouverture.date()).first()
            if not day_record:
                day_record = DayRecord(date_ouverture=date_ouverture.date())
                db.session.add(day_record)
                db.session.commit()

            # Exemple de traitement pour les statistiques d'appels
            appels_traites = int(row.get('Appels Traités', 0))
            appels_escalades = int(row.get('Appels Escaladés', 0))
            appels_abandonnes = int(row.get('Appels Abandonnés', 0))

            # Vérifier si la statistique d'appels existe déjà pour le jour et l'unité de traitement
            call_stat = CallStatistics.query.filter_by(day_record_id=day_record.id, unite_traitement_id=unite_traitement.id).first()
            if not call_stat:
                call_stat = CallStatistics(
                    appels_traites=appels_traites,
                    appels_escalades=appels_escalades,
                    appels_abandonnes=appels_abandonnes,
                    day_record_id=day_record.id,
                    unite_traitement_id=unite_traitement.id
                )
                db.session.add(call_stat)
                db.session.commit()  # Assurez-vous de commettre pour obtenir l'ID
            else:
                # Mettre à jour les statistiques existantes
                call_stat.appels_traites += appels_traites
                call_stat.appels_escalades += appels_escalades
                call_stat.appels_abandonnes += appels_abandonnes
                db.session.commit()  # Assurez-vous de commettre les mises à jour

            # Lier le ticket à la statistique d'appels
            ticket = Ticket(
                numero_ticket=row['ID'],
                call_statistics_id=call_stat.id,
                dispositif_id=dispositif.id,
                categorie=row['Catégorie'],
                timestamp=date_ouverture
            )
            db.session.add(ticket)
        
        db.session.commit()
        return jsonify({'message': 'Fichier traité avec succès'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Erreur lors du traitement: {str(e)}'}), 500

@app.route('/reset_database', methods=['POST'])
def reset_database():
    try:
        # Suppression de toutes les données
        Ticket.query.delete()
        CallStatistics.query.delete()
        DayRecord.query.delete()
        UniteTraitement.query.delete()
        Dispositif.query.delete()
        db.session.commit()
        return jsonify({'message': 'Base de données réinitialisée avec succès'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Erreur lors de la réinitialisation: {str(e)}'}), 500

if __name__ == '__main__':
    # Création du dossier uploads s'il n'existe pas
    os.makedirs('uploads', exist_ok=True)
    
    # Création de la base de données si elle n'existe pas
    with app.app_context():
        db.create_all()
    
    app.run(debug=True)
