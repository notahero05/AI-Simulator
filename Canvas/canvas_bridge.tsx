import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, deleteDoc,
  serverTimestamp, onSnapshot, query,
} from 'firebase/firestore';

// ============================================================
// CANVAS BRIDGE — chạy trong Gemini Canvas
// Nhiệm vụ: nhận yêu cầu từ tab game (do Canvas mở) -> gọi Gemini / Firebase
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

// --- URL game: dán vào đây MỘT LẦN, không cần nhập mỗi lần ---
const GAME_URL = 'https://gehihi.pages.dev';

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
  const subsRef = useRef<Map<string, () => void>>(new Map());
  const popupRef = useRef<Window | null>(null);       // tab game mở bằng window.open
  const popupOriginRef = useRef<string>('*');
  const [opened, setOpened] = useState(false);        // đang có tab game mở
  const [connected, setConnected] = useState(false);  // game đã nói chuyện với cầu nối
  const [lastError, setLastError] = useState('');
  const [msg, setMsg] = useState('');

  const reply = useCallback((target: Window, m: any) => {
    // Với tab game, chỉ gửi tới đúng origin đã biết
    const origin = target === popupRef.current ? popupOriginRef.current : '*';
    target.postMessage(m, origin);
  }, []);

  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      // Chỉ nhận tin từ đúng tab game (đúng cửa sổ + đúng origin)
      const fromPopup = !!popupRef.current && e.source === popupRef.current &&
        (popupOriginRef.current === '*' || e.origin === popupOriginRef.current);
      if (!fromPopup) return;
      const m = e.data;
      if (!m || m.__bridge !== 'req') return;
      const target = e.source as Window;
      setConnected(true);
      const { id, op, args = {} } = m;
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
            result = await callGemini(args.model, args.payload);
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
        const em = String(err?.message || err);
        setLastError(em);
        reply(target, { __bridge: 'res', id, ok: false, error: em });
      }
    };
    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
      subsRef.current.forEach((u) => u());
      subsRef.current.clear();
    };
  }, [reply]);

  // Phải gọi trong sự kiện bấm nút (người dùng) để trình duyệt không chặn popup
  const openGame = () => {
    let origin = '*';
    try { origin = new URL(GAME_URL).origin; } catch (_) { setMsg('GAME_URL không hợp lệ.'); return; }
    const w = window.open(GAME_URL, 'ai_game_tab');
    if (!w) { setMsg('Trình duyệt chặn mở tab mới. Hãy cho phép popup rồi bấm lại.'); return; }
    try { w.focus(); } catch (_) {}
    popupRef.current = w;
    popupOriginRef.current = origin;
    setMsg('');
    setConnected(false);
    setOpened(true);
    const timer = setInterval(() => {
      if (!popupRef.current || popupRef.current.closed) {
        clearInterval(timer);
        popupRef.current = null;
        setOpened(false);
        setConnected(false);
      }
    }, 1500);
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-6 p-6 text-center bg-gray-900 text-gray-100">
      {!opened && (
        <button onClick={openGame} className="px-10 py-5 text-2xl font-bold rounded-xl bg-purple-700 hover:bg-purple-600">
          🚀 Mở game
        </button>
      )}
      {msg && <div className="text-yellow-300 text-sm">{msg}</div>}
      <div className="text-sm">
        <span className="font-bold text-purple-300">🌉 Cầu nối</span>{' '}
        <span className={connected ? 'text-green-400' : 'text-yellow-400'}>
          {connected ? '● Đã kết nối' : opened ? '○ Đang chờ game…' : '○ Chưa có game'}
        </span>
      </div>
      {lastError && <div className="text-red-300 text-xs max-w-md">Lỗi gần nhất: {lastError}</div>}
    </div>
  );
};

export default App;