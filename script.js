let locationsData = [];
let userCoords = null;
let isPremiumUser = false;
let currentSelectedLocation = null;
let cachedDailyForecast = null;
let currentAIRole = 'sowing';
let lastWeatherData = null;
let lastWaveHeight = null;

// Default Emergency Coordinates (Ayeyarwady Delta)
const DEFAULT_LOC = { name: "ဟိုင်းကြီးကျွန်း (ပုသိမ်)", lat: 16.0179, lng: 94.3396 };

// Tab Switching
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const target = btn.getAttribute('data-target');
        const targetElement = document.getElementById(target);
        if(targetElement) targetElement.classList.add('active');
    });
});

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function initLocation() {
    await loadLocationsData();
    const savedLat = localStorage.getItem('ayeyar_lat');
    const savedLng = localStorage.getItem('ayeyar_lng');

    if (savedLat && savedLng) {
        userCoords = { lat: parseFloat(savedLat), lng: parseFloat(savedLng) };
        findNearestLocation();
    } else {
        fetchGPSLocation();
    }
}

async function loadLocationsData() {
    try {
        if (locationsData.length === 0) {
            const res = await fetch('locations.json');
            locationsData = await res.json();
        }
    } catch (err) {
        console.error("locations.json ဖတ်မရပါ:", err);
    }
}

function fetchGPSLocation() {
    const statusText = document.getElementById('locationStatus');
    if (statusText) statusText.innerText = "GPS ရှာနေသည်...";

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                localStorage.setItem('ayeyar_lat', userCoords.lat);
                localStorage.setItem('ayeyar_lng', userCoords.lng);
                if (statusText) statusText.innerText = "GPS ချိတ်ပြီး";
                findNearestLocation();
            },
            () => {
                fallbackToDefault("GPS ဖွင့်မထားပါ");
            },
            { timeout: 7000, enableHighAccuracy: true }
        );
    } else {
        fallbackToDefault("GPS မရနိုင်ပါ");
    }
}

function fallbackToDefault(msg) {
    const statusText = document.getElementById('locationStatus');
    if (statusText) statusText.innerText = msg;
    userCoords = { lat: DEFAULT_LOC.lat, lng: DEFAULT_LOC.lng };
    findNearestLocation();
}

function resetLocation() {
    localStorage.removeItem('ayeyar_lat');
    localStorage.removeItem('ayeyar_lng');
    fetchGPSLocation();
}

function findNearestLocation() {
    if (!locationsData || locationsData.length === 0) {
        displayLocationData({ village_mm: DEFAULT_LOC.name, latitude: DEFAULT_LOC.lat, longitude: DEFAULT_LOC.lng }, 0);
        return;
    }

    let nearest = null;
    let minDistance = Infinity;

    locationsData.forEach(loc => {
        if(loc.latitude && loc.longitude) {
            const dist = getDistance(userCoords.lat, userCoords.lng, loc.latitude, loc.longitude);
            if (dist < minDistance) {
                minDistance = dist;
                nearest = loc;
            }
        }
    });

    if (nearest) displayLocationData(nearest, minDistance);
    else displayLocationData({ village_mm: DEFAULT_LOC.name, latitude: DEFAULT_LOC.lat, longitude: DEFAULT_LOC.lng }, 0);
}

// Search Filter & Selection Fix
function filterLocations(query) {
    const listContainer = document.getElementById('searchResultsList');
    if (!query || query.trim() === '') {
        listContainer.style.display = 'none';
        return;
    }

    const q = query.toLowerCase().trim();
    const filtered = locationsData.filter(loc => {
        const nameMm = loc.village_mm || loc.township_mm || '';
        const nameEn = loc.township_en || '';
        return nameMm.includes(q) || nameEn.toLowerCase().includes(q);
    }).slice(0, 8);

    if (filtered.length === 0) {
        listContainer.style.display = 'none';
        return;
    }

    listContainer.innerHTML = '';
    filtered.forEach(loc => {
        const li = document.createElement('li');
        const title = loc.village_mm ? `${loc.village_mm} (${loc.township_mm || ''})` : loc.township_mm;
        li.innerText = title;
        li.onclick = () => selectLocationFromSearch(loc);
        listContainer.appendChild(li);
    });
    listContainer.style.display = 'block';
}

