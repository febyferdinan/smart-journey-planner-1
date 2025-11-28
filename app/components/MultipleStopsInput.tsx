'use client';

import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { StopInput } from './StopInput';

interface MultipleStopsInputProps {
    stops: string[];
    setStops: (stops: string[]) => void;
    provider: 'mapbox' | 'osm' | 'google';
    stopBufferMinutes: number[];
    setStopBufferMinutes: (buffers: number[]) => void;
    googleMapsApiKey?: string;
}

export function MultipleStopsInput({ stops, setStops, provider, stopBufferMinutes, setStopBufferMinutes, googleMapsApiKey }: MultipleStopsInputProps) {
    const [showBufferInputs, setShowBufferInputs] = useState<boolean[]>([]);

    const addStop = () => {
        setStops([...stops, '']);
        setStopBufferMinutes([...stopBufferMinutes, 0]); // Default 0 minutes for new stop (unchecked)
        setShowBufferInputs([...showBufferInputs, false]); // Default unchecked
    };

    const removeStop = (index: number) => {
        setStops(stops.filter((_, i) => i !== index));
        setStopBufferMinutes(stopBufferMinutes.filter((_, i) => i !== index));
        setShowBufferInputs(showBufferInputs.filter((_, i) => i !== index));
    };

    const updateStop = (index: number, value: string) => {
        const newStops = [...stops];
        newStops[index] = value;
        setStops(newStops);
    };

    const updateBuffer = (index: number, value: number) => {
        const newBuffers = [...stopBufferMinutes];
        newBuffers[index] = value;
        setStopBufferMinutes(newBuffers);
    };

    const toggleBufferInput = (index: number) => {
        const newShowBufferInputs = [...showBufferInputs];
        newShowBufferInputs[index] = !newShowBufferInputs[index];
        setShowBufferInputs(newShowBufferInputs);

        // Set buffer to 0 when unchecking, or 15 when checking
        const newBuffers = [...stopBufferMinutes];
        newBuffers[index] = newShowBufferInputs[index] ? 15 : 0;
        setStopBufferMinutes(newBuffers);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Stop Addresses (Optional)
                </label>
                <button
                    type="button"
                    onClick={addStop}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition"
                >
                    <Plus className="h-3 w-3" />
                    Add Stop
                </button>
            </div>

            {stops.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No stops added. Click "Add Stop" to add an intermediate destination.
                </p>
            )}

            {stops.map((stop, index) => (
                <div key={index} className="space-y-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex gap-2 items-start">
                        <div className="flex-1">
                            <StopInput
                                stopAddress={stop}
                                setStopAddress={(value) => updateStop(index, value)}
                                provider={provider}
                                placeholder={`Stop ${index + 1} address`}
                                showLabel={false}
                                googleMapsApiKey={googleMapsApiKey}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => removeStop(index)}
                            className="mt-1 p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition"
                            aria-label={`Remove stop ${index + 1}`}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Checkbox to show/hide buffer time input */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id={`buffer-checkbox-${index}`}
                            checked={showBufferInputs[index] || false}
                            onChange={() => toggleBufferInput(index)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor={`buffer-checkbox-${index}`} className="text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer">
                            Add buffer time at this stop
                        </label>
                    </div>

                    {/* Buffer time input - only show if checkbox is checked */}
                    {showBufferInputs[index] && (
                        <div>
                            <label htmlFor={`buffer-${index}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Buffer time (minutes)
                            </label>
                            <input
                                id={`buffer-${index}`}
                                type="number"
                                min="0"
                                max="120"
                                value={stopBufferMinutes[index] || 15}
                                onChange={(e) => updateBuffer(index, Math.max(0, parseInt(e.target.value) || 0))}
                                className="block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
