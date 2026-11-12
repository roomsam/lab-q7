// TG Πρόβλεψη · ειδοποίηση Discord για τα ΙΣΧΥΡΑ σήματα του μοντέλου 4H.
// Ίδιος υπολογισμός με τη σελίδα (index.html: load/predict, features.js, ίδιο όριο THRS["4h"]).
// Δεν αλλάζει το μοντέλο· μόνο διαβάζει. Στέλνει ένα μήνυμα ανά κλείσιμο 4ωρου, μόνο αν υπάρχει ισχυρό σήμα.
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const ROOT = path.join(__dirname, "..");
const TGF = require(path.join(ROOT, "features.js")).TGF;
const API = process.env.BINANCE_BASE || "https://www.binance.com";
const HOOK = process.env.DISCORD_WEBHOOK, KEY = process.env.TG_MODEL_KEY, DRY = !!process.env.DRY_RUN;
const STATE = process.env.STATE_FILE || ".notify/model4h.json";
const SYMS = ["AAVEUSDT","ADAUSDT","AVAXUSDT","BCHUSDT","BNBUSDT","BTCUSDT","DOGEUSDT","DOTUSDT","ETHUSDT","HYPEUSDT","LINKUSDT","LTCUSDT","NEARUSDT","PUMPUSDT","RUNEUSDT","SOLUSDT","SUIUSDT","TONUSDT","TRXUSDT","XAUUSDT","XMRUSDT","XRPUSDT","ZECUSDT"];
const TF = "4h", MS = 144e5, THR = 0.628; // = THRS["4h"] στη σελίδα
const MARKET_N = 8; // τόσα ή περισσότερα στην ίδια πλευρά = ένα κοινό σήμα αγοράς

async function j(u) { for (let a = 0; a < 3; a++) { try { const r = await fetch(u, { headers: { "user-agent": "tg-model4h/1" } }); if (r.ok) return await r.json(); if (r.status === 429 || r.status === 418) await new Promise(r => setTimeout(r, 4000)) } catch (e) { } await new Promise(r => setTimeout(r, 800)) } throw new Error("fetch " + u) }
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]) } catch (e) { out[k] = null } } })); return out }
async function klines(s) { const a = await j(`${API}/fapi/v1/klines?symbol=${s}&interval=${TF}&limit=1500`); const now = Date.now(); const b = { t: [], o: [], h: [], l: [], c: [], v: [], ct: [], tbv: [] };
  for (const k of a) { if (+k[6] > now) continue; b.t.push(+k[0]); b.o.push(+k[1]); b.h.push(+k[2]); b.l.push(+k[3]); b.c.push(+k[4]); b.v.push(+k[5]); b.ct.push(+k[6]); b.tbv.push(+k[9]) } return b }
async function funding(s) { const a = await j(`${API}/fapi/v1/fundingRate?symbol=${s}&limit=1000`); return { times: a.map(x => +x.fundingTime), vals: a.map(x => +x.fundingRate) } }
async function oiData(s) { const q = `symbol=${s}&period=4h&limit=500`;
  const [oi, tp, ta, gl] = await Promise.all([j(`${API}/futures/data/openInterestHist?${q}`), j(`${API}/futures/data/topLongShortPositionRatio?${q}`), j(`${API}/futures/data/topLongShortAccountRatio?${q}`), j(`${API}/futures/data/globalLongShortAccountRatio?${q}`)]);
  let tk = []; let end = Date.now(); for (let p = 0; p < 2; p++) { const a = await j(`${API}/futures/data/takerlongshortRatio?symbol=${s}&period=5m&limit=500&endTime=${end}`); if (!a.length) break; tk = a.concat(tk); end = +a[0].timestamp - 1 }
  const m = arr => new Map(arr.map(x => [+x.timestamp, +x.longShortRatio])); const ts = oi.map(x => +x.timestamp); const P = m(tp), A = m(ta), G = m(gl); tk.sort((a, b) => a.timestamp - b.timestamp);
  return { ts, oiv: oi.map(x => +x.sumOpenInterestValue), ttp: ts.map(t => P.get(t) ?? NaN), tta: ts.map(t => A.get(t) ?? NaN), gl: ts.map(t => G.get(t) ?? NaN), tkts: tk.map(x => +x.timestamp), tkv: tk.map(x => +x.buySellRatio) } }
