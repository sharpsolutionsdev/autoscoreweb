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
  SUCCESS_URL              https://dartvoice.com/thanks
  CANCEL_URL               https://dartvoice.com/pricing
"""

import os, time
import stripe
from flask import Flask, request, jsonify, redirect, abort
from flask_cors import CORS
from supabase import create_client

app = Flask(__name__)
CORS(app)

# ── Config ────────────────────────────────────────────────────────────────────
stripe.api_key      = os.environ['STRIPE_SECRET_KEY']
_WEBHOOK_SECRET     = os.environ['STRIPE_WEBHOOK_SECRET']
_PRICE_ID           = os.environ['STRIPE_PRICE_ID']
TRIAL_DAYS          = 7
SUCCESS_URL         = os.environ.get('SUCCESS_URL', 'https://dartvoice.com/thanks')
CANCEL_URL          = os.environ.get('CANCEL_URL',  'https://dartvoice.com/pricing')

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
    _sb.table('dartvoice_subscriptions').upsert(
        fields,
        on_conflict='user_id',
    ).execute()

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

def _get_customer_email(customer_id: str) -> str:
    try:
        c = stripe.Customer.retrieve(customer_id)
        return c.get('email', '') or ''
    except Exception:
        return ''

# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/health')
def health():
    return jsonify({'ok': True})


@app.route('/checkout')
def checkout():
    """
    GET /checkout?user_id=<uuid>&install_id=<uuid>
    Creates a Stripe Checkout session and redirects.
    user_id is the Supabase auth.users UUID.
    """
    user_id    = request.args.get('user_id', '').strip()
    install_id = request.args.get('install_id', '').strip()

    if not user_id or len(user_id) > 64:
        abort(400, 'Missing user_id')

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

    try:
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode='subscription',
            payment_method_types=['card'],
            line_items=[{'price': _PRICE_ID, 'quantity': 1}],
            subscription_data={
                'trial_period_days': TRIAL_DAYS,
                'metadata': {
                    'supabase_user_id': user_id,
                    'install_id':       install_id,
                },
            },
            client_reference_id=user_id,
            success_url=SUCCESS_URL + '?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=CANCEL_URL,
        )
        return redirect(session.url, code=303)
    except stripe.StripeError as e:
        return jsonify({'error': str(e)}), 500


@app.route('/portal')
def portal():
    """
    GET /portal?user_id=<uuid>
    Opens the Stripe Customer Portal so users can manage / cancel their subscription.
    """
    user_id = request.args.get('user_id', '').strip()
    if not user_id:
        abort(400)

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
            return_url=SUCCESS_URL,
        )
        return redirect(session.url, code=303)
    except stripe.StripeError as e:
        return jsonify({'error': str(e)}), 500


@app.route('/webhook', methods=['POST'])
def webhook():
    payload = request.data
    sig     = request.headers.get('Stripe-Signature', '')
    try:
        event = stripe.Webhook.construct_event(payload, sig, _WEBHOOK_SECRET)
    except stripe.SignatureVerificationError:
        abort(400)

    etype = event['type']
    obj   = event['data']['object']

    # ── Checkout completed ────────────────────────────────────────────────────
    if etype == 'checkout.session.completed':
        user_id    = obj.get('client_reference_id')
        cust_id    = obj.get('customer')
        sub_id     = obj.get('subscription')
        email      = (obj.get('customer_details') or {}).get('email', '')
        install_id = ''
        if sub_id:
            try:
                sub = stripe.Subscription.retrieve(sub_id)
                install_id = (sub.metadata or {}).get('install_id', '')
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

    # ── Subscription updated / created ────────────────────────────────────────
    elif etype in ('customer.subscription.created',
                   'customer.subscription.updated'):
        cust_id    = obj.get('customer')
        sub_id     = obj.get('id')
        status     = obj.get('status', 'unknown')
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
            fields = dict(stripe_customer_id=cust_id,
                          stripe_sub_id=sub_id,
                          status=status)
            if install_id:
                fields['install_id'] = install_id
            if period_end_iso:
                fields['current_period_end'] = period_end_iso
            _upsert_sub(user_id, **fields)

    # ── Subscription deleted ──────────────────────────────────────────────────
    elif etype == 'customer.subscription.deleted':
        cust_id = obj.get('customer')
        user_id = _user_id_for_customer(cust_id)
        if user_id:
            _upsert_sub(user_id, status='canceled')

    # ── Payment failed ────────────────────────────────────────────────────────
    elif etype == 'invoice.payment_failed':
        cust_id = obj.get('customer')
        user_id = _user_id_for_customer(cust_id)
        if user_id:
            _upsert_sub(user_id, status='past_due')

    return jsonify({'received': True})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8000)), debug=False)
