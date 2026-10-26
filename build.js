const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

(function suppressObfuscatorBanner() {
  const orig = {
    log:  console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
  };
  const isBanner = (args) =>
    args.some(a => typeof a === 'string' && a.includes('[javascript-obfuscator]'));
  ['log', 'info', 'warn'].forEach(m => {
    console[m] = function (...args) {
      if (isBanner(args)) return;
      return orig[m](...args);
    };
  });
})();

const { minify } = require('terser');
const JavaScriptObfuscator = require('javascript-obfuscator');
const CleanCSS = require('clean-css');
const { minify: minifyHtml } = require('html-minifier-terser');

// ================== CÀI ĐẶT ==================
const MODE = 2;
// 1 = gộp 1 file, chỉ đổi tên biến, KHÔNG tối ưu code
// 2 = giữ nhiều file, mỗi file nén riêng (FPS tốt nhất — dùng cho production)
// 3 = gộp 1 file, nén đầy đủ (bảo mật cao hơn nhưng giảm FPS do renameGlobals)

const RENAME_FILES = true;
// true  = đổi tên file (mode 2: f01.js, f02.js... trong thư mục j/)
// false = giữ tên file gốc (mode 2: js/Config/unit.js...)

const USE_LOADER = true;
// true  = index.html chỉ có 1 thẻ script, các file khác được nạp tự động (chỉ MODE 2)
// false = index.html liệt kê từng thẻ script

const OBFUSCATE = true;
// true  = nén + mã hóa tên hàm/biến/chuỗi
// false = chỉ nén (dùng khi debug local)

const PROTECT_BASENAME = 'protect.js';
// Tên file bảo vệ (dùng cho báo cáo trạng thái)
// Tự khớp dù file ở 'protect.js', 'js/protect.js', 'src/protect.js', ...

const MINIFY_CSS = true;
// true  = nén CSS bằng clean-css
// false = copy nguyên file CSS

const MINIFY_HTML = true;
// true  = nén HTML (bỏ whitespace, comment, attribute thừa)
// false = giữ nguyên HTML

const REMOVE_ATTR_QUOTES = false;
// Chỉ tác dụng khi MINIFY_HTML = true.
// true  = xoá dấu nháy quanh giá trị attribute khi không cần
// false = giữ nguyên quotes (an toàn hơn với framework)

const FAVICON_SRC = 'assets/logo-32.png';
// File icon nguồn copy thành 'dist/favicon.ico' ở root.
// Trình duyệt luôn request /favicon.ico ngầm → thiếu file này gây delay icon Netlify.
// Để '' để tắt.

// ------------------------------------------------------------
// HEAVY OBFUSCATION — CFF + DEADCODE + STRING ARRAY NÂNG CAO
// ------------------------------------------------------------
// CHỈ áp dụng cho file KHÔNG chạy trong hot loop (mỗi frame).
// An toàn: Config load 1 lần, Wiki chỉ mở khi bấm nút.
// ⚠️ KHÔNG thêm file Battle/, Render/, Random/, game.js vào đây —
//    chúng chạy mỗi frame, heavy obf sẽ giết FPS.
// ⚠️ Chỉ có tác dụng ở MODE 2 (MODE 3 gộp 1 file, không tách được).
// ⚠️ Test kỹ sau build — CFF đôi khi gây bug tinh vi với vòng lặp phức tạp.
const HEAVY_OBF_PATHS = [
  'js/Config/02-api-config.js',
];
// Ngưỡng áp dụng cho heavy files:
// • HEAVY_CFF_THRESHOLD (controlFlowFlattening):
//     0.4 = nhẹ (biến ~40% if/else thành while+switch)
//     0.6 = vừa (khuyến nghị — đủ rối, ít bug)
//     0.75 = mạnh (mức thư viện khuyến nghị, nhiều bug hơn)
// • HEAVY_DEADCODE_THRESHOLD (deadCodeInjection):
//     0.2 = nhẹ (chèn ~20% code chết)
//     0.3 = vừa (khuyến nghị — làm rối mà không phình quá)
//     0.4 = mạnh (mức thư viện default, size tăng đáng kể)
const HEAVY_CFF_THRESHOLD = 0.6;
const HEAVY_DEADCODE_THRESHOLD = 0.3;

// Các option nặng khác chỉ bật khi heavy = true (xem obf() bên dưới).
// Đây là những kỹ thuật mạnh nhưng chậm runtime — không ảnh hưởng FPS
// game vì cold path chỉ chạy 1 lần lúc load.
// ==============================================

