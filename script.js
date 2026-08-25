/* ==========================================
   Ayeyarwady Weather Times
   script.js
   Version 1.0
========================================== */

const splash = document.getElementById("splash");
const gpsBtn = document.getElementById("gpsBtn");
const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("searchInput");

const cityName = document.getElementById("cityName");
const lat = document.getElementById("lat");
const lon = document.getElementById("lon");
const distance = document.getElementById("distance");

const favoriteLocation =
document.getElementById("favoriteLocation");

const temp =
document.getElementById("temp");

const humidity =
document.getElementById("humidity");

const wind =
document.getElementById("wind");

const rain =
document.getElementById("rain");

const riskFill =
document.getElementById("riskFill");

const floodStatus =
document.getElementById("floodStatus");

const aiResult =
document.getElementById("aiResult");

window.onload = () => {

setTimeout(() => {

splash.style.display = "none";

},2000);

loadFavorite();

getLocation();

};


/* ===============================
 GPS
================================ */

gpsBtn.addEventListener("click",getLocation);

function getLocation(){

if(!navigator.geolocation){

alert("GPS မရနိုင်ပါ");

return;

}

navigator.geolocation.getCurrentPosition(

success,

error

);

}


function error(){

alert("Location Permission ပိတ်ထားသည်");

}

function success(position){

const latitude = position.coords.latitude;

const longitude = position.coords.longitude;

lat.innerHTML=latitude.toFixed(5);

lon.innerHTML=longitude.toFixed(5);

cityName.innerHTML="Current Location";

distance.innerHTML="0 km";

fetchWeather(latitude,longitude);

    }

/* ===============================
 Search
================================ */

searchBtn.addEventListener("click",()=>{

let text = searchInput.value.trim();

if(text=="") return;

cityName.innerHTML=text;

saveFavorite(text);

demoWeather();

demoFlood();

demoAI();

});


/* ===============================
 Favourite
================================ */

function saveFavorite(name){

localStorage.setItem("favoriteTown",name);

favoriteLocation.innerHTML=name;

}

function loadFavorite(){

let data=localStorage.getItem("favoriteTown");

if(data){

favoriteLocation.innerHTML=data;

}

}


/* ===============================
 Weather Demo
================================ */

function demoWeather(){

temp.innerHTML="30°C";

humidity.innerHTML="82%";

wind.innerHTML="18 km/h";

rain.innerHTML="70%";

}


/* ===============================
 Flood Demo
================================ */

function demoFlood(){

let risk=65;

riskFill.style.width=risk+"%";

if(risk<30){

floodStatus.innerHTML="🟢 Low Risk";

}

else if(risk<70){

floodStatus.innerHTML="🟡 Medium Risk";

}

else{

floodStatus.innerHTML="🔴 High Risk";

}

}


/* ===============================
 AI Demo
================================ */

function demoAI(){

aiResult.innerHTML=`

ယနေ့ မိုးရွာနိုင်ချေ မြင့်မားနေပါသည်။

🌾 လယ်သမားများ

ရေထုတ်မြောင်းများကို စစ်ဆေးထားပါ။

🛶 ငါးဖမ်းသမားများ

လှိုင်းအသင့်အတင့်ရှိနိုင်သောကြောင့်
သတိထားပါ။

👨‍👩‍👧‍👦 အများပြည်သူ

ရေကြီးနိုင်သောနေရာများကို
စောင့်ကြည့်ပါ။

`;

}

/* ==========================================
   LOCATIONS.JSON
========================================== */

let locations = [];

async function loadLocations() {

    try {

        const response = await fetch("locations.json");

        locations = await response.json();

        console.log("Locations Loaded :", locations.length);

    } catch (e) {

        console.log("Location Load Error", e);

    }

}

loadLocations();


/* ==========================================
   SEARCH LOCATION
========================================== */

searchInput.addEventListener("keyup", function () {

    const keyword = this.value.toLowerCase();

    if (keyword.length < 2) return;

    const result = locations.filter(item =>

        item.name.toLowerCase().includes(keyword)

    );

    console.log(result);

});


/* ==========================================
   FIND CITY
========================================== */

