import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import axios from 'axios';
import { autocompletePhoton } from '../utils/osm';
import { autocompleteGoogle } from '../utils/google';

interface DestinationInputProps {
    destination: string;
    setDestination: (value: string) => void;
    provider: 'mapbox' | 'osm' | 'google';
    googleMapsApiKey?: string;
}

export const DestinationInput: React.FC<DestinationInputProps> = ({ destination, setDestination, provider, googleMapsApiKey }) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Close suggestions when clicking outside
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (destination.length < 3) {
                setSuggestions([]);
                return;
            }

            setLoading(true);
            try {
                let results: string[] = [];
                if (provider === 'mapbox') {
                    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
                    if (mapboxToken) {
                        const res = await axios.get(
                            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(destination)}.json`,
                            {
                                params: {
                                    access_token: mapboxToken,
                                    limit: 5,
                                    types: 'address,poi'
                                }
                            }
                        );
                        results = res.data.features.map((f: any) => f.place_name);
                    }
                } else if (provider === 'google') {
                    results = await autocompleteGoogle(destination, googleMapsApiKey);
                } else {
                    // Use Photon for OSM
                    results = await autocompletePhoton(destination);
                }
                setSuggestions(results);
            } catch (error) {
                console.error("Autocomplete error:", error);
            } finally {
                setLoading(false);
            }
        };

        // Debounce
        const timeoutId = setTimeout(() => {
            if (showSuggestions) { // Only fetch if user is actively typing/focused
                fetchSuggestions();
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [destination, provider, showSuggestions]);

    const handleSelect = (suggestion: string) => {
        setDestination(suggestion);
        setShowSuggestions(false);
    };

    return (
        <div className="flex flex-col gap-2 relative" ref={wrapperRef}>
            <label htmlFor="destination" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Destination Address
            </label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    id="destination"
                    className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-800 dark:border-gray-700 placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out"
                    placeholder="e.g. 123 Main St, New York, NY"
                    value={destination}
                    onChange={(e) => {
                        setDestination(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    autoComplete="off"
                />
                {loading && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                    </div>
                )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm top-[70px]">
                    {suggestions.map((suggestion, index) => (
                        <li
                            key={index}
                            className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                            onClick={() => handleSelect(suggestion)}
                        >
                            <span className="block truncate">{suggestion}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
