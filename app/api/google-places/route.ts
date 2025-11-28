import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get('input');
    const customApiKey = searchParams.get('apiKey');
    const apiKey = customApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!input) {
        return NextResponse.json({ predictions: [] });
    }

    if (!apiKey) {
        return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
    }

    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
            params: {
                input,
                key: apiKey,
                types: 'geocode', // Restrict to geocoding results (addresses)
            },
        });

        if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
            return NextResponse.json(response.data);
        } else {
            console.error('Google Places API Error:', response.data);
            return NextResponse.json({ error: response.data.error_message || 'Google Places API error' }, { status: 500 });
        }
    } catch (error: any) {
        console.error('Proxy Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch from Google Places' }, { status: 500 });
    }
}
