"""
DartVoice Billing Server — Unit Tests
======================================
Tests cover:
  - /health endpoint (Stripe + Supabase checks)
  - /checkout endpoint (parameter validation, session creation)
  - /portal endpoint (parameter validation, customer portal redirect)
  - /webhook endpoint (signature verification, all Stripe event types)

All external calls (Stripe, Supabase) are mocked so these tests run
without any live credentials.
"""
import json, time
import unittest
from unittest.mock import MagicMock, patch, PropertyMock

import stripe


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_sub(status='active', period_end=None, customer='cus_test',
              sub_id='sub_test', meta=None):
    """Return a mock stripe.Subscription-like object."""
    sub = MagicMock()
    sub.id = sub_id
    sub.status = status
    sub.customer = customer
    sub.current_period_end = period_end or int(time.time()) + 86400 * 30
    sub.metadata = meta or {}
    return sub


def _make_event(etype, obj_dict):
    """Return a minimal Stripe event dict."""
    return {
        'type': etype,
        'data': {'object': obj_dict},
    }


# ─────────────────────────────────────────────────────────────────────────────
# Test setup — patch all external dependencies at import time of app
# ─────────────────────────────────────────────────────────────────────────────

# Mock environment variables so app.py doesn't raise KeyError on import
import os
os.environ.setdefault('STRIPE_SECRET_KEY',     'sk_test_placeholder')
os.environ.setdefault('STRIPE_WEBHOOK_SECRET', 'whsec_placeholder')
os.environ.setdefault('STRIPE_PRICE_ID',       'price_placeholder')
os.environ.setdefault('SUPABASE_URL',          'https://test.supabase.co')
os.environ.setdefault('SUPABASE_SERVICE_KEY',  'service_placeholder')

# Patch supabase before import so create_client doesn't make a real connection
with patch('supabase.create_client', return_value=MagicMock()):
    import app as billing_app  # noqa: E402


class HealthEndpointTests(unittest.TestCase):
    """Tests for GET /health"""

    def setUp(self):
        billing_app.app.config['TESTING'] = True
        self.client = billing_app.app.test_client()

    def test_health_ok(self):
        """All sub-checks pass → 200 ok:true."""
        with (
            patch.object(stripe.Account, 'retrieve', return_value=MagicMock()),
            patch.object(stripe.Price,   'retrieve', return_value=MagicMock()),
        ):
            mock_sb = MagicMock()
            mock_sb.table.return_value.select.return_value \
                .limit.return_value.execute.return_value = MagicMock()
            billing_app._sb = mock_sb

            resp = self.client.get('/health')
            data = json.loads(resp.data)
            self.assertEqual(resp.status_code, 200)
            self.assertTrue(data['ok'])
            self.assertEqual(data['checks']['stripe'],       'ok')
            self.assertEqual(data['checks']['supabase'],     'ok')
            self.assertEqual(data['checks']['stripe_price'], 'ok')

    def test_health_stripe_auth_failure(self):
        """Stripe auth error → 503 ok:false, stripe check fails."""
        with (
            patch.object(stripe.Account, 'retrieve',
                         side_effect=stripe.AuthenticationError('bad key')),
            patch.object(stripe.Price, 'retrieve', return_value=MagicMock()),
        ):
            mock_sb = MagicMock()
            mock_sb.table.return_value.select.return_value \
                .limit.return_value.execute.return_value = MagicMock()
            billing_app._sb = mock_sb

            resp = self.client.get('/health')
            data = json.loads(resp.data)
            self.assertEqual(resp.status_code, 503)
            self.assertFalse(data['ok'])
            self.assertIn('auth_error', data['checks']['stripe'])

    def test_health_supabase_failure(self):
        """Supabase error → 503 ok:false, supabase check fails."""
        with (
            patch.object(stripe.Account, 'retrieve', return_value=MagicMock()),
            patch.object(stripe.Price,   'retrieve', return_value=MagicMock()),
        ):
            mock_sb = MagicMock()
            mock_sb.table.return_value.select.return_value \
                .limit.return_value.execute.side_effect = Exception('connection refused')
            billing_app._sb = mock_sb

            resp = self.client.get('/health')
            data = json.loads(resp.data)
            self.assertEqual(resp.status_code, 503)
            self.assertFalse(data['ok'])
            self.assertIn('error', data['checks']['supabase'])

    def test_health_price_not_found(self):
        """Unknown price ID → 503 ok:false, stripe_price check fails."""
        with (
            patch.object(stripe.Account, 'retrieve', return_value=MagicMock()),
            patch.object(stripe.Price, 'retrieve',
                         side_effect=stripe.InvalidRequestError('No such price', 'price')),
        ):
            mock_sb = MagicMock()
            mock_sb.table.return_value.select.return_value \
                .limit.return_value.execute.return_value = MagicMock()
            billing_app._sb = mock_sb

            resp = self.client.get('/health')
            data = json.loads(resp.data)
            self.assertEqual(resp.status_code, 503)
            self.assertFalse(data['ok'])
            self.assertIn('price_not_found', data['checks']['stripe_price'])


