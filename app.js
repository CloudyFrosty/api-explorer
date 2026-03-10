Chart.defaults.color = '#606060';
Chart.defaults.borderColor = 'rgba(255,255,255,0.07)';
Chart.defaults.font.family = "'JetBrains Mono', monospace";
Chart.defaults.font.size = 11;

const charts = {};
let reqCount = 0;
const cooldownState = {};
const cdDurations = { weather: 8, crypto: 12, nasa: 30, countries: 5, dictionary: 5, recipes: 8, pokemon: 5, currency: 10, music: 8, news: 20 };

let coinList = [];
let pokemonList = [];
let countryList = [];
let coinListLoaded = false;
let pokemonListLoaded = false;
let countryListLoaded = false;

let currentAudio = null;

function bump() {
  reqCount++;
  document.getElementById('req-count').textContent = reqCount;
}

function isOnCD(api) {
  return cooldownState[api] && Date.now() < cooldownState[api];
}

function startCD(api) {
  const secs = cdDurations[api];
  cooldownState[api] = Date.now() + secs * 1000;
  const btn = document.getElementById(`${api}-btn`);
  const wrap = document.getElementById(`${api}-cd`);
  const bar = document.getElementById(`${api}-cd-bar`);
  const lbl = document.getElementById(`${api}-cd-lbl`);
  btn.disabled = true;
  wrap.classList.remove('hidden');
  bar.style.transition = 'none';
  bar.style.width = '100%';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bar.style.transition = `width ${secs}s linear`;
      bar.style.width = '0%';
    });
  });
  const iv = setInterval(() => {
    const rem = Math.max(0, cooldownState[api] - Date.now());
    lbl.textContent = `Cooldown: ${(rem / 1000).toFixed(1)}s`;
    if (rem <= 0) {
      clearInterval(iv);
      btn.disabled = false;
      wrap.classList.add('hidden');
      bar.style.transition = 'none';
      bar.style.width = '100%';
    }
  }, 100);
}

function setOut(id, html) {
  document.getElementById(id).innerHTML = html;
}

function skeletonCard() {
  return `<div class="card" style="margin-bottom:12px">
    <div class="skel" style="width:40%;height:22px;margin-bottom:12px"></div>
    <div class="skel" style="width:65%;height:13px;margin-bottom:8px"></div>
    <div class="skel" style="width:50%;height:13px;margin-bottom:18px"></div>
    <div class="stat-grid">
      ${Array(4).fill('<div class="skel" style="height:64px;border-radius:6px"></div>').join('')}
    </div>
  </div>`;
}

function errBox(msg) {
  return `<div class="error-box">⚠ ${msg}</div>`;
}

function killChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

function hide(id) { document.getElementById(id).classList.add('hidden'); }
function show(id) { document.getElementById(id).classList.remove('hidden'); }

function chartBar(id, labels, data, colors) {
  killChart(id);
  const ctx = document.getElementById(id);
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderRadius: 5,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#505050' } },
        x: { grid: { display: false }, ticks: { color: '#707070' } }
      }
    }
  });
}

class AC {
  constructor(inputId, sugsId) {
    this.inp = document.getElementById(inputId);
    this.box = document.getElementById(sugsId);
    this.items = [];
    this.active = -1;
    this.selected = null;
    this.onSearch = null;
    this.onPick = null;
    this._t = null;

    this.inp.addEventListener('input', () => this._input());
    this.inp.addEventListener('keydown', e => this._key(e));
    document.addEventListener('mousedown', e => {
      if (!this.box.contains(e.target) && e.target !== this.inp) this.close();
    });
  }

  feed(items) {
    this.items = items.slice(0, 9);
    this._render();
  }

  close() { this.box.classList.remove('open'); }

  getValue() { return this.selected ? this.selected.value : this.inp.value.trim(); }

  _input() {
    this.selected = null;
    const q = this.inp.value.trim();
    if (!q) { this.close(); return; }
    clearTimeout(this._t);
    this._t = setTimeout(() => { if (this.onSearch) this.onSearch(q); }, 180);
  }

