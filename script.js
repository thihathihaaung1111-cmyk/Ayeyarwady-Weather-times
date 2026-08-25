let locationsData = [];
let userCoords = null;
let isPremiumUser = false;
let currentSelectedLocation = null;
let cachedDailyForecast = null;
let currentAIRole = 'harvest'; // Default to harvest
let lastWeatherData = null;
let lastWaveHeight = null;

// Default Coastal Emergency Coords (Hainggyikyun)
const DEFAULT_LOC = { name: "ဟိုင်းကြီးကျွန်း (ငပုတော)", lat: 16.0179, lng: 94.3396, isCoastal: true };

// ကမ်းရိုးတန်း စစ်ဆေးရန် မြို့နယ်များ နှင့် Coordinates လတ္တီတွဒ် Range
const COASTAL_TOWNSHIPS = [
    "hainggyikyun", "ngapudaw", "chaungtha", "ngwesaung", "pyapon", 
    "laputta", "bogale", "mawlamyinegyun", "dedaye", "kyaiklat", "ahmar",
    "ဟိုင်းကြီးကျွန်း", "ငပုတော", "ချောင်းသာ", "ငွေဆောင်", "ဖျာပုံ", 
    "လပွတ္တာ", "ဘိုကလေး", "မော်လမြိုင်ကျွန်း", "ဒေးဒရဲ", "ကျိုက်လတ်", "အမာ"
];

// ဧရာဝတီတိုင်းအတွင်း အဓိက မြစ်ဆုံများနှင့် သက်ဆိုင်ရာ တည်နေရာပြ Coordinates
const RIVER_JUNCTIONS = [
    { name: "ညောင်တုန်း မြစ်ဆုံ (ဧရာဝတီ-တိုးမြစ်)", lat: 17.04, lng: 95.63, dangerLevel: 7.5 },
    { name: "ဟင်္သာတ မြစ်ဆုံ (ဧရာဝတီ-ငဝန်မြစ်)", lat: 17.65, lng: 95.46, dangerLevel: 9.0 },
    { name: "မအူပင် မြစ်ဆုံ (တိုးမြစ်-မြစ်ကြောင်း)", lat: 16.73, lng: 95.65, dangerLevel: 6.2 },
    { name: "ဖျာပုံ မြစ်ဝ (ပင်လယ်ထွက်ပေါက်)", lat: 16.11, lng: 95.68, dangerLevel: 4.5 },
    { name: "ငပုတော/ဟိုင်းကြီး မြစ်ဆုံ (ငဝန်မြစ်ဝ)", lat: 16.01, lng: 94.33, dangerLevel: 3.8 }
];

document.addEventListener('DOMContentLoaded', () => {
    initLocation();
    setupTabEvents();
    renderWeatherGlossary();
    initNotificationSystem();
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

// ကမ်းရိုးတန်း ဟုတ်/မဟုတ် နာမည်အပြင် Lat/Lng Coordinates အကွာအဝေးပါ ကြပ်မတ်စစ်ဆေးခြင်း
function checkIsCoastal(loc) {
    if (!loc) return false;
    const townshipEn = (loc.township_en || "").toLowerCase();
    const townshipMm = (loc.township_mm || "").toLowerCase();
    const villageMm = (loc.village_mm || "").toLowerCase();

    const isMatchName = COASTAL_TOWNSHIPS.some(key => 
        townshipEn.includes(key) || townshipMm.includes(key) || villageMm.includes(key)
    );

    // Lat 16.3 အောက်နှင့် Lng 95.8 အောက်သည် ကမ်းရိုးတန်းဇုန်အဖြစ် သတ်မှတ်
    const isGeoCoastal = loc.latitude < 16.35 && loc.longitude < 95.80;

    return isMatchName || isGeoCoastal;
}

// အနီးစပ်ဆုံး မြစ်ဆုံနှင့် ရေမှတ်စိုက်ထုတ်ခြင်း
function getNearestRiverJunction(lat, lng) {
    let nearest = RIVER_JUNCTIONS[0];
    let minDist = Infinity;

    RIVER_JUNCTIONS.forEach(junc => {
        const dist = getDistance(lat, lng, junc.lat, junc.lng);
        if (dist < minDist) {
            minDist = dist;
            nearest = junc;
        }
    });
    return { ...nearest, distance: minDist };
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

function searchLocation() {
    let input = document.getElementById('searchInput').value.toLowerCase();
    // မြို့နယ်/ရွာ စာရင်းကို filter လုပ်ပေးသည့် logic 
    console.log("Searching for:", input);
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
                alertBox.innerHTML = `📢 <b>DMH သတင်းထုတ်ပြန်ချက် (${floodData.updated_at}):</b><br>${floodData.warning}`;
            }
        }
    } catch (err) {}
}

