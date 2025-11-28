'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';

const containerStyle = {
    width: '100%',
    height: '100%',
};

interface GoogleMapProps {
    routeGeometry: [number, number][]; // [lat, lng] array
    optimizedGeometry?: [number, number][]; // [lat, lng] array
    waypoints: [number, number][]; // [lat, lng] array
    googleMapsApiKey?: string; // Optional custom API key
}

const GoogleMapComponent: React.FC<GoogleMapProps> = ({ routeGeometry, optimizedGeometry, waypoints, googleMapsApiKey }) => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: googleMapsApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);

    const onLoad = useCallback(function callback(map: google.maps.Map) {
        setMap(map);
    }, []);

    const onUnmount = useCallback(function callback(map: google.maps.Map) {
        setMap(null);
    }, []);

    useEffect(() => {
        if (map && waypoints.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            waypoints.forEach((point) => {
                bounds.extend({ lat: point[0], lng: point[1] });
            });
            // Also include route points in bounds
            routeGeometry.forEach((point) => {
                bounds.extend({ lat: point[0], lng: point[1] });
            });
            // Include optimized route points if available
            if (optimizedGeometry) {
                optimizedGeometry.forEach((point) => {
                    bounds.extend({ lat: point[0], lng: point[1] });
                });
            }
            map.fitBounds(bounds);
        }
    }, [map, waypoints, routeGeometry, optimizedGeometry]);

    if (!isLoaded) {
        return (
            <div className="h-96 w-full rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-gray-700 mt-6 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // Generate dynamic labels
    const getLabel = (index: number) => {
        if (index === 0) return 'S'; // Start
        if (index === waypoints.length - 1) return 'D'; // Destination
        return `${index}`; // Stop number
    };

    // Convert routeGeometry to object format for Polyline
    const path = routeGeometry.map(p => ({ lat: p[0], lng: p[1] }));
    const optimizedPath = optimizedGeometry ? optimizedGeometry.map(p => ({ lat: p[0], lng: p[1] })) : [];

    return (
        <div className="h-96 w-full rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-gray-700 mt-6">
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={waypoints.length > 0 ? { lat: waypoints[0][0], lng: waypoints[0][1] } : { lat: 0, lng: 0 }}
                zoom={10}
                onLoad={onLoad}
                onUnmount={onUnmount}
                options={{
                    streetViewControl: false,
                    mapTypeControl: false,
                }}
            >
                {/* Markers */}
                {waypoints.map((point, index) => (
                    <Marker
                        key={index}
                        position={{ lat: point[0], lng: point[1] }}
                        label={{
                            text: getLabel(index),
                            color: 'white',
                            fontWeight: 'bold',
                        }}
                    />
                ))}

                {/* Route Polyline */}
                {path.length > 0 && (
                    <Polyline
                        path={path}
                        options={{
                            strokeColor: '#3b82f6', // Blue-500
                            strokeOpacity: 0.8,
                            strokeWeight: 5,
                        }}
                    />
                )}

                {/* Optimized Route Polyline */}
                {optimizedPath.length > 0 && (
                    <Polyline
                        path={optimizedPath}
                        options={{
                            strokeColor: '#22c55e', // Green-500
                            strokeOpacity: 0.8,
                            strokeWeight: 5,
                            zIndex: 1, // Ensure it sits on top or below depending on preference. 
                            // Let's put it slightly below if overlapping, or use different opacity.
                            // Actually, let's make it dashed if possible, but for now simple green.
                        }}
                    />
                )}
            </GoogleMap>
        </div>
    );
};

export default React.memo(GoogleMapComponent);