  _hl(text) {
    const q = this.inp.value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!q) return text;
    return text.replace(new RegExp(`(${q})`, 'gi'), '<b>$1</b>');
  }

  _render() {
    if (!this.items.length) { this.close(); return; }
    this.box.innerHTML = this.items.map((item, i) => `
      <div class="si" data-i="${i}">
        ${item.badge ? `<span class="si-badge">${item.badge}</span>` : ''}
        <span class="si-main">${this._hl(item.label)}</span>
        ${item.sub ? `<span class="si-sub">${item.sub}</span>` : ''}
      </div>
    `).join('');
    this.box.querySelectorAll('.si').forEach((el, i) => {
      el.addEventListener('mousedown', e => { e.preventDefault(); this._pick(i); });
    });
    this.active = -1;
    this.box.classList.add('open');
  }

  _pick(i) {
    const item = this.items[i];
    this.selected = item;
    this.inp.value = item.label;
    this.close();
    if (this.onPick) this.onPick(item);
  }

  _key(e) {
    const els = this.box.querySelectorAll('.si');
    if (!els.length || !this.box.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); this._setA(this.active + 1, els); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this._setA(this.active - 1, els); }
    else if (e.key === 'Enter' && this.active >= 0) { e.preventDefault(); this._pick(this.active); }
    else if (e.key === 'Escape') this.close();
  }

  _setA(idx, els) {
    els.forEach(el => el.classList.remove('active'));
    this.active = Math.max(0, Math.min(idx, els.length - 1));
    els[this.active]?.classList.add('active');
  }
}

const weatherAC = new AC('weather-input', 'weather-sugs');
weatherAC.onSearch = async (q) => {
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8`);
    const data = await res.json();
    if (!data.results?.length) { weatherAC.close(); return; }
    weatherAC.feed(data.results.map(r => ({
      label: r.name,
      badge: r.country_code,
      sub: `${r.admin1 ? r.admin1 + ', ' : ''}${r.country}`,
      value: { lat: r.latitude, lon: r.longitude, name: r.name, country: r.country }
    })));
  } catch { weatherAC.close(); }
};

document.getElementById('weather-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !weatherAC.selected) fetchWeather(); });

async function fetchWeather() {
  if (isOnCD('weather')) return;
  const val = weatherAC.getValue();
  if (!val || typeof val === 'string' && !val.trim()) return;

  setOut('weather-out', skeletonCard());
  hide('weather-cb');
  killChart('weather-chart');

  try {
    let lat, lon, name, country;

    if (typeof val === 'object') {
      ({ lat, lon, name, country } = val);
    } else {
      bump();
      const gr = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(val)}&count=1`);
      const gd = await gr.json();
      if (!gd.results?.length) { setOut('weather-out', errBox(`City "${val}" not found.`)); return; }
      const r = gd.results[0];
      lat = r.latitude; lon = r.longitude; name = r.name; country = r.country;
    }

    bump();
    const wr = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation,surface_pressure&wind_speed_unit=mph`);
    const wd = await wr.json();
    const c = wd.current;

    const codeMap = { 0:'Clear Sky',1:'Mainly Clear',2:'Partly Cloudy',3:'Overcast',45:'Foggy',48:'Icy Fog',51:'Light Drizzle',61:'Light Rain',63:'Moderate Rain',65:'Heavy Rain',71:'Light Snow',73:'Moderate Snow',80:'Rain Showers',95:'Thunderstorm' };
    const condition = codeMap[c.weather_code] ?? 'Unknown';

    setOut('weather-out', `
      <div class="card">
        <div class="card-title">${name}, ${country}</div>
        <div class="card-meta">Current conditions · Open-Meteo</div>
        <span class="tag tag-blue">${condition}</span>
        <div class="stat-grid">
          <div class="stat"><div class="sv">${c.temperature_2m}°C</div><div class="sl">Temperature</div></div>
          <div class="stat"><div class="sv">${c.apparent_temperature}°C</div><div class="sl">Feels Like</div></div>
          <div class="stat"><div class="sv">${c.relative_humidity_2m}%</div><div class="sl">Humidity</div></div>
          <div class="stat"><div class="sv">${c.wind_speed_10m} mph</div><div class="sl">Wind</div></div>
        </div>
        <div class="stat-grid" style="margin-top:10px">
          <div class="stat"><div class="sv">${c.precipitation} mm</div><div class="sl">Precipitation</div></div>
          <div class="stat"><div class="sv">${c.surface_pressure} hPa</div><div class="sl">Pressure</div></div>
          <div class="stat"><div class="sv">${lat.toFixed(2)}°</div><div class="sl">Latitude</div></div>
          <div class="stat"><div class="sv">${lon.toFixed(2)}°</div><div class="sl">Longitude</div></div>
        </div>
      </div>
    `);

    show('weather-cb');
    chartBar('weather-chart',
      ['Temp (°C)', 'Feels Like', 'Humidity (%)', 'Wind (mph)'],
      [c.temperature_2m, c.apparent_temperature, c.relative_humidity_2m, c.wind_speed_10m],
      ['#60a5fa','#93c5fd','#38bdf8','#7dd3fc']
    );
    startCD('weather');
  } catch {
    setOut('weather-out', errBox('Failed to fetch weather. Check your connection.'));
  }
}

async function loadCoins() {
  try {
    bump();
    const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1');
    const data = await res.json();
    coinList = data.map((c, i) => ({
      label: c.name,
      badge: c.symbol.toUpperCase(),
      sub: `#${c.market_cap_rank}`,
      value: c.id
    }));
    coinListLoaded = true;
  } catch { coinListLoaded = false; }
}

