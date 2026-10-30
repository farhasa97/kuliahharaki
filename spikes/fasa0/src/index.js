import { sahkanCallback, MEDAN_TRANSAKSI, STATUS } from './bayarcash.js';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/bayarcash/callback' && req.method === 'POST') {
      const data = Object.fromEntries(await req.formData());
      if (!(await sahkanCallback(env.BAYARCASH_SECRET, data, MEDAN_TRANSAKSI))) {
        return new Response('checksum tidak sah', { status: 400 });
      }
      // Fasa 2: cari bayaran ikut order_number, kemas kini hanya jika masih "menunggu".
      return Response.json({ ok: true, order: data.order_number, berjaya: data.status === STATUS.SUCCESS });
    }
    return new Response('kh fasa0 spike');
  },

  async scheduled(event) {
    console.log('cron jalan', new Date(event.scheduledTime).toISOString());
  },
};
