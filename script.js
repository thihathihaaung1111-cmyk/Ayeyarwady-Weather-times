const locationBtn = document.getElementById("locationBtn");

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function findNearestLocation(userLat, userLon, locations) {
    let nearest = null;
    let shortestDistance = Infinity;

    for (const place of locations) {
        const distance = getDistance(
            userLat,
            userLon,
            place.latitude,
            place.longitude
        );

        if (distance < shortestDistance) {
            shortestDistance = distance;
            nearest = place;
        }
    }

    return nearest;
}

function getWeatherText(code) {
    const weather = {
        0: "☀️ နေသာ",
        1: "🌤 တိမ်အနည်းငယ်",
        2: "⛅️ တိမ်အသင့်အတင့်",
        3: "☁️ တိမ်ထူ",
        45: "🌫 မြူ",
        48: "🌫 မြူထူ",
        51: "🌧 မိုးဖွဲ",
        53: "🌧 မိုးဖွဲအသင့်အတင့်",
        55: "🌧 မိုးဖွဲများ",
        61: "🌧 မိုးရွာ",
        63: "🌧 မိုးရွာအသင့်အတင့်",
        65: "🌧 မိုးသည်း",
        80: "🌩 မိုးတစ်ခါတစ်ရံ",
        81: "🌩 မိုးများ",
        82: "🌩 မိုးပြင်း",
        95: "⛈ မိုးကြိုးမုန်တိုင်း"
    };

    return weather[code] || "မသိသော ရာသီဥတု";
}

// ၂၄ နာရီစာ ပြသပေးမည့် Function
function renderHourlyForecast(hourly) {
    const container = document.getElementById('hourly-forecast');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < 24; i++) {
        const time = new Date(hourly.time[i]).getHours() + ":00";
        const temp = Math.round(hourly.temperature_2m[i]);
        const rain = hourly.precipitation_probability[i];

        container.innerHTML += `
            <div class="hourly-card">
                <div>${time}</div>
                <div><b>${temp}°C</b></div>
                <div style="font-size: 12px; color: #007bff;">🌧 ${rain}%</div>
            </div>
        `;
    }
}

// ၇ ရက်စာ ပြသပေးမည့် Function
function renderDailyForecast(daily) {
    const container = document.getElementById('daily-forecast');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < daily.time.length; i++) {
        const date = new Date(daily.time[i]).toLocaleDateString('my-MM', { weekday: 'short', day: 'numeric' });
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        const rain = daily.precipitation_probability_max[i];

        container.innerHTML += `
            <div class="daily-row">
                <span>${date}</span>
                <span>🌧 ${rain}%</span>
                <span><b>${maxTemp}°C</b> / ${minTemp}°C</span>
            </div>
        `;
    }
}

locationBtn.addEventListener("click", async () => {
    if (!navigator.geolocation) {
        alert("Geolocation ကို Browser က မထောက်ခံပါ။");
        return;
    }

    document.getElementById("location").innerHTML = "📍 တည်နေရာကို ရှာနေသည်...";

    navigator.geolocation.getCurrentPosition(async (position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;

        try {
            const response = await fetch("locations.json");
            const locations = await response.json();

            const nearest = findNearestLocation(userLat, userLon, locations);

            document.getElementById("location").innerHTML = 
                `📍 ${nearest.village_mm} (${nearest.township_mm})`;

            // 24hr နဲ့ 7day forecast ဒေတာများပါ ပါဝင်အောင် URL ကို ပြင်ဆင်ထားပါသည်
            const weatherUrl = 
                `https://api.open-meteo.com/v1/forecast?latitude=${nearest.latitude}&longitude=${nearest.longitude}&current=temperature_2m,weather_code&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FYangon`;

            const weatherResponse = await fetch(weatherUrl);
            const data = await weatherResponse.json();

            document.getElementById("temperature").innerHTML = 
                `🌡 Temperature : ${data.current.temperature_2m} °C`;

            document.getElementById("weatherText").innerHTML = 
                `☁️ ${getWeatherText(data.current.weather_code)}`;

            const rain = data.hourly.precipitation_probability[0] ?? 0;
            document.getElementById("rainChance").innerHTML = 
                `🌧 Rain Chance : ${rain}%`;

            // Forecast များ ပြသရန် ခေါ်ယူခြင်း
            renderHourlyForecast(data.hourly);
            renderDailyForecast(data.daily);

        } catch (error) {
            console.error(error);
            document.getElementById("location").innerHTML = "❌ အချက်အလက် ရယူ၍ မရပါ";
        }
    }, () => {
        document.getElementById("location").innerHTML = "❌ Location Permission ပေးပါ";
    });
});