function selectLocationFromSearch(loc) {
    document.getElementById('searchResultsList').style.display = 'none';
    document.getElementById('locationSearchInput').value = '';
    userCoords = { lat: loc.latitude, lng: loc.longitude };
    localStorage.setItem('ayeyar_lat', loc.latitude);
    localStorage.setItem('ayeyar_lng', loc.longitude);
    displayLocationData(loc, 0);
}

function displayLocationData(loc, distance = 0) {
    currentSelectedLocation = loc;
    const placeName = loc.village_mm ? `${loc.village_mm} (${loc.township_mm || ''})` : (loc.township_mm || loc.township_en || DEFAULT_LOC.name);
    document.getElementById('currentLocationName').innerText = placeName;
    document.getElementById('geoCoordinates').innerText = `Lat: ${loc.latitude.toFixed(4)} | Long: ${loc.longitude.toFixed(4)} | အကွာအဝေး: ${distance.toFixed(1)} km`;
    
    fetchWeatherData(loc.latitude, loc.longitude, loc);
}

// Weather Condition Code Converter
function getWeatherDescription(code) {
    if (code === 0) return "ကောင်းကင် ကြည်လင်သည်";
    if (code >= 1 && code <= 3) return "တိမ်အသင့်အတင့် ရှိမည်";
    if (code === 51 || code === 53 || code === 55) return "🌧️ မိုးဖွဲကျနိုင်သည်";
    if (code === 61 || code === 63) return "🌧️ မိုးအသင့်အတင့် ရွာမည်";
    if (code === 65) return "🌧️ မိုးသည်းထန်စွာ ရွာမည်";
    if (code === 80 || code === 81) return "🌦️ နေရာကွက်ကျား မိုးရွာမည်";
    if (code >= 95) return "⛈️ မိုးထစ်ချုန်း ရွာမည်";
    return "မိုးတိမ်ထူထပ်မည်";
}

