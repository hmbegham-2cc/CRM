from models import db

class Dispositif(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(200), nullable=False)
    abbreviation = db.Column(db.String(50))
    tickets = db.relationship('Ticket', backref='dispositif', lazy=True)

    def __repr__(self):
        return f'<Dispositif {self.nom}>'
