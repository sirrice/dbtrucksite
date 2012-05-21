



def stringify_rows(rows):
    "converts values of a list of dictionaries into utf-8 strings"
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
