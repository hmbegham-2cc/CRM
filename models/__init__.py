from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from .dispositif import Dispositif
from .unite_traitement import UniteTraitement
from .call_statistics import CallStatistics
from .day_record import DayRecord
from .ticket import Ticket
