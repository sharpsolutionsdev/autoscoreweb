"""
DartVoice Billing Server
========================
Responsibilities:
  1. /checkout  — creates a Stripe Checkout session for the given user
  2. /webhook   — receives Stripe events, writes subscription state to Supabase

Database:  Supabase  (dartvoice_subscriptions table, service-role key)
Email:     Resend  via Supabase Auth SMTP — no direct Resend calls needed here;
           Supabase handles OTP delivery automatically once SMTP is configured.

Environment variables  (see .env.example):
  STRIPE_SECRET_KEY        sk_live_...
  STRIPE_WEBHOOK_SECRET    whsec_...
  STRIPE_PRICE_ID          price_...
  SUPABASE_URL             https://poyjykgqsvgimssbhsuz.supabase.co
  SUPABASE_SERVICE_KEY     service_role secret key (never ships in the app)
    SUCCESS_URL              https://dartvoice.app/thanks.html
    CANCEL_URL               https://dartvoice.app/checkout-cancelled.html
"""

import json
import os
import time

from flask import abort, Flask, jsonify, redirect, request
from flask_cors import CORS
import stripe
from supabase import create_client

app = Flask(__name__)
CORS(app, origins=[
    'https://dartvoice.app',
    'https://www.dartvoice.app',
])

# ── Config ────────────────────────────────────────────────────────────────────
stripe.api_key      = os.environ['STRIPE_SECRET_KEY']
_WEBHOOK_SECRET     = os.environ['STRIPE_WEBHOOK_SECRET']
_PRICE_ID           = os.environ['STRIPE_PRICE_ID']
TRIAL_DAYS          = 7
SUCCESS_URL         = os.environ.get('SUCCESS_URL', 'https://dartvoice.app/thanks')
CANCEL_URL          = os.environ.get('CANCEL_URL',  'https://dartvoice.app/checkout-cancelled')

# ── Launch-sale promo (20% off, fixed end 2026-04-28 23:59:59 UTC) ────────────
# The Stripe coupon/promotion code id. Create in Stripe dashboard → Products →
# Coupons. Set STRIPE_PROMO_COUPON_ID env var, else falls back to the default id.
PROMO_COUPON_ID     = os.environ.get('STRIPE_PROMO_COUPON_ID', 'DARTVOICE20')
# Epoch cutoff: April 28 2026 23:59:59 UTC
PROMO_END_EPOCH     = 1777679999

# ── Supabase admin client (service key — server only, never in the app) ───────
_sb = create_client(
    os.environ['SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_KEY'],
)

