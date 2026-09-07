/**
 * Location utility functions for attendance
 */

/**
 * Ensure location is available (promise-based)
 * Returns GeolocationPosition if successful, throws error if not
 */
export async function ensureLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Get current location coordinates
 * Returns { lat, long } or null if unavailable
 */
export async function getCurrentLocation(): Promise<{ lat: number; long: number } | null> {
  try {
    const position = await ensureLocation();
    return {
      lat: position.coords.latitude,
      long: position.coords.longitude,
    };
  } catch (error) {
    return null;
  }
}
