// Envia os avisos dos Lembretes do Dia. Roda a cada 5 minutos pelo GitHub Actions.
// Não guarda nenhum dado neste repositório: lê e escreve só no seu Firebase.
import admin from 'firebase-admin';
import webpush from 'web-push';
import { dueAlerts } from './due.mjs';

const teste = process.argv.includes('--teste');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://github.com/', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
const db = admin.firestore();

const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
const g = (t) => parts.find((p) => p.type === t).value;
const today = `${g('year')}-${g('month')}-${g('day')}`;
const nowMin = +g('hour') * 60 + +g('minute');
const toMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const read = async (ref) => { const s = await ref.get(); if (!s.exists) return null; try { return JSON.parse(s.data().j); } catch { return null; } };

let sentTotal = 0;
for (const u of await db.collection('users').listDocuments()) {
  let devices = (await read(u.collection('push').doc('devices'))) || [];
  if (!devices.length) continue;
  const send = async (payload) => {
    let ok = 0;
    for (const d of [...devices]) {
      try { await webpush.sendNotification(d, JSON.stringify(payload), { TTL: 3600, urgency: 'high' }); ok++; }
      catch (e) { if (e.statusCode === 404 || e.statusCode === 410) devices = devices.filter((x) => x.endpoint !== d.endpoint); else console.error('Falha ao enviar:', e.statusCode || e.message); }
    }
    return ok;
  };
  if (teste) {
    await send({ title: 'Teste de aviso', body: 'Se você está vendo isto, os avisos estão funcionando.', tag: 'teste', url: './' });
    await u.collection('push').doc('devices').set({ j: JSON.stringify(devices) });
    continue;
  }
  const month = await read(u.collection('rdays').doc(today.slice(0, 7)));
  const items = (month && month[today]) || [];
  const sentRef = u.collection('push').doc('sent');
  const sent = (await read(sentRef)) || {};
  let changed = false;
  const np = ((await read(u.collection('app').doc('core'))) || {}).np || {};
  const on = (k) => np[k] !== 0;
  for (const it of on('lem') ? items : []) {
    if (!it.notif || it.dn || !/^\d\d:\d\d$/.test(it.notif)) continue;
    const key = `${today}|${it.id}|${it.notif}`;
    const diff = nowMin - toMin(it.notif);
    if (sent[key] || diff < 0 || diff > 240) continue;
    const ok = await send({ title: (it.urg ? '⚠ Urgente: ' : '') + it.tx, body: it.desc || (it.tm ? 'Às ' + it.tm : 'Lembrete do dia'), tag: String(it.id), url: './' });
    if (ok) { sent[key] = 1; changed = true; sentTotal++; }
  }
  // Despesas fixas vencidas e não pagas
  const core = (await read(u.collection('app').doc('core'))) || {};
  for (const a of dueAlerts(core.dfix, core.paid, today)) {
    if (!on(a.k)) continue;
    const key = `d|${today}|${a.id}|${a.t}`;
    const diff = nowMin - toMin(a.t);
    if (sent[key] || diff < 0 || diff > 240) continue;
    const ok = await send({ title: a.title, body: a.body, tag: 'd' + a.id, url: './' });
    if (ok) { sent[key] = 1; changed = true; sentTotal++; }
  }
  const limit = new Date(Date.now() - 4 * 864e5).toISOString().slice(0, 10);
  for (const k of Object.keys(sent)) if (k.slice(0, 10) < limit) { delete sent[k]; changed = true; }
  if (changed) await sentRef.set({ j: JSON.stringify(sent) });
  await u.collection('push').doc('devices').set({ j: JSON.stringify(devices) });
}
console.log(`Concluído. Avisos enviados: ${sentTotal}`);
