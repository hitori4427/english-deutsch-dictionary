const defaultModels = (window.ED_WEB_CONFIG && window.ED_WEB_CONFIG.dictionaryModelOptions) || ['MiniMax-M2.7-highspeed', 'MiniMax-M2.7', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.5', 'MiniMax-M2'];
const defaultEndpoint = (window.ED_WEB_CONFIG && window.ED_WEB_CONFIG.defaultEndpoint) || 'https://api.minimax.io/v1/chat/completions';
const defaultTimeout = (window.ED_WEB_CONFIG && window.ED_WEB_CONFIG.defaultTimeoutSeconds) || 90;
const passHash = (window.ED_WEB_CONFIG && window.ED_WEB_CONFIG.accessPassHash) || '';

const el = (id) => document.getElementById(id);

let dictionary = [];
let favorites = JSON.parse(localStorage.getItem('ed_favorites') || '[]');
let deferredInstallPrompt = null;
let currentEntry = null;

function normalize(v) {
  return (v || '').toLowerCase().trim();
}

function sha256(text) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then((buffer) => {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  });
}

function setLockScreen(visible) {
  el('authGate').classList.toggle('hidden', !visible);
  el('appMain').classList.toggle('hidden', visible);
}

async function checkAuth() {
  const saved = localStorage.getItem('ed_auth_ok') === '1';
  if (!passHash) {
    setLockScreen(false);
    return;
  }
  if (saved) {
    setLockScreen(false);
    return;
  }
  const params = new URLSearchParams(location.search);
  const queryToken = params.get('token');
  const queryHash = queryToken ? await sha256(queryToken) : '';
  if (queryHash && queryHash === passHash) {
    localStorage.setItem('ed_auth_ok', '1');
    setLockScreen(false);
    return;
  }
  setLockScreen(true);
}

async function setupAuth() {
  if (!passHash) return;
  el('passSubmit').addEventListener('click', async () => {
    const pass = normalize(el('passInput').value);
    if (!pass) {
      el('passError').textContent = '請輸入通行碼';
      return;
    }
    const hashed = await sha256(pass);
    if (hashed === passHash) {
      localStorage.setItem('ed_auth_ok', '1');
      el('passError').textContent = '';
      setLockScreen(false);
    } else {
      el('passError').textContent = '通行碼錯誤';
    }
  });
}

function articleText(entry) {
  if (entry.partOfSpeech === 'verb') return 'v.';
  if (entry.partOfSpeech === 'noun') return entry.gender ? `${entry.gender}.` : 'n.';
  return 'adj./adv./prep.';
}

function renderEntry(entry) {
  currentEntry = entry;
  const result = el('resultCard');
  const verbLine = entry.verbForms ? `
    <div class="result-line"><strong>變化：</strong>${entry.verbForms.join('，')}</div>`
    : '';
  const examples = entry.exampleEnglish
    ? `<div class="result-line"><strong>英文：</strong>${entry.exampleEnglish}</div>
       <div class="result-line"><strong>德文：</strong>${entry.exampleGerman}</div>`
    : '';
  const fav = favorites.includes(entry.englishWord);
  const details = entry.source
    ? '<div class="result-line muted">離線英德字庫（FreeDict）</div>'
    : `<div class="result-line">詞類：${articleText(entry)} · ${entry.partOfSpeech}</div>
       <div class="result-line"><strong>中文：</strong>${entry.chineseDefinition || '—'}</div>
       ${examples}
       ${verbLine}
       <div class="result-line"><strong>複數：</strong>${entry.plural || '—'}；可數：${entry.isCountable ? '是' : '否'}</div>`;

  result.classList.remove('hidden');
  result.innerHTML = `
    <div class="resultTitle"><strong>${entry.englishWord}</strong> → ${entry.pronunciationText || entry.germanWord}</div>
    ${details}
    <div class="actions">
      <button id="favBtn">${fav ? '移除收藏' : '加入收藏'}</button>
      <button id="aiBtn">AI 查詞補充</button>
    </div>
    <div id="aiResult" class="result-line muted"></div>
  `;

  el('favBtn').addEventListener('click', () => toggleFavorite(entry.englishWord));
  el('aiBtn').addEventListener('click', () => aiLookup(entry.englishWord));
}

