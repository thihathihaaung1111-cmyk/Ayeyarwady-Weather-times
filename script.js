let locationsData = [];
let userCoords = null;
let isPremiumUser = false;
let currentSelectedLocation = null;
let cachedDailyForecast = null;
let currentAIRole = 'sowing';
let lastWeatherData = null;
let lastWaveHeight = null;

// Default Coastal Emergency Coords (Hainggyikyun)
const DEFAULT_LOC = { name: "ဟိုင်းကြီးကျွန်း (ငပုတော)", lat: 16.0179, lng: 94.3396, isCoastal: true };

// ကမ်းရိုးတန်းနှင့် ပင်လယ်ပြင်နှင့် ထိစပ်နေသော မြို့နယ်/ရွာများ စာရင်း
const COASTAL_TOWNSHIPS = [
    "hainggyikyun", "ngapudaw", "chaungtha", "ngwesaung", "pyapon", 
    "laputta", "bogale", "mawlamyinegyun", "dedaye", "kyaiklat",
    "ဟိုင်းကြီးကျွန်း", "ငပုတော", "ချောင်းသာ", "ငွေဆောင်", "ဖျာပုံ", 
    "လပွတ္တာ", "ဘိုကလေး", "မော်လမြိုင်ကျွန်း", "ဒေးဒရဲ", "ကျိုက်လတ်"
];

// Tab System Setup
document.addEventListener('DOMContentLoaded', () => {
    initLocation();
    setupTabEvents();
    renderWeatherGlossary(); // အောက်ခြေတွင် အဓိပ္ပာယ်ရှင်းလင်းချက်များ ထည့်သွင်းရန်
});