const cryptoAC = new AC('crypto-input', 'crypto-sugs');
cryptoAC.onSearch = (q) => {
  if (!coinListLoaded) return;
  const ql = q.toLowerCase();
  const matches = coinList.filter(c =>
    c.label.toLowerCase().startsWith(ql) ||
    c.badge.toLowerCase().startsWith(ql)
  ).slice(0, 9);
  if (!matches.length) {
    const fuzzy = coinList.filter(c =>
      c.label.toLowerCase().includes(ql) ||
      c.badge.toLowerCase().includes(ql)
    ).slice(0, 9);
    cryptoAC.feed(fuzzy);
  } else {
    cryptoAC.feed(matches);
  }
};

document.getElementById('crypto-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !cryptoAC.selected) fetchCrypto(); });

async function fetchCrypto() {
  if (isOnCD('crypto')) return;
  const val = cryptoAC.getValue();
  if (!val || !val.trim()) return;

  const coinId = typeof val === 'string' ? val.toLowerCase().replace(/ /g, '-') : val;

  setOut('crypto-out', skeletonCard());
  hide('crypto-cb');
  killChart('crypto-chart');

  try {
    bump();
    const ids = `${coinId},bitcoin,ethereum`;
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`);
    const data = await res.json();

    const coin = data[coinId];
    if (!coin) { setOut('crypto-out', errBox(`Coin "${val}" not found. Try the exact CoinGecko ID.`)); return; }

    const change = coin.usd_24h_change?.toFixed(2) ?? '—';
    const isUp = parseFloat(change) >= 0;
    const mcap = coin.usd_market_cap ? '$' + (coin.usd_market_cap / 1e9).toFixed(2) + 'B' : '—';
    const vol = coin.usd_24h_vol ? '$' + (coin.usd_24h_vol / 1e9).toFixed(2) + 'B' : '—';

    const coinMeta = coinList.find(c => c.value === coinId);
    const displayName = coinMeta?.label ?? val;
    const symbol = coinMeta?.badge ?? coinId.toUpperCase();
    const rank = coinMeta?.sub ?? '';

    setOut('crypto-out', `
      <div class="card">
        <div class="card-title">${displayName} <span style="color:var(--text-3);font-size:13px;font-family:'JetBrains Mono'">${symbol}</span></div>
        <div class="card-meta">CoinGecko · ${rank ? 'Market cap rank ' + rank : 'Live data'}</div>
        <div class="stat-grid">
          <div class="stat"><div class="sv">$${coin.usd.toLocaleString()}</div><div class="sl">Price (USD)</div></div>
          <div class="stat"><div class="sv ${isUp ? 'tag tag-green' : 'tag tag-red'}" style="padding:0;background:none;border-radius:0">${isUp ? '+' : ''}${change}%</div><div class="sl">24h Change</div></div>
          <div class="stat"><div class="sv">${mcap}</div><div class="sl">Market Cap</div></div>
          <div class="stat"><div class="sv">${vol}</div><div class="sl">24h Volume</div></div>
        </div>
      </div>
    `);

    const btc = data['bitcoin'];
    const eth = data['ethereum'];
    if (btc && eth) {
      const labels = [displayName, 'Bitcoin', 'Ethereum'];
      const changes = [
        parseFloat(coin.usd_24h_change?.toFixed(2) ?? 0),
        parseFloat(btc.usd_24h_change?.toFixed(2) ?? 0),
        parseFloat(eth.usd_24h_change?.toFixed(2) ?? 0)
      ];
      show('crypto-cb');
      chartBar('crypto-chart', labels, changes, changes.map(v => v >= 0 ? 'rgba(74,222,128,0.7)' : 'rgba(248,113,113,0.7)'));
    }

    startCD('crypto');
  } catch {
    setOut('crypto-out', errBox('CoinGecko may be rate limiting. Wait 30s and try again.'));
  }
}

document.getElementById('nasa-date').max = new Date().toISOString().split('T')[0];

async function fetchNASA() {
  if (isOnCD('nasa')) return;
  const date = document.getElementById('nasa-date').value;

  setOut('nasa-out', `<div class="card" style="margin-bottom:12px">
    <div class="skel" style="width:50%;height:22px;margin-bottom:12px"></div>
    <div class="skel" style="width:100%;height:300px;border-radius:6px;margin-bottom:12px"></div>
    <div class="skel" style="width:80%;height:13px;margin-bottom:6px"></div>
    <div class="skel" style="width:65%;height:13px"></div>
  </div>`);

  try {
    bump();
    const url = `https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY${date ? '&date=' + date : ''}`;
    const res = await fetch(url);
    const d = await res.json();

    if (d.error) { setOut('nasa-out', errBox(d.error.message ?? 'NASA API error.')); return; }

    const media = d.media_type === 'image'
      ? `<img src="${d.url}" alt="${d.title}" class="nasa-img">`
      : `<div class="tag tag-blue" style="margin-bottom:12px">Video entry — <a href="${d.url}" target="_blank" style="color:var(--accent)">Watch on NASA ↗</a></div>`;

    setOut('nasa-out', `
      <div class="card">
        <div class="card-title">${d.title}</div>
        <div class="card-meta">${d.date}${d.copyright ? ' · © ' + d.copyright.trim() : ''}</div>
        ${media}
        <p class="nasa-text">${d.explanation.slice(0, 500)}${d.explanation.length > 500 ? '…' : ''}</p>
      </div>
    `);
    startCD('nasa');
  } catch {
    setOut('nasa-out', errBox('NASA DEMO_KEY is rate limited. Wait a minute and try again.'));
  }
}

async function loadCountries() {
  try {
    bump();
    const res = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2,region,flag');
    const data = await res.json();
    countryList = data
      .sort((a, b) => a.name.common.localeCompare(b.name.common))
      .map(c => ({
        label: c.name.common,
        badge: c.flag ?? c.cca2,
        sub: c.region,
        value: c.name.common
      }));
    countryListLoaded = true;
  } catch { countryListLoaded = false; }
}

const countriesAC = new AC('countries-input', 'countries-sugs');
countriesAC.onSearch = (q) => {
  if (!countryListLoaded) return;
  const ql = q.toLowerCase();
  const matches = countryList.filter(c => c.label.toLowerCase().startsWith(ql)).slice(0, 9);
  if (!matches.length) {
    countriesAC.feed(countryList.filter(c => c.label.toLowerCase().includes(ql)).slice(0, 9));
  } else {
    countriesAC.feed(matches);
  }
};

document.getElementById('countries-input').addEventListener('keydown', e => { if (e.key === 'Enter') fetchCountry(); });

async function fetchCountry() {
  if (isOnCD('countries')) return;
  const val = countriesAC.getValue();
  if (!val || !val.trim()) return;

  setOut('countries-out', skeletonCard());

  try {
    bump();
    const res = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(val)}?fullText=false`);
    if (!res.ok) { setOut('countries-out', errBox(`Country "${val}" not found.`)); return; }
    const arr = await res.json();
    const d = arr[0];

    const langs = d.languages ? Object.values(d.languages).join(', ') : '—';
    const currencies = d.currencies ? Object.values(d.currencies).map(c => `${c.name} (${c.symbol ?? ''})`).join(', ') : '—';
    const borders = d.borders?.join(', ') || 'None';
    const capital = d.capital?.[0] ?? '—';
    const pop = d.population.toLocaleString();
    const area = d.area ? d.area.toLocaleString() + ' km²' : '—';
    const tld = d.tld?.[0] ?? '—';
    const calling = d.idd?.root ? d.idd.root + (d.idd.suffixes?.[0] ?? '') : '—';

    setOut('countries-out', `
      <div class="card">
        <div class="country-flag">${d.flag ?? '🏳'}</div>
        <div class="country-name">${d.name.common}</div>
        <div class="country-official">${d.name.official}</div>
        <div class="stat-grid" style="margin-top:0">
          <div class="stat"><div class="sv">${d.region}</div><div class="sl">Region</div></div>
          <div class="stat"><div class="sv">${d.subregion ?? '—'}</div><div class="sl">Subregion</div></div>
          <div class="stat"><div class="sv">${capital}</div><div class="sl">Capital</div></div>
          <div class="stat"><div class="sv">${d.cca2}</div><div class="sl">Code</div></div>
        </div>
        <div class="info-grid" style="margin-top:10px">
          <div class="info-row"><div class="info-key">Population</div><div class="info-val">${pop}</div></div>
          <div class="info-row"><div class="info-key">Area</div><div class="info-val">${area}</div></div>
          <div class="info-row"><div class="info-key">Languages</div><div class="info-val">${langs}</div></div>
          <div class="info-row"><div class="info-key">Currency</div><div class="info-val">${currencies}</div></div>
          <div class="info-row"><div class="info-key">Top-Level Domain</div><div class="info-val">${tld}</div></div>
          <div class="info-row"><div class="info-key">Calling Code</div><div class="info-val">${calling}</div></div>
          <div class="info-row" style="grid-column:1/-1"><div class="info-key">Bordering Countries</div><div class="info-val">${borders}</div></div>
        </div>
      </div>
    `);
    startCD('countries');
  } catch {
    setOut('countries-out', errBox('Failed to fetch country data.'));
  }
}

