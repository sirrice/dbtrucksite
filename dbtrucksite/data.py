import traceback
import pdb

from operator import add
from sqlalchemy import *
from dbtruck.analyze.models import *

from dbtrucksite import app, db
from dbtrucksite.util import *
import dbtrucksite.settings as settings



def get_table_metadata(tablemd):
    ret = {}
    try:
        q = "select count(*) from %s" % tablemd.tablename
        count = db.engine.execute(q).fetchone()[0]

        needdata = tablemd.state in (3,4)
        hasloc = len(tablemd.annotations) > 0
        loccols = set()
        for anno in tablemd.annotations:
            if anno.loctype in ('state', 'city', 'zip', 'latitude', 'longitude', 'latlon'):
                needdata = False
            if anno.loctype != Annotation.USERINPUT:
                loccols.add(anno.name)

        ret['needdata'] = needdata
        ret['nrows'] = count
        ret['hasloc'] = hasloc
        ret['tablename'] = tablemd.tablename

    except:
        traceback.print_exc()

    try:
        stats = db.engine.execute("""
        select count(_latlon[0]),
               min(_latlon[0]), max(_latlon[0]),
               min(_latlon[1]), max(_latlon[1]),
               avg(_latlon[0]), avg(_latlon[1]),
               stddev(_latlon[0]), stddev(_latlon[1])
        from %s where _latlon is not null""" % tablemd.tablename).fetchone()
        ret['stats'] = [s for s in stats]
    except Exception as e:
        print e
        pass

    return ret

def get_latlons(tablemd, count, maxcount=500.):
    tablename = tablemd.tablename
    try:
        threshold = maxcount / count
        q = "select _latlon[0], _latlon[1] from %s where random() <= %%s limit %%s" % (tablename)
        rows = db.engine.execute(q, [count, maxcount]).fetchall()
        return [dict(zip(['lat', 'lon'], row)) for row in rows]
    except Exception as e:
        print e
    return []


def get_correlations(limit=10, offset=0):
    q = """select corr, radius, table1, col1, agg1, table2, col2, agg2
           from __dbtruck_corrpair__
           order by corr desc
           offset %s
           limit %s"""
    rows = db.engine.execute(q, [offset, limit]).fetchall()

    def full_col_name(t, c, a):
        n = '%s.%s' % (t, c)
        if a:
            n = '%s(%s)' % (a, n)
        return n
    
    data = []
    for corr, r, t1, c1, a1, t2, c2, a2 in rows:
        try:
            leftcol = full_col_name('t1', c1, a1)
            rightcol = full_col_name('t2', c2, a2)
            join_data = get_join_data(t1, t2, r, leftcol, rightcol)

            leftcol = full_col_name(t1, c1, a1)
            rightcol = full_col_name(t2, c2, a2)
            data.append((leftcol, rightcol, join_data))
        except Exception as e:
            print e
    return data
        

def get_join_data(t1, t2, r, lc, rc, maxcount=200.):
    q = """select count(*) from %s as t1, %s as t2
           where (t1._latlon <-> t2._latlon) < %%s 
           """ % (t1, t2)
    count = db.execute(q, (r,)).fetchone()[0]
    thresh = maxcount / count

    q = """select %s, %s from %s as t1, %s as t2
           where (t1._latlon <-> t2._latlon) < %%s and
           random() <= %%s
           """ % (lc, rc, t1, t2)
    res = db.execute(q, (r,thresh)).fetchall()
    res = [row.values() for row in res]
    return res
    
    

def get_table(table, schema, limit=10, offset=0):
    
    try:
        colnames = schema.columns.keys()
        normcols = filter(lambda c: not c.startswith('_'), colnames)
        loccols = filter(lambda c: c.startswith('_'), colnames)
        cols = normcols# + loccols

        if not cols:
            return []
                
        q = ["select %s from %s" % (','.join(cols), table)]
        if limit is not None:
            q.append('limit %d' % limit)
        if offset is not None:
            q.append('offset %d' % offset)
        q = ' '.join(q)

        rows = db.engine.execute(q).fetchall()
        rows = [dict(zip(cols, map(to_str,row))) for row in rows]    
        return rows
    except Exception as e:
        print e
        return None


