// weather.js — Open-Meteo helper (bez klucza)
const fetch = global.fetch || require("node-fetch");

const WMO_CODES = {
  0: "bezchmurnie",
  1: "głównie bezchmurnie",
  2: "częściowe zachmurzenie",
  3: "pochmurnie",
  45: "mgła",
  48: "marznąca mgła",
  51: "mżawka słaba",
  53: "mżawka umiarkowana",
  55: "mżawka gęsta",
  56: "marznąca mżawka słaba",
  57: "marznąca mżawka gęsta",
  61: "deszcz słaby",
  63: "deszcz umiarkowany",
  65: "deszcz intensywny",
  66: "marznący deszcz słaby",
  67: "marznący deszcz intensywny",
  71: "śnieg słaby",
  73: "śnieg umiarkowany",
  75: "śnieg intensywny",
  77: "ziarnisty śnieg",
  80: "przelotny deszcz słaby",
  81: "przelotny deszcz umiarkowany",
  82: "ulewa",
  85: "przelotny śnieg słaby",
  86: "przelotny śnieg intensywny",
  95: "burza",
  96: "burza z lekkim gradem",
  99: "burza z silnym gradem"
};

function nowTimestamp() {
  return new Date().toISOString();
}

async function fetchWeatherSummary(query) {
  if (!query || typeof query !== "string") return null;
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=pl&format=json`;
    const geo = await fetch(geoUrl, { timeout: 8000 });
    const geoJson = await geo.json();
    if (!geoJson?.results?.length) return null;
    const loc = geoJson.results[0];
    const { latitude, longitude, name, country_code } = loc;
    const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;
    const wResp = await fetch(wUrl, { timeout: 8000 });
    const wJson = await wResp.json();
    const cur = wJson?.current;
    if (!cur) return null;
    const code = cur.weather_code;
    const label = WMO_CODES[code] || `kod pogody ${code}`;
    const place = [name, country_code].filter(Boolean).join(", ");
    const summary = `Pogoda dla ${place}: ${label}, temp ${cur.temperature_2m}°C (odczuwalna ${cur.apparent_temperature}°C), wilgotność ${cur.relative_humidity_2m}%, wiatr ${cur.wind_speed_10m} km/h. Aktualizacja: ${cur.time || "brak czasu"}.`;
    return { summary, place, code };
  } catch (e) {
    console.error("weather fetch error", e?.message || e);
    return null;
  }
}

module.exports = { fetchWeatherSummary, nowTimestamp };
