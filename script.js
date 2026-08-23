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
    }).
        return nearest;
}
locationBtn.addEventListener("click", async () => {

    if (!navigator.geolocation) {
        alert("သင့် Browser က Geolocation ကို မထောက်ပံ့ပါ။");
        return;
    }

    document.getElementById("location").innerHTML = "📍 တည်နေရာကို ရှာဖွေနေသည်...";

    navigator.geolocation.getCurrentPosition(async (position) => {

        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;

        try {

            // locations.json ကိုဖတ်
            const response = await fetch("locations.json");
            const locations = await response.json();

            // အနီးဆုံးနေရာရှာ
            const nearest = findNearestLocation(userLat, userLon, locations);

            // နေရာပြ
            document.getElementById("location").innerHTML =
                `📍 ${nearest.village_mm}<br>${nearest.township_mm}`;

            // Weather API
            const weatherUrl =
                `https://api.open-meteo.com/v1/forecast?latitude=${nearest.latitude}&longitude=${nearest.longitude}&current=temperature_2m,weather_code&hourly=precipitation_probability`;

            const weatherResponse = await fetch(weatherUrl);
            const data = await weatherResponse.json();

            document.getElementById("temperature").innerHTML =
                `🌡️ ${data.current.temperature_2m} °C`;

            document.getElementById("weatherText").innerHTML =
                `☁️ Weather Code : ${data.current.weather_code}`;

            const rainChance =
                data.hourly.precipitation_probability[0];

            document.getElementById("rainChance").innerHTML =
                `🌧️ ${rainChance}%`;

        } catch (err) {
            console.error(err);
            alert("Data ရယူရာတွင် အမှားဖြစ်နေပါသည်။");
        }

    }, () => {

        document.getElementById("location").innerHTML =
            "❌ Location Permission ပေးပါ။";

    });

});
function getWeatherText(code) {

    const weather = {
        0: "☀️ နေသာ",
        1: "🌤️ တိမ်အနည်းငယ်",
        2: "⛅ တိမ်အသင့်အတင့်",
        3: "☁️ တိမ်ထူ",
        45: "🌫️ မြူ",
        48: "🌫️ မြူထူ",
        51: "🌦️ မိုးဖွဲ",
        53: "🌦️ မိုးဖွဲအသင့်အတင့်",
        55: "🌧️ မိုးဖွဲများ",
        61: "🌧️ မိုးရွာ",
        63: "🌧️ မိုးရွာအသင့်အတင့်",
        65: "🌧️ မိုးသည်း",
        80: "🌦️ မိုးတစ်ခါတစ်ရံ",
        81: "🌧️ မိုးများ",
        82: "⛈️ မိုးပြင်း",
        95: "⛈️ မိုးကြိုးမုန်တိုင်း",
        96: "⛈️ မိုးကြိုးနှင့် မိုးသီး",
        99: "⛈️ မိုးကြိုးပြင်း"
    };

    return weather[code] || "❓ မသိသောရာသီဥတု";
        }
