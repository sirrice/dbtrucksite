import re
import json
import md5
import traceback
import pdb
import datetime

from collections import defaultdict
from operator import add
from gevent.pywsgi import WSGIServer # must be pywsgi to support websocket
from geventwebsocket.handler import WebSocketHandler
from flask import Flask, request, render_template, g, redirect
from sqlalchemy import *


import locjoin.tasks.tasks as tasks
import locjoin.table.table as ljtable
from locjoin.metadata.metadata import *
import locjoin.settings as settings
from locjoin.util import *

from util import *
from dbtrucksite import app, db
from dbtrucksite.data import *

re_space = re.compile('\s+')
re_nonascii = re.compile('[^\w\s]')
re_nonasciistart = re.compile('^[^\w]')



@app.before_request
def before_request():
    g.tstamp = md5.md5(str(hash(datetime.datetime.now()))).hexdigest()
    task_engine = create_engine(settings.DBURI, isolation_level='REPEATABLE READ')
    task_sm = sessionmaker(autocommit=False,
                           autoflush=True,
                           bind=task_engine)
    g.task_session = task_sm()
    
        

@app.teardown_request
def teardown_request(exception):
    g.task_session.close()


@app.route('/', methods=['GET'])
def index():
    tablenames = get_user_tables(db.session)
    tables = []
    
    for tablename in tablenames:
        try:
            tables.append(ljtable.Table(db.session, tablename))
        except Exception as e:
            print e
            
    context = {'tables' : tables}
    return render_template('index.html', **context)

@app.route('/table/', methods=['POST' ,'GET'])
def table():
    tablename = request.args.get('tablename', None)
    context = {}
    if tablename:
        table = ljtable.Table(db.session, tablename)
        cols = table.cols()
        rows = table.rows()
        rows = stringify_rows(rows)
        context['tablename'] = tablename
        context['table'] = table
    return render_template('table.html', **context)



@app.route('/map/', methods=['POST' ,'GET'])
def map():
    tablename = request.args.get('tablename', None)
    context = {}
    if tablename:
        table = ljtable.Table(db.session, tablename)
        context['tablename'] = tablename
        context['table'] = table
    return render_template('map.html', **context)




@app.route('/metadata/update/', methods=['POST'])
def metadata_update():
    """
    Handle form submission for updating location metadata info
    """
    form = request.form
    tablename = form.get('tablename', '')    
    context = {}

    if tablename:
        reserved = ['tablename']

        # parse and gather attributes for each part
        metadatas = defaultdict(dict)
        for k, v in form.items():
            if k in reserved:
                continue

            idx = k.rindex('_')
            name, id = k[:idx], int(k[idx+1:])
            metadatas[id][name] = v


        user_inputs = []
        for mid, md in metadatas.items():
            try:
                if int(md.get('loc_type', '-1')) == -1:
                    continue
                if not md.get('format', '').strip():
                    continue
                if not md.get('col_name', '').strip():
                    continue

                if mid >= 0:
                    md['deleted'] = bool(int(md['deleted']))
                    md['id'] = mid
            except:
                pass

            user_inputs.append(md)

        
        lmds = create_metadata_from_user_inputs(db.session, tablename,  user_inputs)
        reprocess_lmds = update_metadata(db.session, tablename, lmds)
        reprocess_ids = [lmd.id for lmd in reprocess_lmds]
        print "reprocessing lmds: ", reprocess_ids

        # cancel tasks related to the table, then start up the
        # pipeline.  This works because the cron job executes
        # tasks serially in FIFO        
        tasks.cancel_tasks(g.task_session, tablename)
        tasks.run_extractor(g.task_session, tablename, ids=reprocess_ids)
        g.task_session.commit()
        
    return redirect('/')



        
# @app.route('/', methods=["POST", "GET"])
# def index():
#     context = dict(request.form.items())
#     try:
#         pass
#     except Exception as e:

#         traceback.print_exc()
#         context['errormsg'] = str(e)
#     return render_template('index.html', **context)

# @app.route('/annotate/get/', methods=['POST', 'GET'])
# def annotate_get():
#     meta = MetaData(db.engine)
#     meta.reflect()
    
#     table = request.form.get('table', None)
#     annos = {}
#     cols = []
#     if table:
#         tablemd = Metadata.load_from_tablename(db.session, table)
#         for anno in tablemd.annotations:
#             d = {}
#             if anno.loctype == '_userinput_':
#                 key = '_userinput_'
#             else:
#                 key = anno.name
                