document.getElementById('dictionary-input').addEventListener('keydown', e => { if (e.key === 'Enter') fetchDictionary(); });

async function fetchDictionary() {
  if (isOnCD('dictionary')) return;
  const word = document.getElementById('dictionary-input').value.trim();
  if (!word) return;

  setOut('dictionary-out', `<div class="card">
    <div class="skel" style="width:35%;height:24px;margin-bottom:10px"></div>
    <div class="skel" style="width:55%;height:13px;margin-bottom:18px"></div>
    ${Array(3).fill('<div class="skel" style="height:13px;margin-bottom:8px"></div>').join('')}
  </div>`);

  try {
    bump();
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!res.ok) { setOut('dictionary-out', errBox(`"${word}" not found in the dictionary.`)); return; }
    const arr = await res.json();
    const entry = arr[0];

    const phonetic = entry.phonetics?.find(p => p.text)?.text ?? '';
    const audioUrl = entry.phonetics?.find(p => p.audio && p.audio.trim())?.audio ?? '';

    const meanings = entry.meanings.slice(0, 4).map(m => `
      <div class="dict-entry">
        <div class="dict-pos">${m.partOfSpeech}</div>
        ${m.definitions.slice(0, 3).map(def => `
          <div class="dict-def">${def.definition}</div>
          ${def.example ? `<div class="dict-example">"${def.example}"</div>` : ''}
        `).join('')}
        ${m.synonyms?.length ? `<div style="margin-top:8px">${m.synonyms.slice(0,6).map(s => `<span class="tag tag-neutral">${s}</span>`).join('')}</div>` : ''}
      </div>
    `).join('');

    const audioBtn = audioUrl
      ? `<button class="audio-btn" onclick="playDictAudio('${audioUrl}')">▶ Pronunciation</button>`
      : '';

    setOut('dictionary-out', `
      <div class="card">
        <div class="card-title">${entry.word}</div>
        ${phonetic ? `<div class="phonetic">${phonetic}</div>` : ''}
        ${audioBtn}
        ${meanings}
      </div>
    `);
    startCD('dictionary');
  } catch {
    setOut('dictionary-out', errBox('Failed to fetch dictionary entry.'));
  }
}

