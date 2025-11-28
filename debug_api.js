const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Read .env.local manually since we are running with node directly
try {
    const envPath = path.resolve(__dirname, '.env.local');
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
} catch (e) {
    console.error("Could not read .env.local", e);
}

const apiKey = process.env.AVIATIONSTACK_API_KEY;
const flightIata = 'QG439';

async function fetchFlight() {
    try {
        console.log(`Fetching data for ${flightIata} with key ${apiKey ? 'PRESENT' : 'MISSING'}...`);
        const response = await axios.get('http://api.aviationstack.com/v1/flights', {
            params: {
                access_key: apiKey,
                flight_iata: flightIata,
            }
        });

        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error fetching flight:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

fetchFlight();
