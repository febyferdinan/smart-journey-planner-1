'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { addMinutes, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { Plane, Car, MapPin, AlertCircle, Settings, Globe, MessageCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { FlightInput } from './components/FlightInput';
import { StartAddressInput } from './components/StartAddressInput';
import { MultipleStopsInput } from './components/MultipleStopsInput';
import { DestinationInput } from './components/DestinationInput';
import { PredictionCard } from './components/PredictionCard';
import { RouteOptimizationCard } from './components/RouteOptimizationCard';
import { Timeline } from './components/Timeline';
import { geocodeNominatim, getRouteOSRM, getOptimizedTripOSRM } from './utils/osm';
import { geocodeGoogle, getRouteGoogle } from './utils/google';
import polyline from '@mapbox/polyline';
import tzlookup from 'tz-lookup';

import SettingsModal from './components/SettingsModal';

// Dynamically import Map and Chatbot components to avoid SSR issues
const Map = dynamic(() => import('./components/Map'), { ssr: false });
const GoogleMapComponent = dynamic(() => import('./components/GoogleMapComponent'), { ssr: false });
const Chatbot = dynamic(() => import('./components/Chatbot').then(mod => ({ default: mod.Chatbot })), { ssr: false });

type Provider = 'mapbox' | 'osm' | 'google';
type TimezoneMode = 'origin' | 'destination';

