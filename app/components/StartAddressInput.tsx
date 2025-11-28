'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { autocompleteGoogle } from '../utils/google';

interface StartAddressInputProps {
    startAddress: string;
    setStartAddress: (address: string) => void;
    provider: 'mapbox' | 'osm' | 'google';
    googleMapsApiKey?: string;
}

interface Suggestion {
    label: string;
    value: string;
}

export function StartAddressInput({ startAddress, setStartAddress, provider, googleMapsApiKey }: StartAddressInputProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const ignoreNextFetch = useRef(false);

    useEffect(() => {
        if (ignoreNextFetch.current) {
            ignoreNextFetch.current = false;
            return;
        }

        if (startAddress.length < 3) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(async () => {
            setIsLoading(true);
            try {
                let results: Suggestion[] = [];

                if (provider === 'mapbox') {
                    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
                    if (!mapboxToken) {
                        console.error('Mapbox token not found');
                        return;
                    }

                    const response = await axios.get(
                        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(startAddress)}.json`,
                        { params: { access_token: mapboxToken, limit: 5, autocomplete: true } }
                    );

                    results = response.data.features.map((feature: any) => ({
                        label: feature.place_name,
                        value: feature.place_name,
                    }));
                } else if (provider === 'google') {
                    const predictions = await autocompleteGoogle(startAddress, googleMapsApiKey);
                    results = predictions.map((desc: string) => ({
                        label: desc,
                        value: desc,
                    }));
                } else {
                    // Use Photon for OSM
                    const response = await axios.get('https://photon.komoot.io/api/', {
                        params: { q: startAddress, limit: 5 },
                    });

                    results = response.data.features.map((feature: any) => ({
                        label: feature.properties.name
                            ? `${feature.properties.name}, ${feature.properties.country || ''}`
                            : feature.properties.country || 'Unknown',
                        value: feature.properties.name || feature.properties.country || 'Unknown',
                    }));
                }

                setSuggestions(results);
                setShowSuggestions(results.length > 0);
            } catch (error) {
                console.error('Error fetching suggestions:', error);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [startAddress, provider]);

    const handleSelectSuggestion = (suggestion: Suggestion) => {
        ignoreNextFetch.current = true;
        setStartAddress(suggestion.value);
        setShowSuggestions(false);
    };

    return (
        <div className="relative">
            <label htmlFor="start" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Start Address
            </label>
            <div className="mt-1 relative">
                <input
                    id="start"
                    type="text"
                    value={startAddress}
                    onChange={(e) => setStartAddress(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter your starting address"
                    required
                />
                {isLoading && (
                    <div className="absolute right-3 top-3">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    </div>
                )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    {suggestions.map((suggestion, index) => (
                        <li
                            key={index}
                            onClick={() => handleSelectSuggestion(suggestion)}
                            className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-50 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                        >
                            {suggestion.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