function findTown(name) {

    return locations.find(item =>

        item.name.toLowerCase() == name.toLowerCase()

    );

}


/* ==========================================
   DISTANCE
========================================== */

function getDistance(lat1, lon1, lat2, lon2) {

    const R = 6371;

    const dLat = (lat2 - lat1) * Math.PI / 180;

    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =

        Math.sin(dLat / 2) *

        Math.sin(dLat / 2) +

        Math.cos(lat1 * Math.PI / 180) *

        Math.cos(lat2 * Math.PI / 180) *

        Math.sin(dLon / 2) *

        Math.sin(dLon / 2);

    const c =

        2 *

        Math.atan2(

            Math.sqrt(a),

            Math.sqrt(1 - a)

        );

    return R * c;

}


/* ==========================================
   SHOW LOCATION
========================================== */

function showTown(town) {

    cityName.innerHTML = town.name;

    lat.innerHTML = town.latitude;

    lon.innerHTML = town.longitude;

}


/* ==========================================
   SEARCH BUTTON
========================================== */

searchBtn.addEventListener("click", () => {

    const town = findTown(searchInput.value);

    if (!town) {

        alert("မြို့မတွေ့ပါ");

        return;

    }

    function showTown(town){

    cityName.innerHTML = town.name;

    lat.innerHTML = town.latitude;

    lon.innerHTML = town.longitude;

    fetchWeather(
        town.latitude,
        town.longitude
    );

    }

    
/* ==========================================
   AUTO COMPLETE (NEXT VERSION)
========================================== */

function autoComplete(keyword) {

    return locations.filter(item =>

        item.name.toLowerCase()

        .startsWith(keyword.toLowerCase())

    );

}

/* ==========================================
   PART 3
   LIVE WEATHER API + AI RISK
========================================== */

async function fetchWeather(lat, lon) {

    try {

        const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&timezone=auto`;

        const response = await fetch(url);

        const data = await response.json();

        const current = data.current;

        temp.innerHTML = current.temperature_2m + " °C";
        humidity.innerHTML = current.relative_humidity_2m + " %";
        wind.innerHTML = current.wind_speed_10m + " km/h";
        rain.innerHTML = current.precipitation + " mm";

        calculateRisk(current);

    } catch (e) {

        console.log(e);

    }

}


/* ==========================================
   AI RISK SCORE
========================================== */

function calculateRisk(current){

    let score = 0;

    if(current.precipitation >= 5)
        score += 30;

    if(current.wind_speed_10m >= 25)
        score += 30;

    if(current.relative_humidity_2m >= 85)
        score += 20;

    if(current.temperature_2m <= 24)
        score += 20;

    if(score>100)
        score=100;

    riskFill.style.width = score + "%";

    if(score<30){

        floodStatus.innerHTML="🟢 Low Risk";

    }else if(score<60){

        floodStatus.innerHTML="🟡 Medium Risk";

    }else if(score<80){

        floodStatus.innerHTML="🟠 High Risk";

    }else{

        floodStatus.innerHTML="🔴 Extreme Risk";

    }

    generateAI(score,current);

}


/* ==========================================
   AI REPORT
========================================== */

function generateAI(score,current){

let report="";

report+="<h3>🤖 AI Weather Analysis</h3>";

report+="<br>";

report+="🌡 Temperature : "+current.temperature_2m+"°C<br>";

report+="💧 Humidity : "+current.relative_humidity_2m+"%<br>";

report+="💨 Wind : "+current.wind_speed_10m+" km/h<br>";

report+="🌧 Rain : "+current.precipitation+" mm<br><br>";

if(score<30){

report+="✅ ရာသီဥတုတည်ငြိမ်နေပါသည်။";

}

else if(score<60){

report+="⚠ မိုးရွာနိုင်ပါသည်။ သတိထားပါ။";

}

else if(score<80){

report+="🌊 ရေကြီးနိုင်ခြေမြင့်လာနေပါသည်။";

}

else{

report+="🚨 ရေဘေးနှင့် လေပြင်းအန္တရာယ် မြင့်မားပါသည်။";

}

report+="<hr>";

report+="🌾 <b>လယ်သမား</b><br>";

report+="ရေထုတ်မြောင်းများကို စစ်ဆေးထားပါ။<br><br>";

report+="🚤 <b>ငါးဖမ်းသမား</b><br>";

report+="ပင်လယ်မထွက်သင့်ပါ။<br><br>";

report+="👨‍👩‍👧‍👦 <b>ပြည်သူများ</b><br>";

report+="သတင်းများကို အချိန်နှင့်တပြေးညီ စောင့်ကြည့်ပါ။";

aiResult.innerHTML=report;

            }
    /* ==========================================
   PART 4
   NEAREST LOCATION ENGINE
========================================== */

function findNearestTown(userLat, userLon){

    if(locations.length===0) return null;

    let nearest=null;

    let shortest=999999;

    locations.forEach(town=>{

        const d=getDistance(
            userLat,
            userLon,
            parseFloat(town.latitude),
            parseFloat(town.longitude)
        );

        if(d<shortest){

            shortest=d;

            nearest=town;

        }

    });

    if(nearest){

        cityName.innerHTML=nearest.name;

        lat.innerHTML=nearest.latitude;

        lon.innerHTML=nearest.longitude;

        distance.innerHTML=shortest.toFixed(1)+" km";

        fetchWeather(
            nearest.latitude,
            nearest.longitude
        );

        showRegionType(nearest);

    }

}


/* ==========================================
   REGION TYPE
========================================== */

function showRegionType(town){

    let box=document.getElementById("regionType");

    if(!box) return;

    if(town.type=="coastal"){

        box.innerHTML="🌊 ကမ်းရိုးတန်းဒေသ";

    }

    else{

        box.innerHTML="🌾 ကုန်းတွင်းဒေသ";

    }

}


/* ==========================================
   UPDATE GPS SUCCESS
========================================== */

function success(position){

    const latitude=position.coords.latitude;

    const longitude=position.coords.longitude;

    findNearestTown(
        latitude,
        longitude
    );

    }/* ==========================================
   PART 5
   FLOOD ALERT + AI WARNING + NOTIFICATION
========================================== */

function showAlert(level, message) {

    const banner = document.getElementById("alertBanner");

    if (!banner) return;

    banner.style.display = "block";

    banner.className = "alert " + level;

    banner.innerHTML = message;

}

function updateAlert(score){

    if(score < 30){

        showAlert(
            "green",
            "🟢 လက်ရှိတွင် အန္တရာယ်မရှိသေးပါ။"
        );

    }else if(score < 60){

        showAlert(
            "yellow",
            "🟡 မိုးသည်းနိုင်ပါသည်။ သတိထားပါ။"
        );

    }else if(score < 80){

        showAlert(
            "orange",
            "🟠 ရေကြီးနိုင်ခြေ မြင့်တက်နေပါသည်။"
        );

    }else{

        showAlert(
            "red",
            "🔴 အရေးပေါ် သတိပေးချက် - ရေဘေးအန္တရာယ် မြင့်မားနေပါသည်။"
        );

    }

}


/* ==========================================
   Browser Notification
========================================== */

async function sendNotification(title, body){

    if(!("Notification" in window)) return;

    if(Notification.permission==="default"){

        await Notification.requestPermission();

    }

    if(Notification.permission==="granted"){

        new Notification(title,{

            body:body,

            icon:"icon.png"

        });

    }

}


/* ==========================================
   AI Recommendation
========================================== */

function recommendation(score){

    if(score>=80){

        sendNotification(
            "Flood Warning",
            "ရေဘေးအန္တရာယ် မြင့်မားနေပါသည်။"
        );

    }

}


/* ==========================================
   MODIFY calculateRisk()
========================================== */

const oldCalculateRisk = calculateRisk;

calculateRisk = function(current){

    oldCalculateRisk(current);

    let score = 0;

    if(current.precipitation>=5) score+=30;
    if(current.wind_speed_10m>=25) score+=30;
    if(current.relative_humidity_2m>=85) score+=20;
    if(current.temperature_2m<=24) score+=20;

    updateAlert(score);

    recommendation(score);

             }
