import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const customApiKey = searchParams.get('apiKey');
    const apiKey = customApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!address) {
        return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    if (!apiKey) {
        return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
    }

    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address,
                key: apiKey,
            },
        });

        if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
            return NextResponse.json(response.data);
        } else {
            console.error('Google Geocoding API Error:', response.data);
            return NextResponse.json({ error: response.data.error_message || 'Google Geocoding API error' }, { status: 500 });
        }
    } catch (error: any) {
        console.error('Proxy Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch from Google Geocoding API' }, { status: 500 });
    }
}