async function fetchWeatherData(lat, lng, loc) {
    try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=relativehumidity_2m,uv_index&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max&timezone=auto`;
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi,pm10,pm2_5`;
        const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=wave_height`;

        const [weatherRes, aqiRes, marineRes] = await Promise.all([
            fetch(weatherUrl), 
            fetch(aqiUrl),
            fetch(marineUrl).catch(() => null)
        ]);

        const weatherData = await weatherRes.json();
        const aqiData = await aqiRes.json();
        let waveHeight = null;
        
        if (marineRes && marineRes.ok) {
            const marineData = await marineRes.json();
            waveHeight = marineData.current ? marineData.current.wave_height : null;
        }

        lastWeatherData = weatherData;
        lastWaveHeight = waveHeight;
        cachedDailyForecast = weatherData.daily;

        updateUI(weatherData, aqiData, loc, waveHeight);
        renderPremiumForecast(loc);
        fetchDMHFloodData();

    } catch (err) {
        console.error("API Error:", err);
    }
}

async function fetchDMHFloodData() {
    try {
        const res = await fetch('flood-data.json');
        if (res.ok) {
            const floodData = await res.json();
            const alertBox = document.getElementById('floodAlert');
            if(alertBox && floodData.warning) {
                alertBox.innerHTML = `📢 <b>DMH ထုတ်ပြန်ချက် (${floodData.updated_at}):</b><br>${floodData.warning}`;
            }
        }
    } catch (err) {}
}

function calculateDetailedTides(lng) {
    const offset = (lng - 94.73) * 4;
    let t1 = new Date(); t1.setHours(5, 30 + Math.round(offset));
    let t2 = new Date(); t2.setHours(11, 45 + Math.round(offset));
    let t3 = new Date(); t3.setHours(18, 0 + Math.round(offset));
    let t4 = new Date(); t4.setHours(23, 50 + Math.round(offset));

    const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
        high1: { time: fmt(t1), height: "2.4m" },
        low1:  { time: fmt(t2), height: "0.6m" },
        high2: { time: fmt(t3), height: "2.2m" },
        low2:  { time: fmt(t4), height: "0.8m" }
    };
}

function updateUI(weather, aqi, loc, waveHeight) {
    const current = weather.current_weather;
    const dailyRain = weather.daily.precipitation_sum[0] || 0;
    const weatherDesc = getWeatherDescription(current.weathercode);
    const aqiVal = aqi.current ? aqi.current.european_aqi : "22";

    document.getElementById('tempValue').innerText = `${current.temperature} °C`;
    document.getElementById('weatherCondition').innerText = weatherDesc;
    document.getElementById('rainValue').innerText = `${dailyRain} mm`;
    
    // Rain Status Text
    let rainStatus = "မိုးကင်းစင်မည်";
    if (dailyRain > 25) rainStatus = "⚠️ မိုးသည်းထန်စွာ ရွာမည်";
    else if (dailyRain > 5) rainStatus = "🌧️ မိုးအသင့်အတင့် ရွာမည်";
    else if (dailyRain > 0) rainStatus = "🌦️ မိုးဖွဲကျနိုင်သည်";
    document.getElementById('rainStatusText').innerText = rainStatus;

    // Tides & Water Level
    const tides = calculateDetailedTides(loc.longitude);
    document.getElementById('highTideTime').innerText = `${tides.high1.time} / ${tides.high2.time}`;
    document.getElementById('lowTideTime').innerText = `${tides.low1.time} / ${tides.low2.time}`;
    
    const calculatedWaterLevel = (1.2 + (loc.latitude - 16.0) * 0.1 + (dailyRain * 0.02)).toFixed(2);
    document.getElementById('waterLevel').innerText = `+${calculatedWaterLevel} m (ပုံမှန်ရေမှတ်)`;

    // Wind & Wave
    document.getElementById('windSpeed').innerText = `${current.windspeed} km/h`;
    
    let calcWave = waveHeight;
    if (calcWave === null || calcWave === undefined) {
        if (current.windspeed > 30) calcWave = 2.2;
        else if (current.windspeed > 15) calcWave = 1.2;
        else calcWave = 0.6;
    }
    document.getElementById('waveHeightVal').innerText = `${calcWave} m`;
    
    let waveStat = "လှိုင်းအသင့်အတင့်";
    if (calcWave > 2.0) waveStat = "🚨 လှိုင်းကြီးနိုင်သည်";
    else if (calcWave > 1.0) waveStat = "⚠️ လှိုင်းအသင့်အတင့်ရှိ";
    else waveStat = "✅ လှိုင်းငြိမ်သည်";
    document.getElementById('waveStatus').innerText = waveStat;

    // AQI Status
    document.getElementById('aqiValue').innerText = aqiVal;
    let aqiText = "ကောင်းမွန်သည်";
    if (aqiVal > 50) aqiText = "အဆုတ်မသန်သူများ သတိပြုရန်";
    if (aqiVal > 100) aqiText = "ကျန်းမာရေး ထိခိုက်နိုင်သည်";
    document.getElementById('aqiStatusText').innerText = aqiText;

    renderAISummary();
}

// AI Role Switcher
function switchAIRole(role) {
    currentAIRole = role;
    document.querySelectorAll('.ai-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderAISummary();
}

// Advanced Modular AI Generator
function renderAISummary() {
    const container = document.getElementById('aiSummaryText');
    if (!lastWeatherData) return;

    const locName = currentSelectedLocation ? (currentSelectedLocation.village_mm || currentSelectedLocation.township_mm) : "ဤဒေသ";
    const current = lastWeatherData.current_weather;
    const daily = lastWeatherData.daily;
    const rain = daily.precipitation_sum[0] || 0;
    const rainProb = daily.precipitation_probability_max ? daily.precipitation_probability_max[0] : 30;
    const wind = current.windspeed;

    // Free User Notice
    if (!isPremiumUser) {
        container.innerHTML = `
            🤖 <b>${locName} အကြံပြုချက် (အကြန်းဖျင်း):</b><br>
            • လက်ရှိ အပူချိန် ${current.temperature}°C ရှိပြီး လေတိုက်နှုန်း ${wind} km/h ရှိပါသည်။<br>
            • မိုးရွာနိုင်ခြေ ${rainProb}% ခန့်ရှိပြီး စပါးလှန်းခြင်း/ဆေးဖြန်းခြင်းများအတွက် ⚠️ သတိပြုပါ။<br><br>
            <span style="color:#f59e0b;">🔒 မျိုးကြဲ၊ ဆေးဖြန်း၊ စပါးလှန်း၊ ရေလုပ်သား နှင့် မြစ်ကြောင်းသီးသန့် AI အသေးစိတ် အကြံပြုချက်များကို ကြည့်ရန် Premium ဖွင့်ပါ၊၊</span>
        `;
        return;
    }

    // Premium Advanced AI Output
    let text = `🤖 <b>${locName} သီးသန့် AI Pro စိုက်ပျိုးရေးနှင့် ရေကြောင်း လမ်းညွှန်:</b>\n\n`;

    if (currentAIRole === 'sowing') {
        text += `🌱 **မျိုးကြဲခြင်းနှင့် ဆေးဖြန်းခြင်း သုံးသပ်ချက်:**\n`;
        if (rainProb > 60 || rain > 15) {
            text += `❌ **မျိုးမကြဲပါနှင့်/ဆေးမဖြန်းပါနှင့်:** မိုးရွာနိုင်ခြေ ${rainProb}% ရှိပြီး မိုးဖွဲ သို့မဟုတ် မိုးသည်းထန်စွာ ရွာနိုင်သဖြင့် မျိုးစေ့ မျှောပါခြင်း၊ ဖြန်းထားသော ပိုးသတ်ဆေး/ပေါင်းသတ်ဆေးများ ဆေးကြောပါသွားပြီး ဆုံးရှုံးမှု မြင့်မားနိုင်ပါသည်။\n`;
        } else if (wind > 20) {
            text += `⚠️ **ဆေးဖြန်းရန် မသင့်တော်ပါ:** လေတိုက်နှုန်း ${wind} km/h ရှိသဖြင့် ဆေးများ လေလွင့်ပါသွားပါမည်။ လေငြိမ်ချိန် (မနက်စောစော) တွင် ဖြန်းပါ။\n`;
        } else {
            text += `✅ **အလွန်သင့်တော်ပါသည်:** မိုးကင်းစင်ပြီး လေငြိမ်သဖြင့် မျိုးကြဲခြင်း၊ ပျိုးထောင်ခြင်းနှင့် ပိုးသတ်ဆေး/မြေသြဇာ ဖြန်းခြင်းများကို စိတ်ချစွာ ပြုလုပ်နိုင်ပါသည်။\n`;
        }
    } 
    else if (currentAIRole === 'harvest') {
        text += `🚜 **ကောက်ရိတ်သိမ်းခြင်းနှင့် စပါးလှန်းခြင်း:**\n`;
        if (rain > 0 || rainProb > 40) {
            text += `⚠️ **စပါးမလှန်းပါနှင့်:** မိုးရုတ်တရက် ရွာသွန်းနိုင်ခြေ ရှိသဖြင့် စပါးအစိုဓာတ် မြင့်တက်ပြီး ပုပ်သိုးနိုင်ပါသည်။ ရိတ်သိမ်းပြီးပါက မိုးကာစ အဆင်သင့် ပြင်ထားပါ။\n`;
        } else {
            text += `✅ **စပါးလှန်းရန် အလွန်ကောင်းမွန်သည်:** နေရောင်ခြည် အပြည့်အဝ ရရှိနိုင်ပြီး အစိုဓာတ် ၁၄% အောက်ရောက်အောင် အလွယ်တကူ လှန်းနိုင်ပါမည်။ စပါးရိတ်စက်များ မကွင်းဆင်းမီ လယ်ကွင်း ရေထုတ်ထားပါ။\n`;
        }
    }
    else if (currentAIRole === 'fishery') {
        text += `🐟 **ပင်လယ်ပြင် ရေလုပ်သားများအတွက် ခန့်မှန်းချက်:**\n`;
        if (wind > 30) {
            text += `🚨 **လှိုင်းအလွန်ထန်မည်:** လေတိုက်နှုန်း ${wind} km/h အထိ မြင့်တက်နိုင်ပြီး လှိုင်းအမြင့် ၂ မီတာထက် ကျော်လွန်နိုင်ပါသည်။ **ငါးဖမ်းလှေများ စုန်းထွက်ရန် လုံးဝ မသင့်တော်ပါ။**\n`;
        } else if (wind > 18) {
            text += `⚠️ **လှိုင်းအသင့်အတင့်ရှိမည်:** ပင်လယ်ပြင်တွင် လှိုင်းအမြင့် ၁.၂ - ၁.၈ မီတာ ရှိနိုင်သဖြင့် ကမ်းဝေး/ကမ်းနီး လှေများ သတိပြု သွားလာပါ။\n`;
        } else {
            text += `✅ **ပင်လယ်ပြင် သာယာမည်:** လှိုင်းအမြင့် ၁ မီတာအောက်သာ ရှိမည်ဖြစ်၍ ငါးဖမ်းလုပ်ငန်းများ ပုံမှန် လုပ်ဆောင်နိုင်ပါသည်။\n`;
        }
    }
    else if (currentAIRole === 'river') {
        text += `🚤 **မြစ်ဆုံနှင့် ရေကြောင်း သွားလာရေး:**\n`;
        text += `• ဧရာဝတီမြစ်ရေမှတ်နှင့် ဒီရေ အတက်/အကျ ပြောင်းလဲမှုအရ ရေနိမ့်ပိုင်း ကူးတို့လှေများနှင့် စက်လှေများ ဒီရေကျချိန် မြစ်သဲသောင်ပြင် တင်ခြင်းကို သတိပြုပါ။\n`;
        text += `• မြစ်ဝကျွန်းပေါ် မြစ်ဆုံများတွင် လေတိုက်နှုန်း ${wind} km/h ရှိမည်ဖြစ်၍ လှိုင်းငယ်များ ထနိုင်ပါသည်။\n`;
    }

    container.innerText = text;
}

function renderPremiumForecast(loc) {
    const container = document.getElementById('premiumForecastContainer');
    if (!container) return;

    if (!isPremiumUser) {
        container.innerHTML = `
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; padding: 10px; border-radius: 8px; text-align: center;">
                <p style="font-size:0.82rem; color:#f59e0b; margin:0 0 6px 0;">🔒 ရှေ့ (၃) ရက်စာ မိုးရွာနိုင်ခြေ (%) နှင့် မုန်တိုင်း အခြေအနေကို ကြည့်ရန် Premium ဖွင့်ပါ</p>
                <button onclick="unlockPremiumMock()" style="background: #f59e0b; color: #000; border: none; padding: 6px 14px; border-radius: 6px; font-weight: bold; cursor: pointer;">
                    👑 Premium ဖွင့်မည် (Free Unlock)
                </button>
            </div>
        `;
        return;
    }

    if (!cachedDailyForecast) return;

    let html = `<div style="display:flex; flex-direction:column; gap:8px;">`;
    for (let i = 0; i < 3; i++) {
        const dateStr = cachedDailyForecast.time[i];
        const maxTemp = cachedDailyForecast.temperature_2m_max[i];
        const minTemp = cachedDailyForecast.temperature_2m_min[i];
        const rain = cachedDailyForecast.precipitation_sum[i];
        const rainProb = cachedDailyForecast.precipitation_probability_max ? cachedDailyForecast.precipitation_probability_max[i] : 30;
        const code = cachedDailyForecast.weathercode ? cachedDailyForecast.weathercode[i] : 0;
        const desc = getWeatherDescription(code);
        const dayLabel = i === 0 ? "ယနေ့" : (i === 1 ? "မနက်ဖြန်" : "သဘက်ခါ");

        html += `
            <div style="background: rgba(255, 255, 255, 0.08); padding: 8px 12px; border-radius: 6px; border-left: 3px solid #f59e0b;">
                <div style="display:flex; justify-content:space-between; font-size:0.83rem; font-weight:bold; color:#2dd4bf;">
                    <span>${dayLabel} (${dateStr})</span>
                    <span style="color:#60a5fa;">🌧️ ရွာနိုင်ခြေ: ${rainProb}%</span>
                </div>
                <div style="font-size:0.78rem; margin-top:3px; color:#e2e8f0;">
                    ${desc} | 🌡️ ${minTemp}°C - ${maxTemp}°C | 🌧️ မိုးရေချိန်: ${rain} mm
                </div>
            </div>
        `;
    }
    html += `</div>`;
    container.innerHTML = html;
}

function togglePremiumModal() {
    const overlay = document.getElementById('premiumOverlay');
    if (overlay) overlay.style.display = overlay.style.display === 'flex' ? 'none' : 'flex';
}

function unlockPremiumMock() {
    isPremiumUser = true;
    const overlay = document.getElementById('premiumOverlay');
    if (overlay) overlay.style.display = 'none';
    renderPremiumForecast();
    renderAISummary();
}

document.addEventListener('DOMContentLoaded', () => {
    initLocation();
});
