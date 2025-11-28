import React from 'react';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';

interface PredictionCardProps {
    arrivalTime: Date | null;
    loading: boolean;
    error: string | null;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({ arrivalTime, loading, error }) => {
    if (loading) {
        return (
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow-md">
                <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Error</h3>
                <p className="text-red-600 dark:text-red-300">{error}</p>
            </div>
        );
    }

    if (!arrivalTime) {
        return null;
    }

    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
                <Clock className="h-6 w-6 text-blue-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Estimated Arrival</h2>
            </div>
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                {format(arrivalTime, 'h:mm a')}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {format(arrivalTime, 'EEEE, MMMM do, yyyy')}
            </p>
        </div>
    );
};