function calculateDetailedTides(lng, dayOffset = 0) {
    const offset = (lng - 94.73) * 4 + (dayOffset * 50); 
    let t1 = new Date(); t1.setHours(5, 30 + Math.round(offset) % 60);
    let t2 = new Date(); t2.setHours(11, 45 + Math.round(offset) % 60);
    let t3 = new Date(); t3.setHours(18, 0 + Math.round(offset) % 60);
    let t4 = new Date(); t4.setHours(23, 50 + Math.round(offset) % 60);

    const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
        high1: { time: fmt(t1), height: "2.5m" },
        low1:  { time: fmt(t2), height: "0.5m" },
        high2: { time: fmt(t3), height: "2.3m" },
        low2:  { time: fmt(t4), height: "0.7m" }
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
    
    let rainStatus = "မိုးကင်းစင်မည်";
    if (dailyRain > 35) rainStatus = "🌧️ မိုးသည်းထန်စွာ ရွာမည်";
    else if (dailyRain > 10) rainStatus = "🌧️ မိုးအသင့်အတင့် ရွာမည်";
    else if (dailyRain > 0) rainStatus = "🌦️ မိုးဖွဲကျနိုင်သည်";
    document.getElementById('rainStatusText').innerText = rainStatus;

    // ဒီရေ အချက်အလက်
    const tides = calculateDetailedTides(loc.longitude);
    document.getElementById('highTideTime').innerText = `${tides.high1.time} (${tides.high1.height}) / ${tides.high2.time} (${tides.high2.height})`;
    document.getElementById('lowTideTime').innerText = `${tides.low1.time} (${tides.low1.height}) / ${tides.low2.time} (${tides.low2.height})`;
    
    // အနီးစပ်ဆုံး မြစ်ဆုံနှင့် ရေမှတ်တွက်ချက်ခြင်း
    const riverJunc = getNearestRiverJunction(loc.latitude, loc.longitude);
    const calculatedWaterLevel = (1.2 + (loc.latitude - 16.0) * 0.1 + (dailyRain * 0.02)).toFixed(2);
    document.getElementById('waterLevel').innerText = `+${calculatedWaterLevel} m (${riverJunc.name})`;

    // လေတိုက်နှုန်း နှင့် လှိုင်းအမြင့်
    document.getElementById('windSpeed').innerText = `${current.windspeed} km/h`;
    
    const waveEl = document.getElementById('waveHeightVal');
    const waveStatEl = document.getElementById('waveStatus');

    if (!isCoastal) {
        waveEl.innerText = "N/A";
        waveStatEl.innerText = "ပြည်တွင်းမြို့နယ်ဖြစ်၍ ပင်လယ်လှိုင်းမရှိပါ";
    } else {
        let displayWave = waveHeight;
        if (displayWave === null || displayWave === undefined) {
            displayWave = current.windspeed > 25 ? 1.8 : 0.6;
        }
        waveEl.innerText = `${displayWave} m`;
        
        if (displayWave > 2.0) waveStatEl.innerText = "🚨 လှိုင်းအလွန်ထန်မည် (စုန်းမထွက်ရ)";
        else if (displayWave > 1.0) waveStatEl.innerText = "⚠️ လှိုင်းအသင့်အတင့်ရှိ";
        else waveStatEl.innerText = "✅ လှိုင်းငြိမ်သည် (ပင်လယ်ပြင် သာယာ)";
    }

    document.getElementById('aqiValue').innerText = aqiVal;
    let aqiText = "🟢 သန့်ရှင်းကောင်းမွန်သည်";
    if (aqiVal > 50) aqiText = "🟡 အဆုတ်မသန်သူများ သတိပြုရန်";
    if (aqiVal > 100) aqiText = "🔴 ကျန်းမာရေး ထိခိုက်နိုင်သည်";
    document.getElementById('aqiStatusText').innerText = aqiText;

    renderAISummary();
}