class CheckoutEndpointTests(unittest.TestCase):
    """Tests for GET /checkout"""

    def setUp(self):
        billing_app.app.config['TESTING'] = True
        self.client = billing_app.app.test_client()

    def _mock_sb_no_existing(self):
        sb = MagicMock()
        # No existing subscription row
        sb.table.return_value.select.return_value \
            .eq.return_value.limit.return_value.execute.return_value \
            = MagicMock(data=[])
        # auth.admin.get_user_by_id → returns email
        user_mock = MagicMock()
        user_mock.user.email = 'test@example.com'
        sb.auth.admin.get_user_by_id.return_value = user_mock
        # upsert
        sb.table.return_value.upsert.return_value.execute.return_value = MagicMock()
        return sb

    def test_checkout_missing_user_id(self):
        resp = self.client.get('/checkout')
        self.assertEqual(resp.status_code, 400)

    def test_checkout_user_id_too_long(self):
        resp = self.client.get('/checkout?user_id=' + 'x' * 65)
        self.assertEqual(resp.status_code, 400)

    def test_checkout_redirects_to_stripe(self):
        sb = self._mock_sb_no_existing()
        billing_app._sb = sb

        cust = MagicMock(); cust.id = 'cus_new'
        session_mock = MagicMock(); session_mock.url = 'https://checkout.stripe.com/pay/abc'

        with (
            patch.object(stripe.Customer, 'create', return_value=cust),
            patch.object(stripe.checkout.Session, 'create', return_value=session_mock),
        ):
            resp = self.client.get('/checkout?user_id=user-uuid-1234&install_id=inst-uuid-5678')
            self.assertEqual(resp.status_code, 303)
            self.assertIn('checkout.stripe.com', resp.headers['Location'])

    def test_checkout_reuses_existing_customer(self):
        sb = MagicMock()
        sb.table.return_value.select.return_value \
            .eq.return_value.limit.return_value.execute.return_value \
            = MagicMock(data=[{'stripe_customer_id': 'cus_existing', 'email': 'e@e.com'}])
        sb.table.return_value.upsert.return_value.execute.return_value = MagicMock()
        billing_app._sb = sb

        session_mock = MagicMock(); session_mock.url = 'https://checkout.stripe.com/pay/xyz'

        with patch.object(stripe.checkout.Session, 'create', return_value=session_mock) as mock_create:
            resp = self.client.get('/checkout?user_id=user-uuid-1234')
            self.assertEqual(resp.status_code, 303)
            # Customer should NOT be created again
            call_kwargs = mock_create.call_args[1]
            self.assertEqual(call_kwargs['customer'], 'cus_existing')

    def test_checkout_stripe_error(self):
        sb = self._mock_sb_no_existing()
        billing_app._sb = sb
        cust = MagicMock(); cust.id = 'cus_err'
        with (
            patch.object(stripe.Customer, 'create', return_value=cust),
            patch.object(stripe.checkout.Session, 'create',
                         side_effect=stripe.StripeError('network error')),
        ):
            resp = self.client.get('/checkout?user_id=user-uuid-1234')
            self.assertEqual(resp.status_code, 500)
            self.assertIn('error', json.loads(resp.data))


