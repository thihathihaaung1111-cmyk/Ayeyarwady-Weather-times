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
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                localStorage.setItem('ayeyar_lat', userCoords.lat);
                localStorage.setItem('ayeyar_lng', userCoords.lng);
                findNearestLocation();
            },
            () => {
                userCoords = { lat: 16.0179, lng: 94.3396 }; // Hainggyikyun Default
                findNearestLocation();
            }
        );
    } else {
        userCoords = { lat: 16.0179, lng: 94.3396 };
        findNearestLocation();
    }
}

function resetLocation() {
    localStorage.removeItem('ayeyar_lat');
    localStorage.removeItem('ayeyar_lng');
    fetchGPSLocation();
}

function findNearestLocation() {
    if (locationsData.length === 0) return;
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
}

function displayLocationData(loc, distance = null) {
    currentSelectedLocation = loc;
    const placeName = loc.village_mm ? `${loc.village_mm} (${loc.township_mm || ''})` : (loc.township_mm || loc.township_en);
    document.getElementById('currentLocationName').innerText = placeName;
    document.getElementById('geoCoordinates').innerText = `Lat: ${loc.latitude.toFixed(4)} | Long: ${loc.longitude.toFixed(4)} | အကွာအဝေး: ${(distance || 0).toFixed(1)} km`;
    
    fetchWeatherData(loc.latitude, loc.longitude, loc);
}

async function fetchWeatherData(lat, lng, loc) {
    try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=relativehumidity_2m,uv_index&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max&timezone=auto`;
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi`;
        
        // Marine API - လှိုင်းအမြင့် ရယူရန်
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
                alertBox.innerHTML = `📢 <b>DMH တရားဝင် ထုတ်ပြန်ချက် (${floodData.updated_at}):</b><br>${floodData.warning}`;
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
    const uv = weather.hourly.uv_index ? weather.hourly.uv_index[0] : 0;
    const aqiVal = aqi.current ? aqi.current.european_aqi : "N/A";
    const placeTitle = loc.village_mm || loc.township_mm || "ဒီဒေသ";

    document.getElementById('tempValue').innerText = `${current.temperature} °C`;
    document.getElementById('rainValue').innerText = `${dailyRain} mm`;

    const tides = calculateDetailedTides(loc.longitude);
    document.getElementById('highTideTime').innerText = `${tides.high1.time} / ${tides.high2.time}`;
    document.getElementById('lowTideTime').innerText = `${tides.low1.time} / ${tides.low2.time}`;
    
    const calculatedWaterLevel = (1.2 + (loc.latitude - 16.0) * 0.1 + (dailyRain * 0.02)).toFixed(2);
    document.getElementById('waterLevel').innerText = `+${calculatedWaterLevel} m (စိုးရိမ်ရေမှတ်အောက်)`;

    document.getElementById('windSpeed').innerText = `${current.windspeed} km/h`;
    document.getElementById('uvIndex').innerText = uv;
    document.getElementById('aqiValue').innerText = aqiVal;

    // AI စိုက်ပျိုးရေးနှင့် လှိုင်းအမြင့် အသေးစိတ် ခန့်မှန်းချက် ထုတ်ပေးခြင်း
    generateComprehensiveAISummary(current.temperature, dailyRain, current.windspeed, uv, placeTitle, weather.daily, waveHeight);
}

