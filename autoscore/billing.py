"""
DartVoice â€” client-side billing module
=======================================
Account system:  Supabase Auth  (email OTP â€” 6-digit code via Resend)
Subscription:    Stripe (auto-billed monthly, 7-week trial)
Status check:    Supabase  dartvoice_subscriptions table (anon key, RLS)

Flow
----
1. User enters email  â†’  send_otp(email)
   Supabase fires a Resend email with a 6-digit code.

2. User enters code   â†’  verify_otp(email, code)
   Returns a session.  Stored locally.  Subscription auto-restored.

3. On every launch    â†’  refresh_session()
   Re-uses stored session to fetch subscription status directly from
   Supabase (no separate billing server call needed for status).

4. Checkout           â†’  get_checkout_url(user_id, install_id)
   Opens billing server which creates a Stripe Checkout session.
   Stripe webhook writes back to Supabase on payment.

Required env vars (baked into the app at build time):
  SUPABASE_URL            â€” https://poyjykgqsvgimssbhsuz.supabase.co
  SUPABASE_ANON_KEY       â€” publishable anon key
  DV_BILLING_URL          â€” https://billing.dartvoice.app  (for checkout redirect)
"""

import os, json, time, uuid, hashlib, threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import webbrowser


def _open_browser(url):
    """Open URL in system browser.  Uses Android Intent on Android."""
    if 'ANDROID_ARGUMENT' in os.environ:
        try:
            from jnius import autoclass  # type: ignore
            Intent = autoclass('android.content.Intent')
            Uri = autoclass('android.net.Uri')
            PythonActivity = autoclass('org.kivy.android.PythonActivity')
            intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            PythonActivity.mActivity.startActivity(intent)
            return
        except Exception:
            pass
    webbrowser.open(url)

# â”€â”€ Supabase client (graceful fallback) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Catch Exception (not just ImportError) because pydantic-core can throw
# OSError / RuntimeError when its compiled .so is missing or wrong-arch.
try:
    from supabase import create_client, Client as _SBClient
    _SB_OK = True
except Exception:
    _SBClient = None
    _SB_OK    = False

SUPABASE_URL     = os.environ.get('SUPABASE_URL',     'https://poyjykgqsvgimssbhsuz.supabase.co')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveWp5a2dxc3ZnaW1zc2Joc3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjgyMzQsImV4cCI6MjA4OTQwNDIzNH0.1_KBIagUj_EkfTU2MF3qsyR1lvJQ4jVqZ2AuVcGDBIA'
)
BILLING_SERVER   = os.environ.get('DV_BILLING_URL', 'https://billing.dartvoice.app')
DEMO_MINUTES     = 10   # free demo window before subscription required
_SALT            = 'dartvoice-billing-v1-8f3a'
_ACTIVE_STATUSES = {'active', 'trialing'}

# â”€â”€ Admin bypass (dev/testing only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# sha256("DV-ADMIN-2026") â€” change the raw passcode to rotate it
_ADMIN_HASH = '252772e3ca1a02b2dc9718fc087849969d1b0bb5721fd9e878d21e8d6fccdd5a'

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Storage
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _billing_dir() -> str:
    if os.name == 'nt':
        base = os.environ.get('APPDATA', os.path.expanduser('~'))
    elif 'ANDROID_ARGUMENT' in os.environ:
        try:
            from android.storage import app_storage_path  # type: ignore
            base = app_storage_path()
        except Exception:
            base = os.path.expanduser('~')
    else:
        base = os.path.expanduser('~')
    d = os.path.join(base, '.dartvoice')
    os.makedirs(d, exist_ok=True)
    return d

def _store_path() -> str:
    return os.path.join(_billing_dir(), 'billing.json')

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Tamper-evident local store
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _sign(data: dict) -> str:
    payload = json.dumps({k: v for k, v in data.items() if k != '_sig'},
                         sort_keys=True) + _SALT
    return hashlib.sha256(payload.encode()).hexdigest()

def _load() -> dict:
    try:
        with open(_store_path()) as f:
            d = json.load(f)
        if d.get('_sig') != _sign(d):
            return {}
        return d
    except Exception:
        return {}

def _save(data: dict):
    data = {k: v for k, v in data.items() if k != '_sig'}
    data['_sig'] = _sign(data)
    with open(_store_path(), 'w') as f:
        json.dump(data, f, indent=2)

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Install ID (stable per device, used before account login)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def get_install_id() -> str:
    d = _load()
    if not d.get('install_id'):
        d['install_id']  = str(uuid.uuid4())
        d['trial_start'] = time.time()
        _save(d)
    return d['install_id']

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Supabase client
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
_sb: '_SBClient | None' = None