export default function Home() {
  const [startMode, setStartMode] = useState<'flight' | 'address'>('address');
  const [flightNumber, setFlightNumber] = useState('');
  const [startAddress, setStartAddress] = useState('');
  const [stops, setStops] = useState<string[]>([]);
  const [destination, setDestination] = useState('');
  const [provider, setProvider] = useState<Provider>('google');
  const [timezoneMode, setTimezoneMode] = useState<TimezoneMode>('destination');
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChatbot, setShowChatbot] = useState(false);
  const [prediction, setPrediction] = useState<{ arrivalTime: Date; steps: any[]; originTimezone: string; destTimezone: string; optimizedSteps?: any[] } | null>(null);
  const [routeData, setRouteData] = useState<{ geometry: [number, number][]; waypoints: [number, number][]; totalDistance?: number; totalDuration?: number; recommendedOrder?: string[]; optimizedDistance?: number; optimizedDuration?: number; optimizedRouteLegs?: { from: [number, number]; to: [number, number]; duration: number }[]; optimizedGeometry?: [number, number][]; optimizedWaypoints?: [number, number][] } | null>(null);
  const [timelineTab, setTimelineTab] = useState<'original' | 'optimized'>('original');
  const [stopBufferMinutes, setStopBufferMinutes] = useState<number[]>([]);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('google_maps_api_key') || '';
    }
    return '';
  });


  // Reset prediction data and input fields when provider changes
  useEffect(() => {
    setPrediction(null);
    setRouteData(null);
    setError(null);
    setTimelineTab('original');
    setStartAddress('');
    setStops([]);
    setStopBufferMinutes([]);
    setDestination('');
  }, [provider]);

  // Save Google Maps API key to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (googleMapsApiKey) {
        localStorage.setItem('google_maps_api_key', googleMapsApiKey);
      } else {
        localStorage.removeItem('google_maps_api_key');
      }
    }
  }, [googleMapsApiKey]);


  const calculateArrival = async () => {
    setLoading(true);
    setError(null);
    setPrediction(null);
    setRouteData(null);

    try {
      let startCoords: [number, number];
      let startName: string;
      let flightData: any = null;
      let flightArrivalDate: Date | null = null;

      // Handle different start modes
      if (startMode === 'flight') {
        // 1. Fetch Flight Data
        const flightRes = await axios.get('/api/flight', {
          params: { flight_iata: flightNumber },
        });

        flightData = flightRes.data.data?.[0];
        if (!flightData) {
          throw new Error('Flight not found. Please check the flight number.');
        }

        const airportName = flightData.arrival.airport;
        const airportIata = flightData.arrival.iata;
        startName = `${airportName} (${airportIata})`;

        // Geocode Airport
        if (provider === 'mapbox') {
          const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
          if (!mapboxToken) throw new Error('Mapbox Access Token is missing.');

          const res = await axios.get(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(startName)}.json`,
            { params: { access_token: mapboxToken, limit: 1 } }
          );
          if (res.data.features.length === 0) throw new Error(`Airport not found: ${startName}`);
          startCoords = res.data.features[0].center;
        } else if (provider === 'google') {
          startCoords = await geocodeGoogle(startName, googleMapsApiKey);
        } else {
          startCoords = await geocodeNominatim(startName);
        }
      } else {
        // Address mode - use entered address as start
        startName = startAddress;

        if (provider === 'mapbox') {
          const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
          if (!mapboxToken) throw new Error('Mapbox Access Token is missing.');

          const res = await axios.get(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(startAddress)}.json`,
            { params: { access_token: mapboxToken, limit: 1 } }
          );
          if (res.data.features.length === 0) throw new Error(`Location not found: ${startAddress}`);
          startCoords = res.data.features[0].center;
        } else if (provider === 'google') {
          startCoords = await geocodeGoogle(startAddress, googleMapsApiKey);
        } else {
          startCoords = await geocodeNominatim(startAddress);
        }
      }

      // 2. Geocode Stops (if provided) and Destination
      let stopsCoords: [number, number][] = [];
      let destCoords: [number, number];

      if (provider === 'mapbox') {
        const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        if (!mapboxToken) {
          throw new Error('Mapbox Access Token is missing.');
        }

        const geocodeMapbox = async (query: string) => {
          const res = await axios.get(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
            { params: { access_token: mapboxToken, limit: 1 } }
          );
          if (res.data.features.length === 0) throw new Error(`Location not found: ${query}`);
          return res.data.features[0].center; // [lng, lat]
        };

        const geocodePromises = [geocodeMapbox(destination)];
        // Add all stops to geocoding promises
        const validStops = stops.filter(s => s.trim());
        for (const stop of validStops) {
          geocodePromises.push(geocodeMapbox(stop));
        }

        const results = await Promise.all(geocodePromises);
        destCoords = results[0];
        // Extract stop coordinates
        stopsCoords = results.slice(1);
      } else if (provider === 'google') {
        // Use Google Maps Geocoding
        const geocodePromises = [geocodeGoogle(destination, googleMapsApiKey)];
        const validStops = stops.filter(s => s.trim());
        for (const stop of validStops) {
          geocodePromises.push(geocodeGoogle(stop, googleMapsApiKey));
        }

        const results = await Promise.all(geocodePromises);
        destCoords = results[0];
        stopsCoords = results.slice(1);
      } else {
        // Use OpenStreetMap (Nominatim)
        const geocodePromises = [geocodeNominatim(destination)];
        // Add all stops to geocoding promises
        const validStops = stops.filter(s => s.trim());
        for (const stop of validStops) {
          geocodePromises.push(geocodeNominatim(stop));
        }

        const results = await Promise.all(geocodePromises);
        destCoords = results[0];
        // Extract stop coordinates
        stopsCoords = results.slice(1);
      }

      // 3. Calculate Drive Time & Route (Multi-leg journey through all stops)
      let totalDriveDurationMinutes = 0;
      let totalDistanceMeters = 0;
      let routeGeometry: [number, number][] = [];
      const routeLegs: { from: [number, number]; to: [number, number]; duration: number }[] = [];

      // Build all points in order: Start → Stops → Destination
      // Build all points in order: Start → Stops → Destination
      const allPoints = [startCoords, ...stopsCoords, destCoords];
      let recommendedOrder: string[] | undefined;
      let optimizedDistance: number | undefined;
      let optimizedDuration: number | undefined;
      let optimizedRouteLegs: { from: [number, number]; to: [number, number]; duration: number }[] = [];
      let optimizedGeometry: [number, number][] = [];

      if (stopsCoords.length > 0) {
        // Calculate Optimized Order for Recommendation
        try {
          if (provider === 'mapbox') {
            const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
            const coordinates = allPoints.map(p => p.join(',')).join(';');
            const optRes = await axios.get(
              `https://api.mapbox.com/optimized-trips/v1/mapbox/driving-traffic/${coordinates}`,
              {
                params: {
                  access_token: mapboxToken,
                  source: 'first',
                  destination: 'last',
                  roundtrip: false
                }
              }
            );

            if (optRes.data.waypoints) {
              // Mapbox returns waypoints sorted by index in the trip
              // We filter out start (index 0) and end (index allPoints.length-1)
              // The waypoints array contains objects with { waypoint_index: number, trips_index: number }
              // We need to sort by trips_index to get the order.

              const optimizedIndices = optRes.data.waypoints
                .sort((a: any, b: any) => a.trips_index - b.trips_index)
                .map((wp: any) => wp.waypoint_index);

              // Filter out start (0) and end (last)
              const stopIndices = optimizedIndices.filter((idx: number) => idx !== 0 && idx !== allPoints.length - 1);

              // Map back to stop names. Note: stopsCoords corresponds to stops array.
              // Input indices: 0 (Start), 1 (Stop 1), 2 (Stop 2)...
              // So index i corresponds to stops[i-1]
              recommendedOrder = stopIndices.map((idx: number) => stops[idx - 1]);

              // Get optimized route metrics
              if (optRes.data.trips && optRes.data.trips.length > 0) {
                optimizedDuration = Math.round(optRes.data.trips[0].duration / 60); // Convert to minutes
                optimizedDistance = optRes.data.trips[0].distance / 1000; // Convert to km
              }
            }
          } else if (provider === 'google') {
            // Google Maps Directions API supports waypoint optimization
            try {
              // Format waypoints for Google API: lat,lng
              const waypointStrings = stopsCoords.map(coord => `${coord[1]},${coord[0]}`);
              const waypointsParam = `optimize:true|${waypointStrings.join('|')}`;

              const origin = `${startCoords[1]},${startCoords[0]}`;
              const destination = `${destCoords[1]},${destCoords[0]}`;

              const response = await axios.get('/api/google-directions-optimized', {
                params: {
                  origin,
                  destination,
                  waypoints: waypointsParam,
                  ...(googleMapsApiKey && { apiKey: googleMapsApiKey }),
                },
              });

              if (response.data.status === 'OK' && response.data.routes.length > 0) {
                const route = response.data.routes[0];

                // Google returns waypoint_order array with optimized indices
                if (route.waypoint_order && route.waypoint_order.length > 0) {
                  // waypoint_order contains zero-based indices of waypoints in optimized order
                  recommendedOrder = route.waypoint_order.map((idx: number) => stops[idx]);
                }

                // Get optimized route metrics
                if (route.legs) {
                  optimizedDuration = Math.round(route.legs.reduce((sum: number, leg: any) => sum + leg.duration.value, 0) / 60);
                  optimizedDistance = route.legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0) / 1000;
                }
              }
            } catch (optErr) {
              console.error('Google optimization failed:', optErr);
              // Continue without optimization
            }
          } else {
            // OSRM Optimization
            const optRes = await getOptimizedTripOSRM(allPoints);
            const stopIndices = optRes.waypointIndices.filter((idx: number) => idx !== 0 && idx !== allPoints.length - 1);
            recommendedOrder = stopIndices.map((idx: number) => stops[idx - 1]);


            // Get optimized route metrics
            optimizedDuration = Math.round(optRes.duration / 60); // Convert to minutes
            optimizedDistance = optRes.distance / 1000; // Convert to km
          }
        } catch (err) {
          console.error('Optimization failed:', err);
          // Continue without recommendation
        }


        // Calculate exact route legs for optimized order if we have recommendedOrder
        if (recommendedOrder && recommendedOrder.length > 0) {
          try {
            // Build optimized points array: start -> recommended stops (in order) -> destination
            const optimizedStopCoords = recommendedOrder.map(stopName => {
              const idx = stops.findIndex(s => s === stopName);
              return stopsCoords[idx];
            });
            const optimizedPoints = [startCoords, ...optimizedStopCoords, destCoords];

            // Calculate route with optimized stop order
            if (provider === 'mapbox') {
              const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
              const coordinates = optimizedPoints.map(p => p.join(',')).join(';');
              const optDirectionsRes = await axios.get(
                `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}`,
                { params: { access_token: mapboxToken, geometries: 'polyline' } }
              );

              if (optDirectionsRes.data.routes && optDirectionsRes.data.routes.length > 0) {
                const route = optDirectionsRes.data.routes[0];
                if (route.legs) {
                  optimizedRouteLegs = route.legs.map((leg: any, idx: number) => ({
                    from: optimizedPoints[idx],
                    to: optimizedPoints[idx + 1],
                    duration: Math.round(leg.duration / 60), // Convert to minutes
                  }));
                }
                // Extract geometry
                if (route.geometry) {
                  const decoded = polyline.decode(route.geometry);
                  optimizedGeometry = decoded.map(([lat, lng]: [number, number]) => [lat, lng]);
                }
              }
            } else if (provider === 'google') {
              // Build route through Google Directions API (without optimization, using specific order)
              const waypointStrings = optimizedStopCoords.map(coord => `${coord[1]},${coord[0]}`);
              const origin = `${startCoords[1]},${startCoords[0]}`;
              const destination = `${destCoords[1]},${destCoords[0]}`;

              const optDirectionsRes = await axios.get('/api/google-directions', {
                params: {
                  origin,
                  destination,
                  waypoints: waypointStrings.join('|'),
                  ...(googleMapsApiKey && { apiKey: googleMapsApiKey }),
                },
              });

              if (optDirectionsRes.data.status === 'OK' && optDirectionsRes.data.routes.length > 0) {
                const route = optDirectionsRes.data.routes[0];
                if (route.legs) {
                  optimizedRouteLegs = route.legs.map((leg: any, idx: number) => ({
                    from: optimizedPoints[idx],
                    to: optimizedPoints[idx + 1],
                    duration: Math.round(leg.duration.value / 60), // Convert to minutes
                  }));
                }
                // Extract geometry from overview_polyline
                if (route.overview_polyline && route.overview_polyline.points) {
                  const decoded = polyline.decode(route.overview_polyline.points);
                  optimizedGeometry = decoded.map(([lat, lng]: [number, number]) => [lat, lng]);
                }
              }
            } else {
              // OSRM - calculate route with optimized points
              const coordinates = optimizedPoints.map(p => `${p[0]},${p[1]}`).join(';');
              const optRouteRes = await axios.get(`https://router.project-osrm.org/route/v1/driving/${coordinates}`, {
                params: { overview: 'full', geometries: 'polyline' }
              });

              if (optRouteRes.data.routes && optRouteRes.data.routes.length > 0) {
                const route = optRouteRes.data.routes[0];
                if (route.legs) {
                  optimizedRouteLegs = route.legs.map((leg: any, idx: number) => ({
                    from: optimizedPoints[idx],
                    to: optimizedPoints[idx + 1],
                    duration: Math.round(leg.duration / 60), // Convert to minutes
                  }));
                }
                // Extract geometry
                if (route.geometry) {
                  const decoded = polyline.decode(route.geometry);
                  optimizedGeometry = decoded.map(([lat, lng]: [number, number]) => [lat, lng]);
                }
              }
            }
          } catch (err) {
            console.error('Failed to calculate optimized route legs:', err);
            // Continue without optimized legs
          }
        }

        // Multi-leg journey through all stops (Original Order)
        if (provider === 'mapbox') {
          const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
          // Mapbox supports multi-point routing
          const coordinates = allPoints.map(p => p.join(',')).join(';');
          const directionsRes = await axios.get(
            `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}`,
            { params: { access_token: mapboxToken, geometries: 'polyline' } }
          );

          const route = directionsRes.data.routes?.[0];
          if (!route) throw new Error('Could not calculate route.');
          totalDriveDurationMinutes = Math.round(route.duration / 60);
          totalDistanceMeters = route.distance;
          routeGeometry = polyline.decode(route.geometry);

          // Extract leg durations
          if (route.legs) {
            for (let i = 0; i < route.legs.length; i++) {
              routeLegs.push({
                from: allPoints[i],
                to: allPoints[i + 1],
                duration: Math.round(route.legs[i].duration / 60),
              });
            }
          }
        } else if (provider === 'google') {
          // Google Maps: Need to make multiple requests for each leg (or use Directions API with waypoints)
          // For simplicity, making separate requests like OSRM
          for (let i = 0; i < allPoints.length - 1; i++) {
            const routeRes = await getRouteGoogle(allPoints[i], allPoints[i + 1], googleMapsApiKey);
            totalDriveDurationMinutes += Math.round(routeRes.duration / 60);
            totalDistanceMeters += routeRes.distance;
            routeGeometry.push(...routeRes.geometry);
            routeLegs.push({
              from: allPoints[i],
              to: allPoints[i + 1],
              duration: Math.round(routeRes.duration / 60),
            });
          }
        } else {
          // OSRM: Need to make multiple requests for each leg
          for (let i = 0; i < allPoints.length - 1; i++) {
            const routeRes = await getRouteOSRM(allPoints[i], allPoints[i + 1]);
            totalDriveDurationMinutes += Math.round(routeRes.duration / 60);
            totalDistanceMeters += routeRes.distance;
            routeGeometry.push(...routeRes.geometry);
            routeLegs.push({
              from: allPoints[i],
              to: allPoints[i + 1],
              duration: Math.round(routeRes.duration / 60),
            });
          }
        }
      } else {
        // Direct journey: Start → Destination
        if (provider === 'mapbox') {
          const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
          const directionsRes = await axios.get(
            `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${startCoords.join(',')};${destCoords.join(',')}`,
            { params: { access_token: mapboxToken, geometries: 'polyline' } }
          );

          const route = directionsRes.data.routes?.[0];
          if (!route) throw new Error('Could not calculate route.');
          totalDriveDurationMinutes = Math.round(route.duration / 60);
          totalDistanceMeters = route.distance;
          routeGeometry = polyline.decode(route.geometry);
          routeLegs.push({
            from: startCoords,
            to: destCoords,
            duration: totalDriveDurationMinutes,
          });
        } else if (provider === 'google') {
          const routeRes = await getRouteGoogle(startCoords, destCoords, googleMapsApiKey);
          totalDriveDurationMinutes = Math.round(routeRes.duration / 60);
          totalDistanceMeters = routeRes.distance;
          routeGeometry = routeRes.geometry;
          routeLegs.push({
            from: startCoords,
            to: destCoords,
            duration: totalDriveDurationMinutes,
          });
        } else {
          const routeRes = await getRouteOSRM(startCoords, destCoords);
          totalDriveDurationMinutes = Math.round(routeRes.duration / 60);
          totalDistanceMeters = routeRes.distance;
          routeGeometry = routeRes.geometry;
          routeLegs.push({
            from: startCoords,
            to: destCoords,
            duration: totalDriveDurationMinutes,
          });
        }
      }

      // Get Timezones from Coordinates using tz-lookup
      // tz-lookup returns timezone string directly
      // Note: tz-lookup expects (lat, lon)
      const originTimezone = tzlookup(startCoords[1], startCoords[0]) || 'UTC';
      const destTimezone = tzlookup(destCoords[1], destCoords[0]) || 'UTC';

      // Calculate start time based on mode
      let departureTime: Date;

      if (startMode === 'flight') {
        // Flight mode: Parse flight arrival time and add airport buffer
        const arrivalTimeStr = flightData.arrival.estimated || flightData.arrival.scheduled;
        const cleanArrivalTimeStr = arrivalTimeStr.replace(/([+-]\d{2}:\d{2}|Z)$/, '');
        flightArrivalDate = fromZonedTime(cleanArrivalTimeStr, destTimezone);
        const bufferMinutes = 45; // Airport buffer
        departureTime = addMinutes(flightArrivalDate, bufferMinutes);
      } else {
        // Address mode: Start immediately from current time
        departureTime = new Date();
      }

      // Note: Mapbox/OSRM return [lng, lat] for points, but Leaflet/Polyline uses [lat, lng].
      const waypoints: [number, number][] = allPoints.map(p => [p[1], p[0]]);

      setRouteData({
        geometry: routeGeometry,
        waypoints,
        totalDistance: totalDistanceMeters / 1000, // Convert to km
        totalDuration: totalDriveDurationMinutes,
        recommendedOrder,
        optimizedDistance,
        optimizedDuration,
        optimizedRouteLegs,
        optimizedGeometry,
      });

      // 4. Calculate Total Time with Stops
      let currentTime = departureTime;
      const steps: any[] = [];

      // Different timeline based on start mode
      if (startMode === 'flight') {
        steps.push(
          {
            time: flightArrivalDate!,
            label: `Flight Arrives at ${flightData.arrival.iata}`,
            icon: <Plane className="h-5 w-5 text-blue-500" />,
            details: `Flight ${flightData.flight.iata} from ${flightData.departure.iata}`,
          },
          {
            time: departureTime,
            label: 'Leave Airport',
            icon: <MapPin className="h-5 w-5 text-gray-500" />,
            details: 'Includes 45 min buffer for deplaning & baggage',
          }
        );
      } else {
        steps.push({
          time: departureTime,
          label: 'Depart from Start',
          icon: <MapPin className="h-5 w-5 text-green-500" />,
          details: `Starting from ${startName}`,
        });
      }

      // Add timeline entries for each stop
      const validStops = stops.filter(s => s.trim());
      for (let i = 0; i < validStops.length; i++) {
        const leg = routeLegs[i];
        const currentBufferTime = stopBufferMinutes[i] || 0; // Default to 0 if not set
        const arriveAtStopDate = addMinutes(currentTime, leg.duration);

        steps.push({
          time: arriveAtStopDate,
          label: `Arrive at Stop ${i + 1}`,
          icon: <MapPin className="h-5 w-5 text-orange-500" />,
          details: `${leg.duration} min drive to ${validStops[i]}`,
        });

        // Only add "Leave Stop" entry if there's a buffer time
        if (currentBufferTime > 0) {
          const leaveStopDate = addMinutes(arriveAtStopDate, currentBufferTime);
          steps.push({
            time: leaveStopDate,
            label: `Leave Stop ${i + 1}`,
            icon: <Car className="h-5 w-5 text-orange-500" />,
            details: `${currentBufferTime} min buffer at stop`,
          });
          currentTime = leaveStopDate;
        } else {
          currentTime = arriveAtStopDate;
        }
      }

      // Final leg to destination
      const finalLeg = routeLegs[routeLegs.length - 1];
      const finalArrivalDate = addMinutes(currentTime, finalLeg.duration);

      steps.push({
        time: finalArrivalDate,
        label: 'Arrive at Destination',
        icon: <Car className="h-5 w-5 text-green-500" />,
        details: validStops.length > 0
          ? `${finalLeg.duration} min drive from last stop to ${destination}`
          : `${totalDriveDurationMinutes} min drive to ${destination} (via ${provider === 'mapbox' ? 'Mapbox' : 'OpenStreetMap'})`,
      });

      // Generate optimized timeline if we have a recommended order
      let optimizedSteps: any[] | undefined;
      if (recommendedOrder && recommendedOrder.length > 0) {
        // Create optimized timeline with reordered stops
        optimizedSteps = [];
        let optCurrentTime = departureTime;

        // Add start step
        if (startMode === 'flight') {
          optimizedSteps.push(
            {
              time: flightArrivalDate!,
              label: `Flight Arrives at ${flightData.arrival.iata}`,
              icon: <Plane className="h-5 w-5 text-blue-500" />,
              details: `Flight ${flightData.flight.iata} from ${flightData.departure.iata}`,
            },
            {
              time: departureTime,
              label: 'Leave Airport',
              icon: <MapPin className="h-5 w-5 text-gray-500" />,
              details: 'Includes 45 min buffer for deplaning & baggage',
            }
          );
        } else {
          optimizedSteps.push({
            time: departureTime,
            label: 'Depart from Start',
            icon: <MapPin className="h-5 w-5 text-green-500" />,
            details: `Starting from ${startName}`,
          });
        }

        // We need to map the recommended order to the original routeLegs
        // recommendedOrder contains stop names in the optimized order
        // We need to find which original stop index each corresponds to
        const optimizedStopIndices = recommendedOrder.map(stopName =>
          stops.findIndex(s => s === stopName)
        );

        // Check if we have actual optimized route legs data
        let optimizedLegDurations: number[];

        if (optimizedRouteLegs && optimizedRouteLegs.length > 0) {
          // Use actual calculated leg durations from the optimized route
          optimizedLegDurations = optimizedRouteLegs.map(leg => leg.duration);
        } else {
          // Fallback: approximate using original route legs
          optimizedLegDurations = [];

          for (let i = 0; i < optimizedStopIndices.length; i++) {
            const currentStopIdx = optimizedStopIndices[i];
            optimizedLegDurations.push(routeLegs[currentStopIdx].duration);
          }
        }

        // Add timeline entries for optimized stops
        for (let i = 0; i < recommendedOrder.length; i++) {
          const legDuration = optimizedLegDurations[i];

          // Skip this stop if we don't have duration data
          if (legDuration === undefined || legDuration === null || isNaN(legDuration)) {
            console.warn(`Missing leg duration for optimized stop ${i}, using fallback`);
            // Use a fallback - find the duration from original route
            const stopIdx = optimizedStopIndices[i];
            const fallbackDuration = routeLegs[stopIdx]?.duration || 0;

            if (fallbackDuration === 0) {
              console.error(`No fallback duration available for stop ${i}`);
              continue; // Skip this stop entirely
            }

            const arriveAtStopDate = addMinutes(optCurrentTime, fallbackDuration);
            const currentBufferTime = stopBufferMinutes[stopIdx] || 0;

            optimizedSteps.push({
              time: arriveAtStopDate,
              label: `Arrive at Stop ${i + 1}`,
              icon: <MapPin className="h-5 w-5 text-orange-500" />,
              details: `~${fallbackDuration} min drive to ${recommendedOrder[i]} (estimated)`,
            });

            if (currentBufferTime > 0) {
              const leaveStopDate = addMinutes(arriveAtStopDate, currentBufferTime);
              optimizedSteps.push({
                time: leaveStopDate,
                label: `Leave Stop ${i + 1}`,
                icon: <Car className="h-5 w-5 text-orange-500" />,
                details: `${currentBufferTime} min buffer at stop`,
              });
              optCurrentTime = leaveStopDate;
            } else {
              optCurrentTime = arriveAtStopDate;
            }
            continue;
          }

          const stopIdx = optimizedStopIndices[i];
          const currentBufferTime = stopBufferMinutes[stopIdx] || 0;
          const arriveAtStopDate = addMinutes(optCurrentTime, legDuration);

          optimizedSteps.push({
            time: arriveAtStopDate,
            label: `Arrive at Stop ${i + 1}`,
            icon: <MapPin className="h-5 w-5 text-orange-500" />,
            details: `${legDuration} min drive to ${recommendedOrder[i]}`,
          });

          // Only add "Leave Stop" entry if there's a buffer time
          if (currentBufferTime > 0) {
            const leaveStopDate = addMinutes(arriveAtStopDate, currentBufferTime);
            optimizedSteps.push({
              time: leaveStopDate,
              label: `Leave Stop ${i + 1}`,
              icon: <Car className="h-5 w-5 text-orange-500" />,
              details: `${currentBufferTime} min buffer at stop`,
            });
            optCurrentTime = leaveStopDate;
          } else {
            optCurrentTime = arriveAtStopDate;
          }
        }


        // Final destination - use the last leg from optimized route if available
        let finalLegDuration: number;
        if (optimizedRouteLegs && optimizedRouteLegs.length > recommendedOrder.length) {
          // Use the actual final leg from optimized route
          finalLegDuration = optimizedRouteLegs[optimizedRouteLegs.length - 1].duration;
        } else {
          // Fallback: use last leg from original route
          finalLegDuration = routeLegs[routeLegs.length - 1].duration;
        }

        const optFinalDate = addMinutes(optCurrentTime, finalLegDuration);
        optimizedSteps.push({
          time: optFinalDate,
          label: 'Arrive at Destination',
          icon: <Car className="h-5 w-5 text-green-500" />,
          details: `${finalLegDuration} min drive to ${destination} (Optimized route)`,
        });
      }

      setPrediction({
        arrivalTime: finalArrivalDate,
        originTimezone,
        destTimezone,
        steps,
        optimizedSteps,
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date, tz: string) => {
    try {
      return formatInTimeZone(date, tz, 'h:mm a (z)');
    } catch (e) {
      return 'Invalid Timezone';
    }
  };

  const displayTimezone = prediction ? (timezoneMode === 'origin' ? prediction.originTimezone : prediction.destTimezone) : 'UTC';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 dark:from-gray-900 dark:via-blue-950/30 dark:to-purple-950/20">
      {/* Hero Section */}
      <div className="gradient-hero animate-gradient relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative">
          <div className="text-center animate-fade-in-up">
            <div className="inline-block mb-4">
              <div className="flex items-center justify-center gap-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-full px-6 py-2 shadow-lg">
                <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  AI-Powered Journey Planning
                </span>
              </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white mb-4">
              Smart Journey{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                Planner
              </span>
            </h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Optimize your multi-stop journeys with real-time traffic data and intelligent route planning.
              Save time, fuel, and arrive stress-free.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="lg:grid lg:grid-cols-3 lg:gap-6">
          {/* Column 1: Inputs */}
          <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm py-8 px-4 shadow-xl shadow-blue-500/10 dark:shadow-blue-500/20 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 sm:px-10 space-y-6 h-fit animate-fade-in-up hover:shadow-glow transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-1 gradient-primary rounded-t-2xl"></div>
            {/* Settings Button */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>

            <SettingsModal
              isOpen={showSettings}
              onClose={() => setShowSettings(false)}
              timezoneMode={timezoneMode}
              setTimezoneMode={setTimezoneMode}
              provider={provider}
              setProvider={setProvider}
              googleMapsApiKey={googleMapsApiKey}
              setGoogleMapsApiKey={setGoogleMapsApiKey}
            />


            {/* Start Mode Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start From
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStartMode('address')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition ${startMode === 'address'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                >
                  Address
                </button>
                <button
                  type="button"
                  onClick={() => setStartMode('flight')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition ${startMode === 'flight'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                >
                  Flight
                </button>
              </div>
            </div>


            {/* Conditional Input Based on Start Mode */}
            {startMode === 'flight' ? (
              <FlightInput flightNumber={flightNumber} setFlightNumber={setFlightNumber} />
            ) : (
              <StartAddressInput startAddress={startAddress} setStartAddress={setStartAddress} provider={provider} googleMapsApiKey={googleMapsApiKey} />
            )}

            <MultipleStopsInput stops={stops} setStops={setStops} provider={provider} stopBufferMinutes={stopBufferMinutes} setStopBufferMinutes={setStopBufferMinutes} googleMapsApiKey={googleMapsApiKey} />
            <DestinationInput destination={destination} setDestination={setDestination} provider={provider} googleMapsApiKey={googleMapsApiKey} />

            <button
              onClick={calculateArrival}
              disabled={loading || !destination || (startMode === 'flight' ? !flightNumber : !startAddress)}
              className={`w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white relative overflow-hidden group
                ${loading || !destination || (startMode === 'flight' ? !flightNumber : !startAddress)
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'gradient-primary hover:shadow-glow transform hover:scale-[1.02] active:scale-[0.98]'
                }
                transition-all duration-200 ease-in-out`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
              <span className="relative">{loading ? 'Calculating...' : 'Plan My Journey'}</span>
            </button>
          </div>


          {/* Columns 2-3: Welcome Screen or Results */}
          {!prediction ? (
            // Welcome Screen (spans columns 2-3)
            <div className="lg:col-span-2 mt-8 lg:mt-0">
              <div className="relative p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-blue-500/10 dark:shadow-blue-500/20 border border-gray-200/50 dark:border-gray-700/50 overflow-hidden animate-fade-in-up hover:shadow-glow transition-all duration-300">
                <div className="absolute top-0 left-0 right-0 h-1 gradient-primary rounded-t-2xl"></div>

                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                      Smart Journey Planner
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">AI-Powered Travel Planning</p>
                  </div>
                </div>

                <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                  Plan your perfect journey with intelligent routing, multi-stop optimization, and AI-powered travel advice.
                </p>

                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline><polyline points="7.5 19.79 7.5 14.6 3 12"></polyline><polyline points="21 12 16.5 14.6 16.5 19.79"></polyline><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                      <h3 className="font-bold text-gray-900 dark:text-white">Multi-Modal Routing</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Start from a flight arrival or specific address with support for multiple stops
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-100 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                      <h3 className="font-bold text-gray-900 dark:text-white">Route Optimization</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      AI-powered optimization to minimize travel time and distance
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-100 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600 dark:text-purple-400"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                      <h3 className="font-bold text-gray-900 dark:text-white">Interactive Maps</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Google Maps, Mapbox, or OpenStreetMap with visual route display
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg p-4 border border-orange-100 dark:border-orange-800">
                    <div className="flex items-center gap-2 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600 dark:text-orange-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                      <h3 className="font-bold text-gray-900 dark:text-white">AI Travel Assistant</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get intelligent travel advice, packing lists, and local tips
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 rounded-lg p-4 text-white">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    <span>Get started by filling in your journey details on the left!</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Column 2: Prediction & Route Optimization */}
              <div className="mt-8 lg:mt-0 space-y-6">
                {/* Custom Prediction Display to handle timezone */}
                {prediction && (
                  <div className="relative p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-blue-500/10 dark:shadow-blue-500/20 border border-gray-200/50 dark:border-gray-700/50 overflow-hidden animate-fade-in-up hover:shadow-glow transition-all duration-300">
                    <div className="absolute top-0 left-0 right-0 h-1 gradient-primary"></div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      </div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">Estimated Arrival</h2>
                    </div>
                    <div className="text-5xl font-extrabold text-gray-900 dark:text-white mb-2">
                      {formatTime(prediction.arrivalTime, displayTimezone)}
                    </div>
                    <p className="text-base text-gray-600 dark:text-gray-300 font-medium">
                      {formatInTimeZone(prediction.arrivalTime, displayTimezone, 'EEEE, MMMM do, yyyy')}
                    </p>
                  </div>
                )}

                {prediction && routeData && routeData.totalDuration !== undefined && (
                  <RouteOptimizationCard
                    totalDuration={routeData.totalDuration}
                    totalDistance={routeData.totalDistance}
                    optimizedDuration={routeData.optimizedDuration}
                    optimizedDistance={routeData.optimizedDistance}
                    stopCount={stops.filter(s => s.trim()).length}
                    optimized={true}
                    recommendedOrder={routeData.recommendedOrder}
                    startAddress={startMode === 'flight' ? `Flight ${flightNumber}` : startAddress}
                    destinationAddress={destination}
                  />
                )}
              </div>

              {/* Column 3: Map & Journey Timeline */}
              <div className="mt-8 lg:mt-0 space-y-6">
                {routeData && (
                  <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-blue-500/10 dark:shadow-blue-500/20 border border-gray-200/50 dark:border-gray-700/50 overflow-hidden h-72 lg:h-96 animate-fade-in-up">
                    <div className="absolute top-0 left-0 right-0 h-1 gradient-primary z-10"></div>
                    {provider === 'google' ? (
                      <GoogleMapComponent
                        routeGeometry={routeData.geometry}
                        optimizedGeometry={routeData.optimizedGeometry}
                        waypoints={routeData.waypoints}
                        googleMapsApiKey={googleMapsApiKey}
                      />
                    ) : (
                      <Map
                        routeGeometry={routeData.geometry}
                        optimizedGeometry={routeData.optimizedGeometry}
                        waypoints={routeData.waypoints}
                      />
                    )}
                  </div>
                )}

                {prediction && (
                  <div className="relative bg-white dark:bg-gray-800 py-8 px-4 shadow-xl shadow-blue-500/10 dark:shadow-blue-500/20 rounded-lg px-10">
                    <div className="absolute top-0 left-0 right-0 h-1 gradient-primary rounded-t-lg"></div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Journey Timeline</h3>

                      {/* Tabs - only show if we have recommended order */}
                      {routeData?.recommendedOrder && routeData.recommendedOrder.length > 0 && (
                        <div className="flex gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                          <button
                            onClick={() => setTimelineTab('original')}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition ${timelineTab === 'original'
                              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                              }`}
                          >
                            Your Route
                          </button>
                          <button
                            onClick={() => setTimelineTab('optimized')}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition ${timelineTab === 'optimized'
                              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                              }`}
                          >
                            Optimized Route
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-8">
                      {(timelineTab === 'optimized' && prediction.optimizedSteps ? prediction.optimizedSteps : prediction.steps).map((step, index) => (
                        <div key={index} className="relative pl-8">
                          <div className="absolute -left-4 top-1 bg-white dark:bg-gray-900 p-1 rounded-full border border-gray-200 dark:border-gray-700">
                            {step.icon}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                {formatTime(step.time, displayTimezone)}
                              </p>
                              <h4 className="text-base font-semibold text-gray-900 dark:text-white">{step.label}</h4>
                              {step.details && (
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{step.details}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>   {/* Floating Chatbot Button */}
      {!showChatbot && (
        <button
          onClick={() => setShowChatbot(true)}
          className="fixed bottom-6 right-6 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110 z-[9999]"
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chatbot Modal */}
      {showChatbot && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] z-[9999] shadow-2xl">
          <Chatbot
            onClose={() => setShowChatbot(false)}
            journeyContext={{
              startMode,
              flightNumber: startMode === 'flight' ? flightNumber : undefined,
              startAddress: startMode === 'address' ? startAddress : undefined,
              departureTime: startMode === 'address' && prediction ? prediction.steps[0]?.time : undefined,
              destination,
              stops: stops.filter(s => s.trim()),
              arrivalTime: prediction?.arrivalTime,
              provider,
              routeOptimization: routeData ? {
                totalDistance: routeData.totalDistance,
                totalDuration: routeData.totalDuration,
                stopCount: stops.filter(s => s.trim()).length,
                recommendedOrder: routeData.recommendedOrder,
              } : undefined,
            }}
          />
        </div>
      )}

      {/* Copyright Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          © 2025 - Feby Ferdinan Syah
        </div>
      </div>
    </div>
  );
}
