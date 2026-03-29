"""
DartVoice — client-side billing module
=======================================
Account system:  Supabase Auth  (email OTP — 6-digit code via Resend)
Subscription:    Stripe (auto-billed monthly, 7-week trial)
Status check:    Supabase  dartvoice_subscriptions table (anon key, RLS)

Flow
----
1. User enters email  →  send_otp(email)
   Supabase fires a Resend email with a 6-digit code.

2. User enters code   →  verify_otp(email, code)
   Returns a session.  Stored locally.  Subscription auto-restored.

3. On every launch    →  refresh_session()
   Re-uses stored session to fetch subscription status directly from
   Supabase (no separate billing server call needed for status).

4. Checkout           →  get_checkout_url(user_id, install_id)
   Opens billing server which creates a Stripe Checkout session.
   Stripe webhook writes back to Supabase on payment.

Required env vars (baked into the app at build time):
  SUPABASE_URL            — https://poyjykgqsvgimssbhsuz.supabase.co
  SUPABASE_ANON_KEY       — publishable anon key
  DV_BILLING_URL          — https://billing.dartvoice.com  (for checkout redirect)
"""

import os, json, time, uuid, hashlib, threading

# ── Supabase client (graceful fallback) ───────────────────────────────────────
try:
    from supabase import create_client, Client as _SBClient
    _SB_OK = True
except ImportError:
    _SBClient = None
    _SB_OK    = False

SUPABASE_URL     = os.environ.get('SUPABASE_URL',     'https://poyjykgqsvgimssbhsuz.supabase.co')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveWp5a2dxc3ZnaW1zc2Joc3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjgyMzQsImV4cCI6MjA4OTQwNDIzNH0.1_KBIagUj_EkfTU2MF3qsyR1lvJQ4jVqZ2AuVcGDBIA'
)
BILLING_SERVER   = os.environ.get('DV_BILLING_URL', 'https://billing.dartvoice.com')
TRIAL_DAYS       = 49
_SALT            = 'dartvoice-billing-v1-8f3a'
_ACTIVE_STATUSES = {'active', 'trialing'}

# ─────────────────────────────────────────────────────────────────────────────
# Storage
# ─────────────────────────────────────────────────────────────────────────────
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

# ─────────────────────────────────────────────────────────────────────────────
# Tamper-evident local store
# ─────────────────────────────────────────────────────────────────────────────
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

# ─────────────────────────────────────────────────────────────────────────────
# Install ID (stable per device, used before account login)
# ─────────────────────────────────────────────────────────────────────────────
def get_install_id() -> str:
    d = _load()
    if not d.get('install_id'):
        d['install_id']  = str(uuid.uuid4())
        d['trial_start'] = time.time()
        _save(d)
    return d['install_id']

# ─────────────────────────────────────────────────────────────────────────────
# Supabase client
# ─────────────────────────────────────────────────────────────────────────────
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

# ─────────────────────────────────────────────────────────────────────────────
# Auth — email OTP (magic code, not magic link — works in desktop apps)
# ─────────────────────────────────────────────────────────────────────────────
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

# ─────────────────────────────────────────────────────────────────────────────
# Subscription lookup (direct Supabase query, RLS-protected)
# ─────────────────────────────────────────────────────────────────────────────
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

def is_subscribed() -> bool:
    return _cached_status() in _ACTIVE_STATUSES

# ─────────────────────────────────────────────────────────────────────────────
# Trial
# ─────────────────────────────────────────────────────────────────────────────
def trial_days_remaining() -> int:
    d     = _load()
    start = d.get('trial_start', time.time())
    left  = TRIAL_DAYS - (time.time() - start) / 86400
    return max(0, int(left))

def trial_active() -> bool:
    return trial_days_remaining() > 0

# ─────────────────────────────────────────────────────────────────────────────
# Async subscription check
# ─────────────────────────────────────────────────────────────────────────────
def check_subscription_async(callback):
    """
    Background thread: refresh session, then fetch subscription status.
    Calls callback(subscribed: bool, account: dict | None).
    """
    def _do():
        account = get_account()
        if not account:
            # Not logged in — fall back to trial / local cache
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

# ─────────────────────────────────────────────────────────────────────────────
# Checkout URL
# ─────────────────────────────────────────────────────────────────────────────
def get_checkout_url() -> str:
    d = _load()
    uid        = d.get('sb_user_id', '')
    install_id = get_install_id()
    return f'{BILLING_SERVER}/checkout?user_id={uid}&install_id={install_id}'

# ─────────────────────────────────────────────────────────────────────────────
# Convenience summary
# ─────────────────────────────────────────────────────────────────────────────
def billing_status() -> dict:
    account    = get_account()
    subscribed = is_subscribed()
    days_left  = trial_days_remaining()
    logged_in  = account is not None
    return {
        'install_id':   get_install_id(),
        'account':      account,
        'logged_in':    logged_in,
        'subscribed':   subscribed,
        'trial_active': days_left > 0,
        'days_left':    days_left,
        # Locked only if: trial expired AND not subscribed
        'locked':       not subscribed and days_left <= 0,
    }
