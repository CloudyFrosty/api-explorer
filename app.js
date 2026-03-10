const charts = {};
let reqCount = 0;

function bumpCount() {
  reqCount++;
  document.getElementById('req-count').textContent = reqCount;
}

function showEl(id) {
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  return el;
}

function hideEl(id) {
  document.getElementById(id).classList.add('hidden');
}

function killChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
}

function setLoading(id, msg) {
  const el = showEl(id);
  el.innerHTML = `<div class="loading-msg"><div class="spinner"></div>${msg}</div>`;
}

function setError(id, msg) {
  const el = showEl(id);
  el.innerHTML = `<div class="error-msg">${msg}</div>`;
}

function chartDefaults() {
  return {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#e4e0d8' },
        ticks: { font: { family: 'DM Mono', size: 11 }, color: '#9e9890' }
      },
      x: {
        grid: { display: false },
        ticks: { font: { family: 'DM Mono', size: 11 }, color: '#6b6457' }
      }
    }
  };
}

async function fetchWeather() {
  const city = document.getElementById('weather-input').value.trim();
  if (!city) return;

  setLoading('weather-result', 'Locating city...');
  hideEl('weather-chart-wrap');
  killChart('weather');

  try {
    bumpCount();
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
    const geoData = await geoRes.json();

    if (!geoData.results?.length) {
      setError('weather-result', `City "${city}" not found. Try a different spelling.`);
      return;
    }

    const { latitude, longitude, name, country } = geoData.results[0];

    bumpCount();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&wind_speed_unit=mph`;
    const wRes = await fetch(url);
    const wData = await wRes.json();
    const c = wData.current;

    const codes = {
      0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Icy Fog', 51: 'Light Drizzle', 61: 'Light Rain',
      63: 'Moderate Rain', 65: 'Heavy Rain', 71: 'Light Snow', 73: 'Moderate Snow',
      80: 'Rain Showers', 95: 'Thunderstorm'
    };

    const condition = codes[c.weather_code] ?? 'Unknown';

    const el = showEl('weather-result');
    el.innerHTML = `
      <div class="card">
        <div class="card-title">${name}, ${country}</div>
        <div class="card-meta">Current conditions · Open-Meteo</div>
        <div class="stat-grid">
          <div class="stat">
            <span class="stat-val">${c.temperature_2m}°C</span>
            <span class="stat-label">Temperature</span>
          </div>
          <div class="stat">
            <span class="stat-val">${c.apparent_temperature}°C</span>
            <span class="stat-label">Feels Like</span>
          </div>
          <div class="stat">
            <span class="stat-val">${c.relative_humidity_2m}%</span>
            <span class="stat-label">Humidity</span>
          </div>
          <div class="stat">
            <span class="stat-val">${c.wind_speed_10m} mph</span>
            <span class="stat-label">Wind</span>
          </div>
        </div>
        <span class="condition-tag">${condition}</span>
      </div>
    `;

    const wrap = showEl('weather-chart-wrap');
    charts['weather'] = new Chart(document.getElementById('weather-chart'), {
      type: 'bar',
      data: {
        labels: ['Temp (°C)', 'Feels Like (°C)', 'Humidity (%)'],
        datasets: [{
          data: [c.temperature_2m, c.apparent_temperature, c.relative_humidity_2m],
          backgroundColor: ['#2a5c45', '#52a07a', '#95d5b2'],
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: chartDefaults()
    });

  } catch {
    setError('weather-result', 'Failed to fetch weather. Check your connection and try again.');
  }
}

async function fetchNASA() {
  setLoading('nasa-result', 'Contacting NASA...');

  try {
    bumpCount();
    const res = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
    const data = await res.json();

    const el = showEl('nasa-result');

    const imgHTML = data.media_type === 'image'
      ? `<img src="${data.url}" alt="${data.title}" class="nasa-img" />`
      : `<p class="card-meta" style="margin-top:12px">Today's entry is a video — <a href="${data.url}" target="_blank" style="color:var(--accent)">watch on NASA</a></p>`;

    el.innerHTML = `
      <div class="card">
        <div class="card-title">${data.title}</div>
        <div class="card-meta">${data.date}${data.copyright ? ` · © ${data.copyright.trim()}` : ''}</div>
        ${imgHTML}
        <p class="nasa-explanation">${data.explanation.slice(0, 400)}${data.explanation.length > 400 ? '…' : ''}</p>
      </div>
    `;
  } catch {
    setError('nasa-result', 'Failed to fetch NASA data. The DEMO_KEY has rate limits — try again in a minute.');
  }
}

