from flask import Flask, request, render_template, jsonify
from flask_migrate import Migrate
from datetime import datetime
import pandas as pd
import os

from models import Dispositif, UniteTraitement, CallStatistics, DayRecord, Ticket, db

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///glpi_data.db'
app.config['UPLOAD_FOLDER'] = 'uploads'
db.init_app(app)
migrate = Migrate(app, db)

# Logique de création ou récupération
from logic.dispositif_logic import get_or_create_dispositif
from logic.unite_traitement_logic import get_or_create_unite_traitement
from logic.data_processing import extraire_info_titre

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
    
    # Filtrage par date
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if start_date:
        start_date = datetime.strptime(start_date, '%Y-%m-%d')
        start_date = start_date.replace(hour=0, minute=0, second=0)
        query = query.filter(Ticket.timestamp >= start_date)
    if end_date:
        end_date = datetime.strptime(end_date, '%Y-%m-%d')
        end_date = end_date.replace(hour=23, minute=59, second=59)
        query = query.filter(Ticket.timestamp <= end_date)

    # Recherche
    if search:
        query = query.filter(
            db.or_(
                Ticket.numero_ticket.ilike(f'%{search}%'),
                UniteTraitement.nom.ilike(f'%{search}%'),
                Dispositif.nom.ilike(f'%{search}%'),
                Ticket.categorie.ilike(f'%{search}%')
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
        'date_ouverture': ticket.timestamp.strftime('%d-%m-%Y %H:%M') if ticket.timestamp else ''
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
