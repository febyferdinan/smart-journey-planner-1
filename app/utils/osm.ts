import axios from 'axios';
import polyline from '@mapbox/polyline';

// Nominatim Geocoding (Free, 1 req/sec limit)
export const geocodeNominatim = async (query: string): Promise<[number, number]> => {
    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: query,
                format: 'json',
                limit: 1,
            },
            headers: {
                'User-Agent': 'FlightArrivalPredictor/1.0', // Required by Nominatim policy
            },
        });

        if (response.data && response.data.length > 0) {
            const { lat, lon } = response.data[0];
            return [parseFloat(lon), parseFloat(lat)]; // Return [lng, lat] to match Mapbox format
        } else {
            throw new Error(`Location not found (OSM): ${query}`);
        }
    } catch (error: any) {
        console.error('Nominatim Geocoding Error:', error);
        throw new Error(error.message || 'Failed to geocode with OpenStreetMap');
    }
};

// OSRM Routing (Free public demo server)
export const getRouteOSRM = async (start: [number, number], end: [number, number]): Promise<{ duration: number; distance: number; geometry: [number, number][] }> => {
    try {
        // OSRM expects "lng,lat"
        const startStr = `${start[0]},${start[1]}`;
        const endStr = `${end[0]},${end[1]}`;

        const response = await axios.get(`https://router.project-osrm.org/route/v1/driving/${startStr};${endStr}`, {
            params: {
                overview: 'full',
                geometries: 'polyline',
            },
        });

        if (response.data && response.data.routes && response.data.routes.length > 0) {
            const route = response.data.routes[0];
            // Decode polyline to [lat, lng] array
            const geometry = polyline.decode(route.geometry);

            return {
                duration: route.duration, // in seconds
                distance: route.distance, // in meters
                geometry: geometry, // [lat, lng][]
            };
        } else {
            throw new Error('No route found (OSM)');
        }
    } catch (error: any) {
        console.error('OSRM Routing Error:', error);
        throw new Error(error.message || 'Failed to calculate route with OpenStreetMap');
    }
};

// Photon Autocomplete (Free, OSM-based)
export const autocompletePhoton = async (query: string): Promise<string[]> => {
    if (!query || query.length < 3) return [];

    try {
        const response = await axios.get('https://photon.komoot.io/api/', {
            params: {
                q: query,
                limit: 5,
                lang: 'en',
            },
        });

        if (response.data && response.data.features) {
            return response.data.features.map((feature: any) => {
                const p = feature.properties;
                // Construct a readable address string
                const parts = [
                    p.name,
                    p.street,
                    p.city,
                    p.state,
                    p.country
                ].filter(Boolean);
                return parts.join(', ');
            });
        }
        return [];
    } catch (error) {
        console.error('Photon Autocomplete Error:', error);
        return [];
    }
};

// OSRM Trip Optimization
export const getOptimizedTripOSRM = async (coordinates: [number, number][]): Promise<{ duration: number; distance: number; geometry: [number, number][]; waypointIndices: number[] }> => {
    try {
        // OSRM expects "lng,lat;lng,lat;..."
        const coordString = coordinates.map(c => `${c[0]},${c[1]}`).join(';');

        const response = await axios.get(`https://router.project-osrm.org/trip/v1/driving/${coordString}`, {
            params: {
                source: 'first',
                destination: 'last',
                roundtrip: 'false',
                overview: 'full',
                geometries: 'polyline',
            },
        });

        if (response.data && response.data.trips && response.data.trips.length > 0) {
            const trip = response.data.trips[0];
            const geometry = polyline.decode(trip.geometry);

            // OSRM returns waypoints sorted by their index in the trip
            const optimizedOrder = response.data.waypoints.map((wp: any) => wp.waypoint_index);

            return {
                duration: trip.duration,
                distance: trip.distance,
                geometry: geometry,
                waypointIndices: optimizedOrder,
            };
        } else {
            throw new Error('No optimized trip found (OSM)');
        }
    } catch (error: any) {
        console.error('OSRM Trip Error:', error);
        throw new Error(error.message || 'Failed to optimize trip with OpenStreetMap');
    }
};