#             d['annotype'] = anno.annotype
#             d['col'] = anno.name
#             d['loctype'] = anno.loctype
#             annos[key] = d

#         schema = meta.tables[table]
#         cols = filter(lambda c: not c.startswith('_'), schema.columns.keys())
#     print annos
#     data = [ ['state', 'zipcode', 'city', 'address'],
#              cols,
#              annos ]
#     return json.dumps(data)

# @app.route('/annotate/update/', methods=['POST', 'GET'])
# def annotate_update():
#     try:
#         tablename = request.form['table']
#         newannosargs = []
#         for key, val in request.form.iteritems():
#             if val.strip() == '':
#                 continue
#             if key == 'table':
#                 continue
#             if key == '_userinput_':
#                 args = (val.strip(), key, 'parse_default', 1)
#             elif key.startswith('_col_'):
#                 key = key[5:]
#                 loctype = val.strip()
#                 args = (key, loctype, 'parse_default', 0)
#             newannosargs.append(args)

#         update_annotations(db.session, tablename, newannosargs)
#         db.session.commit()

#     except:
#         traceback.print_exc()
#     return redirect('/')


# @app.route('/data/get/', methods=['POST', 'GET'])
# def data_get():
#     url = request.form.get('url', None)
#     name = request.form.get('name', None)
#     if url and name:
#         name = re_nonasciistart.sub('', re_space.sub('_', re_nonascii.sub('', name.strip()).strip()))        
#         add_table(db.session, url, name)
#     else:
#         pass
#     return redirect('/')
    

    
# @app.route('/json/data/all/', methods=['POST', 'GET'])
# def json_data():
#     """
#     retrieve samples of all tables
#     """
#     meta = MetaData(db.engine)
#     meta.reflect()
#     data = []
#     for tablename, schema in meta.tables.items():
#         if tablename.startswith('__dbtruck'):
#             continue
#         tablemd = Metadata.load_from_tablename(db.session, tablename)
#         rows = get_table(tablename, schema)
#         if rows:
#             rows = stringify_rows(rows)
#             md = get_table_metadata(tablemd)
#             data.append([tablename, rows, md])
#     data.sort(key=lambda r: r[0])
#     print "done!"
#     return json.dumps(data)



# @app.route('/json/data/loc/', methods=['POST', 'GET'])
# def json_loc_data():
#     """
#     retrieve samples of tables with hidden location data
#     """
#     meta = MetaData(db.engine)
#     meta.reflect()
#     data = []
#     for tablename, schema in meta.tables.items():
#         if tablename.startswith('__dbtruck'):
#             continue
#         tablemd = Metadata.load_from_tablename(db.session, tablename)
#         if tablemd.state < 3:
#             continue
#         rows = get_table(tablename, schema)
#         if rows:
#             rows = stringify_rows(rows)
#             md = get_table_metadata(tablemd)
#             latlons = get_latlons(tablemd, md['nrows'])
#             md['latlons'] = latlons
#             print md['stats']
#             data.append([tablename, rows, md])
#     data.sort(key=lambda r: r[0])                
#     return json.dumps(data)


# @app.route('/json/data/corr/', methods=['POST', 'GET'])
# def json_corr():
#     """
#     """
#     print "correlation"
#     tables = request.form.get('tables', '[]')
#     limit = request.form.get('limit', '5')
#     offset = request.form.get('offset', '0')
#     try:
#         tables = json.loads(tables)
#     except Exception as e:
#         tables = None
#     try:
#         limit = int(limit)
#     except:
#         limit = 5

#     try:
#         offset = int(offset)
#     except:
#         offset = 0

#     if not tables:
#         meta = MetaData(db.engine)
#         meta.reflect()
#         tables = meta.tables.keys()

#     print offset, limit, tables    
#     ret = '[]'
#     try:
#         data = get_correlations(tables, offset=offset, limit=limit)
#         ret = json.dumps(data)
#     except Exception as e:
#         print e

#         #pdb.set_trace()
#     return ret
    


# @app.route('/createloc/', methods=['POST', 'GET'])
# def create_location_table():
#     tablename = request.form.get('tablename', None)
#     locdata = request.form.get('locdata', None)
#     print tablename
#     if tablename:
#         try:
#             create_and_populate_location_table(db, tablename, maxinserts=30, user_input=locdata)
#         except:
#             traceback.print_exc()
#     return redirect('/')
            

