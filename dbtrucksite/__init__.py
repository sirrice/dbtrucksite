from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy
from sqlalchemy import *
from sqlalchemy.orm import sessionmaker

from settings import DBURI
from locjoin import init_model


app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = DBURI
db = SQLAlchemy(app)
setattr(db, 'execute', db.engine.execute)

init_model(db.engine)

import dbtrucksite.views
