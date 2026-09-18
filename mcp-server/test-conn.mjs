import 'dotenv/config';

const base = (process.env.WP_BASE_URL ?? '').replace(/\/$/, '');
const user = process.env.WP_USER ?? '';
const pass = process.env.WP_APP_PASSWORD ?? '';
const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

function short(t) {
  return typeof t === 'string' ? t.slice(0, 300) : JSON.stringify(t).slice(0, 300);
}

async function hit(label, url, opts = {}) {
  try {
    const res = await fetch(url, opts);
    const body = await res.text();
    console.log(`\n[${label}] ${url}`);
    console.log(`  status: ${res.status} ${res.statusText}`);
    console.log(`  body:   ${short(body)}`);
  } catch (e) {
    console.log(`\n[${label}] ${url}`);
    console.log(`  ERROR:  ${e.message}`);
  }
}

console.log('Base URL:', base, '| user:', user, '| app-pw length:', pass.length);

await hit('1. WP REST reachable', `${base}/wp-json/`);
await hit('2. Plugin + auth', `${base}/wp-json/xmcp/v1/page/0`, {
  headers: { Authorization: auth, 'X-XMCP-Authorization': auth }
});