def _client():
    global _sb
    if not _SB_OK:
        return None
    if _sb is None:
        _sb = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        # Restore any saved session
        d = _load()
        if d.get('sb_access_token') and d.get('sb_refresh_token'):
            try:
                _sb.auth.set_session(d['sb_access_token'], d['sb_refresh_token'])
            except Exception:
                pass
    return _sb

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Auth â€” email OTP (magic code, not magic link â€” works in desktop apps)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def send_otp(email: str) -> tuple[bool, str]:
    """
    Send a 6-digit OTP to the given email via Supabase Auth (Resend SMTP).
    Returns (success, error_message).
    """
    sb = _client()
    if sb is None:
        return False, 'Supabase SDK not installed'
    try:
        sb.auth.sign_in_with_otp({
            'email':              email,
            'options': {
                'should_create_user': True,
                'data': {'install_id': get_install_id()},
            },
        })
        d = _load()
        d['pending_email'] = email
        _save(d)
        return True, ''
    except Exception as e:
        return False, str(e)

def verify_otp(email: str, code: str) -> tuple[bool, str]:
    """
    Verify the 6-digit OTP.  On success, stores the session and returns
    (True, '').  On failure returns (False, error_message).
    """
    sb = _client()
    if sb is None:
        return False, 'Supabase SDK not installed'
    try:
        resp = sb.auth.verify_otp({
            'email': email,
            'token': code.strip(),
            'type':  'email',
        })
        session = resp.session
        user    = resp.user
        if not session or not user:
            return False, 'Verification failed'

        d = _load()
        d['sb_access_token']  = session.access_token
        d['sb_refresh_token'] = session.refresh_token
        d['sb_user_id']       = user.id
        d['sb_email']         = user.email
        d.pop('pending_email', None)
        _save(d)
        return True, ''
    except Exception as e:
        return False, str(e)

def sign_out():
    sb = _client()
    if sb:
        try:
            sb.auth.sign_out()
        except Exception:
            pass
    d = _load()
    for k in ('sb_access_token', 'sb_refresh_token', 'sb_user_id', 'sb_email', 'sub_status'):
        d.pop(k, None)
    _save(d)

def get_account() -> dict | None:
    """Returns {'user_id', 'email'} if logged in, else None."""
    d = _load()
    if d.get('sb_user_id') and d.get('sb_email'):
        return {'user_id': d['sb_user_id'], 'email': d['sb_email']}
    return None

def refresh_session() -> bool:
    """Refresh the Supabase session token.  Returns True if still valid."""
    sb = _client()
    if sb is None:
        return False
    try:
        resp = sb.auth.refresh_session()
        if resp.session:
            d = _load()
            d['sb_access_token']  = resp.session.access_token
            d['sb_refresh_token'] = resp.session.refresh_token
            _save(d)
            return True
    except Exception:
        pass
    return False

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Subscription lookup (direct Supabase query, RLS-protected)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _fetch_sub_status() -> str:
    """Query dartvoice_subscriptions for the current user.  Returns status string."""
    sb = _client()
    if sb is None:
        return 'unknown'
    d = _load()
    if not d.get('sb_access_token'):
        return 'none'
    try:
        resp = (
            sb.table('dartvoice_subscriptions')
            .select('status, current_period_end')
            .order('updated_at', desc=True)
            .limit(1)
            .execute()
        )
        if resp.data:
            row = resp.data[0]
            # Check period hasn't lapsed
            end = row.get('current_period_end')
            if end:
                import datetime
                end_dt = datetime.datetime.fromisoformat(end.replace('Z', '+00:00'))
                if end_dt < datetime.datetime.now(datetime.timezone.utc):
                    return 'past_due'
            return row.get('status', 'none')
        return 'none'
    except Exception:
        return 'unknown'

def _cache_status(status: str):
    d = _load()
    d['sub_status']  = status
    d['sub_checked'] = time.time()
    _save(d)

def _cached_status() -> str:
    return _load().get('sub_status', 'none')

def admin_unlock(passcode: str) -> bool:
    """
    Unlock admin mode with the master passcode.
    Returns True if correct and stores the bypass flag locally.
    """
    if hashlib.sha256(passcode.encode()).hexdigest() == _ADMIN_HASH:
        d = _load()
        d['admin_unlocked'] = True
        _save(d)
        return True
    return False

def admin_lock():
    """Remove admin bypass."""
    d = _load()
    d.pop('admin_unlocked', None)
    _save(d)

def is_admin_unlocked() -> bool:
    return bool(_load().get('admin_unlocked'))

def is_subscribed() -> bool:
    if is_admin_unlocked():
        return True
    return _cached_status() in _ACTIVE_STATUSES

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Demo window (10 minutes, device-local, before subscription required)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def demo_seconds_remaining() -> float:
    d     = _load()
    start = d.get('trial_start', time.time())
    left  = DEMO_MINUTES * 60 - (time.time() - start)
    return max(0.0, left)

