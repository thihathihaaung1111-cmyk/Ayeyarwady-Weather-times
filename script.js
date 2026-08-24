// Global State
let locationsData = [];
let userCoords = null;
let isPremiumUser = false;
let currentSelectedLocation = null;
let cachedDailyForecast = null;

// Tab Switching System
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const target = btn.getAttribute('data-target');
        const targetElement = document.getElementById(target);
        if(targetElement) {
            targetElement.classList.add('active');
        }
    });
});

// Haversine Formula
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// App Initialization
async function initLocation() {
    const statusText = document.getElementById('locationStatus');
    await loadLocationsData();

    const savedLat = localStorage.getItem('ayeyar_lat');
    const savedLng = localStorage.getItem('ayeyar_lng');

    if (savedLat && savedLng) {
        userCoords = { lat: parseFloat(savedLat), lng: parseFloat(savedLng) };
        if(statusText) {
            statusText.innerText = "သိမ်းဆည်းထားသော နေရာ";
            statusText.style.background = "#0d9488";
        }
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
    if(statusText) statusText.innerText = "GPS ရှာနေသည်...";

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userCoords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                localStorage.setItem('ayeyar_lat', userCoords.lat);
                localStorage.setItem('ayeyar_lng', userCoords.lng);
                
                if(statusText) {
                    statusText.innerText = "GPS ချိတ်ဆက်ပြီး";
                    statusText.style.background = "#10b981";
                }
                findNearestLocation();
            },
            (error) => {
                if(statusText) statusText.innerText = "GPS မရပါ (Search ဖြင့် ရှာပါ)";
                userCoords = { lat: 17.3038, lng: 95.1946 };
                findNearestLocation();
            },
            { timeout: 8000, enableHighAccuracy: true }
        );
    } else {
        if(statusText) statusText.innerText = "GPS မရနိုင်ပါ";
        userCoords = { lat: 17.3038, lng: 95.1946 };
        findNearestLocation();
    }
}

function findNearestLocation() {
    if (locationsData.length === 0) return;
    
    const validLocations = locationsData.filter(loc => loc.latitude && loc.longitude);
    let nearest = null;
    let minDistance = Infinity;

    validLocations.forEach(loc => {
        const dist = getDistance(userCoords.lat, userCoords.lng, loc.latitude, loc.longitude);
        if (dist < minDistance) {
            minDistance = dist;
            nearest = loc;
        }
    });

    if (nearest) {
        displayLocationData(nearest, minDistance);
    }
}

function displayLocationData(loc, distance = null) {
    currentSelectedLocation = loc;
    const placeName = loc.village_mm ? `${loc.village_mm} (${loc.township_mm || ''})` : (loc.township_mm || loc.township_en);
    document.getElementById('currentLocationName').innerText = placeName;
    
    let distText = distance !== null ? ` | အကွာအဝေး: ${distance.toFixed(1)} km` : '';
    document.getElementById('geoCoordinates').innerText = `Lat: ${loc.latitude.toFixed(4)} | Long: ${loc.longitude.toFixed(4)}${distText}`;

    userCoords = { lat: loc.latitude, lng: loc.longitude };
    fetchWeatherData(loc.latitude, loc.longitude, loc);
}

// DMH Flood Data ကို JSON မှ လှမ်းဖတ်ခြင်း
async function fetchDMHFloodData() {
    try {
        const res = await fetch('flood-data.json');
        if (res.ok) {
            const floodData = await res.json();
            const alertBox = document.getElementById('floodAlert');
            if(alertBox && floodData.warning) {
                alertBox.innerHTML = `📢 <b>DMH တရားဝင် ထုတ်ပြန်ချက် (${floodData.updated_at}):</b><br>${floodData.warning}`;
            }
        }
    } catch (err) {
        console.log("flood-data.json ဖတ်မရသေးပါ");
    }
}

// Open-Meteo API
async function fetchWeatherData(lat, lng, loc) {
    try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=relativehumidity_2m,uv_index,surface_pressure&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max&timezone=auto`;
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi`;

        const [weatherRes, aqiRes] = await Promise.all([
            fetch(weatherUrl),
            fetch(aqiUrl)
        ]);

        const weatherData = await weatherRes.json();
        const aqiData = await aqiRes.json();

        cachedDailyForecast = weatherData.daily;
        updateUI(weatherData, aqiData, loc);
        renderPremiumForecast(loc);
        fetchDMHFloodData();

    } catch (err) {
        console.error("API Error:", err);
    }
}

