import os
import sys
import json
import types
import importlib.util
import hashlib
import hmac
import time
import pprint

# Set env used by the app at import time
os.environ.setdefault('STRIPE_SECRET_KEY', 'sk_test_123')
os.environ.setdefault('STRIPE_WEBHOOK_SECRET', 'whsec_test')
os.environ.setdefault('STRIPE_PRICE_ID', 'price_test')
os.environ.setdefault('SUPABASE_URL', 'https://example.supabase.co')
os.environ.setdefault('SUPABASE_SERVICE_KEY', 'service_test')

# --- Stub stripe module ---
stripe_mod = types.ModuleType('stripe')

class SignatureVerificationError(Exception):
    pass
stripe_mod.SignatureVerificationError = SignatureVerificationError

# Webhook.construct_event: return object with to_dict_recursive
def construct_event(payload, sig_header, secret):
    try:
        payload_text = payload.decode('utf-8') if isinstance(payload, (bytes, bytearray)) else payload
        data = json.loads(payload_text)
    except Exception:
        data = {}
    class E:
        def to_dict_recursive(self):
            return data
    return E()

stripe_mod.Webhook = types.SimpleNamespace(construct_event=construct_event)

# Subscription.retrieve
def subscription_retrieve(sub_id):
    return {'id': sub_id, 'metadata': {'install_id': 'install_123'}, 'status': 'active', 'current_period_end': int(time.time()) + 86400}
stripe_mod.Subscription = types.SimpleNamespace(retrieve=subscription_retrieve)

# Customer.retrieve
def customer_retrieve(cust_id):
    return {'id': cust_id, 'email': 'user+stub@example.com'}
stripe_mod.Customer = types.SimpleNamespace(retrieve=customer_retrieve)

# checkout.session.create
def checkout_session_create(**kwargs):
    class S:
        url = 'https://checkout.example/sess'
        id = 'sess_123'
    return S()
stripe_mod.checkout = types.SimpleNamespace(Session=types.SimpleNamespace(create=checkout_session_create))

stripe_mod.Account = types.SimpleNamespace(retrieve=lambda: {'id': 'acct_test'})
stripe_mod.Price = types.SimpleNamespace(retrieve=lambda pid: {'id': pid})
stripe_mod.api_key = os.environ['STRIPE_SECRET_KEY']

sys.modules['stripe'] = stripe_mod

# --- Stub supabase.create_client ---
supabase_mod = types.ModuleType('supabase')

class SupabaseClientStub:
    def __init__(self):
        self.store = {}  # keyed by user_id
        self.auth = types.SimpleNamespace(admin=types.SimpleNamespace(get_user_by_id=lambda uid: types.SimpleNamespace(user=types.SimpleNamespace(email='user@example.com'))))
    def table(self, name):
        return TableStub(self, name)

class TableStub:
    def __init__(self, supabase, name):
        self.supabase = supabase
        self.name = name
        self._filters = {}
        self._limit = None
        self._update_fields = None
        self._in_filters = {}
        self._select_cols = None
    def upsert(self, fields, on_conflict='user_id'):
        user_id = fields.get('user_id') or fields.get('stripe_customer_id') or 'unknown'
        existing = self.supabase.store.get(user_id, {})
        merged = {**existing, **fields}
        self.supabase.store[user_id] = merged
        class R:
            def __init__(self, data):
                self.data = [data]
            def execute(self):
                return self
        return R(self.supabase.store[user_id])
    def select(self, cols, count=None):
        self._select_cols = cols
        return self
    def eq(self, key, val):
        self._filters[key] = val
        return self
    def in_(self, key, vals):
        self._in_filters[key] = set(vals)
        return self
    def update(self, fields):
        self._update_fields = fields
        return self
    def limit(self, n):
        self._limit = n
        return self
    def execute(self):
        results = []
        for uid, row in list(self.supabase.store.items()):
            match = True
            for k, v in self._filters.items():
                if row.get(k) != v:
                    match = False
                    break
            for k, vals in self._in_filters.items():
                if row.get(k) not in vals:
                    match = False
                    break
            if match:
                results.append(row)
        if self._update_fields is not None:
            for r in results:
                r.update(self._update_fields)
            return types.SimpleNamespace(data=results)
        return types.SimpleNamespace(data=results[:self._limit] if self._limit else results)


def create_client(url, key):
    return SupabaseClientStub()

supabase_mod.create_client = create_client
sys.modules['supabase'] = supabase_mod

# --- Minimal fake Flask + flask_cors (for test environment) ---
flask_mod = types.ModuleType('flask')

# Simple request proxy that test client will mutate
flask_request = types.SimpleNamespace(data=b'', headers={}, method='GET', args=types.SimpleNamespace(get=lambda k, default=None: default))
flask_mod.request = flask_request

class HTTPError(Exception):
    def __init__(self, code, message=None):
        super().__init__(message)
        self.code = code
        self.message = message

def abort(code, message=None):
    raise HTTPError(code, message)

def jsonify(obj):
    return types.SimpleNamespace(data=json.dumps(obj))

