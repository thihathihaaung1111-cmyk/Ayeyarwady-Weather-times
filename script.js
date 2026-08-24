// Global State
let locationsData = [];
let userCoords = null;
let isPremiumUser = false;

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
    
    // locations.json ကို အရင် Load မည်
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
                // Default to Pathein if GPS fails
                userCoords = { lat: 16.783909, lng: 94.733281 };
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
        displayLocationData(nearest, minDistance);
    }
}

// Display Selected Location Info & Weather
function displayLocationData(loc, distance = null) {
    const placeName = loc.village_mm ? `${loc.village_mm} (${loc.township_mm || ''})` : (loc.township_mm || loc.township_en);
    document.getElementById('currentLocationName').innerText = placeName;
    
    let distText = distance !== null ? ` | အကွာအဝေး: ${distance.toFixed(1)} km` : '';
    document.getElementById('geoCoordinates').innerText = `Lat: ${loc.latitude.toFixed(4)} | Long: ${loc.longitude.toFixed(4)}${distText}`;

    // Update global userCoords for weather
    userCoords = { lat: loc.latitude, lng: loc.longitude };
    fetchWeatherData(loc.latitude, loc.longitude);
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
    }).slice(0, 10); // ထိပ်ဆုံး ရလဒ် ၁၀ ခုသာ ပြမည်

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
                // Select this location
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
async function fetchWeatherData(lat, lng) {
    try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=precipitation,relativehumidity_2m,uv_index&daily=precipitation_sum&timezone=auto`;
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi`;

        const [weatherRes, aqiRes] = await Promise.all([
            fetch(weatherUrl),
            fetch(aqiUrl)
        ]);

        const weatherData = await weatherRes.json();
        const aqiData = await aqiRes.json();

        updateUI(weatherData, aqiData);

    } catch (err) {
        console.error("API Error:", err);
    }
}

// 6. UI Update
function updateUI(weather, aqi) {
    const current = weather.current_weather;
    const dailyRain = weather.daily.precipitation_sum[0] || 0;
    const uv = weather.hourly.uv_index[0] || 0;
    const aqiVal = aqi.current ? aqi.current.european_aqi : "N/A";

    document.getElementById('tempValue').innerText = `${current.temperature} °C`;
    document.getElementById('rainValue').innerText = `${dailyRain} mm`;

    const alertBox = document.getElementById('floodAlert');
    if (dailyRain > 50) {
        alertBox.innerText = "🚨 စိုးရိမ်ရေမှတ် (ရေကြီးနိုင်ချေမြင့်)";
        alertBox.style.color = "#ef4444";
    } else if (dailyRain > 20) {
        alertBox.innerText = "⚠️ သတိပြုရန် (မိုးသည်းထန်စွာရွာနိုင်)";
        alertBox.style.color = "#f59e0b";
    } else {
        alertBox.innerText = "✅ ပုံမှန် (ဘေးအန္တရာယ်မရှိပါ)";
        alertBox.style.color = "#10b981";
    }

    document.getElementById('highTideTime').innerText = "06:30 AM / 06:45 PM";
    document.getElementById('lowTideTime').innerText = "12:15 PM / 12:30 AM";
    document.getElementById('waterLevel').innerText = `+${(dailyRain * 0.05 + 1.2).toFixed(2)} m`;

    document.getElementById('windSpeed').innerText = `${current.windspeed} km/h`;
    document.getElementById('uvIndex').innerText = uv;
    document.getElementById('aqiValue').innerText = aqiVal;

    generateAISummary(current.temperature, dailyRain, current.windspeed, uv);
}

// 7. AI Summary
function generateAISummary(temp, rain, wind, uv) {
    let summary = `လက်ရှိ အပူချိန်မှာ ${temp}°C ရှိပြီး လေတိုက်နှုန်းမှာ တစ်နာရီလျှင် ${wind} km/h ရှိပါသည်။ `;
    
    if (rain > 20) {
        summary += `မိုးရေချိန် ${rain}mm ထိ မြင့်တက်နေသဖြင့် ဧရာဝတီတိုင်းအတွင်း ရေကြောင်းခရီးသွားလာမှုနှင့် မြစ်ကမ်းဘေးနေထိုင်သူများ ရေတက်ချိန်ကို အထူးသတိပြုသင့်ပါသည်။ `;
    } else {
        summary += `မိုးရေချိန် နည်းပါးသဖြင့် ရေကြောင်းစီးဆင်းမှု ပုံမှန်အတိုင်း ရှိနေပါမည်။ `;
    }

    if (uv > 6) {
        summary += `ခရမ်းလွန်ရောင်ခြည် UV Index ${uv} ထိ မြင့်မားနေသဖြင့် နေရောင်ခြည်နှင့် တိုက်ရိုက်ထိတွေ့မှုကို ရှောင်ကြဉ်ပါ။`;
    }

    document.getElementById('aiSummaryText').innerText = summary;
}

// 8. Premium Mock Logic
function updatePremiumUI() {
    const overlay = document.getElementById('premiumOverlay');
    overlay.style.display = isPremiumUser ? 'none' : 'flex';
}

function unlockPremiumMock() {
    isPremiumUser = true;
    updatePremiumUI();
    alert("Premium စမ်းသပ်မှုစနစ် အောင်မြင်ပါသည်။");
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updatePremiumUI();
    initLocation();
});
