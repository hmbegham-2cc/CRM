from models import Dispositif, db


def get_or_create_dispositif(nom, abbreviation):
    """Récupère ou crée un dispositif"""
    dispositif = Dispositif.query.filter_by(nom=nom).first()
    if not dispositif:
        dispositif = Dispositif(nom=nom, abbreviation=abbreviation)
        db.session.add(dispositif)
        db.session.commit()
    return dispositif