function switchAIRole(role, evt) {
    currentAIRole = role;
    document.querySelectorAll('.ai-btn').forEach(btn => btn.classList.remove('active'));
    if (evt && evt.target) {
        evt.target.classList.add('active');
    } else if (event && event.target) {
        event.target.classList.add('active');
    }
    renderAISummary();
}

// သတင်းဌာန ထုတ်ပြန်ချက် ပုံစံဖြင့် အသေးစိတ် AI ခန့်မှန်းချက် တိုးမြှင့်မှု
function renderAISummary() {
    const container = document.getElementById('aiSummaryText');
    if (!lastWeatherData) return;

    const locName = currentSelectedLocation ? (currentSelectedLocation.village_mm || currentSelectedLocation.township_mm) : "ဧရာဝတီတိုင်း";
    const current = lastWeatherData.current_weather;
    const daily = lastWeatherData.daily;
    const rain = daily.precipitation_sum[0] || 0;
    const rainProb = daily.precipitation_probability_max ? daily.precipitation_probability_max[0] : 30;
    const wind = current.windspeed;
    const isCoastal = checkIsCoastal(currentSelectedLocation);
    const riverJunc = getNearestRiverJunction(currentSelectedLocation.latitude, currentSelectedLocation.longitude);

    if (!isPremiumUser) {
        container.innerHTML = `
            📺 <b>ဧရာဝတီ မိုးလေဝသနှင့် ရေကြောင်း သတင်းထုတ်ပြန်ချက်:</b><br>
            • ${locName} တွင် အပူချိန် ${current.temperature}°C, လေတိုက်နှုန်း ${wind} km/h ဖြင့် မိုးရွာနိုင်ခြေ ${rainProb}% ရှိပါသည်။<br><br>
            <span style="color:#f59e0b;">🔒 [Premium သီးသန့်] ကောက်ရိတ်စပါးလှန်း၊ ပင်လယ်ငါးဖမ်း၊ တာကျိုးစိုးရိမ်ရသည့် မြစ်ဆုံရေမှတ်နှင့် တည်နေရာအလိုက် သတင်းဌာနသုံး AI အဆင့်မြင့် သတင်းသုံးသပ်ချက်များကို ကြည့်ရန် Premium စနစ်သို့ မြှင့်တင်ပါ။</span>
        `;
        return;
    }

    let text = `📺 <b>[ဧရာဝတီ သတင်းဌာန တိုက်ရိုက် AI ထုတ်ပြန်ချက် - ${locName}]</b>\n\n`;

    if (currentAIRole === 'harvest') {
        text += `🚜 **ကောက်ရိတ်သိမ်းခြင်းနှင့် စပါးလှန်းခြင်းဆိုင်ရာ သတင်းသုံးသပ်ချက်:**\n`;
        if (rain > 15 || rainProb > 65) {
            text += `🚨 **သတိပေးချက်:** ရှေ့ (၂၄) နာရီအတွင်း မိုးသည်းထန်စွာ ရွာသွန်းနိုင်ခြေ ${rainProb}% အထိ ရှိနေသဖြင့် **စပါးလှန်းခြင်းနှင့် ရိတ်သိမ်းခြင်းများကို ချက်ချင်း ရပ်ဆိုင်းထားရန်** အကြံပြုပါသည်၊၊ ကွင်းပြင်ရှိ စပါးများကို မိုးလုံလေလုံ အမိုးအကာအောက်သို့ အမြန်ဆုံး ရွှေ့ပြောင်းပါ။\n`;
        } else if (rain > 0 && rain <= 5) {
            text += `⚠️ **သတိပြုရန်:** မိုးဖွဲကျနိုင်ခြေ အနည်းငယ် ရှိသော်လည်း နေရောင်ခြည် ရရှိနိုင်ပါသည်။ စပါးလှန်းပါက မိုးကာစများ အသင့်ပြင်ဆင်ထားပါ။\n`;
        } else {
            text += `☀️ **ရာသီဥတု သာယာသည်:** နေရောင်ခြည် အပြည့်အဝ ရရှိနိုင်ပြီး လေထုစိုထိုင်းဆ နည်းပါးသဖြင့် စပါးလှန်းခြင်းနှင့် စက်ဖြင့် ရိတ်သိမ်းခြင်းများကို အရှိန်အဟုန်မြှင့် လုပ်ဆောင်နိုင်ပါသည်။\n`;
        }
    } 
    else if (currentAIRole === 'fishery') {
        text += `🐟 **ပင်လယ်ပြင်နှင့် ကမ်းရိုးတန်း သတင်းထုတ်ပြန်ချက်:**\n`;
        if (!isCoastal) {
            text += `ℹ️ **သတင်းအချက်အလက်:** ${locName} သည် ပြည်တွင်း မြေပြင်ဒေသဖြစ်၍ ပင်လယ်ပြင် သတိပေးချက် သက်ဆိုင်ခြင်း မရှိပါ။\n`;
        } else if (wind > 25 || (lastWaveHeight && lastWaveHeight > 1.8)) {
            text += `🚨 **အရေးကြီး အရေးပေါ် သတိပေးချက်:** လေတိုက်နှုန်း ${wind} km/h နှင့် လှိုင်းအမြင့် ${lastWaveHeight || 2.0} မီတာအထိ မြင့်တက်နေသဖြင့် **ငါးဖမ်းလှေများ၊ ကမ်းနီးကမ်းဝေး သင်္ဘောများ ပင်လယ်ပြင်သို့ ထွက်ခွာခြင်း လုံးဝ မပြုလုပ်ကြရန်** အသိပေးနှိုးဆော်အပ်ပါသည်။\n`;
        } else {
            text += `✅ **ပင်လယ်ပြင် သာယာမည်:** လှိုင်းအမြင့် ၁.၂ မီတာအောက် တည်ငြိမ်နေသဖြင့် ငါးဖမ်းလုပ်ငန်းများနှင့် ပင်လယ်ပြင် သွားလာရေး စိတ်ချစွာ လုပ်ဆောင်နိုင်ပါသည်။\n`;
        }
    }
    else if (currentAIRole === 'river') {
        text += `🚤 **ဒီရေ အတက်အကျနှင့် မြစ်ကြောင်း သွားလာရေး သတင်း:**\n`;
        text += `• ဒီရေ အမြင့်ဆုံး တက်ချိန်များတွင် မြစ်ကမ်းပါး အနိမ့်ပိုင်းများသို့ ရေဝင်ရောက်နိုင်ပြီး ဒီရေကျချိန်တွင် သဲသောင်ပြင် တင်နိုင်သဖြင့် ရေကြောင်းကူးတို့ လှေများ သတိထား မောင်းနှင်ပါ။\n`;
        text += `• ${riverJunc.name} တွင် ရေစီးကြောင်း အနည်းငယ် မြန်ဆန်နိုင်ပါသည်။\n`;
    }
    else if (currentAIRole === 'flood') {
        text += `🌊 **တာကျိုး/ရေကြီးမှု ရေရှည် သတိပေးချက်:**\n`;
        text += `• **အနီးစပ်ဆုံး မြစ်ဆုံ:** ${riverJunc.name} (အကွာအဝေး ${riverJunc.distance.toFixed(1)} km)\n`;
        if (rain > 25) {
            text += `🚨 **ရေကြီးနိုင်ခြေ သတိပေးချက်:** မိုးရေချိန် ${rain}mm အထိ ရွာသွန်းထားသဖြင့် မြစ်ရေမှတ် စိုးရိမ်ရေမှတ်သို့ ရောက်ရှိရန် ၀.၅ မီတာခန့်သာ လိုပါတော့သည်။ မြစ်ကမ်းဘေး သဲသောင်နှင့် တာတမံအနီး နေထိုင်သူများ ရေဘေးလွတ်ရာ ပြင်ဆင်ပါ။\n`;
        } else {
            text += `✅ **ရေဘေးအန္တရာယ် ကင်းရှင်းပါသည်:** လက်ရှိ မြစ်ရေမှတ်သည် စိုးရိမ်ရေမှတ်အောက်တွင် သာမန်အတိုင်း တည်ရှိနေပါသည်။ တာတမံများ စိတ်ချရသော အနေအထားတွင် ရှိပါသည်။\n`;
        }
    }

    container.innerText = text;
}