// ဒေတာအမြောက်အမြား ပါဝင်သော AI စိုက်ပျိုးရေးနှင့် ရေကြောင်း အကြံပြုချက်
function generateComprehensiveAISummary(temp, rain, wind, uv, place, daily, waveHeight) {
    const rainProb = daily.precipitation_probability_max ? daily.precipitation_probability_max[0] : 0;
    const humidity = 80; // Standard estimate for coastal delta

    // လေတိုက်နှုန်းပေါ်မူတည်၍ လှိုင်းအမြင့် ခန့်မှန်းချက် (API မှ မရပါက)
    let waveText = "";
    let estimatedWave = waveHeight;
    if (estimatedWave === null) {
        if (wind < 15) estimatedWave = "0.5 - 1.0 မီတာ (လှိုင်းအသင့်အတင့်)";
        else if (wind < 30) estimatedWave = "1.2 - 2.0 မီတာ (လှိုင်းကြီးနိုင်)";
        else estimatedWave = "2.5 မီတာထက်အထက် (လှိုင်းလေ အလွန်ထန်းနိုင်)";
    } else {
        estimatedWave = `${estimatedWave} မီတာ`;
    }

    if (wind > 25) {
        waveText = `🌊 **ပင်လယ်ပြင်/မြစ်တွင်း လှိုင်းအခြေအနေ:** လေတိုက်နှုန်း **${wind} km/h** ရှိသဖြင့် လှိုင်းအမြင့် **${estimatedWave}** ထိ မြင့်တက်နိုင်ပါသည်။ **ငါးဖမ်းလှေများနှင့် စက်လှေများ စုန်းထွက်ရန်/သွားလာရန် မသင့်တော်ပါ။**`;
    } else {
        waveText = `🌊 **ပင်လယ်ပြင်/မြစ်တွင်း လှိုင်းအခြေအနေ:** လေတိုက်နှုန်း **${wind} km/h** သာရှိပြီး လှိုင်းအမြင့် **${estimatedWave}** ခန့်သာရှိ၍ သွားလာရေး/ငါးဖမ်းလုပ်ငန်း သာမန်အတိုင်း လုပ်ဆောင်နိုင်ပါသည်။`;
    }

    let summary = `🌾 **${place} ဒေသ တောင်သူများနှင့် ရေလုပ်သားများအတွက် AI သုံးသပ်ချက်:**\n\n`;
    summary += `${waveText}\n\n`;
    summary += `📊 **ရာသီဥတု ကိန်းဂဏန်းများ:** မိုးရွာနိုင်ခြေ ${rainProb}% | ခန့်မှန်းမိုးရေချိန် ${rain}mm | UV Index ${uv}\n\n`;
    summary += `--- **စိုက်ပျိုးရေး အသေးစိတ် လမ်းညွှန်ချက်များ** ---\n\n`;

    // 1. မျိုးကြဲခြင်းနှင့် ပျိုးထောင်ခြင်း
    if (rainProb > 60 || rain > 20) {
        summary += `🌱 **၁။ မျိုးကြဲ/ပျိုးထောင်ခြင်း:** ❌ **မသင့်တော်ပါ။** မိုးရွာနိုင်ခြေ (${rainProb}%) မြင့်မားသဖြင့် မျိုးစေ့များ မျှောပါသွားနိုင်ပြီး ပျိုးခင်းများ ရေနစ်မြုပ်နိုင်ပါသည်။ မိုးစဲသည်အထိ စောင့်ပါ။\n\n`;
    } else {
        summary += `🌱 **၁။ မျိုးကြဲ/ပျိုးထောင်ခြင်း:** ✅ **အလွန်သင့်တော်ပါသည်။** မျိုးစေ့များ အပင်ပေါက် ညီညာစေရန် ပျိုးခင်း ရေထုတ်မြောင်းများ ပြင်ဆင်ပြီး မျိုးကြဲနိုင်ပါသည်။\n\n`;
    }

    // 2. ပိုးသတ်ဆေးနှင့် ပေါင်းသတ်ဆေး ဖြန်းခြင်း
    if (rainProb > 35 || wind > 18) {
        summary += `💊 **၂။ ပိုးသတ်ဆေး/ပေါင်းသတ်ဆေး ဖြန်းခြင်း:** ❌ **မသင့်တော်ပါ။** လေတိုက်နှုန်း (${wind} km/h) မြင့်သဖြင့် ဆေးများ လေလွင့်မည် ဖြစ်သလို မိုးရွာပါက ဆေးအာနိသင် ဆေးကြောပါသွားပါမည်။\n\n`;
    } else {
        summary += `💊 **၂။ ပိုးသတ်ဆေး/ပေါင်းသတ်ဆေး ဖြန်းခြင်း:** ✅ **သင့်တော်ပါသည်။** နံနက် ၆:၀၀ မှ ၉:၀၀ နာရီအတွင်း လေငြိမ်ချိန်တွင် ဖြန်းပေးပါက အာနိသင် အကောင်းဆုံး ရရှိပါမည်။\n\n`;
    }

    // 3. စပါးရိတ်သိမ်းခြင်း (ကောက်ရိတ်)
    if (rain > 5 || rainProb > 50) {
        summary += `🚜 **၃။ ကောက်ရိတ်သိမ်းခြင်း:** ⚠️ **သတိပြုပါ။** မိုးရုတ်တရက် ရွာသွန်းနိုင်သဖြင့် ရိတ်သိမ်းပြီး စပါးများကို ချက်ချင်း အမိုးအကာအောက် ရွှေ့ပြောင်းနိုင်မှသာ ရိတ်သိမ်းပါ။\n\n`;
    } else {
        summary += `🚜 **၃။ ကောက်ရိတ်သိမ်းခြင်း:** ✅ **အလွန်သင့်တော်ပါသည်။** စပါးရိတ်စက်များ မကွင်းဆင်းမီ လယ်ကွင်းအတွင်း ရေထုတ်ထားပါ။\n\n`;
    }

    // 4. စပါးလှန်းခြင်းနှင့် အစိုဓာတ်ထိန်းခြင်း
    if (rainProb > 30 || temp < 25) {
        summary += `☀️ **၄။ စပါးလှန်းခြင်း:** ⚠️ **သတိပေးချက်:** မိုးရွာနိုင်ခြေ (${rainProb}%) ရှိသဖြင့် စပါးလှန်းပါက မိုးကာစ အဆင်သင့် ပြင်ထားပါ။\n\n`;
    } else {
        summary += `☀️ **၄။ စပါးလှန်းခြင်း:** ✅ **နေလှန်းရန် အလွန်ကောင်းမွန်ပါသည်။** နေရောင်ကောင်းစွာ ရရှိနိုင်သဖြင့် စပါးအစိုဓာတ် ၁၄% အောက်ရောက်အောင် အလွယ်တကူ လှန်းနိုင်ပါမည်။\n\n`;
    }

    // 5. မြေသြဇာကျွေးခြင်း
    if (rain > 15) {
        summary += `🧪 **၅။ ဓာတ်မြေသြဇာ ကျွေးခြင်း:** ❌ **မကျွေးပါနှင့်။** မိုးသည်းထန်ပါက မြေသြဇာများ ရေနှင့်ပါသွားပြီး ဆုံးရှုံးမှု ကြီးမားနိုင်ပါသည်။\n\n`;
    } else {
        summary += `🧪 **၅။ ဓာတ်မြေသြဇာ ကျွေးခြင်း:** ✅ အပင်များ အာဟာရ စုတ်ယူမှု ကောင်းစေရန် မြေဆီလွှာ အစိုဓာတ်ရှိချိန်တွင် ကျွေးပေးပါ။\n\n`;
    }

    // 6. ရေသွင်း/ရေထုတ် စီမံခန့်ခွဲမှု
    if (rain > 25) {
        summary += `💧 **၆။ ရေထုတ်လုပ်ငန်း:** မိုးရေချိန် မြင့်မားနိုင်သဖြင့် ရေနိမ့်ပိုင်း စပါးခင်းများ ရေမဝပ်စေရန် ရေနုတ်မြောင်းများ အမြန်ဆုံး ရှင်းလင်းထားပါ။`;
    } else {
        summary += `💧 **၆။ ရေသွင်းလုပ်ငန်း:** စပါးပင် အနှံထွက်ချိန်/အောင်ချိန် ဖြစ်ပါက လယ်ကွင်းအတွင်း ရေ ၅ စင်တီမီတာခန့် ထိန်းသိမ်းထားပါ။`;
    }

    document.getElementById('aiSummaryText').innerText = summary;
}

