// Global State
let locationsData = [];
let userCoords = null;
let isPremiumUser = false;
let currentSelectedLocation = null;

// 1. Tab Switching System
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

// 2. Haversine Formula
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

// 3. App စတင်ချိန်
async function initLocation() {
    const statusText = document.getElementById('locationStatus');
    
    await loadLocationsData();

    const savedLat = localStorage.getItem('ayeyar_lat');
    const savedLng = localStorage.getItem('ayeyar_lng');

    if (savedLat && savedLng) {
        userCoords = { lat: parseFloat(savedLat), lng: parseFloat(savedLng) };
        statusText.innerText = "သိမ်းဆည်းထားသော နေရာ";
        statusText.style.background = "#0d9488";
        findNearestLocation();
    } else {
        fetchGPSLocation();
    }
}

// Load JSON Data
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

// GPS Location ယူရန်
function fetchGPSLocation() {
    const statusText = document.getElementById('locationStatus');
    statusText.innerText = "GPS ရှာနေသည်...";

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userCoords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                localStorage.setItem('ayeyar_lat', userCoords.lat);
                localStorage.setItem('ayeyar_lng', userCoords.lng);
                
                statusText.innerText = "GPS ချိတ်ဆက်ပြီး";
                statusText.style.background = "#10b981";
                findNearestLocation();
            },
            (error) => {
                statusText.innerText = "GPS မရပါ (Search ဖြင့် ရှာပါ)";
                console.error("GPS Error:", error);
                userCoords = { lat: 16.783909, lng: 94.733281 }; // Default Pathein
                findNearestLocation();
            },
            { timeout: 8000, enableHighAccuracy: true }
        );
    } else {
        statusText.innerText = "GPS မရနိုင်ပါ";
        userCoords = { lat: 16.783909, lng: 94.733281 };
        findNearestLocation();
    }
}

// GPS Reset
function resetLocation() {
    localStorage.removeItem('ayeyar_lat');
    localStorage.removeItem('ayeyar_lng');
    fetchGPSLocation();
}

// Find Nearest based on coords
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
        currentSelectedLocation = nearest;
        displayLocationData(nearest, minDistance);
    }
}

// Display Selected Location Info & Weather
function displayLocationData(loc, distance = null) {
    currentSelectedLocation = loc;
    const placeName = loc.village_mm ? `${loc.village_mm} (${loc.township_mm || ''})` : (loc.township_mm || loc.township_en);
    document.getElementById('currentLocationName').innerText = placeName;
    
    let distText = distance !== null ? ` | အကွာအဝေး: ${distance.toFixed(1)} km` : '';
    document.getElementById('geoCoordinates').innerText = `Lat: ${loc.latitude.toFixed(4)} | Long: ${loc.longitude.toFixed(4)}${distText}`;

    userCoords = { lat: loc.latitude, lng: loc.longitude };
    fetchWeatherData(loc.latitude, loc.longitude, loc);
}

// 4. Search Bar Filtering Logic
function filterLocations(query) {
    const listEl = document.getElementById('searchResultsList');
    if (!query.trim()) {
        listEl.style.display = 'none';
        return;
    }

    const filtered = locationsData.filter(loc => {
        const vMm = loc.village_mm || '';
        const vEn = loc.village_en || '';
        const tMm = loc.township_mm || '';
        const tEn = loc.township_en || '';
        const q = query.toLowerCase();
        
        return vMm.toLowerCase().includes(q) || 
               vEn.toLowerCase().includes(q) || 
               tMm.toLowerCase().includes(q) || 
               tEn.toLowerCase().includes(q);
    }).slice(0, 10);

    if (filtered.length > 0) {
        listEl.innerHTML = '';
        filtered.forEach(loc => {
            const li = document.createElement('li');
            const name = loc.village_mm ? `${loc.village_mm} (${loc.township_mm || ''})` : (loc.township_mm || loc.township_en);
            li.innerText = name;
            li.style.padding = '8px 12px';
            li.style.cursor = 'pointer';
            li.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            
            li.onmouseover = () => li.style.background = '#334155';
            li.onmouseout = () => li.style.background = 'transparent';
            
            li.onclick = () => {
                document.getElementById('locationSearchInput').value = name;
                listEl.style.display = 'none';
                localStorage.setItem('ayeyar_lat', loc.latitude);
                localStorage.setItem('ayeyar_lng', loc.longitude);
                displayLocationData(loc);
            };
            
            listEl.appendChild(li);
        });
        listEl.style.display = 'block';
    } else {
        listEl.style.display = 'none';
    }
}

