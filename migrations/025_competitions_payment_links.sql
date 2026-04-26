-- migrations/025_competitions_payment_links.sql
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS payment_link_url TEXT;

UPDATE public.competitions SET payment_link_url='https://buy.stripe.com/28EaEP6gFcwu8VbcWMf7i03' WHERE slug='winmau-blade-6-board';
UPDATE public.competitions SET payment_link_url='https://buy.stripe.com/6oUcMX7kJ5421sJ7Csf7i04' WHERE slug='luke-littler-gen-1';
UPDATE public.competitions SET payment_link_url='https://buy.stripe.com/28E6ozeNb8ge3AR0a0f7i05' WHERE slug='cash-500';
UPDATE public.competitions SET payment_link_url='https://buy.stripe.com/28E00b8oN1RQ2wN4qgf7i06' WHERE slug='target-power-9five-gen7';
UPDATE public.competitions SET payment_link_url='https://buy.stripe.com/4gMdR1fRf0NM5IZ3mcf7i07' WHERE slug='snakebite-gen-3';
UPDATE public.competitions SET payment_link_url='https://buy.stripe.com/9B65kvgVj3ZY8Vbg8Yf7i08' WHERE slug='mvg-adrenalin';
