import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, deleteDoc,
  serverTimestamp, onSnapshot, query,
} from 'firebase/firestore';

// ============================================================
// CANVAS BRIDGE — chạy trong Gemini Canvas
// Nhiệm vụ: nhận yêu cầu từ game.html (iframe) -> gọi Gemini / Firebase
// bằng quyền của Canvas (free token) -> gửi kết quả ngược lại.
//
// Giao thức (postMessage):
//   game.html -> bridge : { __bridge:'req',   id, op, args }
//   bridge -> game.html : { __bridge:'res',   id, ok, result | error }
//   bridge -> game.html : { __bridge:'event', subId, docs | error }   (onSnapshot)
// ============================================================

declare const __firebase_config: string | undefined;
declare const __app_id: string | undefined;
declare const __initial_auth_token: string | undefined;

// --- URL game trên Netlify: dán vào đây MỘT LẦN, không cần nhập mỗi lần ---
const GAME_URL = 'https://gehihi.pages.dev/'; // ví dụ: 'https://ten-game.netlify.app'

// --- Cấu hình phía Canvas (chỉ giữ thứ chỉ Canvas mới có) ---
// Model, safetySettings và generationConfig nằm ở js/Config/02-api-config.js (game gửi kèm payload).
const EFFECTIVE_API_KEY = ''; // Canvas proxy: để rỗng

// --- Firebase (do Canvas cấp config) ---
const firebaseConfig =
  typeof __firebase_config !== 'undefined' && __firebase_config
    ? JSON.parse(__firebase_config)
    : { apiKey: 'YOUR_FALLBACK_API_KEY', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' };
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
const APP_ID = typeof __app_id !== 'undefined' && __app_id ? __app_id : 'ai-text-adventure-simulator-vn';

// ---------- (de)serialize: Timestamp <-> {__ts}, {__serverTimestamp} -> serverTimestamp() ----------
const toPlain = (v: any): any => {
  if (Array.isArray(v)) return v.map(toPlain);
  if (v && typeof v === 'object') {
    if (typeof v.toMillis === 'function') return { __ts: v.toMillis() };
    const o: any = {};
    for (const k in v) o[k] = toPlain(v[k]);
    return o;
  }
  return v;
};
const fromPlain = (v: any): any => {
  if (Array.isArray(v)) return v.map(fromPlain);
  if (v && typeof v === 'object') {
    if (v.__serverTimestamp === true) return serverTimestamp();
    const o: any = {};
    for (const k in v) o[k] = fromPlain(v[k]);
    return o;
  }
  return v;
};
const snapDocs = (snap: any) => snap.docs.map((d: any) => ({ id: d.id, data: toPlain(d.data()) }));

// Chỉ cho phép đường dẫn nằm trong dữ liệu của chính người dùng hiện tại
const assertPath = (path: string) => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Chưa đăng nhập Firebase.');
  if (!String(path).startsWith(`artifacts/${APP_ID}/users/${uid}/`)) throw new Error('Đường dẫn không hợp lệ: ' + path);
};

let authReady: Promise<{ uid: string | null; appId: string }> | null = null;
const initAuth = () => {
  if (!authReady) {
    authReady = new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, async (user) => {
        if (user) { unsub(); resolve({ uid: user.uid, appId: APP_ID }); return; }
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
          else await signInAnonymously(auth);
        } catch (e) {
          console.error('Lỗi đăng nhập:', e);
          unsub();
          resolve({ uid: null, appId: APP_ID });
        }
      });
    });
  }
  return authReady;
};