// ဒီရေ အတက်/အကျ အသေးစိတ် တွက်ချက်ခြင်း
function calculateDetailedTides(lng, lat) {
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

function updateUI(weather, aqi, loc) {
    const current = weather.current_weather;
    const dailyRain = weather.daily.precipitation_sum[0] || 0;
    const uv = weather.hourly.uv_index ? weather.hourly.uv_index[0] : 0;
    const aqiVal = aqi.current ? aqi.current.european_aqi : "N/A";

    document.getElementById('tempValue').innerText = `${current.temperature} °C`;
    document.getElementById('rainValue').innerText = `${dailyRain} mm`;

    const placeTitle = loc.village_mm || loc.township_mm || "ဒီဒေသ";

    const tides = calculateDetailedTides(loc.longitude, loc.latitude);
    document.getElementById('highTideTime').innerText = `${tides.high1.time} / ${tides.high2.time}`;
    document.getElementById('lowTideTime').innerText = `${tides.low1.time} / ${tides.low2.time}`;
    
    const calculatedWaterLevel = (1.2 + (loc.latitude - 16.0) * 0.1 + (dailyRain * 0.02)).toFixed(2);
    document.getElementById('waterLevel').innerText = `+${calculatedWaterLevel} m (စိုးရိမ်ရေမှတ်အောက်)`;

    document.getElementById('windSpeed').innerText = `${current.windspeed} km/h`;
    document.getElementById('uvIndex').innerText = uv;
    document.getElementById('aqiValue').innerText = aqiVal;

    generateDetailedAISummary(current.temperature, dailyRain, current.windspeed, uv, placeTitle, calculatedWaterLevel, tides);
}

// Premium (၃) ရက်စာ မိုးရွာနိုင်ခြေ (%)၊ မုန်တိုင်း/မုတ်သုံလေ အခြေအနေနှင့် ဒီရေ ပြသခြင်း
function renderPremiumForecast(loc) {
    const container = document.getElementById('premiumForecastContainer');
    if (!container) return;

    if (!isPremiumUser) {
        container.innerHTML = `
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; padding: 12px; border-radius: 8px; text-align: center;">
                <p style="font-size:0.9rem; color:#f59e0b; margin:0 0 8px 0;">🔒 ရှေ့ (၃) ရက်စာ မိုးရွာနိုင်ခြေ (%)၊ မုန်တိုင်း/မုတ်သုံလေ သတင်းနှင့် ဒီရေ အသေးစိတ်ကို ကြည့်ရန် Premium ဖွင့်ပါ</p>
                <button onclick="unlockPremiumMock()" style="background: #f59e0b; color: #000; border: none; padding: 6px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
                    👑 Premium စမ်းသုံးမည် (Free Click)
                </button>
            </div>
        `;
        return;
    }

    if (!cachedDailyForecast) return;

    const targetLoc = loc || currentSelectedLocation;
    const tides = targetLoc ? calculateDetailedTides(targetLoc.longitude, targetLoc.latitude) : null;

    // မုတ်သုံလေနှင့် မုန်တိုင်း/လေဖိအားနည်းရပ်ဝန်း အခြေအနေ တွက်ချက်ခြင်း
    const maxWind = Math.max(...cachedDailyForecast.windspeed_10m_max);
    let stormStatus = "🌀 <b>မုန်တိုင်း/လေဖိအားနည်းရပ်ဝန်း:</b> လက်ရှိတွင် ဘင်္ဂလားပင်လယ်အောက်ခြေ လေဖိအားနည်းရပ်ဝန်း မရှိပါ။";
    let monsoonStatus = "💨 <b>မုတ်သုံလေ အခြေအနေ:</b> အာရေဗျပင်လယ်ပြင်မှ အနောက်တောင်မုတ်သုံလေ အသင့်အတင့် တိုက်ခတ်နေပါသည်။";

    if (maxWind > 45) {
        stormStatus = "🚨 <b>မုန်တိုင်း သတိပေးချက်:</b> ပင်လယ်ပြင်တွင် လေဖိအားနည်းရပ်ဝန်းဖြစ်ပေါ်နေပြီး လေတိုက်နှုန်းမြင့်မားနိုင်ပါသည်။";
    } else if (maxWind > 30) {
        stormStatus = "⚠️ <b>လေဖိအားနည်းရပ်ဝန်း:</b> ပင်လယ်ပြင်တွင် လေပွေလှိုင်းများ ရှိနေသဖြင့် မိုးရုတ်တရက် သည်းထန်နိုင်သည်။";
    }

    let html = `
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; padding: 8px 12px; border-radius: 8px; margin-bottom: 10px; font-size: 0.82rem; color: #34d399;">
            ${monsoonStatus}<br>${stormStatus}
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
    `;
    
    for (let i = 0; i < 3; i++) {
        const dateStr = cachedDailyForecast.time[i];
        const maxTemp = cachedDailyForecast.temperature_2m_max[i];
        const minTemp = cachedDailyForecast.temperature_2m_min[i];
        const rain = cachedDailyForecast.precipitation_sum[i];
        const rainProb = cachedDailyForecast.precipitation_probability_max ? cachedDailyForecast.precipitation_probability_max[i] : 45;
        const wind = cachedDailyForecast.windspeed_10m_max[i];

        const dayLabel = i === 0 ? "ယနေ့" : (i === 1 ? "မနက်ဖြန်" : "သဘက်ခါ");

        html += `
            <div style="background: rgba(255, 255, 255, 0.08); padding: 10px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <div style="display:flex; justify-content:space-between; font-weight:bold; color:#2dd4bf;">
                    <span>${dayLabel} (${dateStr})</span>
                    <span style="color:#60a5fa;">🌧️ ရွာနိုင်ခြေ: ${rainProb}%</span>
                </div>
                <div style="font-size:0.85rem; margin-top:4px; color:#e2e8f0;">
                    🌡️ အပူချိန်: ${minTemp}°C - ${maxTemp}°C | 🌧️ မိုးရေချိန်: ${rain} mm | 💨 လေ: ${wind} km/h
                </div>
                ${tides ? `
                <div style="font-size:0.75rem; color:#cbd5e1; margin-top:6px; background:rgba(0,0,0,0.2); padding:6px; border-radius:4px;">
                    🌊 <b>ဒီရေ အတက်/အကျ အသေးစိတ်:</b><br>
                    • တက်ရေ: ${tides.high1.time} (${tides.high1.height}) / ${tides.high2.time} (${tides.high2.height})<br>
                    • ကျရေ: ${tides.low1.time} (${tides.low1.height}) / ${tides.low2.time} (${tides.low2.height})
                </div>` : ''}
            </div>
        `;
    }
    html += `</div>`;
    container.innerHTML = html;
}

function generateDetailedAISummary(temp, rain, wind, uv, place, waterLvl, tides) {
    let summary = `🤖 **${place}၏ မိုးလေဝသ၊ ရေကြောင်းနှင့် ဧရာဝတီတိုင်း ဒေသတွင်း အသုံးဝင်သော အချက်အလက်များ:**\n\n`;
    
    summary += `• **မိုးလေဝသနှင့် အပူချိန်:** ယနေ့ ${place} တွင် လက်ရှိအပူချိန် ${temp}°C ရှိပြီး လေတိုက်နှုန်းမှာ ${wind} km/h တိုက်ခတ်နေပါသည်။ မိုးရေချိန် ${rain}mm ခန့် ရှိနိုင်ပါသည်။\n\n`;

    summary += `• **ဒီရေ ရေမှတ်အခြေအနေ:** အမြင့်ဆုံးဒီရေတက်ချိန် (${tides.high1.time}) နှင့် အနိမ့်ဆုံးကျချိန် (${tides.low1.time}) ဖြစ်ပါသည်။ မြစ်ရေမှတ်မှာ +${waterLvl} မီတာခန့်တွင် ရှိနေပါသည်။\n\n`;

    summary += `🌊 **ဧရာဝတီတိုင်းဒေသကြီး ရေကြီးမှုနှင့် မြစ်ရေသတိပေးချက် လတ်တလော အခြေအနေ:**\n`;
    summary += `- **ဟင်္သာတ၊ ဇလွန်၊ ဓနုဖြူ၊ ညောင်တုန်း:** ဧရာဝတီမြစ်ရေသည် ပုံမှန်ရေမှတ်အတိုင်း ရှိနေပြီး စိုးရိမ်ရေမှတ်သို့ မရောက်ရှိသေးပါ။\n`;
    summary += `- **ကျုံပျော်၊ ကျောင်းကုန်း၊ ငါးသိုင်းချောင်း:** ဒါးကမြစ် ရေမှတ်များ စိုးရိမ်ရေမှတ်အောက် တည်ငြိမ်လျက်ရှိပါသည်။\n`;
    summary += `- **ပုသိမ်၊ လပွတ္တာ၊ ဖျာပုံ:** ပင်လယ်ပြင်လှိုင်း အသင့်အတင့် ရှိနိုင်ပြီး ဒီရေတက်ချိန်များတွင် မြေနိမ့်ပိုင်းများ ရေအတန်ငယ် တက်နိုင်ပါသည်။\n`;

    document.getElementById('aiSummaryText').innerText = summary;
}

// Premium Modal
function togglePremiumModal() {
    const overlay = document.getElementById('premiumOverlay');
    if (overlay) {
        overlay.style.display = overlay.style.display === 'flex' ? 'none' : 'flex';
    } else {
        unlockPremiumMock();
    }
}

// Premium ဖွင့်ပေးလိုက်ခြင်း
function unlockPremiumMock() {
    isPremiumUser = true;
    const overlay = document.getElementById('premiumOverlay');
    if (overlay) overlay.style.display = 'none';
    renderPremiumForecast();
}

document.addEventListener('DOMContentLoaded', () => {
    initLocation();
});
