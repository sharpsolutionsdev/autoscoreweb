-- Allow authenticated admin emails to read contact messages
CREATE POLICY "admin_select_contact_messages"
    ON public.dartvoice_contact_messages
    FOR SELECT
    TO authenticated
    USING (auth.jwt() ->> 'email' IN ('admin@dartvoice.app', 'support@dartvoice.app'));
