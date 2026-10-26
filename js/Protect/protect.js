(function () {
  'use strict';

  // ------------------------------------------------------------
  // ALLOWED_HOSTS — DOMAIN ĐƯỢC PHÉP CHẠY GAME
  // ------------------------------------------------------------
  //  ⚠️ CHỈ ghi hostname thuần. KHÔNG có "https://", KHÔNG có "/".
  //     location.hostname trả về dạng "3quoc.netlify.app".
  //     Ghi "https://3quoc.netlify.app/" → domain lock LUÔN FAIL
  //     → game tự blank trên chính domain thật.
  //  • Hỗ trợ subdomain: khai báo 'example.com' là đủ cho
  //    'game.example.com', 'cdn.example.com', ...
  //  • Mảng rỗng [] → domain lock TỰ ĐỘNG BỎ QUA. Tiện khi dev,
  //    nhưng deploy thật BẮT BUỘC phải điền.
  // ------------------------------------------------------------
  const ALLOWED_HOSTS = [
  ];

  // ------------------------------------------------------------
  // DEV_HOSTS — HOST ĐƯỢC COI LÀ "MÔI TRƯỜNG PHÁT TRIỂN"
  // ------------------------------------------------------------
  //  • Khi location.hostname nằm trong danh sách này: domainLock
  //    BỎ QUA (khỏi phải thêm localhost vào ALLOWED_HOSTS).
  //  • '' (chuỗi rỗng) = trường hợp mở file bằng file://.
  // ------------------------------------------------------------
  const DEV_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', ''];

  // ------------------------------------------------------------
  // ENABLE — BẬT / TẮT TỪNG LỚP BẢO VỆ
  // ------------------------------------------------------------
  //  Đặt false để tắt. Gợi ý học: bật từng lớp một để quan sát.
  //  ⚠️  [4], [5], [6] được thiết kế để PHÁ workflow debug —
  //      tắt cả 3 khi đang cần debug.
  // ------------------------------------------------------------
  const ENABLE = {
    // [1] Chụp "dấu vân tay" các hàm native ngay lúc load.
    //     Baseline dùng ở [7] để phát hiện ai đó hook/thay hàm.
    integrityBaseline:  true,

    // [2] Chặn game bị nhúng trong <iframe> của domain khác.
    antiIframe:         true,

    // [3] Chặn game chạy trên domain lạ (chống copy dist/).
    //     Chỉ tác dụng khi ALLOWED_HOSTS không rỗng.
    domainLock:         true,

    // [4] Ghi đè console.* thành no-op → khó debug, khó log biến.
    consoleDisable:     true,

    // [5] Phát hiện devtools đang mở → blank trang (+ redirect).
    //     Hai đường: window size (docked, không pause) + timing (undocked).
    devtoolsDetection:  true,

    // [6] Treo debugger định kỳ → phá step-through.
    //     Lưu ý: nếu CFG.trapAfterBlank = false, trap DỪNG sau khi
    //     blank() chạy → tránh việc user phải F8 nhiều lần và kéo dài
    //     thời gian họ ngồi trong devtools.
    debuggerTrap:       true,

    // [7] Định kỳ so sánh hàm native với baseline ở [1].
    integrityPolling:   true,

    // [8] Chặn phím tắt: F12, Ctrl+Shift+I/J/C, Ctrl+U.
    keyboardBlock:      true,
  };

  // ------------------------------------------------------------
  // CFG — NGƯỠNG & TẦN SUẤT (ms)
  // ------------------------------------------------------------
  const CFG = {
    // [5-fast] Ngưỡng chênh lệch window size (px) để coi là devtools docked.
    //     Chrome/Edge/Firefox docked chiếm ≥ 200px. 160 an toàn cho
    //     tránh false positive khi có sidebar/extension.
    sizeThreshold: 160,

    // [5-fast] Tần suất check window size. Nhỏ = phản ứng nhanh.
    sizeInterval: 500,

    // [5-slow] Ngưỡng thời gian (ms) để coi là devtools đang mở
    //     (dùng cho undocked — không phát hiện được bằng window size).
    //     Quá nhỏ dễ false positive khi máy yếu; quá lớn phản ứng chậm.
    devtoolsThreshold: 100,

    // [5-slow] Tần suất check timing. 1000ms đủ nhanh, không tốn CPU.
    devtoolsInterval: 1000,

    // [6] Tần suất treo debugger. 4000ms đủ khó chịu, không làm chậm game.
    debuggerTrapInterval: 4000,

    // [6] Sau khi blank() có tiếp tục treo debugger không?
    //     • false (KHUYẾN NGHỊ) = DỪNG trap sau blank.
    //       Lý do: trap chỉ có ích khi code game còn chạy. Sau blank,
    //       DOM trống, code không còn gì để "step-through" → trap vô
    //       nghĩa. Tệ hơn: user phải bấm F8 nhiều lần, kéo dài thời
    //       gian họ ngồi trong devtools → NGƯỢC mục đích bảo vệ.
    //     • true = vẫn treo định kỳ (kiểu "hành" — ít hữu ích).
    trapAfterBlank: false,

    // [5] Sau khi blank() có redirect về about:blank không?
    //     • true (KHUYẾN NGHỊ) = redirect → DESTROY trang gốc →
    //       devtools mất ngữ cảnh (URL đổi, code game không còn trong
    //       memory của document mới). Đây là cách DUY NHẤT JS có thể
    //       "đá" user ra khỏi devtools của trang game.
    //     • false = chỉ xoá DOM, giữ URL gốc. User vẫn mở được
    //       Sources/Network của trang game → không thực sự bảo vệ.
    //
    //     ⚠️  Nếu bạn đặt false VÀ trapAfterBlank = false → devtools
    //     vẫn xem được code sau khi blank. Chỉ dùng false khi đang
    //     cần debug hành vi blank.
    redirectAfterBlank: true,

    // [5] Độ trễ (ms) trước khi redirect about:blank sau blank().
    //     • 0    = redirect ngay (user không kịp thấy trang trắng)
    //     • 300  = thấy trắng ~0.3s rồi bị đá (cân bằng)
    //     • 1000 = thấy trắng 1s
    //     Chỉ có tác dụng khi redirectAfterBlank = true.
    redirectDelay: 300,

    // [7] Tần suất kiểm tra integrity. So sánh ~7 hàm native mỗi lần
    //     → cực nhẹ. Giảm xuống 1000ms nếu muốn chặt hơn.
    integrityInterval: 5000,
  };

  const NATIVE_FUNCS = {
    'Function':                    Function,
    'Function.prototype.toString': Function.prototype.toString,
    'JSON.stringify':              JSON.stringify,
    'Array.prototype.push':        Array.prototype.push,
    'Object.defineProperty':       Object.defineProperty,
    'setInterval':                 setInterval,
    'setTimeout':                  setTimeout,
  };

  const baseline = {};
  let isDead = false;

  const blank = function () {
    if (isDead) return;
    isDead = true;
    try { window.__PROTECTION_FAILED__ = true; } catch (_) {}
    try { document.documentElement.innerHTML = ''; } catch (_) {}
    try { document.documentElement.remove && document.documentElement.remove(); } catch (_) {}
    try { document.title = ''; } catch (_) {}
    try { window.stop && window.stop(); } catch (_) {}
    try { window.requestAnimationFrame = function () { return 0; }; } catch (_) {}
    try { window.cancelAnimationFrame = function () {}; } catch (_) {}

    if (CFG.redirectAfterBlank) {
      setTimeout(function () {
        try { location.replace('about:blank'); } catch (_) {}
      }, CFG.redirectDelay);
    }
  };

  const sig = function (fn) {
    return Function.prototype.toString.call(fn).slice(0, 80);
  };

  if (ENABLE.integrityBaseline) {
    for (const k in NATIVE_FUNCS) {
      try { baseline[k] = sig(NATIVE_FUNCS[k]); } catch (_) {}
    }
  }

  if (ENABLE.antiIframe) {
    try {
      if (window.top !== window.self) {
        document.documentElement.style.display = 'none';
        try { window.top.location = window.self.location; }
        catch (_) { blank(); }
      }
    } catch (_) { blank(); }
  }

  if (ENABLE.domainLock && ALLOWED_HOSTS.length) {
    const host = location.hostname;
    const okInDev  = DEV_HOSTS.indexOf(host) >= 0;
    const okInProd = ALLOWED_HOSTS.some(h => host === h || host.endsWith('.' + h));
    if (!okInDev && !okInProd) {
      blank();
      throw new Error('blocked');
    }
  }

  if (ENABLE.consoleDisable) {
    const noop = function () {};
    const methods = [
      'log', 'warn', 'error', 'info', 'debug', 'trace', 'dir', 'table',
      'clear', 'profile', 'profileEnd', 'group', 'groupEnd', 'count',
      'assert', 'time', 'timeEnd',
    ];
    for (let i = 0; i < methods.length; i++) {
      try {
        Object.defineProperty(console, methods[i], {
          value: noop, writable: false, configurable: false,
        });
      } catch (_) {}
    }
  }

  if (ENABLE.devtoolsDetection) {
    setInterval(function () {
      if (isDead) return;
      try {
        const dw = window.outerWidth  - window.innerWidth;
        const dh = window.outerHeight - window.innerHeight;
        if (dw > CFG.sizeThreshold || dh > CFG.sizeThreshold) blank();
      } catch (_) {}
    }, CFG.sizeInterval);

    setInterval(function () {
      if (isDead) return;
      let t0;
      try { t0 = performance.now(); } catch (_) { return; }
      // eslint-disable-next-line no-debugger
      debugger;
      let dt;
      try { dt = performance.now() - t0; } catch (_) { return; }
      if (dt > CFG.devtoolsThreshold) blank();
    }, CFG.devtoolsInterval);
  }

  if (ENABLE.debuggerTrap) {
    try {
      const trap = Function('debugger');
      setInterval(function () {
        if (isDead && !CFG.trapAfterBlank) return;
        trap();
      }, CFG.debuggerTrapInterval);
    } catch (_) {}
  }

  if (ENABLE.integrityPolling) {
    setInterval(function () {
      if (isDead) return;
      for (const k in NATIVE_FUNCS) {
        if (!baseline[k]) continue;
        try {
          if (sig(NATIVE_FUNCS[k]) !== baseline[k]) { blank(); return; }
        } catch (_) { blank(); return; }
      }
    }, CFG.integrityInterval);
  }

    // ============================================================
  // [8] KEYBOARD BLOCK + CONTEXT MENU BLOCK
  // ============================================================
  if (ENABLE.keyboardBlock) {
    document.addEventListener('keydown', function (e) {
      const k    = (e.key || '').toLowerCase();
      const code = e.code || '';
      const mod  = e.ctrlKey || e.metaKey;   // Ctrl (Win/Linux) hoặc Cmd (Mac)
      const blocked =
        k === 'f12' ||
        (mod && e.shiftKey && (
          code === 'KeyI' || code === 'KeyJ' || code === 'KeyC' ||   // Chrome/Edge Inspect/Console/Picker
          code === 'KeyK' || code === 'KeyM' || code === 'KeyE'      // Firefox Console/Responsive/Network
        )) ||
        (mod && (code === 'KeyU' || k === 'u')) ||                   // View-source
        (e.shiftKey && k === 'f10');                                 // Context menu keyboard (Win)
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    document.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }
})();