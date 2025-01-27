from models import db

class DayRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date_ouverture = db.Column(db.Date, nullable=False, unique=True)
    attente_plus_longue = db.Column(db.Integer)  # En secondes
    attente_moyenne = db.Column(db.Integer)  # En secondes
    temps_parole_moyen = db.Column(db.Integer)  # En secondes
    call_statistics = db.relationship('CallStatistics', backref='day_record', lazy=True)
