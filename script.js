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
        document.getElementById(target).classList.add('active');
    });
});

// 2. Haversine Formula (GPS အကွာအဝေး တွက်ချက်ရန်)
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// 3. User ရဲ့ GPS နေရာကို တောင်းယူခြင်း
function getUserLocation() {
    const statusText = document.getElementById('locationStatus');
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userCoords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                statusText.innerText = "GPS ချိတ်ဆက်ပြီး";
                statusText.style.background = "#10b981";
                findNearestLocation();
            },
            (error) => {
                statusText.innerText = "GPS ယူ၍မရပါ (Pathein ကို အသုံးပြုမည်)";
                // GPS မရပါက Pathein ၏ Coords ကို Default ထားခြင်း
                userCoords = { lat: 16.783909, lng: 94.733281 };
                findNearestLocation();
            }
        );
    } else {
        statusText.innerText = "GPS Support မလုပ်ပါ";
        userCoords = { lat: 16.783909, lng: 94.733281 };
        findNearestLocation();
    }
}

// 4. locations.json ထဲမှ အနီးဆုံးနေရာ ရှာခြင်း
async function findNearestLocation() {
    try {
        const res = await fetch('locations.json');
        locationsData = await res.json();
        
        // Null မဟုတ်သော Data များသာ ယူမည်
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
            document.getElementById('currentLocationName').innerText = `${nearest.village_mm || nearest.village_en} (${nearest.township_mm || nearest.township_en})`;
            document.getElementById('geoCoordinates').innerText = `Lat: ${userCoords.lat.toFixed(4)} | Long: ${userCoords.lng.toFixed(4)} | အကွာအဝေး: ${minDistance.toFixed(1)} km`;
            
            // Weather & Environmental Data Fetch လုပ်ရန်
            fetchWeatherData(userCoords.lat, userCoords.lng);
        }
    } catch (err) {
        console.error("locations.json ဖတ်မရပါ:", err);
    }
}

// 5. Open-Meteo API ဖြင့် Weather, Wind, UV, AQI Data များ ယူခြင်း
async function fetchWeatherData(lat, lng) {
    try {
        // Open-Meteo Weather API
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=precipitation,relativehumidity_2m,uv_index&daily=precipitation_sum&timezone=auto`;
        
        // Open-Meteo Air Quality API
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi`;

        const [weatherRes, aqiRes] = await Promise.all([
            fetch(weatherUrl),
            fetch(aqiUrl)
        ]);

        const weatherData = await weatherRes.json();
        const aqiData = await aqiRes.json();

        // UI တွင် ဒေတာများ ထည့်သွင်းခြင်း
        updateUI(weatherData, aqiData);

    } catch (err) {
        console.error("API Data ရယူရာတွင် အမှားရှိပါသည်:", err);
    }
}

// 6. UI Data အသစ်ပြင်ဆင်ခြင်း & AI Logic
function updateUI(weather, aqi) {
    const current = weather.current_weather;
    const dailyRain = weather.daily.precipitation_sum[0] || 0;
    const uv = weather.hourly.uv_index[0] || 0;
    const aqiVal = aqi.current ? aqi.current.european_aqi : "N/A";

    // Overview Tab
    document.getElementById('tempValue').innerText = `${current.temperature} °C`;
    document.getElementById('rainValue').innerText = `${dailyRain} mm`;

    // Flood Warning Logic (မိုးရေချိန်ပေါ်မူတည်၍ သတိပေးချက်ထုတ်ခြင်း)
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

    // Tides Tab Mock Calculations (ဒီရေအတက်အကျ ခန်းမှန်းတွက်ချက်မှု)
    document.getElementById('highTideTime').innerText = "06:30 AM / 06:45 PM";
    document.getElementById('lowTideTime').innerText = "12:15 PM / 12:30 AM";
    document.getElementById('waterLevel').innerText = `+${(dailyRain * 0.05 + 1.2).toFixed(2)} m`;

    // Environment Tab
    document.getElementById('windSpeed').innerText = `${current.windspeed} km/h`;
    document.getElementById('uvIndex').innerText = uv;
    document.getElementById('aqiValue').innerText = aqiVal;

    // AI Summary Generator Logic
    generateAISummary(current.temperature, dailyRain, current.windspeed, uv);
}

// 7. AI Text Generation Logic (အခြေအနေပေါ် မူတည်ပြီး စာတိုထုတ်ပေးခြင်း)
function generateAISummary(temp, rain, wind, uv) {
    let summary = `လက်ရှိ အပူချိန်မှာ ${temp}°C ရှိပြီး လေတိုက်နှုန်းမှာတစ်နာရီ ${wind} km/h ရှိပါသည်။ `;
    
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
    getUserLocation();
});