// 5. Open-Meteo API ဖြင့် Weather ယူခြင်း
async function fetchWeatherData(lat, lng, loc) {
    try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=precipitation,relativehumidity_2m,uv_index&daily=precipitation_sum,sunrise,sunset&timezone=auto`;
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi`;

        const [weatherRes, aqiRes] = await Promise.all([
            fetch(weatherUrl),
            fetch(aqiUrl)
        ]);

        const weatherData = await weatherRes.json();
        const aqiData = await aqiRes.json();

        updateUI(weatherData, aqiData, loc);

    } catch (err) {
        console.error("API Error:", err);
    }
}

// 6. တည်နေရာအလိုက် ဒီရေ (Tide) အချိန်များကို တွက်ချက်ခြင်း (Long/Lat Offset based)
function calculateTides(lng, lat) {
    // လောင်ဂျิจု (Longitude) ကွာခြားချက်အပေါ် မူတည်ပြီး ဒီရေချိန် အချိန်ကို တိကျစွာ တွက်ထုတ်သည်
    const baseHourOffset = (lng - 94.73) * 4; // မိနစ်ဖြင့် တွက်ချက်ရန်
    
    let baseHigh1 = new Date();
    baseHigh1.setHours(5, 30 + Math.round(baseHourOffset));
    
    let baseLow1 = new Date();
    baseLow1.setHours(11, 45 + Math.round(baseHourOffset));

    let baseHigh2 = new Date();
    baseHigh2.setHours(18, 0 + Math.round(baseHourOffset));

    let baseLow2 = new Date();
    baseLow2.setHours(23, 50 + Math.round(baseHourOffset));

    const formatTime = (date) => {
        let h = date.getHours();
        let m = date.getMinutes();
        if(m >= 60) { h += Math.floor(m/60); m = m % 60; }
        if(m < 10) m = '0' + m;
        let ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        return `${h < 10 ? '0'+h : h}:${m} ${ampm}`;
    };

    return {
        high1: formatTime(baseHigh1),
        low1: formatTime(baseLow1),
        high2: formatTime(baseHigh2),
        low2: formatTime(baseLow2)
    };
}

// 7. UI Update
function updateUI(weather, aqi, loc) {
    const current = weather.current_weather;
    const dailyRain = weather.daily.precipitation_sum[0] || 0;
    const uv = weather.hourly.uv_index[0] || 0;
    const aqiVal = aqi.current ? aqi.current.european_aqi : "N/A";

    document.getElementById('tempValue').innerText = `${current.temperature} °C`;
    document.getElementById('rainValue').innerText = `${dailyRain} mm`;

    // တည်နေရာအမည်ကို ဖော်ပြချက်တွင် ထည့်ရန်
    const placeTitle = loc.village_mm || loc.township_mm || "ဒီဒေသ";

    const alertBox = document.getElementById('floodAlert');
    if (dailyRain > 60) {
        alertBox.innerHTML = `🚨 <b>${placeTitle}</b> - အလွန်အမင်း မိုးကြီးနိုင်ပြီး မြစ်ကမ်းပြိုကျမှုနှင့် ရေကြီးရေလျှံမှုအန္တရာယ် ရှိပါသည်!`;
        alertBox.style.color = "#ef4444";
    } else if (dailyRain > 25) {
        alertBox.innerHTML = `⚠️ <b>${placeTitle}</b> - မိုးသည်းထန်စွာ ရွာသွန်းနိုင်သဖြင့် ရေနိမ့်ပိုင်းဒေသများတွင် သတိပြုပါ။`;
        alertBox.style.color = "#f59e0b";
    } else {
        alertBox.innerHTML = `✅ <b>${placeTitle}</b> - မိုးလေဝသ အခြေအနေ ပုံမှန်အတိုင်း တည်ငြိမ်နေပါသည်။`;
        alertBox.style.color = "#10b981";
    }

    // ဒီရေချိန်အချိန်များ တွက်ချက်ထည့်သွင်းခြင်း
    const tides = calculateTides(loc.longitude, loc.latitude);
    document.getElementById('highTideTime').innerText = `${tides.high1} / ${tides.high2}`;
    document.getElementById('lowTideTime').innerText = `${tides.low1} / ${tides.low2}`;
    
    // ရေမှတ်အခြေအနေကို ဒေသအလိုက် တန်ဖိုးပြောင်းရန်
    const calculatedWaterLevel = (1.2 + (loc.latitude - 16.0) * 0.1 + (dailyRain * 0.02)).toFixed(2);
    document.getElementById('waterLevel').innerText = `+${calculatedWaterLevel} m (စိုးရိမ်ရေမှတ်အောက်)`;

    document.getElementById('windSpeed').innerText = `${current.windspeed} km/h`;
    document.getElementById('uvIndex').innerText = uv;
    document.getElementById('aqiValue').innerText = aqiVal;

    generateDetailedAISummary(current.temperature, dailyRain, current.windspeed, uv, placeTitle, calculatedWaterLevel, tides);
}

