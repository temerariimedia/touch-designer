# TouchDesigner Web Server DAT callbacks for td-mcp live control bridge
# Request:  {"id":1,"action":"set_param","data":{...},"token":"..."}
# Response: {"id":1,"ok":true,"result":{...}} or {"id":1,"ok":false,"error":{...}}

import json

def safe_json_fallback(o):
    if hasattr(o, 'path'): return o.path
    if hasattr(o, 'val'): return o.val
    return str(o)

def safe_json_dumps(*args, **kwargs):
    kwargs['default'] = safe_json_fallback
    return __import__('json').dumps(*args, **kwargs)


import traceback
import time
import fnmatch

SHARED_SECRET = ''


def _get_secret():
    try:
        secret_dat = op('td_control_secret')
        if secret_dat is not None:
            return secret_dat.text.strip()
    except Exception:
        pass
    return SHARED_SECRET


def _ok(req_id, result=None):
    return safe_json_dumps({
        'id': req_id,
        'ok': True,
        'result': result if result is not None else {},
        'meta': {
            'ts': time.time()
        }
    })


def _err(req_id, message, code='bridge_error', details=None):
    payload = {
        'id': req_id,
        'ok': False,
        'error': {
            'code': code,
            'message': message
        }
    }
    if details is not None:
        payload['error']['details'] = details
    return safe_json_dumps(payload)


def _get_op(path):
    node = op(path)
    if node is None:
        raise Exception('Operator not found: {}'.format(path))
    return node


def _set_param(path, param, value):
    node = _get_op(path)
    par = getattr(node.par, param, None)
    if par is None:
        raise Exception('Parameter not found: {}.{}'.format(path, param))
    previous = par.eval()
    par.val = value
    return {'path': path, 'param': param, 'value': par.eval(), 'previous': previous}


def _pulse(path, param):
    node = _get_op(path)
    par = getattr(node.par, param, None)
    if par is None:
        raise Exception('Pulse parameter not found: {}.{}'.format(path, param))
    par.pulse()
    return {'path': path, 'param': param, 'pulsed': True}


def _create_op(parent, op_type, name=None):
    parent_node = _get_op(parent)
    new_op = parent_node.create(op_type, name) if name else parent_node.create(op_type)
    return {'path': new_op.path, 'name': new_op.name, 'type': new_op.OPType}


def _delete_op(path):
    node = _get_op(path)
    target_path = node.path
    node.destroy()
    return {'path': target_path, 'deleted': True}


def _connect_ops(out_path, into_path, index=0):
    out_node = _get_op(out_path)
    into_node = _get_op(into_path)
    into_node.inputConnectors[int(index)].connect(out_node)
    return {'out': out_path, 'into': into_path, 'index': index, 'connected': True}


def _op_info(path):
    node = _get_op(path)
    pars = []
    try:
        for p in node.pars()[:40]:
            pars.append({'name': p.name, 'label': p.label, 'value': p.eval()})
    except Exception:
        pass
    return {
        'path': node.path,
        'name': node.name,
        'type': str(node.OPType),
        'family': str(node.family),
        'numParameters': len(node.pars()) if hasattr(node, 'pars') else None,
        'parametersPreview': pars
    }


def _ping():
    return {
        'pong': True,
        'timestamp': time.time(),
        'frame': absTime.frame
    }


def _list_nodes(parent='/project1', pattern='*', include_properties=False, limit=200):
    parent_node = _get_op(parent)
    nodes = []
    matched = []
    try:
        matched = parent_node.findChildren(depth=999)
    except Exception:
        matched = []

    for n in matched:
        if not fnmatch.fnmatch(n.name, pattern):
            continue
        row = {
            'path': n.path,
            'name': n.name,
            'type': str(n.OPType),
            'family': str(n.family)
        }
        if include_properties:
            props = {}
            try:
                for p in n.pars()[:20]:
                    props[p.name] = p.eval()
            except Exception:
                pass
            row['properties'] = props
        nodes.append(row)
        if len(nodes) >= int(limit):
            break

    return {
        'parent': parent,
        'pattern': pattern,
        'count': len(nodes),
        'nodes': nodes
    }