const normalizeSrc = (s) => s.replace(/^\.\//, '');
const isHeavyObf = (src) => HEAVY_OBF_PATHS.includes(normalizeSrc(src));

const obf = (code, i, heavy = false) => !OBFUSCATE ? code : JavaScriptObfuscator.obfuscate(code, {
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
  identifiersPrefix: 'f' + i,
  renameGlobals: MODE !== 2,   // MODE 2 nhiều file share biến global → không rename

  // --- String array cơ bản (mọi file) ---
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: heavy ? 1 : 0.75,   // heavy: mã hoá 100% string
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayIndexShift: true,              // rẻ, giữ nguyên cho mọi file
  unicodeEscapeSequence: false,

  // --- Heavy: CFF + deadcode ---
  controlFlowFlattening: heavy,
  controlFlowFlatteningThreshold: heavy ? HEAVY_CFF_THRESHOLD : 0,
  deadCodeInjection: heavy,
  deadCodeInjectionThreshold: heavy ? HEAVY_DEADCODE_THRESHOLD : 0,

  // --- Heavy: string array nâng cao (làm chậm runtime, chỉ dùng cold path) ---
  stringArrayWrappersType: heavy ? 'function' : 'variable',
  stringArrayWrappersCount: heavy ? 5 : 1,
  stringArrayWrappersChainedCalls: heavy,   // chain wrapper → cực khó trace
  stringArrayCallsTransform: heavy,         // wrap lời gọi string array
  splitStrings: heavy,                      // chia nhỏ string literal
  splitStringsChunkLength: heavy ? 5 : 10,
  transformObjectKeys: heavy,               // object key → string array call
  numbersToExpressions: heavy,              // số → biểu thức toán học

  // --- Luôn tắt (rủi ro cao, bypass dễ, không đáng) ---
  selfDefending: false,       // crash khi format/antivirus, bypass dễ
  debugProtection: false,     // trùng với [6] debuggerTrap trong protect.js
}).getObfuscatedCode();

// ================== BÁO CÁO TRẠNG THÁI BẢO VỆ ==================
function findProtectSrc(srcs) {
  const re = new RegExp('(^|/)' + PROTECT_BASENAME.replace('.', '\\.') + '$');
  return srcs.find(s => re.test(s)) || null;
}

function readProtectionStatus(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { exists: false };
  const src = fs.readFileSync(filePath, 'utf8');
  const m = src.match(/const\s+ENABLE\s*=\s*\{([\s\S]*?)\};/);
  if (!m) return { exists: true, parsed: false, path: filePath };
  const items = [];
  const re = /(\w+)\s*:\s*(true|false)/g;
  let mm;
  while ((mm = re.exec(m[1]))) items.push({ name: mm[1], enabled: mm[2] === 'true' });
  return { exists: true, parsed: true, items, path: filePath };
}

function printReport(srcs) {
  const p  = findProtectSrc(srcs);
  const st = readProtectionStatus(p);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║          BÁO CÁO TRẠNG THÁI BẢO VỆ                   ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  if (!p) {
    console.log('  ⚠️  Không thấy ' + PROTECT_BASENAME + ' trong danh sách <script src>');
  } else {
    console.log('  📄 File     : ' + p);
    if (!st.exists) {
      console.log('  ⚠️  File không tồn tại trên đĩa');
    } else if (!st.parsed) {
      console.log('  ⚠️  Không đọc được khối "const ENABLE = { ... }" trong file');
    } else {
      const on  = st.items.filter(x => x.enabled);
      const off = st.items.filter(x => !x.enabled);
      console.log(`  ✅ Đã bật (${on.length}/${st.items.length}):`);
      on.length ? on.forEach(x => console.log('     ✓ ' + x.name)) : console.log('     (không có)');
      console.log(`  ❌ Đã tắt (${off.length}/${st.items.length}):`);
      off.length ? off.forEach(x => console.log('     ✗ ' + x.name)) : console.log('     (không có)');
    }
  }

  // ---- Heavy obf report ----
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║          HEAVY OBFUSCATION (COLD PATH)               ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  if (MODE !== 2) {
    console.log('  ⚠️  MODE = ' + MODE + ' → heavy obf BỊ BỎ QUA (chỉ áp dụng MODE 2)');
    return;
  }

  console.log(`  CFF threshold       : ${HEAVY_CFF_THRESHOLD}`);
  console.log(`  Deadcode threshold  : ${HEAVY_DEADCODE_THRESHOLD}`);
  console.log('  Extra techniques    : wrappers chained, splitStrings, transformObjectKeys,');
  console.log('                        numbersToExpressions, stringArrayCallsTransform');
  console.log(`  Files (${HEAVY_OBF_PATHS.length}):`);
  HEAVY_OBF_PATHS.forEach(f => {
    const found = srcs.some(s => normalizeSrc(s) === f);
    console.log('     ' + (found ? '✓' : '✗ (không có trong index.html)') + ' ' + f);
  });
}

// ================== HELPERS ==================
function dirSize(dir) {
  let total = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else total += fs.statSync(p).size;
    }
  };
  try { walk(dir); } catch (_) {}
  return total;
}

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function copyDir(srcDir, dstDir, { minifyCss = false } = {}) {
  fs.mkdirSync(dstDir, { recursive: true });
  const cleaner = minifyCss ? new CleanCSS({ level: 2 }) : null;
  const walk = (src, dst) => {
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, e.name);
      const d = path.join(dst, e.name);
      if (e.isDirectory()) {
        fs.mkdirSync(d, { recursive: true });
        walk(s, d);
      } else if (minifyCss && e.name.endsWith('.css')) {
        const out = cleaner.minify(fs.readFileSync(s, 'utf8'));
        if (out.errors.length) throw new Error(s + ': ' + out.errors.join('; '));
        fs.writeFileSync(d, out.styles);
      } else {
        fs.copyFileSync(s, d);
      }
    }
  };
  walk(srcDir, dstDir);
}