def demo_active() -> bool:
    return demo_seconds_remaining() > 0

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Async subscription check
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def check_subscription_async(callback):
    """
    Background thread: refresh session, then fetch subscription status.
    Calls callback(subscribed: bool, account: dict | None).
    """
    def _do():
        account = get_account()
        if not account:
            # Not logged in â€” fall back to trial / local cache
            callback(is_subscribed(), None)
            return
        refresh_session()
        status = _fetch_sub_status()
        if status == 'unknown':
            callback(is_subscribed(), account)
            return
        _cache_status(status)
        callback(status in _ACTIVE_STATUSES, account)
    threading.Thread(target=_do, daemon=True).start()

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Checkout URL
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def get_checkout_url() -> str:
    d = _load()
    uid        = d.get('sb_user_id', '')
    install_id = get_install_id()
    return f'{BILLING_SERVER}/checkout?user_id={uid}&install_id={install_id}'

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Convenience summary
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def billing_status() -> dict:
    admin      = is_admin_unlocked()
    account    = get_account()
    subscribed = is_subscribed()       # already returns True if admin
    logged_in  = account is not None
    return {
        'install_id':   get_install_id(),
        'account':      account,
        'logged_in':    logged_in,
        'admin':        admin,
        'subscribed':   subscribed,
        'demo_active':  False,
        'demo_secs':    0.0,
        # Locked only if not subscribed
        'locked':       not subscribed,
        # Human-readable access tier
        'tier':         'admin' if admin else ('member' if subscribed else 'inactive'),
    }


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Web-based login (localhost callback)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Both Windows and Android open the browser to html/login.html?source=app&port=PORT.
# After the user authenticates, html/login.html POSTs session tokens back to
# http://127.0.0.1:PORT/auth-callback.  This server catches that single
# request, stores the tokens, then shuts down.
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

_LOGIN_SITE = 'https://dartvoice.app/html/login.html'

class _AuthCallbackHandler(BaseHTTPRequestHandler):
    """Handles the single POST /auth-callback from the browser."""

    def do_POST(self):
        if self.path != '/auth-callback':
            self.send_error(404)
            return
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        try:
            payload = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_error(400)
            return

        # Validate expected keys
        access  = payload.get('access_token', '')
        refresh = payload.get('refresh_token', '')
        uid     = payload.get('user_id', '')
        email   = payload.get('email', '')
        if not (access and refresh and uid and email):
            self.send_error(400)
            return

        # Store session exactly as verify_otp() does
        d = _load()
        d['sb_access_token']  = access
        d['sb_refresh_token'] = refresh
        d['sb_user_id']       = uid
        d['sb_email']         = email
        d.pop('pending_email', None)
        _save(d)

        # CORS headers so the browser POST succeeds
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

        # Signal the server to stop after this request
        self.server._auth_received = True

    def do_OPTIONS(self):
        """Handle CORS preflight for the browser POST."""
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, *args):
        pass  # Silence request logs


def login_via_web(callback=None, intent=''):
    """
    Open the DartVoice website login in the system browser and wait for
    the session tokens to arrive via a localhost callback.

    Parameters
    ----------
    callback : callable(success: bool, account: dict | None)
        Called when auth completes (or times out).  May be called from a
        background thread â€” use Clock/after to bounce to the UI thread.
    intent : str
        Optional 'subscribe' to open the sign-up variant.

    Returns immediately; auth happens in a background thread.
    """
    # Android can't reliably receive a POST on 127.0.0.1 (app gets suspended
    # when it goes to the background, so the browser's POST is dropped).
    # Instead, html/login.html redirects to dartvoice://auth?... and the Activity's
    # Intent handler picks up the tokens â€” see _consume_intent in
    # dartvoice_android.py.  We just open the browser and poll the billing
    # store for the session to appear.
    if 'ANDROID_ARGUMENT' in os.environ:
        def _run_android():
            params = 'source=app&platform=android'
            if intent:
                params += f'&intent={intent}'
            _open_browser(f'{_LOGIN_SITE}?{params}')

            # Poll the billing store for ~5 minutes â€” the Intent handler
            # writes the tokens there when the browser redirects back.
            deadline = time.time() + 300
            while time.time() < deadline:
                if get_account():
                    if callback:
                        callback(True, get_account())
                    return
                time.sleep(1)
            if callback:
                callback(False, None)

        threading.Thread(target=_run_android, daemon=True).start()
        return

    def _run():
        server = HTTPServer(('127.0.0.1', 0), _AuthCallbackHandler)
        server._auth_received = False
        port = server.server_address[1]

        # Build login URL
        params = f'source=app&port={port}'
        if intent:
            params += f'&intent={intent}'
        url = f'{_LOGIN_SITE}?{params}'
        _open_browser(url)

        # Wait up to 5 minutes for the browser POST
        server.timeout = 2
        deadline = time.time() + 300
        while time.time() < deadline and not server._auth_received:
            server.handle_request()

        server.server_close()

        if server._auth_received:
            acct = get_account()
            if callback:
                callback(True, acct)
        else:
            if callback:
                callback(False, None)

    threading.Thread(target=_run, daemon=True).start()