def _node_errors(path, include_children=True, limit=200):
    root = _get_op(path)
    targets = [root]
    if include_children:
        try:
            targets.extend(root.findChildren(depth=999))
        except Exception:
            pass

    errors = []
    for node in targets:
        try:
            node_errors = node.errors()
        except Exception:
            node_errors = []
        for e in node_errors:
            errors.append({
                'path': node.path,
                'name': node.name,
                'type': str(node.OPType),
                'message': str(e)
            })
            if len(errors) >= int(limit):
                return {'path': path, 'count': len(errors), 'errors': errors}

    return {'path': path, 'count': len(errors), 'errors': errors}


def _exec_node_method(path, method, args=None, kwargs=None):
    node = _get_op(path)
    args = args or []
    kwargs = kwargs or {}
    target = getattr(node, method, None)
    if target is None:
        raise Exception('Method or attribute not found: {}.{}'.format(path, method))

    if callable(target):
        result = target(*args, **kwargs)
    else:
        result = target

    try:
        serialized = json.loads(safe_json_dumps(result))
    except Exception:
        serialized = str(result)

    return {
        'path': path,
        'method': method,
        'result': serialized
    }


def _snapshot_node(node, include_params=True):
    row = {
        'path': node.path,
        'name': node.name,
        'type': str(node.OPType),
        'family': str(node.family)
    }
    if include_params:
        params = []
        try:
            for p in node.pars()[:100]:
                params.append({
                    'name': p.name,
                    'label': p.label,
                    'value': p.eval()
                })
        except Exception:
            pass
        row['params'] = params
    return row


def _export_snapshot(paths, include_params=True, include_children=False):
    items = []
    for path in paths:
        node = _get_op(path)
        items.append(_snapshot_node(node, include_params))

        if include_children:
            try:
                for child in node.findChildren(depth=999):
                    items.append(_snapshot_node(child, include_params))
            except Exception:
                pass

    # Stable output ordering for deterministic diffs
    items = sorted(items, key=lambda x: x['path'])
    return {
        'count': len(items),
        'items': items
    }


def _safe_attr(obj, name, default=None):
    try:
        return getattr(obj, name, default)
    except Exception:
        return default


def _capture_performance(duration_frames=120):
    now = time.time()
    duration_frames = int(duration_frames)
    perf = {
        'timestamp': now,
        'requestedFrames': duration_frames,
        'frame': absTime.frame,
        'fps': _safe_attr(project, 'cookRate', None),
        'realTime': _safe_attr(absTime, 'seconds', None),
        'appVersion': _safe_attr(app, 'version', None),
        'appBuild': _safe_attr(app, 'build', None),
        'timelinePlaying': bool(op('/local/time').par.play.eval())
    }
    return perf


def _test_reset_workspace(parent='/project1', keep_paths=None, dry_run=False):
    keep_paths = keep_paths or []
    parent_node = _get_op(parent)
    protected = set(keep_paths + [parent_node.path])

    removed = []
    preserved = []

    children = []
    try:
        children = parent_node.findChildren(depth=1)
    except Exception:
        children = []

    for child in children:
        if child.path in protected:
            preserved.append(child.path)
            continue

        if dry_run:
            removed.append({'path': child.path, 'dryRun': True})
            continue

        try:
            target = child.path
            child.destroy()
            removed.append({'path': target, 'deleted': True})
        except Exception as error:
            removed.append({'path': child.path, 'deleted': False, 'error': str(error)})

    return {
        'parent': parent_node.path,
        'dryRun': bool(dry_run),
        'removed': removed,
        'preserved': preserved
    }


def _status():
    return {
        'projectName': project.name,
        'projectFolder': project.folder,
        'filePath': (project.folder + "/" + project.name),
        'version': app.version,
        'build': app.build,
        'playing': op('/local/time').par.play,
        'frame': absTime.frame
    }


def _open_project(file_path):
    project.load(file_path)
    return {'opened': True, 'file': file_path}


