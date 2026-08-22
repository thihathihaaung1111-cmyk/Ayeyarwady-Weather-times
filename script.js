const locationBtn = document.getElementById("locationBtn");
const locationText = document.getElementById("location");

locationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    locationText.innerText = "ဒီ Browser မှာ Location မရပါ။";
    return;
  }

  locationText.innerText = "တည်နေရာ ရှာနေသည်...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      locationText.innerHTML = `
      📍 Latitude : ${lat}<br>
      📍 Longitude : ${lon}
      `;
    },
    () => {
      locationText.innerText = "တည်နေရာ ခွင့်ပြုချက် မရရှိပါ။";
    }
  );
});
