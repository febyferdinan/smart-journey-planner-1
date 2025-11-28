import React from 'react';
import { Plane } from 'lucide-react';

interface FlightInputProps {
    flightNumber: string;
    setFlightNumber: (value: string) => void;
}

export const FlightInput: React.FC<FlightInputProps> = ({ flightNumber, setFlightNumber }) => {
    return (
        <div className="flex flex-col gap-2">
            <label htmlFor="flightNumber" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Flight Number
            </label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Plane className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    id="flightNumber"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-800 dark:border-gray-700 placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out"
                    placeholder="e.g. AA123"
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
                />
            </div>
        </div>
    );
};
