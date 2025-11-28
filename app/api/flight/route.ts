import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const flightIata = searchParams.get('flight_iata');

    if (!flightIata) {
        return NextResponse.json({ error: 'Missing flight_iata parameter' }, { status: 400 });
    }

    const apiKey = process.env.AVIATIONSTACK_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: 'Server configuration error: Missing API Key' }, { status: 500 });
    }

    try {
        // AviationStack free tier only supports HTTP, but we are on server side so it's fine to call HTTP.
        // However, axios might default to HTTPS or the server environment might block HTTP.
        // AviationStack free tier endpoint: http://api.aviationstack.com/v1/flights

        const response = await axios.get('http://api.aviationstack.com/v1/flights', {
            params: {
                access_key: apiKey,
                flight_iata: flightIata,
            },
        });

        return NextResponse.json(response.data);
    } catch (error: any) {
        console.error('AviationStack API Error:', error.message);
        return NextResponse.json(
            { error: 'Failed to fetch flight data', details: error.message },
            { status: 500 }
        );
    }
}
