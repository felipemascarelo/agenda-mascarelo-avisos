// Alertas de despesa fixa vencida e não paga.
// No dia do vencimento: 08:00, 14:00 e 19:00. Depois: uma vez por dia, às 08:00, até pagar.
export const SLOTS = ['08:00', '14:00', '19:00'];
const p2 = (n) => String(n).padStart(2, '0');
const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ms = (ds) => Date.UTC(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8, 10));

// today: 'AAAA-MM-DD'. dfix: lista de despesas. paid: { 'AAAA-MM|d|id': 1 }.
// Devolve [{ id, t: 'HH:MM', title, body }] para o dia informado.
export function dueAlerts(dfix, paid, today, dpon) {
  const out = [];
  const y = +today.slice(0, 4), mo = +today.slice(5, 7) - 1;
  for (const x of dfix || []) {
    let due = null;
    for (let k = 6; k >= 0; k--) {
      const md = new Date(Date.UTC(y, mo - k, 1));
      const m = `${md.getUTCFullYear()}-${p2(md.getUTCMonth() + 1)}`;
      const last = new Date(Date.UTC(md.getUTCFullYear(), md.getUTCMonth() + 1, 0)).getUTCDate();
      const dd = `${m}-${p2(Math.min(+x.dia || 1, last))}`;
      if (dd > today) continue;
      if (x.id > 1e12 && dd < new Date(x.id - 3 * 36e5).toISOString().slice(0, 10)) continue; // criada depois do vencimento
      if (paid && paid[`${m}|d|${x.id}`]) continue;
      due = dd; break;
    }
    if (!due) continue;
    const late = Math.round((ms(today) - ms(due)) / 864e5), v = brl(x.v), n = x.n;
    if (late === 0) {
      out.push({ id: x.id, k: 'dh', t: SLOTS[0], title: 'Despesa vence hoje', body: `${n} · ${v}` });
      out.push({ id: x.id, k: 'dh', t: SLOTS[1], title: 'Despesa ainda não paga', body: `${n} vence hoje · ${v}` });
      out.push({ id: x.id, k: 'dh', t: SLOTS[2], title: 'Última chamada de hoje', body: `${n} vence hoje e ainda não foi paga · ${v}` });
    } else {
      out.push({ id: x.id, k: 'dv', t: SLOTS[0], title: 'Despesa vencida', body: `${n} venceu dia ${due.slice(8, 10)}/${due.slice(5, 7)} (há ${late === 1 ? '1 dia' : late + ' dias'}) · ${v}` });
    }
  }
  for (const x of dpon || []) {
    if (x.p || !x.d || x.d > today) continue;
    if (x.id > 1e12 && x.d < new Date(x.id - 3 * 36e5).toISOString().slice(0, 10)) continue;
    const late = Math.round((ms(today) - ms(x.d)) / 864e5), v = brl(x.v), n = x.n;
    if (late === 0) {
      out.push({ id: x.id, k: 'dh', t: SLOTS[0], title: 'Despesa vence hoje', body: `${n} · ${v}` });
      out.push({ id: x.id, k: 'dh', t: SLOTS[1], title: 'Despesa ainda não paga', body: `${n} vence hoje · ${v}` });
      out.push({ id: x.id, k: 'dh', t: SLOTS[2], title: 'Última chamada de hoje', body: `${n} vence hoje e ainda não foi paga · ${v}` });
    } else {
      out.push({ id: x.id, k: 'dv', t: SLOTS[0], title: 'Despesa vencida', body: `${n} venceu dia ${x.d.slice(8, 10)}/${x.d.slice(5, 7)} (há ${late === 1 ? '1 dia' : late + ' dias'}) · ${v}` });
    }
  }
  return out;
}