class PortalEndpointTests(unittest.TestCase):
    """Tests for GET /portal"""

    def setUp(self):
        billing_app.app.config['TESTING'] = True
        self.client = billing_app.app.test_client()

    def test_portal_missing_user_id(self):
        resp = self.client.get('/portal')
        self.assertEqual(resp.status_code, 400)

    def test_portal_no_subscription(self):
        sb = MagicMock()
        sb.table.return_value.select.return_value \
            .eq.return_value.limit.return_value.execute.return_value \
            = MagicMock(data=[])
        billing_app._sb = sb
        resp = self.client.get('/portal?user_id=user-uuid-1234')
        self.assertEqual(resp.status_code, 404)

    def test_portal_redirects(self):
        sb = MagicMock()
        sb.table.return_value.select.return_value \
            .eq.return_value.limit.return_value.execute.return_value \
            = MagicMock(data=[{'stripe_customer_id': 'cus_portal'}])
        billing_app._sb = sb

        portal_session = MagicMock()
        portal_session.url = 'https://billing.stripe.com/session/abc'

        with patch.object(stripe.billing_portal.Session, 'create',
                          return_value=portal_session):
            resp = self.client.get('/portal?user_id=user-uuid-1234')
            self.assertEqual(resp.status_code, 303)
            self.assertIn('billing.stripe.com', resp.headers['Location'])


