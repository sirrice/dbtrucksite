#!/usr/local/bin/python
import psycopg2
from gevent.pywsgi import WSGIServer # must be pywsgi to support websocket
from geventwebsocket.handler import WebSocketHandler
from gevent.pool import Pool

from dbtrucksite import app


if __name__ == '__main__':

    DEC2FLOAT = psycopg2.extensions.new_type(
        psycopg2.extensions.DECIMAL.values,
        'DEC2FLOAT',
        lambda value, curs: float(value) if value is not None else None)
    psycopg2.extensions.register_type(DEC2FLOAT)
    app.debug = True
    address = ('', 8080)
    pool = Pool(500)
    env = {'wsgi.multithreaded' : True}
    http_server = WSGIServer(address,
                             app,
                             spawn=pool,
                             handler_class=WebSocketHandler,
                             environ=env)
    print "running"
    http_server.serve_forever()

    #app.run(debug=True)