function playDictAudio(url) {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  const audio = new Audio(url);
  audio.play();
}

const recipesAC = new AC('recipes-input', 'recipes-sugs');
recipesAC.onSearch = async (q) => {
  try {
    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!data.meals) { recipesAC.close(); return; }
    recipesAC.feed(data.meals.slice(0, 8).map(m => ({
      label: m.strMeal,
      badge: m.strArea?.slice(0, 3).toUpperCase() ?? '—',
      sub: m.strCategory,
      value: m.idMeal,
      _meal: m
    })));
  } catch { recipesAC.close(); }
};

document.getElementById('recipes-input').addEventListener('keydown', e => { if (e.key === 'Enter') fetchRecipe(); });

async function fetchRecipe() {
  if (isOnCD('recipes')) return;
  const q = document.getElementById('recipes-input').value.trim();
  if (!q) return;

  setOut('recipes-out', `<div class="card">
    <div class="skel" style="width:100%;height:220px;border-radius:6px;margin-bottom:14px"></div>
    <div class="skel" style="width:50%;height:22px;margin-bottom:10px"></div>
    <div class="skel" style="width:70%;height:13px;margin-bottom:8px"></div>
  </div>`);

  try {
    let meal;
    const sel = recipesAC.selected;

    if (sel?._meal) {
      meal = sel._meal;
    } else {
      bump();
      const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!data.meals?.length) { setOut('recipes-out', errBox(`No recipes found for "${q}".`)); return; }
      meal = data.meals[0];
    }

    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const ing = meal[`strIngredient${i}`];
      const meas = meal[`strMeasure${i}`];
      if (ing && ing.trim()) ingredients.push(`${meas?.trim() ? meas.trim() + ' ' : ''}${ing}`);
    }

    const steps = meal.strInstructions?.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, 600) ?? '';

    setOut('recipes-out', `
      <div class="card">
        ${meal.strMealThumb ? `<img src="${meal.strMealThumb}" class="meal-img" alt="${meal.strMeal}">` : ''}
        <div class="card-title">${meal.strMeal}</div>
        <div class="card-meta">${meal.strCategory} · ${meal.strArea} cuisine</div>
        ${meal.strTags ? meal.strTags.split(',').map(t => `<span class="tag tag-neutral">${t.trim()}</span>`).join('') : ''}
        <div style="margin-top:14px">
          <div class="ctitle">Ingredients (${ingredients.length})</div>
          <div class="ingredients-grid">${ingredients.map(i => `<div class="ing-item">${i}</div>`).join('')}</div>
        </div>
        <div style="margin-top:14px">
          <div class="ctitle">Instructions</div>
          <div class="recipe-steps">${steps}${meal.strInstructions?.length > 600 ? '…' : ''}</div>
        </div>
        ${meal.strYoutube ? `<a href="${meal.strYoutube}" target="_blank" style="display:inline-block;margin-top:12px" class="tag tag-blue">▶ Watch on YouTube</a>` : ''}
      </div>
    `);
    startCD('recipes');
  } catch {
    setOut('recipes-out', errBox('Failed to fetch recipe.'));
  }
}

