// ============================================================================
// FIREBASE (qua Canvas): cầu nối postMessage + lớp giả lập API Firebase + hàm dữ liệu game
// Nạp SAU canvas-config.js và TRƯỚC 03-app-setup.js / 03-app.js.
// ============================================================================
let appId = "Hầm ngục";
// =====================================================================
// BRIDGE CLIENT (chạy trong HTML) — giao thức postMessage với Canvas
//   HTML  --{__bridge:'req', id, op, args}-->  Canvas (canvas_bridge.tsx)
//   HTML  <--{__bridge:'res', id, ok, result|error}--  Canvas
//   HTML  <--{__bridge:'event', subId, ...}--  Canvas (onSnapshot)
// Các hàm Firestore/Auth bên dưới mô phỏng đúng chữ ký Firebase để
// phần code game không phải sửa.
// =====================================================================
// CANVAS_URL được khai báo trong canvas-config.js (phải nạp trước file này)
const __pending = new Map();
const __subs = new Map();
let __reqSeq = 0;
// Máy chủ bridge: tab Canvas đã mở trang này (window.opener) hoặc Canvas chứa trang này trong iframe (window.parent)
const __host = (window.opener && window.opener !== window) ? window.opener
             : (window.parent !== window ? window.parent : null);
const __inFrame = !!__host;

// Tự chuyển sang Canvas khi mở game trực tiếp (không nằm trong Canvas, không do Canvas mở).
// Muốn chơi độc lập không qua Canvas: thêm ?standalone=1 vào URL game.
if (!__inFrame && CANVAS_URL && !/[?&]standalone=1/.test(location.search)) {
  location.replace(CANVAS_URL);
}

window.addEventListener('message', (e) => {
  if (!__host || e.source !== __host) return;
  const m = e.data;
  if (!m || m.__bridge === undefined) return;
  if (m.__bridge === 'res') {
    const p = __pending.get(m.id);
    if (!p) return;
    __pending.delete(m.id);
    m.ok ? p.resolve(m.result) : p.reject(new Error(m.error || 'Bridge error'));
  } else if (m.__bridge === 'event') {
    const s = __subs.get(m.subId);
    if (!s) return;
    if (m.error) s.onError && s.onError(new Error(m.error));
    else s.onNext(__makeSnapshot(m.docs));
  }
});

function bridgeCall(op, args, timeoutMs = 300000) {
  if (!__inFrame) return Promise.reject(new Error('Chưa kết nối Canvas. Hãy mở game bằng nút \"Mở game\" trong Canvas (đừng mở trực tiếp URL).'));
  return new Promise((resolve, reject) => {
    const id = ++__reqSeq;
    const timer = setTimeout(() => { __pending.delete(id); reject(new Error('Canvas không phản hồi (timeout).')); }, timeoutMs);
    __pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (er) => { clearTimeout(timer); reject(er); },
    });
    __host.postMessage({ __bridge: 'req', id, op, args }, '*');
  });
}

// ---- Timestamp: Canvas gửi {__ts: ms}; ta dựng lại đối tượng có toDate() ----
function __revive(v) {
  if (Array.isArray(v)) return v.map(__revive);
  if (v && typeof v === 'object') {
    if (typeof v.__ts === 'number') { const ms = v.__ts; return { toDate: () => new Date(ms), toMillis: () => ms }; }
    const o = {}; for (const k in v) o[k] = __revive(v[k]); return o;
  }
  return v;
}
function __makeDocSnap(d) {
  const data = d.data === null || d.data === undefined ? undefined : __revive(d.data);
  return { id: d.id, exists: () => data !== undefined, data: () => data };
}
function __makeSnapshot(docs) {
  const arr = (docs || []).map(__makeDocSnap);
  return { docs: arr, empty: arr.length === 0, size: arr.length, forEach: (fn) => arr.forEach(fn) };
}

// ---- Mô phỏng API Firebase ----
const db = { __isBridgeDb: true };
const auth = { __isBridgeAuth: true };
const doc = (_db, path, ...rest) => ({ __type: 'doc', path: [path, ...rest].join('/') });
const collection = (_db, path, ...rest) => ({ __type: 'collection', path: [path, ...rest].join('/') });
const query = (colRef) => colRef;
const serverTimestamp = () => ({ __serverTimestamp: true });
const setDoc = (ref, data, options) => bridgeCall('fs.set', { path: ref.path, data, merge: !!(options && options.merge) });
const getDoc = async (ref) => __makeDocSnap(await bridgeCall('fs.get', { path: ref.path }));
const getDocs = async (ref) => __makeSnapshot(await bridgeCall('fs.list', { path: ref.path }));
const addDoc = async (ref, data) => ({ id: (await bridgeCall('fs.add', { path: ref.path, data })).id });
const deleteDoc = (ref) => bridgeCall('fs.delete', { path: ref.path });
function onSnapshot(ref, onNext, onError) {
  const subId = 'sub-' + (++__reqSeq);
  __subs.set(subId, { onNext, onError });
  bridgeCall('fs.subscribe', { path: ref.path, subId }).catch((err) => onError && onError(err));
  return () => { __subs.delete(subId); bridgeCall('fs.unsubscribe', { subId }).catch(() => {}); };
}
function onAuthStateChanged(_auth, cb) {
  let cancelled = false;
  bridgeCall('auth.init', {}, 60000)
    .then((r) => { if (cancelled) return; if (r && r.appId) appId = r.appId; cb(r && r.uid ? { uid: r.uid } : null); })
    .catch((err) => { console.error('auth.init lỗi:', err); if (!cancelled) cb(null); });
  return () => { cancelled = true; };
}
const signInAnonymously = async () => {};
const signInWithCustomToken = async () => {};