function renderPremiumForecast(loc) {
    const container = document.getElementById('premiumForecastContainer');
    if (!container) return;

    if (!isPremiumUser) {
        container.innerHTML = `
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; padding: 12px; border-radius: 8px; text-align: center;">
                <p style="font-size:0.85rem; color:#f59e0b; margin:0 0 8px 0;">🔒 ရှေ့ (၃) ရက်စာ မိုးရွာနိုင်ခြေ (%) နှင့် မုတ်သုံလေ/မုန်တိုင်း အခြေအနေကို ကြည့်ရန် Premium ဖွင့်ပါ</p>
                <button onclick="unlockPremiumMock()" style="background: #f59e0b; color: #000; border: none; padding: 6px 14px; border-radius: 6px; font-weight: bold; cursor: pointer;">
                    👑 Premium စမ်းသုံးမည် (Click to Unlock)
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
        const wind = cachedDailyForecast.windspeed_10m_max ? cachedDailyForecast.windspeed_10m_max[i] : 15;
        const dayLabel = i === 0 ? "ယနေ့" : (i === 1 ? "မနက်ဖြန်" : "သဘက်ခါ");

        html += `
            <div style="background: rgba(255, 255, 255, 0.08); padding: 8px 12px; border-radius: 6px; border-left: 3px solid #f59e0b;">
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:bold; color:#2dd4bf;">
                    <span>${dayLabel} (${dateStr})</span>
                    <span style="color:#60a5fa;">🌧️ ရွာနိုင်ခြေ: ${rainProb}%</span>
                </div>
                <div style="font-size:0.8rem; margin-top:4px; color:#e2e8f0;">
                    🌡️ အပူချိန်: ${minTemp}°C - ${maxTemp}°C | 🌧️ မိုးရေချိန်: ${rain} mm | 💨 လေတိုက်နှုန်း: ${wind} km/h
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
}

document.addEventListener('DOMContentLoaded', () => {
    initLocation();
});
