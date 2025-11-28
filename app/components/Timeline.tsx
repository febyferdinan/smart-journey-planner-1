import React from 'react';
import { Plane, Car, MapPin, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface TimelineStep {
    time: Date;
    label: string;
    icon: React.ReactNode;
    details?: string;
}

interface TimelineProps {
    steps: TimelineStep[];
}

export const Timeline: React.FC<TimelineProps> = ({ steps }) => {
    if (steps.length === 0) return null;

    return (
        <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Journey Timeline</h3>
            <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-8">
                {steps.map((step, index) => (
                    <div key={index} className="relative pl-8">
                        <div className="absolute -left-[9px] top-1 bg-white dark:bg-gray-900 p-1 rounded-full border border-gray-200 dark:border-gray-700">
                            {step.icon}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                    {format(step.time, 'h:mm a')}
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
    );
};