// ---------- Gemini ----------
const callGemini = async (model: string | undefined, payload: any) => {
  if (!model) throw new Error('Game chưa gửi model (kiểm tra GEMINI_MODEL_ID trong 02-api-config.js).');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${EFFECTIVE_API_KEY}`;
  const body = payload;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
};

// ================= Component =================
const App = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const subsRef = useRef<Map<string, () => void>>(new Map());
  const popupRef = useRef<Window | null>(null);       // tab game mở bằng window.open
  const popupOriginRef = useRef<string>('*');
  const [connected, setConnected] = useState(false);
  const [gameUrl, setGameUrl] = useState(GAME_URL);
  const [src, setSrc] = useState<{ kind: 'none' } | { kind: 'url'; value: string } | { kind: 'html'; value: string }>({ kind: 'none' });
  const [urlInput, setUrlInput] = useState('');
  const [stats, setStats] = useState({ calls: 0, lastOp: '-', lastError: '' });
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (line: string) => setLog((l) => [new Date().toLocaleTimeString('vi-VN') + ' ' + line, ...l].slice(0, 30));

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bridge_game_url'); if (saved) { setUrlInput(saved); }
      const savedNet = localStorage.getItem('bridge_netlify_url'); if (savedNet && !GAME_URL) { setGameUrl(savedNet); }
    } catch (_) {}
  }, []);

  const reply = useCallback((target: Window, msg: any) => {
    // Với tab game, chỉ gửi tới đúng origin đã biết
    const origin = target === popupRef.current ? popupOriginRef.current : '*';
    target.postMessage(msg, origin);
  }, []);

  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      // Chỉ nhận tin từ iframe game, hoặc từ đúng tab game (đúng cửa sổ + đúng origin)
      const fromIframe = !!iframeRef.current && e.source === iframeRef.current.contentWindow;
      const fromPopup = !!popupRef.current && e.source === popupRef.current &&
        (popupOriginRef.current === '*' || e.origin === popupOriginRef.current);
      if (!fromIframe && !fromPopup) return;
      const m = e.data;
      if (!m || m.__bridge !== 'req') return;
      const target = e.source as Window;
      if (fromPopup) setConnected(true);
      const { id, op, args = {} } = m;
      setStats((s) => ({ ...s, calls: s.calls + 1, lastOp: op }));
      try {
        let result: any = null;
        switch (op) {
          case 'ping':
            result = { pong: true, t: Date.now() };
            break;
          case 'auth.init':
            result = await initAuth();
            break;
          case 'gemini.generate':
            pushLog(`Gemini → ${args.model || '(thiếu model)'}`);
            result = await callGemini(args.model, args.payload);
            pushLog(`Gemini ← HTTP ${result.status} (${result.body.length} ký tự)`);
            break;
          case 'fs.set':
            assertPath(args.path);
            await setDoc(doc(db, args.path), fromPlain(args.data), args.merge ? { merge: true } : undefined);
            break;
          case 'fs.get': {
            assertPath(args.path);
            const s = await getDoc(doc(db, args.path));
            result = { id: s.id, data: s.exists() ? toPlain(s.data()) : null };
            break;
          }
          case 'fs.list':
            assertPath(args.path + '/');
            result = snapDocs(await getDocs(collection(db, args.path)));
            break;
          case 'fs.add': {
            assertPath(args.path + '/');
            const ref = await addDoc(collection(db, args.path), fromPlain(args.data));
            result = { id: ref.id };
            break;
          }
          case 'fs.delete':
            assertPath(args.path);
            await deleteDoc(doc(db, args.path));
            break;
          case 'fs.subscribe': {
            assertPath(args.path + '/');
            const { subId } = args;
            subsRef.current.get(subId)?.();
            const unsub = onSnapshot(
              query(collection(db, args.path)),
              (snap) => reply(target, { __bridge: 'event', subId, docs: snapDocs(snap) }),
              (err) => reply(target, { __bridge: 'event', subId, error: String(err?.message || err) })
            );
            subsRef.current.set(subId, unsub);
            break;
          }
          case 'fs.unsubscribe':
            subsRef.current.get(args.subId)?.();
            subsRef.current.delete(args.subId);
            break;
          default:
            throw new Error('Op không được hỗ trợ: ' + op);
        }
        reply(target, { __bridge: 'res', id, ok: true, result });
      } catch (err: any) {
        const msg = String(err?.message || err);
        setStats((s) => ({ ...s, lastError: msg }));
        pushLog(`LỖI ${op}: ${msg}`);
        reply(target, { __bridge: 'res', id, ok: false, error: msg });
      }
    };
    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
      subsRef.current.forEach((u) => u());
      subsRef.current.clear();
    };
  }, [reply]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setSrc({ kind: 'html', value: String(r.result || '') });
    r.readAsText(f);
    e.target.value = '';
  };
  const openGameTab = () => {
    const v = gameUrl.trim();
    if (!v) { pushLog('Hãy nhập URL Netlify của game trước.'); return; }
    let origin = '*';
    try { origin = new URL(v).origin; } catch (_) { pushLog('URL không hợp lệ.'); return; }
    try { localStorage.setItem('bridge_netlify_url', v); } catch (_) {}
    // Phải gọi trong sự kiện bấm nút (người dùng) để trình duyệt không chặn popup
    const w = window.open(v, 'ai_game_tab');
    if (!w) { pushLog('Trình duyệt/Canvas chặn mở tab mới. Cho phép popup rồi bấm lại.'); return; }
    popupRef.current = w;
    popupOriginRef.current = origin;
    setConnected(false);
    pushLog('Đã mở tab game: ' + origin + ' — đang chờ game kết nối…');
    const timer = setInterval(() => {
      if (!popupRef.current || popupRef.current.closed) { clearInterval(timer); setConnected(false); pushLog('Tab game đã đóng.'); popupRef.current = null; }
    }, 1500);
  };
  const onLoadUrl = () => {
    const v = urlInput.trim();
    if (!v) return;
    try { localStorage.setItem('bridge_game_url', v); } catch (_) {}
    setSrc({ kind: 'url', value: v });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100 text-sm">
      <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-800 border-b border-gray-700">
        <span className="font-bold text-purple-300">🌉 Canvas Bridge</span>
        <label className="px-2 py-1 bg-sky-700 hover:bg-sky-600 rounded cursor-pointer">
          📂 Chọn game.html
          <input type="file" accept=".html,text/html" className="hidden" onChange={onPickFile} />
        </label>
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="hoặc dán URL nơi host game.html (https://...)"
          className="flex-1 min-w-[200px] px-2 py-1 bg-gray-700 border border-gray-600 rounded"
        />
        <button onClick={onLoadUrl} className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded">Tải URL</button>
        <span className="w-full border-t border-gray-700 my-1" />
        <input
          value={gameUrl}
          onChange={(e) => setGameUrl(e.target.value)}
          placeholder="URL game trên Netlify (https://ten-game.netlify.app)"
          className="flex-1 min-w-[220px] px-2 py-1 bg-gray-700 border border-gray-600 rounded"
        />
        <button onClick={openGameTab} className="px-2 py-1 bg-purple-700 hover:bg-purple-600 rounded">🚀 Mở game ở tab mới</button>
        <span className={connected ? 'text-green-400 text-xs' : 'text-yellow-400 text-xs'}>{connected ? '● Tab game đã kết nối' : '○ Chưa có tab game'}</span>
        <span className="text-xs text-gray-400">Số lệnh: {stats.calls} · Gần nhất: {stats.lastOp}</span>
      </div>
      {stats.lastError && <div className="px-2 py-1 bg-red-900/60 text-red-200 text-xs">Lỗi gần nhất: {stats.lastError}</div>}
      <div className="flex-1 relative">
        {src.kind === 'none' ? (
          <div className="h-full flex items-center justify-center text-gray-400 p-6 text-center">
            Nhập URL Netlify rồi bấm "Mở game ở tab mới" để chơi ở tab riêng (giữ tab Canvas này mở).
            Hoặc chọn file game.html để chơi ngay trong khung này. Mọi cuộc gọi Gemini/Firebase đều đi qua Canvas.
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            title="game"
            className="w-full h-full border-0 bg-gray-900"
            sandbox="allow-scripts allow-same-origin allow-modals allow-downloads allow-forms"
            {...(src.kind === 'url' ? { src: src.value } : { srcDoc: src.value })}
          />
        )}
      </div>
      <details className="bg-gray-800 border-t border-gray-700 text-xs">
        <summary className="px-2 py-1 cursor-pointer text-gray-400">Nhật ký bridge ({log.length})</summary>
        <div className="max-h-32 overflow-y-auto px-2 pb-2 font-mono text-gray-300">{log.map((l, i) => <div key={i}>{l}</div>)}</div>
      </details>
    </div>
  );
};

export default App;