async function loadPokemon() {
  try {
    bump();
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=898');
    const data = await res.json();
    pokemonList = data.results.map((p, i) => {
      const id = i + 1;
      return {
        label: p.name.charAt(0).toUpperCase() + p.name.slice(1),
        badge: `#${String(id).padStart(3, '0')}`,
        value: p.name,
        id
      };
    });
    pokemonListLoaded = true;
  } catch { pokemonListLoaded = false; }
}

const pokemonAC = new AC('pokemon-input', 'pokemon-sugs');
pokemonAC.onSearch = (q) => {
  if (!pokemonListLoaded) return;
  const ql = q.toLowerCase();
  const starts = pokemonList.filter(p => p.value.startsWith(ql)).slice(0, 9);
  if (starts.length) { pokemonAC.feed(starts); return; }
  pokemonAC.feed(pokemonList.filter(p => p.value.includes(ql)).slice(0, 9));
};

document.getElementById('pokemon-input').addEventListener('keydown', e => { if (e.key === 'Enter') fetchPokemon(); });

async function fetchPokemon() {
  if (isOnCD('pokemon')) return;
  const val = pokemonAC.getValue();
  if (!val || !val.trim()) return;
  const name = typeof val === 'string' ? val.toLowerCase().trim() : val;

  setOut('pokemon-out', `<div class="card">
    <div class="skel" style="width:50%;height:24px;margin-bottom:12px"></div>
    <div style="display:flex;gap:16px">
      <div class="skel" style="width:110px;height:110px;border-radius:6px;flex-shrink:0"></div>
      <div style="flex:1">
        <div class="skel" style="height:13px;margin-bottom:8px"></div>
        <div class="skel" style="height:13px;margin-bottom:8px;width:70%"></div>
        <div class="skel" style="height:13px;width:50%"></div>
      </div>
    </div>
  </div>`);
  hide('pokemon-cb');
  killChart('pokemon-chart');

  try {
    bump();
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
    if (!res.ok) { setOut('pokemon-out', errBox(`Pokémon "${name}" not found.`)); return; }
    const d = await res.json();

    const types = d.types.map(t => `<span class="poke-type">${t.type.name}</span>`).join('');
    const stats = d.stats;

    const statColors = { hp: '#f87171', attack: '#fb923c', defense: '#fbbf24', 'special-attack': '#a78bfa', 'special-defense': '#60a5fa', speed: '#4ade80' };

    const statBars = stats.map(s => {
      const pct = Math.min(100, (s.base_stat / 255) * 100).toFixed(1);
      const col = statColors[s.stat.name] ?? 'var(--accent)';
      return `
        <div class="stat-bar-row">
          <div class="stat-bar-label">${s.stat.name.replace('special-','sp-')}</div>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%;background:${col}"></div></div>
          <div class="stat-bar-val">${s.base_stat}</div>
        </div>
      `;
    }).join('');

    const height = (d.height / 10).toFixed(1) + 'm';
    const weight = (d.weight / 10).toFixed(1) + 'kg';
    const sprite = d.sprites.other?.['official-artwork']?.front_default ?? d.sprites.front_default ?? '';

    setOut('pokemon-out', `
      <div class="card">
        <div class="poke-card">
          ${sprite ? `<img src="${sprite}" class="poke-sprite" alt="${d.name}">` : ''}
          <div class="poke-info">
            <div class="poke-num">#${String(d.id).padStart(3, '0')}</div>
            <div class="poke-name">${d.name.charAt(0).toUpperCase() + d.name.slice(1)}</div>
            <div class="poke-types">${types}</div>
            <div class="stat-grid cols3" style="margin:0 0 12px">
              <div class="stat"><div class="sv">${height}</div><div class="sl">Height</div></div>
              <div class="stat"><div class="sv">${weight}</div><div class="sl">Weight</div></div>
              <div class="stat"><div class="sv">${d.base_experience ?? '—'}</div><div class="sl">Base XP</div></div>
            </div>
            <div class="stat-bar-wrap">${statBars}</div>
          </div>
        </div>
      </div>
    `);

    show('pokemon-cb');
    killChart('pokemon-chart');
    const ctx = document.getElementById('pokemon-chart');
    charts['pokemon-chart'] = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: stats.map(s => s.stat.name.replace('special-attack','Sp.Atk').replace('special-defense','Sp.Def').replace('-',' ').split(' ').map(w => w[0].toUpperCase()+w.slice(1)).join(' ')),
        datasets: [{
          data: stats.map(s => s.base_stat),
          backgroundColor: 'rgba(96,165,250,0.15)',
          borderColor: '#60a5fa',
          borderWidth: 2,
          pointBackgroundColor: '#60a5fa',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            min: 0, max: 255,
            ticks: { stepSize: 50, color: '#404040', backdropColor: 'transparent' },
            grid: { color: 'rgba(255,255,255,0.07)' },
            angleLines: { color: 'rgba(255,255,255,0.07)' },
            pointLabels: { color: '#707070', font: { size: 11 } }
          }
        }
      }
    });

    startCD('pokemon');
  } catch {
    setOut('pokemon-out', errBox('Failed to fetch Pokémon data.'));
  }
}

