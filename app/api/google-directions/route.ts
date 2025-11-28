import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const waypoints = searchParams.get('waypoints');
    const customApiKey = searchParams.get('apiKey');
    const apiKey = customApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!origin || !destination) {
        return NextResponse.json({ error: 'Origin and destination are required' }, { status: 400 });
    }

    if (!apiKey) {
        return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
    }

    try {
        const params: any = {
            origin,
            destination,
            key: apiKey,
            departure_time: 'now',
        };

        if (waypoints) {
            params.waypoints = waypoints;
        }

        const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
            params,
        });

        if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS' || response.data.status === 'NOT_FOUND') {
            return NextResponse.json(response.data);
        } else {
            console.error('Google Directions API Error:', response.data);
            return NextResponse.json({ error: response.data.error_message || 'Google Directions API error' }, { status: 500 });
        }
    } catch (error: any) {
        console.error('Proxy Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch from Google Directions API' }, { status: 500 });
    }
}