function setupTabEvents() {
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
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// မြို့နယ်သည် ကမ်းရိုးတန်း/ပင်လယ်ပြင်နှင့် ထိစပ်မှု ရှိမရှိ စစ်ဆေးခြင်း
function checkIsCoastal(loc) {
    if (!loc) return false;
    const townshipEn = (loc.township_en || "").toLowerCase();
    const townshipMm = (loc.township_mm || "").toLowerCase();
    const villageMm = (loc.village_mm || "").toLowerCase();

    return COASTAL_TOWNSHIPS.some(key => 
        townshipEn.includes(key) || townshipMm.includes(key) || villageMm.includes(key)
    );
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
        console.error("locations.json ဖတ်၍မရပါ:", err);
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
            () => fallbackToDefault("GPS ဖွင့်မထားပါ"),
            { timeout: 8000, enableHighAccuracy: true }
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

function getWeatherDescription(code) {
    if (code === 0) return "☀️ ကောင်းကင် သာယာကြည့်လင်သည်";
    if (code >= 1 && code <= 3) return "⛅ တိမ်အသင့်အတင့် ရှိမည်";
    if (code === 51 || code === 53 || code === 55) return "🌦️ မိုးဖွဲကျနိုင်သည်";
    if (code === 61 || code === 63) return "🌧️ မိုးအသင့်အတင့် ရွာမည်";
    if (code === 65) return "🌧️ မိုးသည်းထန်စွာ ရွာမည်";
    if (code === 80 || code === 81) return "🌧️ နေရာကွက်ကျား မိုးရွာမည်";
    if (code >= 95) return "⛈️ မိုးထစ်ချုန်း ရွာမည်";
    return "☁️ မိုးတိမ်ထူထပ်မည်";
}

async function fetchWeatherData(lat, lng, loc) {
    try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=relativehumidity_2m,uv_index&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max&timezone=auto`;
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi`;
        const isCoastal = checkIsCoastal(loc);

        let marineUrl = null;
        if (isCoastal) {
            marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=wave_height`;
        }

        const [weatherRes, aqiRes, marineRes] = await Promise.all([
            fetch(weatherUrl),
            fetch(aqiUrl),
            marineUrl ? fetch(marineUrl).catch(() => null) : null
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

        updateUI(weatherData, aqiData, loc, waveHeight, isCoastal);
        renderPremiumForecast(loc);
        fetchDMHFloodData();

    } catch (err) {
        console.error("API Fetch Error:", err);
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

function updateUI(weather, aqi, loc, waveHeight, isCoastal) {
    const current = weather.current_weather;
    const dailyRain = weather.daily.precipitation_sum[0] || 0;
    const weatherDesc = getWeatherDescription(current.weathercode);
    const aqiVal = aqi.current ? aqi.current.european_aqi : "18";

    document.getElementById('tempValue').innerText = `${current.temperature} °C`;
    document.getElementById('weatherCondition').innerText = weatherDesc;
    document.getElementById('rainValue').innerText = `${dailyRain} mm`;
    
    // မိုးရေချိန် အခြေအနေ အတိအကျ စစ်ထုတ်ခြင်း
    let rainStatus = "မိုးကင်းစင်မည်";
    if (dailyRain > 35) rainStatus = "🌧️ မိုးသည်းထန်စွာ ရွာမည်";
    else if (dailyRain > 10) rainStatus = "🌧️ မိုးအသင့်အတင့် ရွာမည်";
    else if (dailyRain > 0) rainStatus = "🌦️ မိုးဖွဲကျနိုင်သည်";
    document.getElementById('rainStatusText').innerText = rainStatus;

    // ဒီရေ အချက်အလက်
    const tides = calculateDetailedTides(loc.longitude);
    document.getElementById('highTideTime').innerText = `${tides.high1.time} / ${tides.high2.time}`;
    document.getElementById('lowTideTime').innerText = `${tides.low1.time} / ${tides.low2.time}`;
    
    const calculatedWaterLevel = (1.2 + (loc.latitude - 16.0) * 0.1 + (dailyRain * 0.02)).toFixed(2);
    document.getElementById('waterLevel').innerText = `+${calculatedWaterLevel} m (ပုံမှန်ရေမှတ်)`;

    // လေတိုက်နှုန်း နှင့် လှိုင်းအမြင့် (ကမ်းရိုးတန်းစစ်မှပြမည်)
    document.getElementById('windSpeed').innerText = `${current.windspeed} km/h`;
    
    const waveEl = document.getElementById('waveHeightVal');
    const waveStatEl = document.getElementById('waveStatus');

    if (!isCoastal) {
        waveEl.innerText = "N/A";
        waveStatEl.innerText = "ကမ်းရိုးတန်းမဟုတ်ပါ (သက်ဆိုင်ခြင်းမရှိ)";
    } else {
        let displayWave = waveHeight;
        if (displayWave === null || displayWave === undefined) {
            displayWave = current.windspeed > 25 ? 1.8 : 0.6; // Fallback
        }
        waveEl.innerText = `${displayWave} m`;
        
        if (displayWave > 2.0) waveStatEl.innerText = "🚨 လှိုင်းကြီးနိုင်သည်";
        else if (displayWave > 1.0) waveStatEl.innerText = "⚠️ လှိုင်းအသင့်အတင့်ရှိ";
        else waveStatEl.innerText = "✅ လှိုင်းငြိမ်သည် (ပင်လယ်ပြင် သာယာ)";
    }

    // လေထုအရည်အသွေး (AQI)
    document.getElementById('aqiValue').innerText = aqiVal;
    let aqiText = "🟢 သန့်ရှင်းကောင်းမွန်သည်";
    if (aqiVal > 50) aqiText = "🟡 အဆုတ်မသန်သူများ သတိပြုရန်";
    if (aqiVal > 100) aqiText = "🔴 ကျန်းမာရေး ထိခိုက်နိုင်သည်";
    document.getElementById('aqiStatusText').innerText = aqiText;

    renderAISummary();
}

function switchAIRole(role) {
    currentAIRole = role;
    document.querySelectorAll('.ai-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    renderAISummary();
}

// AI စိုက်ပျိုးရေးနှင့် လှိုင်း ခန့်မှန်းချက် Logic ပြင်ဆင်ချက်
function renderAISummary() {
    const container = document.getElementById('aiSummaryText');
    if (!lastWeatherData) return;

    const locName = currentSelectedLocation ? (currentSelectedLocation.village_mm || currentSelectedLocation.township_mm) : "ဤဒေသ";
    const current = lastWeatherData.current_weather;
    const daily = lastWeatherData.daily;
    const rain = daily.precipitation_sum[0] || 0;
    const rainProb = daily.precipitation_probability_max ? daily.precipitation_probability_max[0] : 30;
    const wind = current.windspeed;
    const isCoastal = checkIsCoastal(currentSelectedLocation);

    if (!isPremiumUser) {
        container.innerHTML = `
            🤖 <b>${locName} အကြံပြုချက် (အကြန်းဖျင်း):</b><br>
            • လက်ရှိ အပူချိန် ${current.temperature}°C, လေတိုက်နှုန်း ${wind} km/h ရှိပါသည်။<br>
            • မိုးရွာနိုင်ခြေ ${rainProb}% ရှိပါသည်။<br><br>
            <span style="color:#f59e0b;">🔒 မျိုးကြဲ၊ ဆေးဖြန်း၊ စပါးလှန်း၊ ရေလုပ်သား နှင့် မြစ်ကြောင်းသီးသန့် AI အဆင့်မြင့် လမ်းညွှန်ချက်များ ကြည့်ရန် Premium ဖွင့်ပါ၊၊</span>
        `;
        return;
    }

    let text = `🤖 <b>${locName} သီးသန့် AI Pro စိုက်ပျိုးရေးနှင့် ရေကြောင်း လမ်းညွှန်:</b>\n\n`;

    if (currentAIRole === 'sowing') {
        text += `🌱 **မျိုးကြဲခြင်းနှင့် ဆေးဖြန်းခြင်း သုံးသပ်ချက်:**\n`;
        if (rain > 20 || rainProb > 70) {
            text += `❌ **မျိုးမကြဲပါနှင့် / ဆေးမဖြန်းပါနှင့်:** မိုးသည်းထန်စွာ ရွာနိုင်ခြေ မြင့်မားသဖြင့် မျိုးစေ့များ မျှောပါသွားနိုင်ပါသည်။\n`;
        } else if (rain > 0 && rain <= 3) {
            text += `✅ **မျိုးကြဲရန် / ပျိုးထောင်ရန် သင့်တော်ပါသည်:** မိုးဖွဲကျရုံ (မိုးရေချိန် ${rain}mm) သာရှိသဖြင့် မြေဆီလွှာ စိုစွတ်ပြီး အပင်ပေါက်နှုန်း အထူးကောင်းမွန်ပါမည်။\n`;
        } else if (wind > 18) {
            text += `⚠️ **ဆေးဖြန်းရန် မသင့်တော်ပါ:** လေတိုက်နှုန်း ${wind} km/h ရှိသဖြင့် ဆေးများ လေလွင့်ပါသွားပါမည်။ လေငြိမ်ချိန်မှ ဖြန်းပါ။\n`;
        } else {
            text += `✅ **အလွန်သင့်တော်ပါသည်:** ရာသီဥတု သာယာပြီး လေငြိမ်သဖြင့် ပိုးသတ်ဆေး/မြေသြဇာ ဖြန်းခြင်းနှင့် မျိုးကြဲခြင်း စိတ်ချစွာ ပြုလုပ်နိုင်ပါသည်။\n`;
        }
    } 
    else if (currentAIRole === 'harvest') {
        text += `🚜 **ကောက်ရိတ်သိမ်းခြင်းနှင့် စပါးလှန်းခြင်း:**\n`;
        if (rain > 5 || rainProb > 50) {
            text += `⚠️ **စပါးမလှန်းပါနှင့်:** မိုးရုတ်တရက် ရွာသွန်းနိုင်ခြေ ရှိသဖြင့် စပါးအစိုဓာတ် မြင့်တက်နိုင်ပါသည်။ ရိတ်သိမ်းပြီးပါက အမိုးအကာအောက် ရွှေ့ပါ။\n`;
        } else {
            text += `✅ **စပါးလှန်းရန် အလွန်ကောင်းမွန်သည်:** နေရောင်ခြည် အပြည့်အဝ ရရှိနိုင်ပြီး အစိုဓာတ် ၁၄% အောက်ရောက်အောင် အလွယ်တကူ လှန်းနိုင်ပါမည်။\n`;
        }
    }
    else if (currentAIRole === 'fishery') {
        text += `🐟 **ပင်လယ်ပြင် ရေလုပ်သားများအတွက် ခန့်မှန်းချက်:**\n`;
        if (!isCoastal) {
            text += `ℹ️ **သတိပြုရန်:** ဤဒေသသည် ကမ်းရိုးတန်း သို့မဟုတ် ပင်လယ်ပြင်နှင့် တိုက်ရိုက် ထိစပ်ခြင်း မရှိပါ။ (တောင်ပေါ်/ပြည်တွင်း မြို့နယ်ဖြစ်ပါသည်။)\n`;
        } else if (wind > 28) {
            text += `🚨 **လှိုင်းအလွန်ထန်မည်:** လေတိုက်နှုန်း ${wind} km/h ရှိပြီး လှိုင်းအမြင့် ၂ မီတာအထက် ရှိနိုင်သဖြင့် **ငါးဖမ်းလှေများ စုန်းမထွက်သင့်ပါ။**\n`;
        } else {
            text += `✅ **ပင်လယ်ပြင် သာယာမည်:** လှိုင်းအမြင့် ၁ မီတာအောက်သာ ရှိမည်ဖြစ်၍ ငါးဖမ်းလုပ်ငန်းများ ပုံမှန် လုပ်ဆောင်နိုင်ပါသည်။\n`;
        }
    }
    else if (currentAIRole === 'river') {
        text += `🚤 **မြစ်ဆုံနှင့် ရေကြောင်း သွားလာရေး:**\n`;
        text += `• ဒီရေ အတက်/အကျ ပြောင်းလဲမှုအရ ရေနိမ့်ပိုင်း ကူးတို့လှေများနှင့် စက်လှေများ ဒီရေကျချိန် မြစ်သဲသောင်ပြင် တင်ခြင်းကို သတိပြုပါ။\n`;
        text += `• လေတိုက်နှုန်း ${wind} km/h ရှိမည်ဖြစ်၍ မြစ်ဝကျွန်းပေါ် မြစ်ဆုံများတွင် လှိုင်းငယ်များ အနည်းငယ် ထနိုင်ပါသည်။\n`;
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
                    👑 Premium ဖွင့်မည် (Free Click)
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

// စာမျက်နှာအောက်ခြေ မိုးလေဝသ ဝေါဟာရ အဓိပ္ပာယ်ရှင်းလင်းချက် (Glossary Section)
function renderWeatherGlossary() {
    let glossaryContainer = document.getElementById('weatherGlossarySection');
    if (!glossaryContainer) {
        glossaryContainer = document.createElement('div');
        glossaryContainer.id = 'weatherGlossarySection';
        glossaryContainer.style.cssText = "margin-top: 20px; padding: 12px; background: #11221c; border-top: 2px solid #0d9488; border-radius: 8px;";
        document.querySelector('.container').appendChild(glossaryContainer);
    }

    glossaryContainer.innerHTML = `
        <h3 style="color:#2dd4bf; font-size:0.95rem; margin-bottom:8px;">📚 မိုးလေဝသ ဝေါဟာရ အဓိပ္ပာယ်ရှင်းလင်းချက်များ</h3>
        <div style="font-size:0.8rem; color:#cbd5e1; display:flex; flex-direction:column; gap:8px; line-height:1.5;">
            <div><b>⛈️ မိုးထစ်ချုန်းရွာခြင်း:</b> လျှပ်စီးလက်ခြင်း၊ မိုးကြိုးပစ်ခြင်းများနှင့်အတူ မိုးသည်းထန်စွာ လေပြင်းတိုက်ခတ်၍ ရွာသွန်းသော မိုးအမျိုးအစားဖြစ်ပါသည်။</div>
            <div><b>🌦️ နေရာကွက်ကျား မိုးရွာခြင်း:</b> မြို့တစ်မြို့လုံး မဟုတ်ဘဲ အချို့သော ရပ်ကွက် သို့မဟုတ် ကျေးရွာအနည်းငယ်တွင်သာ သီးသန့် ရွာသွန်းခြင်းဖြစ်ပါသည်။</div>
            <div><b>🌧️ မိုးဖွဲကျခြင်း:</b> မိုးရေချိန် ၃ မီလီမီတာအောက် နည်းပါးစွာ ပေါ့ပါးစွာ ရွာခြင်းဖြစ်ပြီး ပျိုးခင်းများအတွက် အစိုဓာတ် ရရှိစေပါသည်။</div>
            <div><b>🌊 လှိုင်းအမြင့် (Wave Height):</b> ပင်လယ်ပြင် ရေမျက်နှာပြင်မှ လှိုင်းထိပ်အထိ အမြင့်ဖြစ်ပြီး ၁.၅ မီတာထက် ကျော်လွန်ပါက စက်လှေငယ်များ သတိပြုရပါမည်။</div>
            <div><b>🌫️ လေထုအရည်အသွေး (AQI):</b> လေထုအတွင်း ဖုန်မှုန့်နှင့် ဓာတ်ငွေ့ ပါဝင်မှုကို တိုင်းတာခြင်းဖြစ်ပြီး ကိန်းဂဏန်း ၅၀ အောက်ဆိုပါက အဆုတ်ကျန်းမာရေးအတွက် အလွန်သန့်ရှင်းပါသည်။</div>
        </div>
    `;
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