# ─────────────────────────────────────────────────────────────────────────────
# Supabase helpers
# ─────────────────────────────────────────────────────────────────────────────
def _upsert_sub(user_id: str, **fields):
    """Insert or update a subscription row for the given Supabase user_id."""
    fields['user_id']    = user_id
    fields['updated_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    try:
        app.logger.info('Upserting subscription for user %s: %s', user_id, json.dumps(fields))
    except Exception:
        app.logger.info('Upserting subscription for user %s', user_id)

        

    try:
        resp = _sb.table('dartvoice_subscriptions').upsert(
            fields,
            on_conflict='user_id',
        ).execute()
        try:
            app.logger.info('Upserted subscription for %s: %s', user_id, {k: v for k, v in fields.items() if k != 'user_id'})
        except Exception:
            # Best-effort logging; avoid failing the request due to logging
            pass
        return resp
    except Exception as e:
        app.logger.exception('Failed to upsert subscription for %s: %s', user_id, e)
        raise

def _user_id_for_customer(stripe_customer_id: str) -> str | None:
    """Look up Supabase user_id from a Stripe customer_id."""
    resp = (
        _sb.table('dartvoice_subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', stripe_customer_id)
        .limit(1)
        .execute()
    )
    if resp.data:
        return resp.data[0]['user_id']
    return None

def _user_id_for_install(install_id: str) -> str | None:
    resp = (
        _sb.table('dartvoice_subscriptions')
        .select('user_id')
        .eq('install_id', install_id)
        .limit(1)
        .execute()
    )
    if resp.data:
        return resp.data[0]['user_id']
    return None

def _stripe_to_dict(obj):
    """Convert any StripeObject (and nested children) to a plain dict."""
    if hasattr(obj, 'to_dict_recursive'):
        return obj.to_dict_recursive()
    return obj

def _get_sub_row(user_id: str) -> dict | None:
    """Fetch the current subscription row for a Supabase user (or None)."""
    try:
        resp = (_sb.table('dartvoice_subscriptions')
                .select('*')
                .eq('user_id', user_id)
                .limit(1)
                .execute())
        if resp.data:
            return resp.data[0]
    except Exception:
        pass
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Auth helpers
# ─────────────────────────────────────────────────────────────────────────────
def _user_id_from_request():
    """
    Verify the caller's Supabase access token and return their auth.users UUID.
    Accepts the JWT either from the `Authorization: Bearer <jwt>` header or a
    `?access_token=<jwt>` query string (last-resort for redirect flows that
    can't set headers, e.g. /portal opened in a top-level window). Aborts 401
    on any failure. NEVER trust `?user_id=` from the query string — it is
    callable by anyone who knows a victim's Supabase UUID.
    """
    token = ''
    auth_hdr = request.headers.get('Authorization', '')
    if auth_hdr.lower().startswith('bearer '):
        token = auth_hdr.split(None, 1)[1].strip()
    if not token:
        token = (request.args.get('access_token') or '').strip()
    if not token or len(token) > 4096:
        abort(401, 'Missing access token')
    try:
        # supabase-py's auth.get_user(jwt) verifies signature against the
        # project JWKS and returns the user record.
        result = _sb.auth.get_user(token)
        user = getattr(result, 'user', None) or (result.get('user') if isinstance(result, dict) else None)
        uid = getattr(user, 'id', None) if user else None
        if not uid and isinstance(user, dict):
            uid = user.get('id')
        if not uid:
            abort(401, 'Invalid token')
        return uid
    except Exception as e:
        app.logger.warning('JWT verification failed: %s', e)
        abort(401, 'Invalid token')


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/health')
def health():
    """
    Deep health check — verifies Stripe API access and Supabase DB connectivity.
    Returns HTTP 200 with {'ok': True, 'checks': {...}} on success,
    or HTTP 503 with details of what failed.
    """
    checks = {}
    ok = True

    # ── 1. Stripe connectivity ────────────────────────────────────────────────
    try:
        stripe.Account.retrieve()
        checks['stripe'] = 'ok'
    except stripe.AuthenticationError as e:
        checks['stripe'] = f'auth_error: {e}'
        ok = False
    except Exception as e:
        checks['stripe'] = f'error: {e}'
        ok = False

    # ── 2. Supabase DB connectivity (read-only — service key required) ────────
    try:
        # A lightweight count query — verifies the DB is reachable and
        # the service key has access to the subscriptions table.
        _sb.table('dartvoice_subscriptions').select('id', count='exact').limit(0).execute()
        checks['supabase'] = 'ok'
    except Exception as e:
        checks['supabase'] = f'error: {e}'
        ok = False

    # ── 3. Stripe price configured ───────────────────────────────────────────
    try:
        stripe.Price.retrieve(_PRICE_ID)
        checks['stripe_price'] = 'ok'
    except stripe.InvalidRequestError:
        checks['stripe_price'] = f'price_not_found: {_PRICE_ID}'
        ok = False
    except Exception as e:
        checks['stripe_price'] = f'error: {e}'
        ok = False

    status_code = 200 if ok else 503
    return jsonify({'ok': ok, 'checks': checks}), status_code


@app.route('/checkout')
def checkout():
    """
    GET /checkout?install_id=<uuid>&access_token=<jwt>
    OR  GET /checkout?install_id=<uuid>  with Authorization: Bearer <jwt>
    Creates a Stripe Checkout session and redirects. The Supabase user_id is
    derived from the verified JWT — NEVER from the query string.
    """
    user_id    = _user_id_from_request()
    install_id = request.args.get('install_id', '').strip()
    if len(install_id) > 64:
        abort(400, 'install_id too long')

    # Fetch or create Stripe customer linked to this user
    existing = (
        _sb.table('dartvoice_subscriptions')
        .select('stripe_customer_id, email')
        .eq('user_id', user_id)
        .limit(1)
        .execute()
    )

    customer_id = None
    email       = None
    if existing.data:
        customer_id = existing.data[0].get('stripe_customer_id')
        email       = existing.data[0].get('email')

    # Fetch email from Supabase auth if not stored
    if not email:
        try:
            u = _sb.auth.admin.get_user_by_id(user_id)
            email = u.user.email if u.user else None
        except Exception:
            pass

    # Create Stripe customer if needed
    if not customer_id:
        kwargs = {'metadata': {'supabase_user_id': user_id,
                               'install_id': install_id}}
        if email:
            kwargs['email'] = email
        cust = stripe.Customer.create(**kwargs)
        customer_id = cust.id
        _upsert_sub(user_id,
                    stripe_customer_id=customer_id,
                    install_id=install_id,
                    email=email or '',
                    status='none')

    # Auto-apply launch-sale coupon while promo window is open.
    # Note: Stripe does not allow `discounts` + `allow_promotion_codes` on the
    # same session, so we toggle between them.
    promo_active = int(time.time()) < PROMO_END_EPOCH and bool(PROMO_COUPON_ID)
    session_kwargs = dict(
        customer=customer_id,
        mode='subscription',
        payment_method_types=['card'],
        payment_method_collection='always',
        line_items=[{'price': _PRICE_ID, 'quantity': 1}],
        subscription_data={
            'trial_period_days': TRIAL_DAYS,
            'trial_settings': {
                'end_behavior': {'missing_payment_method': 'cancel'},
            },
            'metadata': {
                'supabase_user_id': user_id,
                'install_id':       install_id,
            },
        },
        client_reference_id=user_id,
        success_url=SUCCESS_URL + '?session_id={CHECKOUT_SESSION_ID}',
        cancel_url=CANCEL_URL,
    )
    if promo_active:
        session_kwargs['discounts'] = [{'coupon': PROMO_COUPON_ID}]
    else:
        session_kwargs['allow_promotion_codes'] = True

    try:
        session = stripe.checkout.Session.create(**session_kwargs)
        return redirect(session.url, code=303)
    except stripe.StripeError as e:
        # If the coupon doesn't exist or expired mid-flight, retry without it
        if promo_active and ('coupon' in str(e).lower() or 'discount' in str(e).lower()):
            app.logger.warning('Promo coupon failed (%s); retrying with promotion codes allowed', e)
            session_kwargs.pop('discounts', None)
            session_kwargs['allow_promotion_codes'] = True
            try:
                session = stripe.checkout.Session.create(**session_kwargs)
                return redirect(session.url, code=303)
            except stripe.StripeError as e2:
                return jsonify({'error': str(e2)}), 500
        return jsonify({'error': str(e)}), 500

@app.route('/portal')
def portal():
    """
    GET /portal  (Authorization: Bearer <jwt>  OR  ?access_token=<jwt>)
    Opens the Stripe Customer Portal so users can manage / cancel their subscription.
    The user_id is derived from the verified JWT — never from the query string.
    """
    user_id = _user_id_from_request()

    resp = (
        _sb.table('dartvoice_subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user_id)
        .limit(1)
        .execute()
    )
    if not resp.data or not resp.data[0].get('stripe_customer_id'):
        abort(404, 'No subscription found')

    customer_id = resp.data[0]['stripe_customer_id']
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url='https://dartvoice.app/dartvoice-dashboard.html',
        )
        return redirect(session.url, code=303)
    except stripe.StripeError as e:
        return jsonify({'error': str(e)}), 500


# ────────────────────────────────────────────────────────────────────────────────
# Competitions / raffles  — one-time Stripe Checkout per ticket purchase.
# Tickets are NOT reserved here; the webhook calls reserve_competition_tickets
# only after Stripe confirms the payment, so abandoned sessions never burn
# inventory.
# ────────────────────────────────────────────────────────────────────────────────
@app.route('/competition-checkout', methods=['POST'])
def competition_checkout():
    user_id = _user_id_from_request()
    body = request.get_json(silent=True) or {}
    slug = (body.get('slug') or '').strip()
    try:
        qty = int(body.get('qty') or 0)
    except (TypeError, ValueError):
        qty = 0
    if not slug or len(slug) > 80 or qty <= 0 or qty > 200:
        abort(400, 'Bad slug or qty')

    comp = (
        _sb.table('competitions')
        .select('id,slug,title,status,ticket_price_pence,total_tickets,sold_tickets,max_per_user,stripe_price_id')
        .eq('slug', slug)
        .limit(1)
        .execute()
    )
    if not comp.data:
        abort(404, 'Competition not found')
    c = comp.data[0]
    if c.get('status') != 'active':
        abort(409, 'Competition not active')
    if (c.get('sold_tickets') or 0) + qty > (c.get('total_tickets') or 0):
        abort(409, 'Not enough tickets remaining')
    if qty > (c.get('max_per_user') or 75):
        abort(400, 'Exceeds max_per_user')
    price_id = c.get('stripe_price_id')
    if not price_id:
        abort(500, 'Competition not wired to Stripe')

    base = os.environ.get('PUBLIC_SITE_URL', 'https://dartvoice.app').rstrip('/')
    try:
        session = stripe.checkout.Session.create(
            mode='payment',
            payment_method_types=['card'],
            line_items=[{'price': price_id, 'quantity': qty}],
            client_reference_id=user_id,
            metadata={
                'kind':           'competition',
                'competition_id': c['id'],
                'slug':           c['slug'],
                'qty':            str(qty),
                'supabase_user_id': user_id,
            },
            success_url=f'{base}/competitions.html?slug={c["slug"]}&paid=1',
            cancel_url=f'{base}/competitions.html?slug={c["slug"]}&cancelled=1',
        )
        return jsonify({'url': session.url}), 200
    except stripe.StripeError as e:
        app.logger.error('Competition checkout failed: %s', e)
        return jsonify({'error': str(e)}), 500
def webhook():
    if request.method == 'GET':
        return jsonify({
            'ok': True,
            'message': 'Webhook endpoint is live. Stripe must send POST requests.'
        }), 200

    # Read raw payload as text so we can parse JSON reliably.
    payload = request.data
    sig = request.headers.get('Stripe-Signature', '')
    try:
        event = stripe.Webhook.construct_event(payload, sig, _WEBHOOK_SECRET)
    except stripe.SignatureVerificationError:
        app.logger.warning('Stripe webhook signature verification failed')
        abort(400)

    # Parse the raw payload into a plain dict to avoid StripeObject attribute issues.
    try:
        payload_text = payload.decode('utf-8') if isinstance(payload, (bytes, bytearray)) else payload
        evt = json.loads(payload_text)
    except Exception:
        evt = _stripe_to_dict(event)

    etype = evt.get('type')
    event_id = evt.get('id')
    app.logger.info('Received Stripe event %s id=%s', etype, event_id)
    obj = (evt.get('data') or {}).get('object', {})

    # ── Checkout completed ────────────────────────────────────────────────────
    if etype == 'checkout.session.completed':        meta = obj.get('metadata') or {}

        # ── Branch: competition ticket purchase ─────────────────────────
        if meta.get('kind') == 'competition' and meta.get('competition_id'):
            cid = meta.get('competition_id')
            uid = meta.get('supabase_user_id') or obj.get('client_reference_id')
            try:
                qty = int(meta.get('qty') or 0)
            except (TypeError, ValueError):
                qty = 0
            session_id = obj.get('id')
            amount     = obj.get('amount_total') or 0
            if cid and uid and qty > 0:
                # Idempotency: if we've already booked this session, skip.
                already = (
                    _sb.table('competition_tickets')
                    .select('id').eq('stripe_session_id', session_id).limit(1).execute()
                )
                if not already.data:
                    try:
                        rpc = _sb.rpc('reserve_competition_tickets',
                                      {'p_competition_id': cid, 'p_qty': qty}).execute()
                        numbers = rpc.data or []
                        _sb.table('competition_tickets').insert({
                            'competition_id':    cid,
                            'user_id':           uid,
                            'qty':               qty,
                            'ticket_numbers':    numbers,
                            'amount_paid_pence': amount,
                            'stripe_session_id': session_id,
                            'payment_status':    'paid',
                            'paid_at':           time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                        }).execute()
                    except Exception as e:
                        app.logger.error('Competition ticket reserve failed: %s', e)
            return jsonify({'received': True}), 200

        # ── Branch: subscription checkout (existing flow) ────────────────        user_id    = obj.get('client_reference_id')
        cust_id    = obj.get('customer')
        sub_id     = obj.get('subscription')
        email      = (obj.get('customer_details') or {}).get('email', '')
        install_id = ''
        prev = _get_sub_row(user_id) if user_id else None
        if sub_id:
            try:
                sub = _stripe_to_dict(stripe.Subscription.retrieve(sub_id))
                meta = sub.get('metadata', {}) if isinstance(sub, dict) else {}
                install_id = meta.get('install_id', '')
            except Exception:
                pass
        if user_id:
            _upsert_sub(user_id,
                        stripe_customer_id=cust_id,
                        stripe_sub_id=sub_id,
                        install_id=install_id,
                        email=email,
                        status='trialing',
                        trial_start=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))

            # Update referral status to trial_active if this user was referred
            try:
                _sb.table('dartvoice_referrals') \
                    .update({'status': 'trial_active'}) \
                    .eq('referred_user_id', user_id) \
                    .eq('status', 'signed_up') \
                    .execute()
            except Exception:
                pass

            # Emails are handled by the DB trigger (send-confirmation edge function)

    # ── Subscription updated / created ────────────────────────────────────────
    elif etype in ('customer.subscription.created',
                   'customer.subscription.updated'):
        cust_id = obj.get('customer')
        sub_id = obj.get('id')
        status = obj.get('status', 'unknown')
        install_id = (obj.get('metadata') or {}).get('install_id', '')
        period_end = obj.get('current_period_end')
        period_end_iso = (
            time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(period_end))
            if period_end else None
        )
        user_id = (
            (obj.get('metadata') or {}).get('supabase_user_id') or
            _user_id_for_customer(cust_id)
        )
        if user_id:
            prev = _get_sub_row(user_id)
            fields = dict(stripe_customer_id=cust_id,
                          stripe_sub_id=sub_id,
                          status=status)
            if install_id:
                fields['install_id'] = install_id
            if period_end_iso:
                fields['current_period_end'] = period_end_iso
            if status == 'active':
                if not (prev and prev.get('subscribed_at')):
                    fields['subscribed_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            _upsert_sub(user_id, **fields)
            # Emails are handled by the DB trigger (send-confirmation edge function)

    # ── Subscription deleted ──────────────────────────────────────────────────
    elif etype == 'customer.subscription.deleted':
        cust_id = obj.get('customer')
        user_id = _user_id_for_customer(cust_id)
        if user_id:
            _upsert_sub(user_id, status='canceled')

    # ── First invoice paid (trial converts to active) ─────────────────────────
    elif etype == 'invoice.payment_succeeded':
        cust_id = obj.get('customer')
        sub_id = obj.get('subscription')
        user_id = _user_id_for_customer(cust_id)
        if user_id and sub_id:
            prev = _get_sub_row(user_id)
            try:
                sub = _stripe_to_dict(stripe.Subscription.retrieve(sub_id))
                sub_status = sub.get('status', 'unknown') if isinstance(sub, dict) else getattr(sub, 'status', 'unknown')
                period_end = sub.get('current_period_end') if isinstance(sub, dict) else getattr(sub, 'current_period_end', None)
                fields = dict(stripe_sub_id=sub_id,
                              status=sub_status)
                if period_end:
                    fields['current_period_end'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(period_end))
                if sub_status == 'active':
                    if not (prev and prev.get('subscribed_at')):
                        fields['subscribed_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                _upsert_sub(user_id, **fields)
                # Emails are handled by the DB trigger (send-confirmation edge function)
            except Exception:
                pass

            # ── Referral conversion: credit the ambassador ────────────
            try:
                ref_resp = _sb.table('dartvoice_referrals') \
                    .select('id, status') \
                    .eq('referred_user_id', user_id) \
                    .in_('status', ['signed_up', 'trial_active']) \
                    .execute()
                if ref_resp.data:
                    _sb.table('dartvoice_referrals') \
                        .update({'status': 'converted', 'reward_amount': 5.00}) \
                        .eq('id', ref_resp.data[0]['id']) \
                        .execute()
            except Exception:
                pass

    # ── Payment failed ────────────────────────────────────────────────────────
    elif etype == 'invoice.payment_failed':
        cust_id = obj.get('customer')
        user_id = _user_id_for_customer(cust_id)
        if user_id:
            _upsert_sub(user_id, status='past_due')

    return jsonify({'received': True})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8000)), debug=False)