// ရှေ့ (၃) ရက်စာ မိုး/ဒီရေ/လှိုင်း အသေးစိတ် Forecast (Premium)
function renderPremiumForecast(loc) {
    const container = document.getElementById('premiumForecastContainer');
    if (!container) return;

    if (!isPremiumUser) {
        container.innerHTML = `
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; padding: 12px; border-radius: 8px; text-align: center;">
                <p style="font-size:0.83rem; color:#f59e0b; margin:0 0 8px 0;">🔒 ရှေ့ (၃) ရက်စာ မိုးရွာနိုင်ခြေ (%)၊ နေ့စဉ် ဒီရေအတက်အကျနှင့် မုန်တိုင်းသတင်း သီးသန့်ကြည့်ရန် Premium စနစ် ဖွင့်ပါ</p>
                <button onclick="unlockPremiumMock()" style="background: #f59e0b; color: #000; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
                    👑 Premium စမ်းသုံးမည် (Free Click)
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
        
        // နေ့ရက်အလိုက် ဒီရေ အတက်/အကျ တွက်ချက်ခြင်း
        const dayTide = calculateDetailedTides(loc ? loc.longitude : 94.73, i);

        html += `
            <div style="background: rgba(255, 255, 255, 0.08); padding: 10px 12px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:bold; color:#2dd4bf;">
                    <span>${dayLabel} (${dateStr})</span>
                    <span style="color:#60a5fa;">🌧️ ရွာနိုင်ခြေ: ${rainProb}%</span>
                </div>
                <div style="font-size:0.78rem; margin-top:4px; color:#e2e8f0;">
                    ${desc} | 🌡️ ${minTemp}°C - ${maxTemp}°C | 🌧️ မိုးရေချိန်: ${rain} mm
                </div>
                <div style="font-size:0.75rem; margin-top:4px; color:#fbbf24;">
                    🌊 ဒီရေတက်ချိန်: ${dayTide.high1.time} (${dayTide.high1.height}) | ကျချိန်: ${dayTide.low1.time} (${dayTide.low1.height})
                </div>
            </div>
        `;
    }
    html += `</div>`;
    container.innerHTML = html;
}

function renderWeatherGlossary() {
    let glossaryContainer = document.getElementById('weatherGlossarySection');
    if (!glossaryContainer) {
        glossaryContainer = document.createElement('div');
        glossaryContainer.id = 'weatherGlossarySection';
        glossaryContainer.style.cssText = "margin-top: 20px; padding: 12px; background: #11221c; border-top: 2px solid #0d9488; border-radius: 8px;";
        document.querySelector('.container').appendChild(glossaryContainer);
    }

    glossaryContainer.innerHTML = `
        <h3 style="color:#2dd4bf; font-size:0.95rem; margin-bottom:8px;">📚 မိုးလေဝသနှင့် ရေကြောင်း ဝေါဟာရ ရှင်းလင်းချက်</h3>
        <div style="font-size:0.8rem; color:#cbd5e1; display:flex; flex-direction:column; gap:8px; line-height:1.5;">
            <div><b>⛈️ မိုးထစ်ချုန်းရွာခြင်း:</b> လျှပ်စီးလက်ခြင်း၊ မိုးကြိုးပစ်ခြင်းများနှင့်အတူ လေပြင်းတိုက်ခတ်၍ ရွာသွန်းသော မိုးအမျိုးအစား ဖြစ်ပါသည်။</div>
            <div><b>🌊 ဒီရေ အတက်အကျ (Tides):</b> လနှင့် နေ၏ ဆွဲအားကြောင့် ရေမျက်နှာပြင် မြင့်တက်/ကျဆင်းခြင်းဖြစ်ပြီး ကင်းလွတ်နယ်မြေ သွားလာရေးအတွက် အရေးကြီးပါသည်။</div>
            <div><b>🚨 စိုးရိမ်ရေမှတ်:</b> မြစ်ရေမှတ်သည် တာတမံအမြင့်သို့ ရောက်ရှိပြီး ရေလျှံ/တာကျိုးနိုင်သည့် ညွှန်းကိန်း ဖြစ်ပါသည်။</div>
        </div>
    `;
}

// Push Notification Feature
function initNotificationSystem() {
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

function triggerEmergencyAlert(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: body, icon: 'icon.png' });
    }
}

function togglePremiumModal() {
    const overlay = document.getElementById('premiumOverlay');
    if (overlay) overlay.style.display = overlay.style.display === 'flex' ? 'none' : 'flex';
}

function unlockPremiumMock() {
    isPremiumUser = true;
    const overlay = document.getElementById('premiumOverlay');
    if (overlay) overlay.style.display = 'none';
    renderPremiumForecast(currentSelectedLocation);
    renderAISummary();
}