def _save_project(file_path=None):
    if file_path:
        project.save(file_path)
        return {'saved': True, 'file': file_path}
    project.save()
    return {'saved': True, 'file': (project.folder + "/" + project.name)}


def _dispatch(action, data):
    if action == 'ping':
        return _ping()
    if action == 'get_status':
        return _status()
    if action == 'eval':
        expression = data.get('expression', '')
        return {'expression': expression, 'value': eval(expression)}
    if action == 'run_script':
        code = data.get('code', '')
        exec(code, globals(), locals())
        return {'executed': True}
    if action == 'set_param':
        return _set_param(data.get('path'), data.get('param'), data.get('value'))
    if action == 'pulse':
        return _pulse(data.get('path'), data.get('param'))
    if action == 'create_op':
        return _create_op(data.get('parent'), data.get('type'), data.get('name'))
    if action == 'delete_op':
        return _delete_op(data.get('path'))
    if action == 'connect_ops':
        return _connect_ops(data.get('out'), data.get('into'), data.get('index', 0))
    if action == 'op_info':
        return _op_info(data.get('path'))
    if action == 'list_nodes':
        return _list_nodes(
            data.get('parent', '/project1'),
            data.get('pattern', '*'),
            data.get('include_properties', False),
            data.get('limit', 200)
        )
    if action == 'node_errors':
        return _node_errors(
            data.get('path'),
            data.get('include_children', True),
            data.get('limit', 200)
        )
    if action == 'exec_node_method':
        return _exec_node_method(
            data.get('path'),
            data.get('method'),
            data.get('args', []),
            data.get('kwargs', {})
        )
    if action == 'export_snapshot':
        return _export_snapshot(
            data.get('paths', []),
            data.get('include_params', True),
            data.get('include_children', False)
        )
    if action == 'capture_performance':
        return _capture_performance(data.get('duration_frames', 120))
    if action == 'test_reset_workspace':
        return _test_reset_workspace(
            data.get('parent', '/project1'),
            data.get('keep_paths', []),
            data.get('dry_run', False)
        )
    if action == 'timeline_play':
        op('/local/time').par.play.val = True
        return {'playing': True}
    if action == 'timeline_stop':
        op('/local/time').par.play.val = False
        return {'playing': False}
    if action == 'open_project':
        return _open_project(data.get('file'))
    if action == 'save_project':
        return _save_project(data.get('file'))
    raise Exception('Unknown action: {}'.format(action))


def onWebSocketOpen(webServerDAT, client, uri):
    return


def onWebSocketClose(webServerDAT, client):
    return


def onWebSocketReceiveText(webServerDAT, client, data):
    req_id = None
    started = time.time()
    try:
        req = json.loads(data)
        req_id = req.get('id')

        if not isinstance(req_id, int):
            webServerDAT.webSocketSendText(client, _err(-1, 'Missing or invalid request id', 'bad_request'))
            return

        secret = _get_secret()
        if secret:
            token = req.get('token', '')
            if token != secret:
                webServerDAT.webSocketSendText(client, _err(req_id, 'Invalid token', 'auth_failed'))
                return

        action = req.get('action')
        payload = req.get('data', {})
        result = _dispatch(action, payload)
        out = json.loads(_ok(req_id, result))
        out['meta']['duration_ms'] = int((time.time() - started) * 1000)
        webServerDAT.webSocketSendText(client, safe_json_dumps(out))
    except Exception as error:
        tb = traceback.format_exc()
        error_id = req_id if req_id is not None else -1
        webServerDAT.webSocketSendText(client, _err(error_id, str(error), 'exception', {'traceback': tb[-1200:]}))


def onWebSocketReceiveBinary(webServerDAT, client, data):
    webServerDAT.webSocketSendText(client, _err(-1, 'Binary messages are not supported', 'bad_request'))


def onHTTPRequest(webServerDAT, request, response):
    response.statusCode = 404
    response.contentType = 'application/json'
    response.write(safe_json_dumps({'error': 'Use WebSocket endpoint only'}))
    return response


