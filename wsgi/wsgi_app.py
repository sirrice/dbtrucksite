#!/usr/local/bin/python
import sys
import psycopg2
sys.path.append('/var/www/dbtrucksite/')
from flup.server.fcgi import WSGIServer
from flaskext.actions import Manager

def main():

    from dbtruck.util import get_logger
    _log = get_logger(fname='/tmp/dbtruck.log')
    from dbtrucksite import app
    DEC2FLOAT = psycopg2.extensions.new_type(
        psycopg2.extensions.DECIMAL.values,
        'DEC2FLOAT',
        lambda value, curs: float(value) if value is not None else None)
    psycopg2.extensions.register_type(DEC2FLOAT)
    app.debug = True
    print 'running'
    manager = Manager(app, default_server_actions=True)
    manager.run()
#    WSGIServer(app , bindAddress='/tmp/.dbtruck.sock' ).run()
                   


if __name__ == '__main__':
    main()
