// Collection endpoint — Netlify Function + Netlify Blobs.
// POST /api/collect            -> stores one response (JSON body, de-duped by id)
// GET  /api/collect?token=...  -> returns {responses:[...]} for analyze.html
// Token: set COLLECT_TOKEN in Netlify env (Site settings -> Environment variables).
// Until you set it, the default below applies — fine for test data, change for the study.
import { getStore } from '@netlify/blobs';

const DEFAULT_TOKEN = 'blockstream-test';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  const store = getStore('cardsort-responses');

  if (req.method === 'POST') {
    let data;
    try { data = JSON.parse(await req.text()); } catch (e) {
      return Response.json({ ok: false, error: 'bad json' }, { status: 400, headers: CORS });
    }
    if (!data || typeof data.id !== 'string' || !/^r_[a-z0-9]{6,40}$/.test(data.id)) {
      return Response.json({ ok: false, error: 'bad id' }, { status: 400, headers: CORS });
    }
    const body = JSON.stringify(data);
    if (body.length > 100_000) {
      return Response.json({ ok: false, error: 'too large' }, { status: 413, headers: CORS });
    }
    const key = 'r/' + data.id;
    const existing = await store.get(key);
    if (!existing) await store.set(key, body);   // de-dupe by id
    return Response.json({ ok: true }, { headers: CORS });
  }

  if (req.method === 'GET') {
    const token = new URL(req.url).searchParams.get('token');
    if (token !== (process.env.COLLECT_TOKEN || DEFAULT_TOKEN)) {
      return Response.json({ error: 'unauthorized' }, { status: 401, headers: CORS });
    }
    const responses = [];
    const { blobs } = await store.list({ prefix: 'r/' });
    for (const b of blobs) {
      const r = await store.get(b.key, { type: 'json' });
      if (r) responses.push(r);
    }
    return Response.json({ responses }, { headers: CORS });
  }

  return Response.json({ error: 'method not allowed' }, { status: 405, headers: CORS });
};

export const config = { path: '/api/collect' };
