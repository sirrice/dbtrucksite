from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy
from sqlalchemy import *

import dbtrucksite.settings as settings

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = "postgresql://sirrice@localhost:5432/%s" % settings.DBNAME
db = SQLAlchemy(app)
setattr(db, 'execute', db.engine.execute)

import dbtruck.analyze.models
import dbtrucksite.views
