from models import db

class Ticket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    numero_ticket = db.Column(db.String(50), unique=True, nullable=False)
    call_statistics_id = db.Column(db.Integer, db.ForeignKey('call_statistics.id'), nullable=False)
    dispositif_id = db.Column(db.Integer, db.ForeignKey('dispositif.id'), nullable=False)
    categorie = db.Column(db.String(100))
    timestamp = db.Column(db.DateTime)

    def __repr__(self):
        return f'<Ticket {self.numero_ticket}>'
