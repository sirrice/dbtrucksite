import json
import md5
import traceback
import pdb
import datetime

from operator import add
from gevent.pywsgi import WSGIServer # must be pywsgi to support websocket
from geventwebsocket.handler import WebSocketHandler
from flask import Flask, request, render_template, g, redirect
from dbtruck.dbtruck import *
from dbtruck.exporters.db import *
from dbtruck.exporters.pg import PGMethods
from dbtruck.analyze.location import *
from dbtruck.analyze.metadata import *

from dbtrucksite import app

DBNAME = 'test'

@app.before_request
def before_request():
    dbname = request.form.get('db', DBNAME)
    g.db = connect(dbname)
    g.dbname = dbname
    g.tstamp = md5.md5(str(hash(datetime.datetime.now()))).hexdigest()
        

@app.teardown_request
def teardown_request(exception):
    try:
        g.db.close()
    except:
        pass


        
@app.route('/', methods=["POST", "GET"])
def index():
    context = dict(request.form.items())
    try:
        pass
    except Exception as e:

        traceback.print_exc()
        context['errormsg'] = str(e)
    return render_template('index.html', **context)



@app.route('/data/get/', methods=['POST', 'GET'])
def data_get():
    db = g.db
    url = request.form.get('url', None)
    name = request.form.get('name', None)
    if url and name:
        try:
            import_datafiles([url], True, name, DBNAME, None, PGMethods)
        except:
            traceback.print_exc()
    return redirect('/')
    
    

@app.route('/json/data/all/', methods=['POST', 'GET'])
def json_data():
    """
    retrieve samples of ALL tables
    """
    db = g.db
    data = []
    for table, loctable in get_table_name_pairs(db):
        rows = get_table(table)
        if rows:
            rows = stringify_rows(rows)
            data.append([table, rows, get_table_metadata(table)])
            for row in rows:
                try:
                    json.dumps(row)
                except:
                    print row
                    traceback.print_exc()
                    break
    data.sort(key=lambda r: r[0])
    return json.dumps(data)

@app.route('/json/data/loc/', methods=['POST', 'GET'])
def json_loc_data():
    """
    retrieve samples of tables with hidden location data
    """
    db = g.db
    data = []
    for regtable, loctable in get_table_name_pairs(db):
        if regtable and loctable:
            rows = join_regular_and_hidden_tables(db, regtable)
            if rows:
                rows = stringify_rows(rows)
                data.append([regtable, rows, get_table_metadata(regtable)])
    data.sort(key=lambda r: r[0])                
    return json.dumps(data)

@app.route('/json/data/noloc/', methods=['POST', 'GET'])
def json_noloc_data():
    """
    retrieve samples of tables that we think have location data but are not geocoded
    """
    # does the data contain city, state info?
    db = g.db
    data = []
    locmd = LocationMD(db)
    for regtable, loctable in get_table_name_pairs(db):
        if regtable and not locmd.is_done(regtable):
            loc_dict, colname_dict = find_location_columns(db, regtable)
            if len(loc_dict) > 1:
                rows = get_table(regtable)
                if rows:
                    md = get_table_metadata(regtable)
                    md['loc_cols'] = reduce(add, colname_dict.values())
                    rows = stringify_rows(rows)
                    data.append([regtable, rows, md])
    data.sort(key=lambda r: r[0])                    
    return json.dumps(data)

@app.route('/createloc/', methods=['POST', 'GET'])
def create_location_table():
    tablename = request.form.get('tablename', None)
    locdata = request.form.get('locdata', None)
    print tablename
    if tablename:
        try:
            create_and_populate_location_table(g.db, tablename, maxinserts=30, user_input=locdata)
        except:
            traceback.print_exc()
    return redirect('/')
            

def get_table_metadata(table):
    db = g.db
    ret = {}
    try:
        q = "select count(*) from %s" % table
        count = query(db, q)[0][0]
        loc_dict = find_location_columns(db, table)
        if not ('state' in loc_dict or
                'city' in loc_dict or
                'zip' in loc_dict):
            ret['needdata'] = True
        else:
            ret['needdata'] = False
        loccols = set()
        
        ret['nrows'] = count
        ret['hasloc'] = len(loc_dict) > 1
        ret['tablename'] = table

    except:
        traceback.print_exc()

    try:
        stats = query(db, """select count(latitude), min(latitude), max(latitude),
        min(longitude), max(longitude), avg(latitude), avg(longitude),
        stddev(latitude), stddev(longitude) from _%s_loc_ where latitude is not null""" % table)[0]
        ret['stats'] = stats
    except Exception as e:
        print e

    return ret

def get_table(table, limit=10, offset=0):
    db = g.db
    try:
        q = """select column_name from information_schema.columns
        where table_name = %s order by ordinal_position;"""
        cols = [row[0] for row in query(db, q, (table,))]

                
        q = ["select %s from %s" % (','.join(cols), table)]
        if limit is not None:
            q.append('limit %d' % limit)
        if offset is not None:
            q.append('offset %d' % offset)
        q = ' '.join(q)

        rows = query(db, q)
        rows = [dict(zip(cols, map(to_str,row))) for row in rows]    
        return rows
    except:
        return None

def stringify_rows(rows):
    if not rows:
        return []
    cols = rows[0].keys()
    return [dict(zip(cols, map(to_str, row.values()))) for row in rows]
        
    
def to_str(v):
    try:
        return v.strftime('%m/%d/%Y %H:%M')
    except:
        if isinstance(v, unicode):
            s = v.encode('utf-8', errors='ignore')
        elif isinstance(v, basestring):
            s = unicode(v, 'utf-8', errors='ignore').encode('utf-8', errors='ignore')
        else:
            s = str(v)
        if len(s) > 150:
            s = s[:150] + '...'
        return s

if __name__ == "__main__":
    DEC2FLOAT = psycopg2.extensions.new_type(
        psycopg2.extensions.DECIMAL.values,
        'DEC2FLOAT',
        lambda value, curs: float(value) if value is not None else None)
    psycopg2.extensions.register_type(DEC2FLOAT)
    app.debug = True
    address = ('', 8080)
    http_server = WSGIServer(address, app, handler_class=WebSocketHandler)
    print "running"
    http_server.serve_forever()
