#!/usr/bin/env python3
"""
Backup Supabase tables: dartvoice_profiles, dartvoice_referrals, dartvoice_ambassador_payouts
Writes JSON and CSV to backups/<timestamp>/

Usage: python scripts/backup_supabase_tables.py

The script will look for SUPABASE_URL and SUPABASE_KEY in the environment.
If not found it will try to extract `SB_URL` and `SB_KEY` from `contact.html` in the repo.
"""
import os
import re
import sys
import json
import csv
import datetime
import pathlib

try:
    import requests
except Exception:
    print('Missing dependency: requests. Please run `python -m pip install requests` and retry.', file=sys.stderr)
    sys.exit(2)


def find_supabase_creds():
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_KEY') or os.environ.get('SUPABASE_ANON_KEY') or os.environ.get('SB_KEY')
    if url and key:
        return url.rstrip('/'), key
    # fallback to reading contact.html
    p = pathlib.Path('contact.html')
    if p.exists():
        txt = p.read_text(encoding='utf-8')
        m_url = re.search(r"var\s+SB_URL\s*=\s*'([^']+)'", txt)
        m_key = re.search(r"var\s+SB_KEY\s*=\s*'([^']+)'", txt)
        if m_url and m_key:
            return m_url.group(1).rstrip('/'), m_key.group(1)
    print('Supabase credentials not found in environment or contact.html. Set SUPABASE_URL and SUPABASE_KEY.', file=sys.stderr)
    sys.exit(2)


def fetch_table(url, key, table):
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Accept': 'application/json'
    }
    params = {'select': '*'}
    r = requests.get(f"{url}/rest/v1/{table}", headers=headers, params=params, timeout=60)
    r.raise_for_status()
    return r.json()


def write_json(data, path):
    pathlib.Path(path).write_text(json.dumps(data, indent=2, default=str), encoding='utf-8')


def write_csv(data, path):
    if not data:
        pathlib.Path(path).write_text('', encoding='utf-8')
        return
    keys = sorted({k for row in data for k in row.keys()})
    with open(path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        for row in data:
            writer.writerow({k: row.get(k) for k in keys})


def main():
    url, key = find_supabase_creds()
    ts = datetime.datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    outdir = pathlib.Path('backups') / ts
    outdir.mkdir(parents=True, exist_ok=True)
    tables = ['dartvoice_profiles', 'dartvoice_referrals', 'dartvoice_ambassador_payouts']
    for t in tables:
        print(f'Fetching {t}...')
        try:
            data = fetch_table(url, key, t)
        except Exception as e:
            print(f'Error fetching {t}: {e}', file=sys.stderr)
            continue
        jpath = outdir / f"{t}.json"
        cpath = outdir / f"{t}.csv"
        write_json(data, jpath)
        write_csv(data, cpath)
        print(f'Wrote {jpath} and {cpath}')
    print('Backup complete. Directory:', outdir)


if __name__ == '__main__':
    main()