async function fetchCrypto() {
  setLoading('crypto-result', 'Fetching live prices...');
  hideEl('crypto-chart-wrap');
  killChart('crypto');

  try {
    bumpCount();
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,cardano&vs_currencies=usd&include_24hr_change=true');
    const data = await res.json();

    const coins = [
      { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
      { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
      { id: 'solana', name: 'Solana', symbol: 'SOL' },
      { id: 'cardano', name: 'Cardano', symbol: 'ADA' }
    ];

    const rows = coins.map(coin => {
      const d = data[coin.id];
      const change = d.usd_24h_change.toFixed(2);
      const pos = change >= 0;
      return `
        <div class="crypto-row">
          <span class="crypto-name">${coin.name}<span class="crypto-symbol">${coin.symbol}</span></span>
          <span class="crypto-price">$${d.usd.toLocaleString()}</span>
          <span class="crypto-change ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${change}%</span>
        </div>
      `;
    }).join('');

    const el = showEl('crypto-result');
    el.innerHTML = `
      <div class="card">
        <div class="card-title">Live Prices (USD)</div>
        <div class="card-meta">CoinGecko public API · Updated just now</div>
        <div class="crypto-list">${rows}</div>
      </div>
    `;

    showEl('crypto-chart-wrap');
    const changes = coins.map(c => parseFloat(data[c.id].usd_24h_change.toFixed(2)));
    charts['crypto'] = new Chart(document.getElementById('crypto-chart'), {
      type: 'bar',
      data: {
        labels: coins.map(c => c.symbol),
        datasets: [{
          data: changes,
          backgroundColor: changes.map(v => v >= 0 ? '#2a5c45' : '#b94040'),
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        ...chartDefaults(),
        scales: {
          ...chartDefaults().scales,
          y: { ...chartDefaults().scales.y, beginAtZero: false }
        }
      }
    });

  } catch {
    setError('crypto-result', 'CoinGecko may be rate-limiting this request. Wait 30 seconds and try again.');
  }
}

async function fetchGitHub() {
  const username = document.getElementById('github-input').value.trim();
  if (!username) return;

  setLoading('github-result', 'Looking up profile...');
  hideEl('github-chart-wrap');
  killChart('github');

  try {
    bumpCount();
    const res = await fetch(`https://api.github.com/users/${username}`);

    if (res.status === 404) {
      setError('github-result', `User "${username}" not found on GitHub.`);
      return;
    }

    if (res.status === 403) {
      setError('github-result', 'GitHub rate limit reached. Wait a minute and try again.');
      return;
    }

    const d = await res.json();

    const el = showEl('github-result');
    el.innerHTML = `
      <div class="card github-card">
        <img src="${d.avatar_url}" alt="${d.login}" class="github-avatar" />
        <div class="github-info">
          <div class="card-title">${d.name || d.login}</div>
          <div class="card-meta">@${d.login}${d.location ? ` · ${d.location}` : ''}</div>
          ${d.bio ? `<p class="github-bio">${d.bio}</p>` : ''}
          <div class="stat-grid mt">
            <div class="stat">
              <span class="stat-val">${d.public_repos}</span>
              <span class="stat-label">Repos</span>
            </div>
            <div class="stat">
              <span class="stat-val">${d.followers.toLocaleString()}</span>
              <span class="stat-label">Followers</span>
            </div>
            <div class="stat">
              <span class="stat-val">${d.following}</span>
              <span class="stat-label">Following</span>
            </div>
            <div class="stat">
              <span class="stat-val">${d.public_gists}</span>
              <span class="stat-label">Gists</span>
            </div>
          </div>
        </div>
      </div>
    `;

    showEl('github-chart-wrap');
    charts['github'] = new Chart(document.getElementById('github-chart'), {
      type: 'bar',
      data: {
        labels: ['Repos', 'Followers', 'Following', 'Gists'],
        datasets: [{
          data: [d.public_repos, d.followers, d.following, d.public_gists],
          backgroundColor: ['#2a5c45', '#52a07a', '#95d5b2', '#b7e4c7'],
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: chartDefaults()
    });

  } catch {
    setError('github-result', 'Failed to reach GitHub. Check your connection.');
  }
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

document.getElementById('weather-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') fetchWeather();
});

document.getElementById('github-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') fetchGitHub();
});