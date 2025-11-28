'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Next.js/Leaflet
const iconUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

interface MapProps {
    routeGeometry: [number, number][]; // [lat, lng] array
    optimizedGeometry?: [number, number][]; // [lat, lng] array for optimized route
    waypoints: [number, number][]; // [lat, lng] array of all waypoints (airport, stop, destination)
}

function RecenterMap({ bounds }: { bounds: L.LatLngBounds }) {
    const map = useMap();
    useEffect(() => {
        if (bounds.isValid()) {
            map.fitBounds(bounds);
        }
    }, [map, bounds]);
    return null;
}

export default function Map({ routeGeometry, optimizedGeometry, waypoints }: MapProps) {
    let bounds = L.latLngBounds(routeGeometry);
    waypoints.forEach(wp => bounds.extend(wp));
    if (optimizedGeometry && optimizedGeometry.length > 0) {
        optimizedGeometry.forEach(point => bounds.extend(point));
    }

    // Default center if no route (fallback)
    const centerLatLng = bounds.isValid() ? bounds.getCenter() : L.latLng(0, 0);
    const center: [number, number] = [centerLatLng.lat, centerLatLng.lng];

    return (
        <MapContainer
            center={center}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Original route in blue */}
            <Polyline positions={routeGeometry} color="blue" weight={4} opacity={0.7} />

            {/* Optimized route in green */}
            {optimizedGeometry && optimizedGeometry.length > 0 && (
                <Polyline positions={optimizedGeometry} color="green" weight={4} opacity={0.7} dashArray="10, 5" />
            )}

            {waypoints.map((wp, idx) => (
                <Marker key={idx} position={wp}>
                    <Popup>
                        {idx === 0 ? 'Start' : idx === waypoints.length - 1 ? 'Destination' : `Stop ${idx}`}
                    </Popup>
                </Marker>
            ))}
            <RecenterMap bounds={bounds} />
        </MapContainer>
    );
}
