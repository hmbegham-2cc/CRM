import re

def extraire_info_titre(titre):
    """Extrait l'unité de traitement et le dispositif du titre
    Format: '[UnitéTraitement] - Dispositif (ABBREVIATION)'"""
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
