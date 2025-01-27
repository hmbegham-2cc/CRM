from models import db

class UniteTraitement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(100), nullable=False, unique=True)
    call_statistics = db.relationship('CallStatistics', backref='unite_traitement', lazy=True)
