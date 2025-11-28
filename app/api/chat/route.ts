import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

export const runtime = 'edge';

// Define available tools/functions
const tools = [
    {
        type: 'function',
        function: {
            name: 'lookup_flight',
            description: 'Look up flight information by IATA flight number (e.g., AA100, BA283)',
            parameters: {
                type: 'object',
                properties: {
                    flight_iata: {
                        type: 'string',
                        description: 'IATA flight number (e.g., AA100)',
                    },
                },
                required: ['flight_iata'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'geocode_address',
            description: 'Convert an address to coordinates (latitude, longitude)',
            parameters: {
                type: 'object',
                properties: {
                    address: {
                        type: 'string',
                        description: 'Address to geocode',
                    },
                },
                required: ['address'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'calculate_route',
            description: 'Calculate driving route and time between two locations',
            parameters: {
                type: 'object',
                properties: {
                    from: {
                        type: 'string',
                        description: 'Starting location (address or coordinates)',
                    },
                    to: {
                        type: 'string',
                        description: 'Destination location (address or coordinates)',
                    },
                },
                required: ['from', 'to'],
            },
        },
    },
];

// Function handlers
async function executeTool(name: string, args: any): Promise<any> {
    try {
        if (name === 'lookup_flight') {
            const apiKey = process.env.AVIATIONSTACK_API_KEY;
            const response = await axios.get('http://api.aviationstack.com/v1/flights', {
                params: {
                    access_key: apiKey,
                    flight_iata: args.flight_iata,
                },
            });

            const flight = response.data.data?.[0];
            if (!flight) return { error: 'Flight not found' };

            return {
                flight_number: flight.flight.iata,
                airline: flight.airline.name,
                departure: {
                    airport: flight.departure.airport,
                    iata: flight.departure.iata,
                    scheduled: flight.departure.scheduled,
                    actual: flight.departure.actual,
                },
                arrival: {
                    airport: flight.arrival.airport,
                    iata: flight.arrival.iata,
                    scheduled: flight.arrival.scheduled,
                    estimated: flight.arrival.estimated,
                },
                status: flight.flight_status,
            };
        } else if (name === 'geocode_address') {
            // Use Nominatim for geocoding
            const response = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: {
                    q: args.address,
                    format: 'json',
                    limit: 1,
                },
                headers: {
                    'User-Agent': 'FlightArrivalPredictor/1.0',
                },
            });

            if (response.data.length === 0) return { error: 'Location not found' };

            const result = response.data[0];
            return {
                address: result.display_name,
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
            };
        } else if (name === 'calculate_route') {
            // Geocode both locations first
            const fromGeocode = await executeTool('geocode_address', { address: args.from });
            const toGeocode = await executeTool('geocode_address', { address: args.to });

            if (fromGeocode.error || toGeocode.error) {
                return { error: 'Could not geocode one or both locations' };
            }

            // Calculate route using OSRM
            const response = await axios.get(
                `https://router.project-osrm.org/route/v1/driving/${fromGeocode.longitude},${fromGeocode.latitude};${toGeocode.longitude},${toGeocode.latitude}`,
                { params: { overview: 'false' } }
            );

            if (response.data.routes?.length === 0) return { error: 'Route not found' };

            const route = response.data.routes[0];
            return {
                distance_km: (route.distance / 1000).toFixed(2),
                duration_minutes: Math.round(route.duration / 60),
                from: args.from,
                to: args.to,
            };
        }

        return { error: 'Unknown function' };
    } catch (error: any) {
        console.error('Tool execution error:', error);
        return { error: error.message || 'Tool execution failed' };
    }
}

export async function POST(req: NextRequest) {
    try {
        const { messages, provider, model, apiKey, baseUrl, journeyContext } = await req.json();

        if (!messages || messages.length === 0) {
            return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
        }

        // Add journey context as system message if provided
        const contextMessages = [...messages];
        if (journeyContext && Object.keys(journeyContext).length > 0) {
            const stopsText = journeyContext.stops && journeyContext.stops.length > 0
                ? journeyContext.stops.map((s: string, i: number) => `Stop ${i + 1}: ${s}`).join('\n')
                : '';

            const startText = journeyContext.startMode === 'flight'
                ? `Starting from flight: ${journeyContext.flightNumber || 'N/A'}`
                : `Starting from address: ${journeyContext.startAddress || 'N/A'}`;

            const routeOptText = journeyContext.routeOptimization ? `
Route Optimization Details:
- Total Distance: ${journeyContext.routeOptimization.totalDistance ? journeyContext.routeOptimization.totalDistance.toFixed(1) + ' km' : 'N/A'}
- Total Duration: ${journeyContext.routeOptimization.totalDuration ? Math.floor(journeyContext.routeOptimization.totalDuration / 60) + 'h ' + (journeyContext.routeOptimization.totalDuration % 60) + 'm' : 'N/A'}
- Number of Stops: ${journeyContext.routeOptimization.stopCount || 0}
${journeyContext.routeOptimization.recommendedOrder && journeyContext.routeOptimization.recommendedOrder.length > 0 ? `- Recommended Stop Order (Traffic Optimized):\n${journeyContext.routeOptimization.recommendedOrder.map((s: string, i: number) => `  ${i + 1}. ${s}`).join('\n')}` : ''}
- Provider: ${journeyContext.provider || 'N/A'}` : '';

            const contextText = `Current journey information:
${startText}
${stopsText}
${journeyContext.destination ? `Destination: ${journeyContext.destination}` : ''}
${journeyContext.arrivalTime ? `Estimated arrival: ${new Date(journeyContext.arrivalTime).toLocaleString()}` : ''}
${journeyContext.departureTime ? `Departure time: ${new Date(journeyContext.departureTime).toLocaleString()}` : ''}
${routeOptText}

Use this context to answer questions about the user's current journey. If asked about route optimization, total distance, travel time, or recommended stop order, use the information provided above.`;

            contextMessages.unshift({
                role: 'system',
                content: contextText,
            });
        }

        const encoder = new TextEncoder();
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();

        // Handle different providers
        (async () => {
            try {
                if (provider === 'openai' || provider === 'openrouter' || provider === 'custom') {
                    // OpenAI and OpenAI-compatible endpoints
                    let baseURL: string | undefined = undefined;
                    let effectiveApiKey = apiKey;

                    if (provider === 'openrouter') {
                        baseURL = 'https://openrouter.ai/api/v1';
                        effectiveApiKey = apiKey || process.env.OPENROUTER_API_KEY;
                    } else if (provider === 'custom' && baseUrl) {
                        baseURL = baseUrl;
                        effectiveApiKey = apiKey; // Custom endpoints use user-provided key
                    } else {
                        // OpenAI
                        effectiveApiKey = apiKey || process.env.OPENAI_API_KEY;
                    }

                    const openai = new OpenAI({
                        apiKey: effectiveApiKey,
                        baseURL,
                        defaultHeaders: provider === 'openrouter' ? {
                            'HTTP-Referer': 'https://smart-journey-planner.app',
                            'X-Title': 'Smart Journey Planner',
                        } : undefined,
                    });

                    // Validate API key
                    if (!effectiveApiKey) {
                        throw new Error(`API key required for ${provider}. Set it in settings or environment variables.`);
                    }

                    let currentMessages = contextMessages;
                    let toolCalls: any[] = [];

                    // OpenRouter doesn't support tools well, so skip tool calling for it
                    const supportsTools = provider !== 'openrouter';

                    while (true) {
                        const response = await openai.chat.completions.create({
                            model: model || 'gpt-3.5-turbo',
                            messages: currentMessages,
                            ...(supportsTools ? { tools: tools as any } : {}),
                            stream: false, // Use non-streaming for tool calls
                        });

                        const choice = response.choices[0];

                        if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
                            // Execute tool calls
                            toolCalls = choice.message.tool_calls;
                            currentMessages.push(choice.message as any);

                            for (const toolCall of toolCalls) {
                                const result = await executeTool(
                                    toolCall.function.name,
                                    JSON.parse(toolCall.function.arguments)
                                );

                                currentMessages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify(result),
                                } as any);
                            }
                        } else {
                            // Final response - stream it
                            const finalResponse = await openai.chat.completions.create({
                                model: model || 'gpt-3.5-turbo',
                                messages: currentMessages,
                                stream: true,
                            });

                            for await (const chunk of finalResponse) {
                                const content = chunk.choices[0]?.delta?.content || '';
                                if (content) {
                                    await writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                                }
                            }
                            break;
                        }
                    }
                } else if (provider === 'gemini') {
                    // Google Gemini (simplified - no tool support in this implementation)
                    const genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY || '');
                    const geminiModel = genAI.getGenerativeModel({ model: model || 'gemini-pro' });

                    const history = contextMessages.slice(0, -1).map((msg: any) => ({
                        role: msg.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: msg.content }],
                    }));

                    const chat = geminiModel.startChat({ history });
                    const lastMessage = contextMessages[contextMessages.length - 1].content;

                    const result = await chat.sendMessageStream(lastMessage);

                    for await (const chunk of result.stream) {
                        const content = chunk.text();
                        if (content) {
                            await writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                        }
                    }
                } else {
                    throw new Error('Unsupported provider');
                }

                await writer.write(encoder.encode('data: [DONE]\n\n'));
            } catch (error: any) {
                console.error('Chat error:', error);
                await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ error: error.message || 'An error occurred' })}\n\n`)
                );
            } finally {
                await writer.close();
            }
        })();

        return new Response(stream.readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (error: any) {
        console.error('Request error:', error);
        return NextResponse.json({ error: error.message || 'An error occurred' }, { status: 500 });
    }
}