class WebhookEndpointTests(unittest.TestCase):
    """Tests for POST /webhook — all Stripe event types."""

    def setUp(self):
        billing_app.app.config['TESTING'] = True
        self.client = billing_app.app.test_client()

    def _post_event(self, event_dict):
        """Post a fake verified Stripe event."""
        payload = json.dumps(event_dict).encode()
        with patch.object(stripe.Webhook, 'construct_event', return_value=event_dict):
            return self.client.post(
                '/webhook',
                data=payload,
                content_type='application/json',
                headers={'Stripe-Signature': 'dummy'},
            )

    def _setup_sb_upsert(self):
        sb = MagicMock()
        sb.table.return_value.upsert.return_value.execute.return_value = MagicMock()
        sb.table.return_value.select.return_value \
            .eq.return_value.limit.return_value.execute.return_value \
            = MagicMock(data=[{'user_id': 'user-uuid-1234'}])
        billing_app._sb = sb
        return sb

    # ── Signature verification ────────────────────────────────────────────────

    def test_webhook_bad_signature_rejected(self):
        with patch.object(stripe.Webhook, 'construct_event',
                          side_effect=stripe.SignatureVerificationError('bad', 'sig')):
            resp = self.client.post(
                '/webhook', data=b'{}',
                content_type='application/json',
                headers={'Stripe-Signature': 'bad'},
            )
        self.assertEqual(resp.status_code, 400)

    # ── checkout.session.completed ────────────────────────────────────────────

    def test_webhook_checkout_completed(self):
        sb = self._setup_sb_upsert()
        sub_mock = _make_sub(status='trialing')
        sub_mock.metadata = {'install_id': 'inst-uuid'}

        event = _make_event('checkout.session.completed', {
            'client_reference_id': 'user-uuid-1234',
            'customer': 'cus_test',
            'subscription': 'sub_test',
            'customer_details': {'email': 'user@test.com'},
        })

        with patch.object(stripe.Subscription, 'retrieve', return_value=sub_mock):
            resp = self._post_event(event)

        self.assertEqual(resp.status_code, 200)
        upsert_calls = sb.table.return_value.upsert.call_args_list
        self.assertTrue(len(upsert_calls) > 0)
        upserted = upsert_calls[0][0][0]
        self.assertEqual(upserted['status'], 'trialing')
        self.assertEqual(upserted['user_id'], 'user-uuid-1234')

    # ── customer.subscription.updated ────────────────────────────────────────

    def test_webhook_subscription_updated_active(self):
        sb = self._setup_sb_upsert()
        event = _make_event('customer.subscription.updated', {
            'id': 'sub_test',
            'customer': 'cus_test',
            'status': 'active',
            'current_period_end': int(time.time()) + 86400 * 30,
            'metadata': {'supabase_user_id': 'user-uuid-1234', 'install_id': ''},
        })
        resp = self._post_event(event)
        self.assertEqual(resp.status_code, 200)
        upserted = sb.table.return_value.upsert.call_args_list[0][0][0]
        self.assertEqual(upserted['status'], 'active')

    def test_webhook_subscription_updated_past_due(self):
        sb = self._setup_sb_upsert()
        event = _make_event('customer.subscription.updated', {
            'id': 'sub_test',
            'customer': 'cus_test',
            'status': 'past_due',
            'current_period_end': int(time.time()) - 86400,
            'metadata': {'supabase_user_id': 'user-uuid-1234'},
        })
        resp = self._post_event(event)
        self.assertEqual(resp.status_code, 200)
        upserted = sb.table.return_value.upsert.call_args_list[0][0][0]
        self.assertEqual(upserted['status'], 'past_due')

    # ── customer.subscription.deleted ────────────────────────────────────────

    def test_webhook_subscription_deleted(self):
        sb = self._setup_sb_upsert()
        event = _make_event('customer.subscription.deleted', {
            'customer': 'cus_test',
        })
        resp = self._post_event(event)
        self.assertEqual(resp.status_code, 200)
        upserted = sb.table.return_value.upsert.call_args_list[0][0][0]
        self.assertEqual(upserted['status'], 'canceled')

    # ── invoice.payment_succeeded ─────────────────────────────────────────────

    def test_webhook_invoice_payment_succeeded(self):
        sb = self._setup_sb_upsert()
        active_sub = _make_sub(status='active')
        event = _make_event('invoice.payment_succeeded', {
            'customer': 'cus_test',
            'subscription': 'sub_test',
        })
        with patch.object(stripe.Subscription, 'retrieve', return_value=active_sub):
            resp = self._post_event(event)
        self.assertEqual(resp.status_code, 200)
        upserted = sb.table.return_value.upsert.call_args_list[0][0][0]
        self.assertEqual(upserted['status'], 'active')

    # ── invoice.payment_failed ────────────────────────────────────────────────

    def test_webhook_invoice_payment_failed(self):
        sb = self._setup_sb_upsert()
        event = _make_event('invoice.payment_failed', {
            'customer': 'cus_test',
        })
        resp = self._post_event(event)
        self.assertEqual(resp.status_code, 200)
        upserted = sb.table.return_value.upsert.call_args_list[0][0][0]
        self.assertEqual(upserted['status'], 'past_due')

    def test_webhook_unknown_event_ignored(self):
        """Unknown event types should be silently acknowledged."""
        sb = self._setup_sb_upsert()
        event = _make_event('some.unknown.event', {'foo': 'bar'})
        resp = self._post_event(event)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(json.loads(resp.data), {'received': True})