function zvec(M, x) { const ci = M.features.indexOf('sym_id'); const code = M.catmap.indexOf(x[ci] | 0); const z = [code < 0 ? NaN : code]; for (let k = 0; k < x.length; k++)if (k !== ci) z.push(x[k]); return z }
function walk(M, z) { let s = M.base; for (const T of M.trees) { let i = 0; while (!T.leaf[i]) { const v = z[T.f[i]]; let left; if (v === null || v === undefined || Number.isNaN(v)) left = T.ml[i] === 1; else if (T.c[i]) { const c = v | 0, bs = T.bs[T.b[i]]; left = ((bs[c >> 5] >>> (c & 31)) & 1) === 1 } else left = v <= T.t[i]; i = left ? T.l[i] : T.r[i] } s += T.v[i] } return s }
const predict = (M, x) => 1 / (1 + Math.exp(-walk(M, zvec(M, x))));
async function decryptModels(pw) { const enc = JSON.parse(fs.readFileSync(path.join(ROOT, "models.enc"), "utf8")); const b = s => Buffer.from(s, "base64"); const { subtle } = globalThis.crypto;
  const base = await subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  const key = await subtle.deriveKey({ name: "PBKDF2", salt: b(enc.salt), iterations: enc.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const raw = await subtle.decrypt({ name: "AES-GCM", iv: b(enc.iv) }, key, b(enc.data)); return JSON.parse(zlib.gunzipSync(Buffer.from(raw)).toString("utf8")) }

// Ίδιος υπολογισμός με τη load("4h") της σελίδας, για τα δύο τελευταία κλεισμένα κεριά.
async function compute(M) {
  const ks = await pool(SYMS, 6, klines); const fsd = await pool(SYMS, 6, funding); const ois = await pool(SYMS, 3, oiData);
  const needMac = M.features.some(f => f.startsWith("m_")); let MF = null;
  if (needMac) { const js = JSON.parse(fs.readFileSync(path.join(ROOT, "macro.json"), "utf8")); MF = TGF.macroFrame(js.series) }
  const all = {}; let latest = 0; SYMS.forEach((s, i) => { const b = ks[i]; if (b && b.t.length >= 450) latest = Math.max(latest, b.t[b.t.length - 1]) });
  SYMS.forEach((s, i) => { const b = ks[i]; if (!b || b.t.length < 450 || b.t[b.t.length - 1] < latest - MS) return; const X = TGF.symFeatures(b, fsd[i], ois[i], TF); if (MF) TGF.addMacro(X, b, MF); all[s] = { b, X, idx: new Map(b.t.map((t, k) => [t, k])) } });
  if (!all.BTCUSDT) throw new Error("λείπει το BTC");
  const T = all.BTCUSDT.b.t, times = [T[T.length - 2], T[T.length - 1]]; const res = {};
  for (const t of times) { const cr = TGF.crossAt(all, SYMS, t, true); res[t] = {};
    for (const s in cr) { const A = all[s], i = A.idx.get(t); if (i < 420) continue; const atr = A.X._atr[i]; if (!(atr > 0) || !(A.b.v[i] > 0)) continue;
      const p = predict(M, TGF.vector(M, A.X, i, cr[s])); const sg = p >= THR ? 1 : p <= 1 - THR ? -1 : 0; res[t][s] = { s, p, sig: sg, c: A.b.c[i], atr } } }
  return { latest, prev: times[0], res, missing: SYMS.filter(s => !all[s]) };
}
const tA = t => new Date(t).toLocaleString("el-GR", { timeZone: "Europe/Athens", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const hA = t => new Date(t).toLocaleString("el-GR", { timeZone: "Europe/Athens", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function px(x) { const d = x >= 1000 ? 1 : x >= 100 ? 2 : x >= 1 ? 3 : x >= 0.1 ? 4 : 5; return x.toLocaleString("el-GR", { minimumFractionDigits: d, maximumFractionDigits: d }) }
function message(C, M) {
  const L = C.res[C.latest], P = C.res[C.prev] || {}; const close = C.latest + MS, until = close + M.N * MS;
  const sig = Object.values(L).filter(r => r.sig).sort((a, b) => Math.abs(b.p - .5) - Math.abs(a.p - .5)); if (!sig.length) return null;
  const nd = sig.filter(r => r.sig < 0).length, nu = sig.length - nd;
  let m = `📊 **Μοντέλο 4H · ισχυρά σήματα** · κλείσιμο ${tA(close)}\n`;
  m += `${nd ? `🔴 ${nd} SHORT` : ""}${nd && nu ? " · " : ""}${nu ? `🟢 ${nu} LONG` : ""} · ισχύουν έως ${tA(until)} (${M.N} κεριά)\n`;
  if (Math.max(nd, nu) >= MARKET_N) m += `⚠️ ${Math.max(nd, nu)} σύμβολα στην ίδια πλευρά = κυρίως **ένα κοινό σήμα αγοράς**, όχι ${Math.max(nd, nu)} ανεξάρτητα.\n`;
  m += "```\n";
  for (const r of sig) { const pr = P[r.s], cont = pr && pr.sig === r.sig; const tp = r.c + r.sig * M.k * r.atr, sl = r.c - r.sig * M.k * r.atr;
    m += `${r.s.replace("USDT", "").padEnd(5)} ${r.sig > 0 ? "↑" : "↓"} ${r.p.toFixed(2).replace(".", ",")}  ${px(r.c)} → ${px(tp)} / στοπ ${px(sl)}${cont ? "  (συνεχίζει από " + hA(C.prev + MS) + ")" : "  νέο"}\n` }
  m += "```";
  if (C.missing.length) m += `\nΔεν υπολογίστηκαν: ${C.missing.map(s => s.replace("USDT", "")).join(", ")}`;
  m += `\nΠιθ. = πόσο πιστεύει το μοντέλο ότι χτυπιέται πρώτα το άνω επίπεδο (≤ ${(1 - THR).toFixed(2).replace(".", ",")} = ισχυρό short, ≥ ${THR.toFixed(2).replace(".", ",")} = ισχυρό long). Εκπαιδευτικό — όχι επενδυτική συμβουλή.`;
  return m.length > 1950 ? m.slice(0, 1940) + "\n…" : m;
}
async function post(content) { if (DRY) { console.log("DRY>\n" + content); return } const r = await fetch(HOOK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content }) }); if (!r.ok) throw new Error("discord " + r.status) }

(async () => {
  if (!KEY) { console.log("model4h: χωρίς TG_MODEL_KEY, παράλειψη"); return }
  if (!HOOK && !DRY) { console.log("model4h: χωρίς webhook"); return }
  let st = {}; try { st = JSON.parse(fs.readFileSync(STATE, "utf8")) } catch (e) { }
  // Φθηνός έλεγχος: υπάρχει νέο κλεισμένο 4ωρο;
  const k = await j(`${API}/fapi/v1/klines?symbol=BTCUSDT&interval=${TF}&limit=3`); const now = Date.now(); const closed = k.filter(x => +x[6] <= now).map(x => +x[0]); const last = closed[closed.length - 1];
  if (!process.env.FORCE && st.lastBar && last <= st.lastBar) { console.log("model4h: κανένα νέο 4ωρο (" + tA(last + MS) + ")"); return }
  if (now - (last + MS) > 90 * 6e4 && !process.env.FORCE) { st.lastBar = last; fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(st)); console.log("model4h: παλιό κλείσιμο, χωρίς αποστολή"); return }
  const MODELS = await decryptModels(KEY); const M = MODELS[TF];
  const C = await compute(M);
  if (C.latest !== last) { console.log("model4h: τα δεδομένα δεν έχουν ακόμα το νέο κερί"); return }
  const msg = message(C, M);
  const n = Object.values(C.res[C.latest]).filter(r => r.sig).length;
  if (msg) await post(msg);
  st.lastBar = last; st.lastN = n; st.at = now; fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(st));
  console.log("model4h: κλείσιμο " + tA(last + MS) + " · ισχυρά " + n + (msg ? " · στάλθηκε" : ""));
})().catch(e => { console.log("model4h error: " + e.message); process.exitCode = 0 });
