import axios from 'axios';
import polyline from '@mapbox/polyline';

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export const geocodeGoogle = async (query: string, apiKey?: string): Promise<[number, number]> => {
    // Note: We don't need to check for API key here as it's handled on the server side
    // But we can keep it if we want to fail fast on client, though env var might not be exposed if not NEXT_PUBLIC
    // The previous implementation used NEXT_PUBLIC_GOOGLE_MAPS_API_KEY so it was exposed.

    try {
        const params: any = { address: query };
        if (apiKey) {
            params.apiKey = apiKey;
        }

        const response = await axios.get('/api/google-geocode', {
            params,
        });

        if (response.data.status === 'OK' && response.data.results.length > 0) {
            const { lat, lng } = response.data.results[0].geometry.location;
            return [lng, lat]; // Return [lng, lat] to match Mapbox/GeoJSON format
        } else {
            throw new Error(`Location not found (Google): ${query}`);
        }
    } catch (error: any) {
        console.error('Google Geocoding Error:', error);
        throw new Error(error.response?.data?.error || error.message || 'Failed to geocode with Google Maps');
    }
};

export const getRouteGoogle = async (start: [number, number], end: [number, number], apiKey?: string): Promise<{ duration: number; distance: number; geometry: [number, number][] }> => {
    try {
        // Google Directions API expects "lat,lng"
        const origin = `${start[1]},${start[0]}`;
        const destination = `${end[1]},${end[0]}`;

        const params: any = {
            origin,
            destination,
        };

        if (apiKey) {
            params.apiKey = apiKey;
        }

        const response = await axios.get('/api/google-directions', {
            params,
        });

        if (response.data.status === 'OK' && response.data.routes.length > 0) {
            const route = response.data.routes[0];
            const leg = route.legs[0];

            // Google returns an encoded polyline
            const geometry = polyline.decode(route.overview_polyline.points);

            return {
                duration: leg.duration.value, // in seconds
                distance: leg.distance.value, // in meters
                geometry: geometry, // [lat, lng][]
            };
        } else {
            throw new Error('No route found (Google)');
        }
    } catch (error: any) {
        console.error('Google Routing Error:', error);
        throw new Error(error.response?.data?.error || error.message || 'Failed to calculate route with Google Maps');
    }
};

export const autocompleteGoogle = async (query: string, apiKey?: string): Promise<string[]> => {
    if (!query || query.length < 3) return [];

    try {
        const params: any = { input: query };
        if (apiKey) {
            params.apiKey = apiKey;
        }

        const response = await axios.get('/api/google-places', {
            params,
        });

        // Note: Client-side Google Places Autocomplete usually requires the JS SDK or a proxy to avoid CORS.
        // Direct calls to Places API from browser are blocked by CORS.
        // We might need a proxy route or use the session token approach.
        // For now, I'll assume we might need a proxy. 
        // Or we can use the existing 'geocodeGoogle' for simple search if autocomplete is hard without SDK.
        // But the user asked for "Google Map", implying the full experience.

        // Let's assume we'll create a proxy route /api/google-places-autocomplete
        return response.data.predictions.map((p: any) => p.description);
    } catch (error) {
        console.error('Google Autocomplete Error:', error);
        return [];
    }
};