// ---- Gemini: HTML gửi payload, Canvas gọi API (free token) rồi trả kết quả ----
// Trả về đối tượng giống Response của fetch để code gọi cũ dùng nguyên.
async function geminiFetch(model, payload) {
  const r = await bridgeCall('gemini.generate', { model, payload });
  return {
    ok: r.ok,
    status: r.status,
    text: async () => r.body,
    json: async () => JSON.parse(r.body),
  };
}

// ---- Dải trạng thái kết nối Canvas (góc dưới phải) ----
(function () {
  function badge() {
    let b = document.getElementById('__bridge_badge');
    if (!b) {
      b = document.createElement('div'); b.id = '__bridge_badge';
      b.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99998;padding:5px 12px;border-radius:999px;font:12px Arial;color:#fff;opacity:.92';
      b.addEventListener('click', () => {
        if (b.dataset.ok === '1') return;
        if (!CANVAS_URL) { alert('Chưa cấu hình CANVAS_URL trong game.html. Hãy mở Canvas thủ công, rồi bấm "Mở game" trong Canvas.'); return; }
        window.open(CANVAS_URL, 'ai_canvas_tab');
        alert('Đã mở Canvas ở tab khác. Bấm "🚀 Mở game" trong Canvas để kết nối lại (tab game này sẽ được dùng lại).');
      });
      document.body.appendChild(b);
    }
    return b;
  }
  function set(ok, text) {
    const b = badge();
    b.dataset.ok = ok ? '1' : '0';
    b.style.background = ok ? '#15803d' : '#b91c1c';
    b.style.cursor = ok ? 'default' : 'pointer';
    b.textContent = text;
  }
  async function check() {
    if (!__inFrame) { set(false, '✖ Chưa kết nối Canvas — bấm để mở Canvas'); return; }
    try { await bridgeCall('ping', {}, 8000); set(true, '● Canvas đã kết nối'); }
    catch (_) { set(false, '✖ Canvas không phản hồi — bấm để mở Canvas'); }
  }
  // Tab game đặt tên cố định để nút "Mở game ở tab mới" trong Canvas dùng lại đúng tab này
  try { window.name = window.name || 'ai_game_tab'; } catch (_) {}
  window.addEventListener('load', () => { check(); setInterval(check, 15000); });
})();

// ============================================================================
// DỮ LIỆU GAME TRÊN FIREBASE — mọi thao tác Firestore của game nằm ở đây.
// 03-app.js chỉ gọi các hàm fb* bên dưới, không tự dựng đường dẫn/ref nữa.
//   artifacts/{appId}/users/{uid}/games/{gameId}
//     ├─ storyLedger/{turnId}          (từng lượt truyện)
//     └─ memory/currentWorldState      (ảnh chụp trạng thái thế giới)
// ============================================================================
const fbGamesPath = (uid) => `artifacts/${appId}/users/${uid}/games`;

// Tạo game mới. Nếu có nhiều lệnh tạo GIỐNG HỆT NHAU đang chờ phản hồi cùng lúc
// (bấm đúp nút, gọi lặp do cầu nối chậm...) thì dùng chung 1 kết quả, không tạo 2 bản.
const __fbCreating = new Map();
function fbCreateGame(uid, data) {
  const key = uid + '|' + JSON.stringify(data);
  if (__fbCreating.has(key)) return __fbCreating.get(key);
  const p = addDoc(collection(db, fbGamesPath(uid)), data).finally(() => __fbCreating.delete(key));
  __fbCreating.set(key, p);
  return p; // -> { id }
}

// Nghe danh sách game đã lưu. onDocs nhận mảng [{ id, ...dữ liệu }]. Trả về hàm huỷ nghe.
function fbSubscribeGames(uid, onDocs, onError) {
  return onSnapshot(query(collection(db, fbGamesPath(uid))), (snap) => {
    const arr = [];
    snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
    onDocs(arr);
  }, onError);
}

const fbDeleteGame = (uid, gameId) => deleteDoc(doc(db, fbGamesPath(uid), gameId));

// Lưu tiến trình (gộp vào bản cũ)
const fbSaveGame = (uid, gameId, data) =>
  setDoc(doc(db, `${fbGamesPath(uid)}/${gameId}`), data, { merge: true });
const fbSaveWorldState = (uid, gameId, data) =>
  setDoc(doc(db, `${fbGamesPath(uid)}/${gameId}/memory/currentWorldState`), data, { merge: true });

// Một lượt truyện trong storyLedger (merge=true khi chỉ bổ sung/di chuyển dữ liệu cũ)
const fbSaveLedgerTurn = (uid, gameId, turn, merge) =>
  setDoc(doc(db, `${fbGamesPath(uid)}/${gameId}/storyLedger`, turn.id), turn, merge ? { merge: true } : undefined);

// Tải lại
async function fbLoadLedger(uid, gameId) {
  const snap = await getDocs(collection(db, `${fbGamesPath(uid)}/${gameId}/storyLedger`));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function fbLoadWorldState(uid, gameId) {
  const snap = await getDoc(doc(db, `${fbGamesPath(uid)}/${gameId}/memory/currentWorldState`));
  return snap.exists() ? snap.data() : null;
}