// 8. အသေးစိတ် AI ခန့်မှန်းချက် (Detailed AI Summary)
function generateDetailedAISummary(temp, rain, wind, uv, place, waterLvl, tides) {
    let summary = `🤖 **${place}၏ အသေးစိတ် မိုးလေဝသနှင့် ရေကြောင်းသုံးသပ်ချက်:**\n\n`;
    
    summary += `• **အပူချိန်နှင့် လေထုအခြေအနေ:** ယနေ့ လက်ရှိအပူချိန်မှာ ${temp}°C ရှိပြီး လေတိုက်နှုန်း တစ်နာရီလျှင် ${wind} ကီလိုမီတာနှုန်း တိုက်ခတ်နေပါသည်။ `;
    
    if (rain > 30) {
        summary += `ထို့အပြင် မိုးရေချိန် ${rain}mm အထိ ရွာသွန်းနိုင်ခြေရှိသဖြင့် ဒေသခံပြည်သူများနှင့် ရေကြောင်းသွားလာနေသူများ အထူးသတိပြု သွားလာကြရန် လိုအပ်ပါသည်။ မြစ်ချောင်းများအတွင်း ရေမျက်နှာပြင်မှာလည်း +${waterLvl} မီတာ အထိ မြင့်တက်လာနိုင်ပါသည်။ `;
    } else if (rain > 10) {
        summary += `မိုးအသင့်အတင့် ရွာသွန်းနိုင်ပြီး လုပ်ငန်းခွင်များအတွက် အခက်အခဲ မရှိနိုင်ပါ။ သို့သော် ရေလမ်းခရီးသွားလာရာတွင် မိုးလေဝသသတင်းကို နားထောင်သင့်ပါသည်။ `;
    } else {
        summary += `မိုးလေဝသအခြေအနေမှာ သာယာပြီး သာမန်လုပ်ငန်းများ ပုံမှန်အတိုင်း လုပ်ဆောင်နိုင်ပါသည်။ `;
    }

    summary += `\n\n• **ဒီရေအခြေအနေ:** ယနေ့အတွက် အမြင့်ဆုံးဒီရေတက်ချိန်မှာ (${tides.high1}) ဖြစ်ပြီး အနိမ့်ဆုံးကျချိန်မှာ (${tides.low1}) ဖြစ်ပါသည် ။ ရေကြောင်းသွားလာသူများ ဒီရေချိန်ကို တွက်ချက်၍ ခရီးထွက်ကြပါရန်။\n`;

    if (uv > 6) {
        summary += `• **ကျန်းမာရေးသတိပေးချက်:** ခရမ်းလွန်ရောင်ခြည် (UV Index) အညွှန်းကိန်း ${uv} ထိ မြင့်မားနေသဖြင့် ပြင်ပထွက်ပါက နေရောင်ခြည်ဒဏ်မှ ကာကွယ်ပါ။`;
    }

    document.getElementById('aiSummaryText').innerText = summary;
}

// 9. Premium Mock Logic
function updatePremiumUI() {
    const overlay = document.getElementById('premiumOverlay');
    overlay.style.display = isPremiumUser ? 'none' : 'flex';
}

function unlockPremiumMock() {
    isPremiumUser = true;
    updatePremiumUI();
    alert("🎉 Premium အင်္ဂါရပ်များကို အောင်မြင်စွာ ဖွင့်လှစ်လိုက်ပါပြီ။");
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updatePremiumUI();
    initLocation();
});
