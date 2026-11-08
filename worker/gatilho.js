// Gatilho dos avisos: o agendador do GitHub atrasa/pula execuções, então este Worker
// (Cloudflare, pontual) dispara o fluxo "Avisos dos lembretes" a cada 5 minutos.
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(disparar(env));
  },
  async fetch(req, env) { // abrir o endereço do Worker faz um disparo de teste
    const r = await disparar(env);
    return new Response(r, { status: 200 });
  },
};
async function disparar(env) {
  const r = await fetch('https://api.github.com/repos/felipemascarelo/agenda-mascarelo-avisos/actions/workflows/avisos.yml/dispatches', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.GH_TOKEN,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'avisos-gatilho',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref: 'main' }),
  });
  return r.status === 204 ? 'ok' : 'erro ' + r.status;
}
