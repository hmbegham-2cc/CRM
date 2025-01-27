from models import UniteTraitement, db


def get_or_create_unite_traitement(nom):
    """Récupère ou crée une unité de traitement"""
    unite_traitement = UniteTraitement.query.filter_by(nom=nom).first()
    if not unite_traitement:
        unite_traitement = UniteTraitement(nom=nom)
        db.session.add(unite_traitement)
        db.session.commit()
    return unite_traitement