function renderSuggestions(list) {
  const node = el('suggestions');
  node.innerHTML = '';
  list.forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = `${entry.englishWord} → ${entry.germanWord}`;
    li.addEventListener('click', () => renderEntry(entry));
    node.appendChild(li);
  });
}

function entriesForLetter(letter) {
  return dictionary
    .filter((entry) => normalize(entry.englishWord).startsWith(letter.toLowerCase()))
    .sort((a, b) => a.englishWord.localeCompare(b.englishWord, 'en'));
}

function browseLetter(letter) {
  el('searchInput').value = '';
  document.querySelectorAll('#alphabetNav button').forEach((button) => {
    button.classList.toggle('active', button.dataset.letter === letter);
  });
  const entries = entriesForLetter(letter);
  el('browseHeading').textContent = `${letter} 開頭 · ${entries.length} 個單字`;
  renderSuggestions(entries);
}

function renderAlphabet() {
  const nav = el('alphabetNav');
  nav.innerHTML = '';
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((letter) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.letter = letter;
    button.textContent = letter;
    button.addEventListener('click', () => browseLetter(letter));
    nav.appendChild(button);
  });
}


function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js?v=17').catch(() => {});
  });
}

function renderFavorites() {
  const node = el('favoritesList');
  node.innerHTML = '';
  if (!favorites.length) {
    node.innerHTML = '<li>尚未收藏</li>';
    return;
  }
  favorites.forEach((key) => {
    const entry = dictionary.find((item) => item.englishWord.toLowerCase() === key);
    const li = document.createElement('li');
    li.textContent = entry ? `${entry.englishWord} → ${entry.germanWord}` : key;
    node.appendChild(li);
  });
}

function toggleFavorite(key) {
  const idx = favorites.indexOf(key);
  if (idx >= 0) favorites.splice(idx, 1);
  else favorites.push(key);
  localStorage.setItem('ed_favorites', JSON.stringify(favorites));
  renderFavorites();
  if (currentEntry) renderEntry(currentEntry);
}

function loadSettingsToUI() {
  const savedEndpoint = localStorage.getItem('ed_endpoint') || '';
  const savedModel = localStorage.getItem('ed_model') || '';
  const storedTimeout = Number(localStorage.getItem('ed_timeout') || 0);
  const shouldUpgradeModel = savedModel === 'MiniMax-M2.7' && localStorage.getItem('ed_fast_model_upgrade') !== '1';
  const settings = {
    apiKey: localStorage.getItem('ed_api_key') || '',
    endpoint: !savedEndpoint || savedEndpoint.includes('api.minimax.com/v1/text/chat/completion') ? defaultEndpoint : savedEndpoint,
    model: shouldUpgradeModel ? 'MiniMax-M2.7-highspeed' : (defaultModels.includes(savedModel) ? savedModel : defaultModels[0]),
    timeout: !storedTimeout || storedTimeout <= 60 ? defaultTimeout : storedTimeout,
  };

  const modelSelect = el('modelSelect');
  modelSelect.innerHTML = '';
  defaultModels.forEach((m) => {
    const o = document.createElement('option');
    o.value = m;
    o.textContent = m;
    modelSelect.appendChild(o);
  });
  modelSelect.value = settings.model;
  el('apiKey').value = settings.apiKey;
  el('endpoint').value = settings.endpoint;
  el('timeout').value = settings.timeout;
  localStorage.setItem('ed_endpoint', settings.endpoint);
  localStorage.setItem('ed_model', settings.model);
  localStorage.setItem('ed_timeout', String(settings.timeout));
  localStorage.setItem('ed_fast_model_upgrade', '1');

  el('apiKey').addEventListener('change', () => {
    localStorage.setItem('ed_api_key', el('apiKey').value.trim());
  });
  el('endpoint').addEventListener('change', () => {
    localStorage.setItem('ed_endpoint', el('endpoint').value.trim());
  });
  modelSelect.addEventListener('change', () => {
    localStorage.setItem('ed_model', modelSelect.value);
  });
  el('timeout').addEventListener('change', () => {
    localStorage.setItem('ed_timeout', String(Math.max(5, Number(el('timeout').value) || defaultTimeout)));
  });

  if (!settings.apiKey) {
    el('settingsInfo').textContent = '目前未設定 API Key，將只使用本機辭典。';
  } else {
    el('settingsInfo').textContent = '可用 MiniMax API 擴展查詢結果。';
  }
}

