from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy
from sqlalchemy import *

from settings import DBURI


app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = DBURI
db = SQLAlchemy(app)
setattr(db, 'execute', db.engine.execute)

import locjoin.analyze.models
import dbtrucksite.views
