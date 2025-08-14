(() => {
  // Elements
  const modeSelect = document.getElementById('modeSelect');
  const sampleBtn = document.getElementById('sampleBtn');
  const clearBtn = document.getElementById('clearBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const runBtn = document.getElementById('runBtn');
  const themeSwitch = document.getElementById('themeSwitch');
  const statusEl = document.getElementById('status');
  const preview = document.getElementById('preview');
  const consoleEl = document.getElementById('console');

  const singleWrap = document.getElementById('singleWrap');
  const splitWrap = document.getElementById('splitWrap');

  const singleHtml = document.getElementById('singleHtml');
  const htmlCode = document.getElementById('htmlCode');
  const cssCode = document.getElementById('cssCode');
  const jsCode = document.getElementById('jsCode');

  const tabs = Array.from(document.querySelectorAll('.tab'));

  // Layout split drag
  const gutter = document.getElementById('gutter');
  const layout = document.getElementById('layout');
  const leftPane = document.getElementById('leftPane');

  // LocalStorage keys
  const LS = {
    mode: 'vw_mode',
    single: 'vw_single',
    html: 'vw_html',
    css: 'vw_css',
    js: 'vw_js',
    theme: 'vw_theme',
    leftw: 'vw_left_width'
  };

  // Helpers
  const debounce = (fn, ms = 400) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  function setStatus(txt) { statusEl.textContent = txt; }

  function clearConsole() { consoleEl.innerHTML = ''; }
  function pushLog(type, parts) {
    const div = document.createElement('div');
    div.className = 'log ' + (type === 'error' ? 'err' : 'ok');
    const time = new Date().toLocaleTimeString();
    div.textContent = `[${time}] ${type.toUpperCase()}: ${(parts || []).join(' ')}`;
    consoleEl.appendChild(div);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  // Capture messages from iframe
  window.addEventListener('message', (e) => {
    if (!e.data || !e.data.__vw) return;
    pushLog(e.data.type, e.data.args);
  });

  // Tabs in split mode
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.dataset.tab;
    htmlCode.style.display = tab === 'html' ? 'block' : 'none';
    cssCode.style.display  = tab === 'css'  ? 'block' : 'none';
    jsCode.style.display   = tab === 'js'   ? 'block' : 'none';
  }));

  // Theme
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeSwitch.checked = (theme === 'light'); // switch ON -> light
    localStorage.setItem(LS.theme, theme);
  }
  themeSwitch.addEventListener('change', () => {
    applyTheme(themeSwitch.checked ? 'light' : 'dark');
  });

  // Mode UI
  function setModeUI() {
    const m = modeSelect.value;
    singleWrap.style.display = (m === 'single') ? 'block' : 'none';
    splitWrap.style.display  = (m === 'split')  ? 'block' : 'none';
    localStorage.setItem(LS.mode, m);
  }
  modeSelect.addEventListener('change', () => { setModeUI(); render(); });

  // Compose preview document
  function bootScript() {
    return `
<script>
(function(){
  const send=(type,args)=>parent.postMessage({__vw:true,type,args:[].slice.call(args).map(String)},'*');
  ['log','info','warn','error'].forEach(k=>{
    const orig=console[k];
    console[k]=function(){ send(k, arguments); orig.apply(console, arguments); }
  });
  window.addEventListener('error', e => send('error', [ (e.message||'Error') + ' @ ' + (e.filename||'') + ':' + (e.lineno||'') ]));
  window.addEventListener('unhandledrejection', e => send('error', ['Unhandled: ' + (e.reason && (e.reason.message||e.reason)) ]));
}());
<\/script>`;
  }

  function composeSplit() {
    const html = htmlCode.value || `<main style="padding:24px"><h2>Hello 👋</h2></main>`;
    const css  = `<style>${cssCode.value || ''}</style>`;
    const js   = `
<script>
try {
${jsCode.value || ''}
} catch(err){ console.error(err); }
<\/script>`;
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${bootScript()}
${css}
</head>
<body>
${html}
${js}
</body>
</html>`;
  }

  function ensureHtmlDoc(s) {
    // If user provided a full doc, keep it. Else wrap inside a minimal document.
    const looksFull = /<html[\s>]/i.test(s) || /<!doctype/i.test(s);
    if (looksFull) return s;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${bootScript()}</head><body>${s}</body></html>`;
  }

  function injectBoot(doc) {
    if (/<head[^>]*>/i.test(doc)) {
      return doc.replace(/<head([^>]*)>/i, '<head$1>' + bootScript());
    }
    // Fallback: prepend head
    return `<!doctype html><html><head><meta charset="utf-8">${bootScript()}</head><body>${doc}</body></html>`;
  }

  function composeSingle() {
    const raw = singleHtml.value || '<div style="padding:24px"><h2>Empty</h2></div>';
    const doc = ensureHtmlDoc(raw);
    return injectBoot(doc);
  }

  function buildDoc() {
    return (modeSelect.value === 'split') ? composeSplit() : composeSingle();
  }

  // Render into iframe
  function render() {
    setStatus('Rendering…');
    clearConsole();
    preview.srcdoc = buildDoc();
    setStatus('Rendered ✓');
    saveState();
  }
  const renderDebounced = debounce(render, 500);

  // Persist
  function saveState() {
    localStorage.setItem(LS.single, singleHtml.value);
    localStorage.setItem(LS.html, htmlCode.value);
    localStorage.setItem(LS.css, cssCode.value);
    localStorage.setItem(LS.js, jsCode.value);
  }
  function loadState() {
    // theme
    const t = localStorage.getItem(LS.theme) || 'dark';
    applyTheme(t);
    // mode
    const m = localStorage.getItem(LS.mode) || 'split';
    modeSelect.value = m;
    setModeUI();
    // editors
    const sm = localStorage.getItem(LS.single);
    const hm = localStorage.getItem(LS.html);
    const cm = localStorage.getItem(LS.css);
    const jm = localStorage.getItem(LS.js);
    if (sm !== null) singleHtml.value = sm;
    if (hm !== null) htmlCode.value = hm;
    if (cm !== null) cssCode.value = cm;
    if (jm !== null) jsCode.value = jm;

    // left pane width
    const leftw = parseInt(localStorage.getItem(LS.leftw) || '0', 10);
    if (leftw > 180) {
      layout.style.gridTemplateColumns = `${leftw}px 8px 1fr`;
    }
  }

  // Buttons
  sampleBtn.addEventListener('click', () => {
    if (modeSelect.value === 'split') {
      htmlCode.value = `<main style="padding:24px; max-width: 720px; margin:auto">
  <h1 id="title">Counter Demo</h1>
  <p>Click the button to increase the count.</p>
  <button id="btn" class="button">Count: <span id="n">0</span></button>
</main>`;
      cssCode.value = `:root { font-family: system-ui, -apple-system, Segoe UI, Roboto; }
main { display: grid; gap: 12px; }
.button { padding: 10px 14px; border-radius: 12px; border: 1px solid #ccc; cursor: pointer; }
.button:hover { transform: translateY(-1px); }`;
      jsCode.value = `const n = document.getElementById('n');
document.getElementById('btn').addEventListener('click', () => {
  n.textContent = String(1 + Number(n.textContent || 0));
  console.log('Clicked, count =', n.textContent);
});`;
    } else {
      singleHtml.value = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Single HTML Sample</title>
<style>
  body { font-family: system-ui,-apple-system,Segoe UI,Roboto; padding: 24px; }
  .card { padding: 16px 18px; border: 1px solid #ddd; border-radius: 12px; }
  .card h3 { margin: 0 0 8px; }
</style>
</head>
<body>
  <div class="card">
    <h3>Single-file sample</h3>
    <p>Edit this HTML, add &lt;style&gt; and &lt;script&gt; — preview updates live.</p>
    <button onclick="console.log('clicked'); alert('Hello!')">Click me</button>
  </div>
  <script>console.log('Hello from single-file sample');<\/script>
</body>
</html>`;
    }
    render();
  });

  clearBtn.addEventListener('click', () => {
    if (modeSelect.value === 'split') {
      htmlCode.value = ''; cssCode.value = ''; jsCode.value = '';
    } else {
      singleHtml.value = '';
    }
    render();
  });

  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([buildDoc()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'composed_page.html';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  });

  runBtn.addEventListener('click', render);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'enter') {
      e.preventDefault(); render();
    }
  });

  // Live render while typing
  [singleHtml, htmlCode, cssCode, jsCode].forEach(el => {
    el.addEventListener('input', renderDebounced);
  });

  // Draggable divider
  (function initDrag() {
    let dragging = false;
    function onDown(e) { dragging = true; document.body.style.cursor = 'col-resize'; e.preventDefault(); }
    function onUp() { if (!dragging) return; dragging = false; document.body.style.cursor = ''; }
    function onMove(e) {
      if (!dragging) return;
      const rect = layout.getBoundingClientRect();
      let x = e.clientX - rect.left;
      const min = 220, max = rect.width - 320; // keep reasonable bounds
      x = Math.max(min, Math.min(max, x));
      layout.style.gridTemplateColumns = `${x}px 8px 1fr`;
      localStorage.setItem(LS.leftw, String(Math.round(x)));
    }
    gutter.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    // Touch
    gutter.addEventListener('touchstart', (e) => { onDown(e.touches[0]); }, {passive:false});
    window.addEventListener('touchend', onUp, {passive:true});
    window.addEventListener('touchmove', (e) => { onMove(e.touches[0]); }, {passive:false});
  }());

  // Boot
  loadState();
  // If nothing saved, load a sample by default
  const nothingSaved = !singleHtml.value && !htmlCode.value && !cssCode.value && !jsCode.value;
  if (nothingSaved) {
    modeSelect.value = 'split';
    setModeUI();
    sampleBtn.click();
  } else {
    render();
  }
})();