async function requestMiniMax(word) {
  const apiKey = (el('apiKey').value || '').trim();
  const endpoint = (el('endpoint').value || defaultEndpoint).trim();
  const model = el('modelSelect').value || defaultModels[0];
  const timeout = Number(el('timeout').value) || defaultTimeout;

  if (!apiKey) {
    throw new Error('尚未設定 API Key');
  }
  const payload = {
    model,
    messages: [
      { role: 'system', content: '你是英德辭典。只輸出精簡 JSON，不要解釋。' },
      { role: 'user', content: `${word} 的英德查詞 JSON：english,german,article,chinese,partOfSpeech,plural,exampleEnglish,exampleGerman` }
    ],
    reasoning_split: true,
    temperature: 0.2,
    max_completion_tokens: 2048
  };

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(5000, timeout * 1000));
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      });
      const txt = await res.text();
      if (!res.ok) {
        let detail = txt;
        try {
          const parsed = JSON.parse(txt);
          detail = parsed.error?.message || parsed.base_resp?.status_msg || txt;
        } catch {}
        const error = new Error(`HTTP ${res.status}${detail ? `：${String(detail).slice(0, 160)}` : ''}`);
        error.retryable = res.status === 429 || res.status >= 500;
        throw error;
      }
      let answerContent = '';
      try { answerContent = String(JSON.parse(txt).choices?.[0]?.message?.content || '').trim(); } catch {}
      if (!answerContent) {
        lastError = new Error('MiniMax 只完成推理，沒有產生最後答案');
        if (attempt === 1) {
          payload.messages = [{ role: 'user', content: `只用一行 JSON 回答 ${word} 的德文：{"english":"","german":"","article":"","chinese":"","partOfSpeech":"","plural":"","exampleEnglish":"","exampleGerman":""}` }];
          continue;
        }
        throw lastError;
      }
      return txt;
    } catch (err) {
      lastError = err;
      const retryable = err.name === 'AbortError' || err instanceof TypeError || err.retryable;
      if (attempt === 2 || !retryable) break;
      await new Promise((resolve) => setTimeout(resolve, 800));
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastError?.name === 'AbortError') throw new Error(`AI 連續兩次回應超過 ${timeout} 秒；請稍後再試`);
  if (lastError instanceof TypeError) throw new Error('瀏覽器無法連線 MiniMax；請檢查網路或 Endpoint');
  throw lastError;
}

function extractAIContent(responseText) {
  let content = responseText;
  try {
    const envelope = JSON.parse(responseText);
    content = envelope.choices?.[0]?.message?.content ?? responseText;
  } catch {}

  content = String(content)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const candidate = content.slice(start, end + 1);
    try { return JSON.parse(candidate); } catch {}
  }
  try { return JSON.parse(content); } catch {}
  if (content) return { rawText: content };
  throw new Error('AI 回覆沒有可顯示的內容，請再查一次');
}

function aiResultLines(data) {
  if (data.rawText) return [data.rawText];
  const examples = Array.isArray(data.examples)
    ? data.examples.map((item) => typeof item === 'string' ? item : `${item.english || item.en || ''} → ${item.german || item.de || ''}`).filter(Boolean).join('；')
    : (data.examples || ((data.exampleEnglish || data.exampleGerman) ? `${data.exampleEnglish || ''} → ${data.exampleGerman || ''}` : '—'));
  return [
    `${data.english || ''} → ${data.displayGerman || data.german || '—'}`,
    `冠詞／詞類：${data.article || '—'} · ${data.partOfSpeech || '—'}`,
    `中文：${data.chinese || '—'}`,
    `複數：${data.plural || '—'}　程度：${data.level || '—'}`,
    `例句：${examples}`,
    `提示：${data.learningTip || '—'}`
  ];
}

