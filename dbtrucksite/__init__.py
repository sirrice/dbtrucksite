from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy
from sqlalchemy import *

DBURI = 'postgresql://sirrice@localhost:5432/test'

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = DBURI
db = SQLAlchemy(app)
setattr(db, 'execute', db.engine.execute)

import dbtruck.analyze.models
import dbtrucksite.views
