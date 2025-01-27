from models import db

class CallStatistics(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    appels_traites = db.Column(db.Integer, nullable=False)
    appels_escalades = db.Column(db.Integer, nullable=False)
    appels_abandonnes = db.Column(db.Integer, nullable=False)
    day_record_id = db.Column(db.Integer, db.ForeignKey('day_record.id'), nullable=False)
    unite_traitement_id = db.Column(db.Integer, db.ForeignKey('unite_traitement.id'), nullable=False)
    tickets = db.relationship('Ticket', backref='call_statistics', lazy=True)
