// ============================================================================
// Small GPS/maps helper used when logging a field visit, so the exact spot
// a customer visit happened at gets attached to the visit-history entry
// (see buildVisitEntry in constants.js) without blocking the save if
// location isn't available.
// ============================================================================

// Resolves the device's current { lat, lng }, or null if location can't be
// obtained (permission denied, unsupported browser/WebView, or it timed
// out). Never rejects — callers can always safely await this without a
// try/catch, and a null result just means "log the visit without a pin".
export function getCurrentLocation(timeoutMs = 6000) {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => resolve(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}

// Builds a Google Maps URL for a { lat, lng } location, or null if there's
// no location to link to.
export function mapsUrl(location) {
  if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") return null;
  return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
}
