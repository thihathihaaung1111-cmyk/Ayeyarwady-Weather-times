const locationBtn = document.getElementById("locationBtn");

locationBtn.addEventListener("click", () => {
    // Geolocation မရှိပါက သတိပေးရန်
    if (!navigator.geolocation) {
        alert("သင့် Browser က Geolocation ကို အထောက်အပံ့ မပေးပါ၊၊");
        return;
    }

    document.getElementById("location").innerText = "📍 တည်နေရာကို ရှာဖွေနေသည်...";

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        document.getElementById("location").innerHTML = 
            `📍 Latitude: ${lat.toFixed(4)} <br> Longitude: ${lon.toFixed(4)}`;

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&hourly=precipitation_probability`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            // Weather Data များကို HTML သို့ ထည့်သွင်းခြင်း
            document.getElementById("temperature").innerHTML = 
                `🌡️ Temperature : ${data.current.temperature_2m} °C`;

            document.getElementById("weatherText").innerHTML = 
                `☁️ Weather Code : ${data.current.weather_code}`;

            // Rain Chance ရရှိပါက ပြရန်
            const rainChance = data.hourly?.precipitation_probability?.[0] ?? 0;
            document.getElementById("rainChance").innerHTML = 
                `🌧️ Rain Chance : ${rainChance} %`;

        } catch (error) {
            console.error(error);
            alert("ရာသီဥတု အချက်အလက်များ ယူဆောင်ရာတွင် အမှားအယွင်း ရှိနေပါသည်။");
        }
    }, (error) => {
        // Location Permission ပိတ်ထားလျှင် ပြရန်
        document.getElementById("location").innerText = "❌ တည်နေရာ ရယူ၍ မရပါ။ Permission ပေးပါ။";
    });
});