async function fetchCurrency() {
  if (isOnCD('currency')) return;
  const base = document.getElementById('currency-from').value;

  setOut('currency-out', `<div class="card">
    <div class="skel" style="width:40%;height:22px;margin-bottom:14px"></div>
    <div class="cur-grid">${Array(8).fill('<div class="skel" style="height:60px;border-radius:6px"></div>').join('')}</div>
  </div>`);
  hide('currency-cb');
  killChart('currency-chart');

  try {
    bump();
    const targets = ['USD','EUR','GBP','JPY','CAD','AUD','CHF','CNY','INR','BRL','MXN','KRW'].filter(c => c !== base).join(',');
    const res = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=${targets}`);
    const data = await res.json();

    const rates = Object.entries(data.rates).sort((a, b) => a[0].localeCompare(b[0]));

    setOut('currency-out', `
      <div class="card">
        <div class="card-title">1 ${base} equals</div>
        <div class="card-meta">Frankfurter · ECB data · Updated ${data.date}</div>
        <div class="cur-grid">
          ${rates.map(([code, val]) => `
            <div class="cur-item">
              <div class="cur-code">${code}</div>
              <div class="cur-val">${typeof val === 'number' ? (val >= 100 ? val.toFixed(0) : val >= 10 ? val.toFixed(2) : val.toFixed(4)) : val}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `);

    show('currency-cb');
    const topRates = rates.slice(0, 8);
    chartBar('currency-chart',
      topRates.map(r => r[0]),
      topRates.map(r => r[1]),
      Array(topRates.length).fill('#60a5fa')
    );
    startCD('currency');
  } catch {
    setOut('currency-out', errBox('Failed to fetch exchange rates.'));
  }
}

document.getElementById('music-input').addEventListener('keydown', e => { if (e.key === 'Enter') fetchMusic(); });

async function fetchMusic() {
  if (isOnCD('music')) return;
  const q = document.getElementById('music-input').value.trim();
  if (!q) return;

  setOut('music-out', `<div class="music-grid">${Array(6).fill(`
    <div class="music-card" style="animation:none">
      <div class="skel" style="width:56px;height:56px;border-radius:6px;flex-shrink:0"></div>
      <div style="flex:1"><div class="skel" style="height:13px;margin-bottom:8px"></div><div class="skel" style="height:11px;width:60%"></div></div>
    </div>
  `).join('')}</div>`);

  try {
    bump();
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&limit=8&entity=song&media=music`);
    const data = await res.json();

    if (!data.results?.length) { setOut('music-out', errBox(`No tracks found for "${q}".`)); return; }

    const cards = data.results.map(track => {
      const art = track.artworkUrl100?.replace('100x100', '300x300') ?? '';
      const hasPreview = !!track.previewUrl;
      return `
        <div class="music-card">
          ${art ? `<img src="${art}" class="music-art" alt="${track.trackName}">` : '<div class="music-art"></div>'}
          <div class="music-info">
            <div class="music-track">${track.trackName ?? '—'}</div>
            <div class="music-artist">${track.artistName ?? '—'} · ${track.collectionName ?? ''}</div>
            ${hasPreview
              ? `<button class="play-btn" data-url="${track.previewUrl}" data-name="${track.trackName} — ${track.artistName}" onclick="playPreview(this)">▶ Preview</button>`
              : '<span style="font-size:10px;color:var(--text-3)">No preview</span>'
            }
          </div>
        </div>
      `;
    }).join('');

    setOut('music-out', `<div class="music-grid">${cards}</div>`);
    startCD('music');
  } catch {
    setOut('music-out', errBox('Failed to fetch music. Check your connection.'));
  }
}

function playPreview(btn) {
  stopAudio();
  const url = btn.dataset.url;
  const name = btn.dataset.name;
  if (!url) return;
  currentAudio = new Audio(url);
  currentAudio.play();
  currentAudio.onended = stopAudio;
  document.getElementById('audio-name').textContent = name;
  document.getElementById('audio-bar').classList.remove('hidden');
}

function stopAudio() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  document.getElementById('audio-bar').classList.add('hidden');
}

async function fetchNews() {
  if (isOnCD('news')) return;

  setOut('news-out', `<div class="card">${Array(8).fill(`
    <div class="news-item">
      <div class="skel" style="height:15px;margin-bottom:7px"></div>
      <div class="skel" style="height:11px;width:45%"></div>
    </div>
  `).join('')}</div>`);

  try {
    bump();
    const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = await idsRes.json();
    const top12 = ids.slice(0, 12);

    const stories = await Promise.all(top12.map(async id => {
      bump();
      const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      return r.json();
    }));

    const validStories = stories.filter(s => s && s.title);

    const timeAgo = (unix) => {
      const diff = Math.floor((Date.now() / 1000) - unix);
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    };

    const domain = (url) => {
      try { return new URL(url).hostname.replace('www.', ''); } catch { return 'news.ycombinator.com'; }
    };

    const items = validStories.map((s, i) => `
      <div class="news-item">
        <div class="news-title">
          <span class="news-rank">${String(i + 1).padStart(2, '0')}.</span>
          <a href="${s.url ?? `https://news.ycombinator.com/item?id=${s.id}`}" target="_blank">${s.title}</a>
        </div>
        <div class="news-meta">
          <span>▲ ${s.score}</span>
          <span>💬 ${s.descendants ?? 0}</span>
          <span>${timeAgo(s.time)}</span>
          <span style="color:var(--text-3)">${domain(s.url ?? '')}</span>
          <a href="https://news.ycombinator.com/item?id=${s.id}" target="_blank" style="color:var(--accent);text-decoration:none">HN ↗</a>
        </div>
      </div>
    `).join('');

    setOut('news-out', `<div class="card">${items}</div>`);
    startCD('news');
  } catch {
    setOut('news-out', errBox('Failed to fetch Hacker News.'));
  }
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById(tab).classList.add('active');

    if (tab === 'crypto' && !coinListLoaded) loadCoins();
    if (tab === 'pokemon' && !pokemonListLoaded) loadPokemon();
    if (tab === 'countries' && !countryListLoaded) loadCountries();
  });
});

(async () => {
  document.getElementById('nasa-date').max = new Date().toISOString().split('T')[0];
  await fetchNews();
})();