class SubscriptionAccessControlTests(unittest.TestCase):
    """
    Verify that the subscription status returned by Supabase is correctly
    interpreted so that only active/trialing users get access.
    """

    def setUp(self):
        billing_app.app.config['TESTING'] = True
        self.client = billing_app.app.test_client()

    def _sub_response(self, status, days_offset=30):
        """Build a mock Supabase response with the given subscription status."""
        import datetime
        end_dt = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=days_offset)
        return MagicMock(data=[{
            'user_id': 'user-uuid-1234',
            'status': status,
            'stripe_customer_id': 'cus_test',
            'current_period_end': end_dt.isoformat(),
        }])

    def test_trialing_user_is_active(self):
        """A user in trial → subscription.updated webhook keeps status='trialing'."""
        sb = MagicMock()
        sb.table.return_value.upsert.return_value.execute.return_value = MagicMock()
        sb.table.return_value.select.return_value \
            .eq.return_value.limit.return_value.execute.return_value \
            = MagicMock(data=[{'user_id': 'user-uuid-1234'}])
        billing_app._sb = sb

        event = _make_event('customer.subscription.updated', {
            'id': 'sub_test',
            'customer': 'cus_test',
            'status': 'trialing',
            'current_period_end': int(time.time()) + 86400 * 5,
            'metadata': {'supabase_user_id': 'user-uuid-1234'},
        })
        with patch.object(stripe.Webhook, 'construct_event', return_value=event):
            resp = self.client.post(
                '/webhook', data=json.dumps(event).encode(),
                content_type='application/json',
                headers={'Stripe-Signature': 'dummy'},
            )
        self.assertEqual(resp.status_code, 200)
        upserted = sb.table.return_value.upsert.call_args_list[0][0][0]
        self.assertEqual(upserted['status'], 'trialing')

    def test_canceled_subscription_blocks_access(self):
        """Subscription deleted → status='canceled', user loses access."""
        sb = MagicMock()
        sb.table.return_value.upsert.return_value.execute.return_value = MagicMock()
        sb.table.return_value.select.return_value \
            .eq.return_value.limit.return_value.execute.return_value \
            = MagicMock(data=[{'user_id': 'user-uuid-1234'}])
        billing_app._sb = sb

        event = _make_event('customer.subscription.deleted', {
            'customer': 'cus_test',
        })
        with patch.object(stripe.Webhook, 'construct_event', return_value=event):
            resp = self.client.post(
                '/webhook', data=json.dumps(event).encode(),
                content_type='application/json',
                headers={'Stripe-Signature': 'dummy'},
            )
        self.assertEqual(resp.status_code, 200)
        upserted = sb.table.return_value.upsert.call_args_list[0][0][0]
        # Must be 'canceled', not 'active' or 'trialing'
        self.assertEqual(upserted['status'], 'canceled')
        self.assertNotIn(upserted['status'], ('active', 'trialing'))

    def test_trial_missing_payment_method_cancels(self):
        """
        When a trial ends with no payment method, Stripe sends
        subscription.updated with status='canceled'. This must be persisted
        so the client's subscription check correctly blocks access.
        """
        sb = MagicMock()
        sb.table.return_value.upsert.return_value.execute.return_value = MagicMock()
        sb.table.return_value.select.return_value \
            .eq.return_value.limit.return_value.execute.return_value \
            = MagicMock(data=[{'user_id': 'user-uuid-1234'}])
        billing_app._sb = sb

        event = _make_event('customer.subscription.updated', {
            'id': 'sub_test',
            'customer': 'cus_test',
            'status': 'canceled',
            'current_period_end': int(time.time()) - 1,
            'metadata': {'supabase_user_id': 'user-uuid-1234'},
        })
        with patch.object(stripe.Webhook, 'construct_event', return_value=event):
            resp = self.client.post(
                '/webhook', data=json.dumps(event).encode(),
                content_type='application/json',
                headers={'Stripe-Signature': 'dummy'},
            )
        self.assertEqual(resp.status_code, 200)
        upserted = sb.table.return_value.upsert.call_args_list[0][0][0]
        self.assertEqual(upserted['status'], 'canceled')


if __name__ == '__main__':
    unittest.main()
