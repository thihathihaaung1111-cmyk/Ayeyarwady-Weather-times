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

// 2. Haversine Formula (GPS အကွာအဝေး တွက်ချက်ရန်)
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

// 3. App စတင်ချိန်တွင် သိမ်းဆည်းထားသော နေရာရှိမရှိ စစ်ဆေးခြင်း
async function initLocation() {
    const statusText = document.getElementById('locationStatus');
    
    // အရင်က သိမ်းထားပြီးသား နေရာရှိမရှိ စစ်မည်
    const savedLat = localStorage.getItem('ayeyar_lat');
    const savedLng = localStorage.getItem('ayeyar_lng');

    if (savedLat && savedLng) {
        userCoords = { lat: parseFloat(savedLat), lng: parseFloat(savedLng) };
        statusText.innerText = "မှတ်သားထားသော တည်နေရာ";
        statusText.style.background = "#0d9488";
        
        // locations.json ကို အရင် Load လုပ်ပြီးမှ အနီးဆုံးနေရာ ရှာမည်
        await loadLocationsAndFindNearest();
    } else {
        fetchGPSLocation();
    }
}

// GPS အသစ်ယူရန် (ပုသိမ်ဟု ဇွတ်မတပ်ဘဲ GPS ကို အပြည့်အဝ အချိန်ပေးရှာမည်)
function fetchGPSLocation() {
    const statusText = document.getElementById('locationStatus');
    statusText.innerText = "GPS ဖြင့် တည်နေရာရှာနေသည်...";

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                userCoords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                // LocalStorage တွင် မှတ်ထားမည်
                localStorage.setItem('ayeyar_lat', userCoords.lat);
                localStorage.setItem('ayeyar_lng', userCoords.lng);
                
                statusText.innerText = "GPS ချိတ်ဆက်ပြီး";
                statusText.style.background = "#10b981";
                await loadLocationsAndFindNearest();
            },
            (error) => {
                statusText.innerText = "GPS ရယူ၍မရပါ (ဖုန်း Location ဖွင့်ပါ)";
                console.error("GPS Error:", error);
            },
            { timeout: 10000, enableHighAccuracy: true } // 10 စက္ကန့်အထိ တိကျစွာ GPS စောင့်ရှောက်ရှာဖွေမည်
        );
    } else {
        statusText.innerText = "ဤ Browser တွင် GPS မရနိုင်ပါ";
    }
}

// တည်နေရာအသစ် ပြန်လည်ပြောင်းလဲလိုပါက (Reset ခလုတ်နှိပ်လျှင်)
function resetLocation() {
    localStorage.removeItem('ayeyar_lat');
    localStorage.removeItem('ayeyar_lng');
    document.getElementById('currentLocationName').innerText = "တည်နေရာအသစ် ရှာဖွေနေပါသည်...";
    fetchGPSLocation();
}

// 4. locations.json ကို Load လုပ်ပြီး အနီးဆုံးရွာ/မြို့ တည်နေရာ အမှန်အတိုင်း ရှာခြင်း
async function loadLocationsAndFindNearest() {
    try {
        if (locationsData.length === 0) {
            const res = await fetch('locations.json');
            locationsData = await res.json();
        }
        
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
            const placeName = nearest.village_mm ? `${nearest.village_mm} (${nearest.township_mm || ''})` : nearest.township_en;
            document.getElementById('currentLocationName').innerText = placeName;
            document.getElementById('geoCoordinates').innerText = `Lat: ${userCoords.lat.toFixed(4)} | Long: ${userCoords.lng.toFixed(4)} | အနီးဆုံးရွာ/မြို့နှင့် အကွာအဝေး: ${minDistance.toFixed(1)} km`;
            
            fetchWeatherData(userCoords.lat, userCoords.lng);
        }
    } catch (err) {
        console.error("locations.json ဖတ်မရပါ:", err);
        fetchWeatherData(userCoords.lat, userCoords.lng);
    }
}

// 5. Open-Meteo API ဖြင့် Weather, Wind, UV, AQI Data များ ယူခြင်း
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
        console.error("API Data ရယူရာတွင် အမှားရှိပါသည်:", err);
    }
}

// 6. UI Data များ ထည့်သွင်းခြင်း & AI Logic
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

// 7. AI Text Generation Logic
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
    alert("Premium စမ်းသပ်မှုစနစ် အောင်မြင်ပါသည်။ AI ခန့်မှန်းချက် အပြည့်အစုံကို ကြည့်ရှုနိုင်ပါပြီ။");
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    updatePremiumUI();
    initLocation();
});
