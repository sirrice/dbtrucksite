import json
import md5
import traceback
import pdb
import datetime

from operator import add
from gevent.pywsgi import WSGIServer # must be pywsgi to support websocket
from geventwebsocket.handler import WebSocketHandler
from flask import Flask, request, render_template, g, redirect
from sqlalchemy import *

from dbtruck.dbtruck import *
from dbtruck.exporters.db import *
from dbtruck.exporters.pg import PGMethods
from dbtruck.analyze.analyze import add_user_annotation
#from dbtruck.analyze.metadata import *
from dbtruck.analyze.models import *


from dbtrucksite import app, db
from dbtrucksite import app, db
from dbtrucksite.data import *
import dbtrucksite.settings as settings


@app.before_request
def before_request():
    g.tstamp = md5.md5(str(hash(datetime.datetime.now()))).hexdigest()
        

@app.teardown_request
def teardown_request(exception):
    pass


@app.route('/test/', methods=['POST' ,'GET'])
def test():
    db.session.add(Metadata('newtable again'))
    db.session.commit()
    return str(db.session.query(Metadata).all())
        
@app.route('/', methods=["POST", "GET"])
def index():
    context = dict(request.form.items())
    try:
        pass
    except Exception as e:

        traceback.print_exc()
        context['errormsg'] = str(e)
    return render_template('index.html', **context)

@app.route('/annotate/get/', methods=['POST', 'GET'])
def annotate_get():
    meta = MetaData(db.engine)
    meta.reflect()
    
    table = request.form.get('table', None)
    annos = {}
    cols = []
    if table:
        tablemd = Metadata.load_from_tablename(db.engine, table)
        for anno in tablemd.annotations:
            d = {}
            d['annotype'] = anno.annotype
            d['col'] = anno.name
            d['loctype'] = anno.loctype
            annos[anno.name] = d

        schema = meta.tables[table]
        cols = filter(lambda c: not c.startswith('_'), schema.columns.keys())
    data = [ ['state', 'zipcode', 'city', 'address'],
             cols,
             annos ]
    return json.dumps(data)

@app.route('/annotate/update/', methods=['POST', 'GET'])
def annotate_update():
    try:
        print request.form
        tablename = request.form['table']
        tablemd = Metadata.load_from_tablename(db.engine, tablename)        
        newannos = []
        for key, val in request.form.iteritems():
            if val.strip() == '':
                continue
            if key == 'table':
                continue
            if key == '_userinput_':
                anno = Annotation(val.strip(), key, 'parse_default', tablemd, annotype=1, user_set=True)
            elif key.startswith('_col_'):
                key = key[5:]
                loctype = val.strip()
                anno = Annotation(key, loctype, 'parse_default', tablemd, annotype=0, user_set=True)
            newannos.append(anno)

        tablemd.state = 1
        
        map(db_session.delete, tablemd.annotations)
        db_session.add_all(newannos)
        db_session.add(tablemd)
        db_session.commit()
    except:
        traceback.print_exc()
    return redirect('/')


@app.route('/annotate/address/', methods=['POST', 'GET'])
def annotate_address():
    col = request.form.get('colname', None)
    table = request.form.get('table', None)
    if col and table:
        tablemd = Metadata.load_from_tablename(db.engine, table)
        add_user_annotation(tablemd, 'address', col)
    
    return "success"

@app.route('/data/get/', methods=['POST', 'GET'])
def data_get():
    url = request.form.get('url', None)
    name = request.form.get('name', None)
    if url and name:
        try:
            import_datafiles([url], True, name, settings.DBNAME, None, PGMethods)
        except:
            traceback.print_exc()
    return redirect('/')
    

    
@app.route('/json/data/all/', methods=['POST', 'GET'])
def json_data():
    """
    retrieve samples of all tables
    """
    meta = MetaData(db.engine)
    meta.reflect()
    data = []
    for tablename, schema in meta.tables.items():
        if tablename.startswith('__dbtruck'):
            continue
        tablemd = Metadata.load_from_tablename(db.engine, tablename)
        rows = get_table(tablename, schema)
        if rows:
            rows = stringify_rows(rows)
            md = get_table_metadata(tablemd)
            data.append([tablename, rows, md])
    data.sort(key=lambda r: r[0])                
    return json.dumps(data)



@app.route('/json/data/loc/', methods=['POST', 'GET'])
def json_loc_data():
    """
    retrieve samples of tables with hidden location data
    """
    meta = MetaData(db.engine)
    meta.reflect()
    data = []
    for tablename, schema in meta.tables.items():
        if tablename.startswith('__dbtruck'):
            continue
        tablemd = Metadata.load_from_tablename(db.engine, tablename)
        if tablemd.state < 3:
            continue
        rows = get_table(tablename, schema)
        if rows:
            rows = stringify_rows(rows)
            md = get_table_metadata(tablemd)
            latlons = get_latlons(tablemd, md['nrows'])
            md['latlons'] = latlons
            print md['stats']
            data.append([tablename, rows, md])
    data.sort(key=lambda r: r[0])                
    return json.dumps(data)


@app.route('/json/data/corr/', methods=['POST', 'GET'])
def json_corr():
    """
    """
    ret = '[]'
    try:
        data = get_correlations()
        ret = json.dumps(data)
    except Exception as e:
        pdb.set_trace()
    return ret
    


@app.route('/createloc/', methods=['POST', 'GET'])
def create_location_table():
    tablename = request.form.get('tablename', None)
    locdata = request.form.get('locdata', None)
    print tablename
    if tablename:
        try:
            create_and_populate_location_table(db, tablename, maxinserts=30, user_input=locdata)
        except:
            traceback.print_exc()
    return redirect('/')
            