def redirect(url, code=302):
    return types.SimpleNamespace(redirect=url, code=code)

class FakeFlask:
    def __init__(self, name):
        self._routes = {}
        # lightweight logger used by the app
        class FakeLogger:
            def info(self, *a, **k):
                print('[INFO]', *a)
            def warning(self, *a, **k):
                print('[WARN]', *a)
            def exception(self, *a, **k):
                print('[EXC]', *a)
        self.logger = FakeLogger()
    def route(self, path, methods=None):
        methods = methods or ['GET']
        def deco(func):
            self._routes[path] = func
            return func
        return deco
    def run(self, *args, **kwargs):
        pass
    def test_client(self):
        return TestClient(self)

class TestClient:
    def __init__(self, app):
        self.app = app
    def post(self, path, data=None, headers=None):
        # populate the module-level request proxy
        flask_mod.request.data = data
        flask_mod.request.headers = headers or {}
        flask_mod.request.method = 'POST'
        func = self.app._routes.get(path)
        if not func:
            return types.SimpleNamespace(status_code=404, get_data=lambda as_text=True: 'not found')
        try:
            rv = func()
        except HTTPError as e:
            return types.SimpleNamespace(status_code=e.code, get_data=lambda as_text=True: json.dumps({'error': e.message or ''}))
        if isinstance(rv, tuple):
            body, status = rv[0], rv[1]
        else:
            body, status = rv, 200
        if hasattr(body, 'data'):
            body_text = body.data
        elif isinstance(body, dict):
            body_text = json.dumps(body)
        else:
            body_text = str(body)
        return types.SimpleNamespace(status_code=status, get_data=lambda as_text=True: body_text)

flask_mod.Flask = FakeFlask
flask_mod.abort = abort
flask_mod.jsonify = jsonify
flask_mod.redirect = redirect
flask_mod.request = flask_request
sys.modules['flask'] = flask_mod

# minimal flask_cors
flask_cors_mod = types.ModuleType('flask_cors')
def CORS(app, origins=None):
    return None
flask_cors_mod.CORS = CORS
sys.modules['flask_cors'] = flask_cors_mod

# --- Import the billing server app module ---
here = os.path.dirname(os.path.abspath(__file__))
app_path = os.path.abspath(os.path.join(here, '..', 'autoscore', 'billing_server', 'app.py'))
spec = importlib.util.spec_from_file_location('billing_app', app_path)
billing = importlib.util.module_from_spec(spec)
sys.modules['billing_app'] = billing
spec.loader.exec_module(billing)

# Ensure _sb is our stub
if not isinstance(billing._sb, SupabaseClientStub):
    billing._sb = create_client(None, None)

client = billing.app.test_client()

def compute_sig(payload_bytes, secret):
    ts = int(time.time())
    signed_payload = f"{ts}.".encode('utf-8') + payload_bytes
    sig = hmac.new(secret.encode('utf-8'), msg=signed_payload, digestmod=hashlib.sha256).hexdigest()
    header = f"t={ts},v1={sig}"
    return header

print('\n--- Running webhook tests ---')

# Test subscription.created
payload = {
    'id': 'evt_test_1',
    'type': 'customer.subscription.created',
    'data': {'object': {
        'id': 'sub_test_1',
        'customer': 'cus_test_1',
        'status': 'active',
        'metadata': {'supabase_user_id': 'user-uuid-1', 'install_id': 'install-1'},
        'current_period_end': int(time.time()) + 3600
    }}
}
payload_bytes = json.dumps(payload).encode('utf-8')
sig = compute_sig(payload_bytes, os.environ['STRIPE_WEBHOOK_SECRET'])
resp = client.post('/webhook', data=payload_bytes, headers={'Stripe-Signature': sig, 'Content-Type': 'application/json'})
print('subscription.created response', resp.status_code, resp.get_data(as_text=True))
print('Supabase store:', json.dumps(billing._sb.store, indent=2))
row = billing._sb.store.get('user-uuid-1')
print('Row:', row)
print('subscribed_at exists:', ('subscribed_at' in row) if row else None)

# Test invoice.payment_succeeded path
payload2 = {
    'id': 'evt_test_2',
    'type': 'invoice.payment_succeeded',
    'data': {'object': {
        'id': 'in_test_1',
        'customer': 'cus_test_1',
        'subscription': 'sub_test_1'
    }}
}
payload2_bytes = json.dumps(payload2).encode('utf-8')
sig2 = compute_sig(payload2_bytes, os.environ['STRIPE_WEBHOOK_SECRET'])
resp2 = client.post('/webhook', data=payload2_bytes, headers={'Stripe-Signature': sig2, 'Content-Type': 'application/json'})
print('invoice.payment_succeeded response', resp2.status_code, resp2.get_data(as_text=True))
print('Supabase store after invoice:', json.dumps(billing._sb.store, indent=2))
row2 = billing._sb.store.get('user-uuid-1')
print('Row after invoice:', row2)
print('subscribed_at exists after invoice:', ('subscribed_at' in row2) if row2 else None)

print('\nTESTS COMPLETE')