// ================== BUILD ==================
(async () => {
  if (!fs.existsSync('index.html')) throw new Error('Không tìm thấy index.html');
  const html = fs.readFileSync('index.html', 'utf8');

  const SCRIPT_RE = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/g;
  const srcs = [...html.matchAll(SCRIPT_RE)].map(m => m[1]);
  if (!srcs.length) throw new Error('Không tìm thấy thẻ <script src=...> trong index.html');

  const missing = srcs.filter(s => !fs.existsSync(s));
  if (missing.length) {
    console.error('\n❌ Thiếu file nguồn (có trong index.html nhưng không tồn tại):');
    missing.forEach(f => console.error('   - ' + f));
    throw new Error('Dừng build');
  }

  const withAttrs = [...html.matchAll(/<script\b([^>]*\bsrc=["'][^"']+["'][^>]*)><\/script>/g)]
    .filter(m => /\b(defer|async|type\s*=)/.test(m[1]));
  if (withAttrs.length && MODE !== 2) {
    console.warn('\n⚠️  Có thẻ <script> mang thuộc tính (defer/async/type). Ở MODE ' + MODE + ' các thuộc tính này bị bỏ.');
  }

  const opts = MODE === 1
    ? { compress: false, mangle: true, format: { comments: false } }
    : { compress: true,  mangle: true, format: { comments: false } };

  fs.rmSync('dist', { recursive: true, force: true });
  fs.mkdirSync('dist', { recursive: true });

  const write = (rel, content) => {
    const dest = path.join('dist', rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
  };

  let tags = '';

  if (MODE === 2) {
    const minified = await Promise.all(srcs.map(async (s) => {
      const r = await minify(fs.readFileSync(s, 'utf8'), opts);
      if (r.error) throw new Error(s + ': ' + r.error.message);
      return r.code;
    }));

    const names = [];
    for (let i = 0; i < minified.length; i++) {
      const name = RENAME_FILES
        ? './j/f' + String(i + 1).padStart(2, '0') + '.js'
        : (srcs[i].startsWith('./') ? srcs[i] : './' + srcs[i]);
      const heavy = isHeavyObf(srcs[i]);
      write(name, obf(minified[i], i, heavy));
      names.push(name);
    }

    if (USE_LOADER) {
      const loader = '(function(){' + JSON.stringify(names) +
        '.forEach(function(s){var e=document.createElement("script");' +
        'e.src=s;e.async=false;document.body.appendChild(e)})})();';
      const loaderName = RENAME_FILES ? './j/l.js' : './l.js';
      write(loaderName, loader);
      tags = '<script src="' + loaderName + '"></script>';
    } else {
      tags = names.map(n => '<script src="' + n + '"></script>').join('\n');
    }
  } else {
    let code = '';
    for (const s of srcs) code += fs.readFileSync(s, 'utf8') + '\n;\n';
    const r = await minify(code, opts);
    if (r.error) throw r.error;
    const name = RENAME_FILES
      ? 'g-' + crypto.createHash('md5').update(r.code).digest('hex').slice(0, 8) + '.js'
      : 'game.js';
    write('./' + name, obf(r.code, 0, false));  // MODE 3 không heavy
    tags = '<script src="./' + name + '"></script>';
  }

  let out = html
    .replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*><\/script>[^\n]*\n?/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  if (!out.includes('</body>')) {
    console.warn('\n⚠️  index.html không có </body>, chèn tag script vào cuối.');
    out = out + '\n' + tags;
  } else {
    out = out.replace('</body>', tags + '\n</body>');
  }

  if (MINIFY_HTML) {
    out = await minifyHtml(out, {
      collapseWhitespace: true,
      removeComments: true,
      removeRedundantAttributes: true,
      removeEmptyAttributes: true,
      minifyCSS: false,
      minifyJS: false,
      removeAttributeQuotes: REMOVE_ATTR_QUOTES,
    });
  }
  fs.writeFileSync('dist/index.html', out);

  if (fs.existsSync('css')) {
    copyDir('css', 'dist/css', { minifyCss: MINIFY_CSS });
  } else console.warn('\n⚠️  Không có thư mục css/');

  if (fs.existsSync('assets')) fs.cpSync('assets', 'dist/assets', { recursive: true });
  else console.warn('\n⚠️  Không có thư mục assets/');

  if (FAVICON_SRC) {
    if (fs.existsSync(FAVICON_SRC)) {
      fs.copyFileSync(FAVICON_SRC, 'dist/favicon.ico');
    } else {
      console.warn('\n⚠️  Không tìm thấy ' + FAVICON_SRC + ' → bỏ qua favicon.ico');
    }
  }

  console.log('\nXong! MODE =', MODE, '| RENAME_FILES =', RENAME_FILES,
    '| USE_LOADER =', USE_LOADER, '|', srcs.length, 'file nguon |',
    'dist =', fmtBytes(dirSize('dist')));

  printReport(srcs);
})();