async function aiLookup(word) {
  const output = el('aiResult');
  output.textContent = '查詢中...';
  try {
    const txt = await requestMiniMax(word);
    const data = extractAIContent(txt);
    output.textContent = '';
    const title = document.createElement('strong');
    title.className = 'success';
    title.textContent = 'AI 查詞結果';
    output.appendChild(title);
    aiResultLines(data).forEach((line) => {
      const div = document.createElement('div');
      div.textContent = line;
      output.appendChild(div);
    });
    return true;
  } catch (err) {
    output.innerHTML = `<span class="error">查詢失敗：</span>${err.message}`;
    return false;
  }
}

async function testConfig() {
  const apiKey = (el('apiKey').value || '').trim();
  if (!apiKey) {
    el('settingsInfo').textContent = '請先輸入 API Key。';
    return;
  }
  el('settingsInfo').textContent = '測試中...';
  el('testBtn').disabled = true;
  try {
    const txt = await requestMiniMax('apple');
    const result = extractAIContent(txt);
    if (!result.german && !result.displayGerman) throw new Error('有收到回應，但缺少德文翻譯');
    el('settingsInfo').textContent = '測試成功：連線、完整查詞及結果解析皆正常。';
  } catch (err) {
    el('settingsInfo').textContent = `測試失敗：${err.message}`;
  } finally {
    el('testBtn').disabled = false;
  }
}


function bindSearch() {
  let debounce = null;
  el('searchInput').addEventListener('input', (e) => {
    const q = normalize(e.target.value);
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      if (!q) {
        browseLetter('A');
        return;
      }
      document.querySelectorAll('#alphabetNav button').forEach((button) => button.classList.remove('active'));
      el('browseHeading').textContent = `搜尋「${q}」`;
      const result = dictionary
        .filter((entry) => {
          const en = normalize(entry.englishWord);
          const de = normalize(entry.germanWord);
          return en.includes(q) || de.includes(q) || normalize(entry.chineseDefinition).includes(q);
        })
        .sort((a, b) => {
          const aStarts = normalize(a.englishWord).startsWith(q) ? 0 : 1;
          const bStarts = normalize(b.englishWord).startsWith(q) ? 0 : 1;
          return aStarts - bStarts;
        });
      renderSuggestions(result.slice(0, 30));
    }, 120);
  });
}

function bindDirectAI() {
  el('aiSearchBtn').addEventListener('click', () => {
    const word = normalize(el('searchInput').value);
    if (!word) {
      el('browseHeading').textContent = '請先輸入要查詢的英文單字。';
      return;
    }
    renderEntry({
      englishWord: word,
      germanWord: '等待 AI 查詢',
      pronunciationText: '等待 AI 查詢',
      partOfSpeech: '',
      chineseDefinition: '',
      plural: '',
      isCountable: false
    });
    aiLookup(word);
  });
}

function bindInstallPrompt() {
  const button = el('installBtn');
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    button.classList.remove('hidden');
  });
  button.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      alert('請在 Safari 點「分享」→「加到主畫面」。');
      return;
    }
    deferredInstallPrompt.prompt();
    deferredInstallPrompt = null;
    button.classList.add('hidden');
  });
}

async function renderApp() {
  bindInstallPrompt();
  loadSettingsToUI();
  renderFavorites();
  bindSearch();
  bindDirectAI();
  el('testBtn').addEventListener('click', testConfig);

  try {
    const response = await fetch('dictionary.json?v=17', { cache: 'no-store' });
    dictionary = await response.json();
    renderAlphabet();
    browseLetter('A');
  } catch {
    dictionary = [];
  }
  if (!dictionary.length) {
    el('resultCard').classList.remove('hidden');
    el('resultCard').innerHTML = '<p class="error">載入辭典失敗，請稍後再試。</p>';
  }
}

async function boot() {
  await checkAuth();
  setupAuth();
  registerServiceWorker();
  await renderApp();
}

boot();
