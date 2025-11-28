'use client';

import React from 'react';
import { TrendingUp, Clock, Map } from 'lucide-react';

interface RouteOptimizationCardProps {
    totalDuration?: number; // in minutes
    totalDistance?: number; // in km (optional if available)
    optimizedDuration?: number; // in minutes (optional)
    optimizedDistance?: number; // in km (optional)
    stopCount: number;
    optimized: boolean;
    recommendedOrder?: string[];
    startAddress?: string;
    destinationAddress?: string;
}


export function RouteOptimizationCard({ totalDuration, totalDistance, optimizedDuration, optimizedDistance, stopCount, optimized, recommendedOrder, startAddress, destinationAddress }: RouteOptimizationCardProps) {
    const hours = totalDuration ? Math.floor(totalDuration / 60) : 0;
    const minutes = totalDuration ? totalDuration % 60 : 0;

    const optHours = optimizedDuration ? Math.floor(optimizedDuration / 60) : hours;
    const optMinutes = optimizedDuration ? optimizedDuration % 60 : minutes;

    const hasOptimizedRoute = recommendedOrder && recommendedOrder.length > 0;

    // Calculate savings
    const timeSavings = totalDuration && optimizedDuration ? totalDuration - optimizedDuration : 0;
    const distanceSavings = totalDistance && optimizedDistance ? totalDistance - optimizedDistance : 0;

    return (
        <div className="relative p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-green-500/10 dark:shadow-green-500/20 border border-gray-200/50 dark:border-gray-700/50 overflow-hidden animate-fade-in-up hover:shadow-glow-green transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-1 gradient-success"></div>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full gradient-success flex items-center justify-center shadow-lg">
                        <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
                        Route {hasOptimizedRoute ? 'Comparison' : 'Optimization'}
                    </h2>
                </div>
                {optimized && (
                    <span className="inline-flex items-center gap-1.5 gradient-success text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
                        <span>✓</span>
                        <span>Optimized</span>
                    </span>
                )}
            </div>

            {hasOptimizedRoute ? (
                // Comparison view when optimized route exists
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Your Route Column */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 text-center pb-2 border-b-2 border-gray-300 dark:border-gray-600">
                                Your Route
                            </h3>
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium mb-2">
                                    <Clock className="h-4 w-4" />
                                    Time
                                </div>
                                <div className="text-2xl font-extrabold text-gray-900 dark:text-white">
                                    {hours > 0 ? `${hours}h ` : ''}{minutes}m
                                </div>
                            </div>
                            {totalDistance !== undefined && (
                                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium mb-2">
                                        <Map className="h-4 w-4" />
                                        Distance
                                    </div>
                                    <div className="text-2xl font-extrabold text-gray-900 dark:text-white">
                                        {totalDistance.toFixed(1)} km
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Optimized Route Column */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent text-center pb-2 border-b-2 border-green-300 dark:border-green-600">
                                ⚡ Optimized Route
                            </h3>
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl p-4 border-2 border-green-300 dark:border-green-700">
                                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 text-xs font-bold mb-2">
                                    <Clock className="h-4 w-4" />
                                    Time
                                </div>
                                <div className="text-2xl font-extrabold text-green-800 dark:text-green-100">
                                    {optHours > 0 ? `${optHours}h ` : ''}{optMinutes}m
                                    {timeSavings !== 0 && (
                                        <span className={`text-xs ml-1 ${timeSavings > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                                            {timeSavings > 0 ? `-${timeSavings}m` : timeSavings < 0 ? `+${Math.abs(timeSavings)}m` : '~same'}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {optimizedDistance !== undefined && (
                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl p-4 border-2 border-green-300 dark:border-green-700">
                                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300 text-xs font-bold mb-2">
                                        <Map className="h-4 w-4" />
                                        Distance
                                    </div>
                                    <div className="text-2xl font-extrabold text-green-800 dark:text-green-100">
                                        {optimizedDistance.toFixed(1)} km
                                        {distanceSavings !== 0 && (
                                            <span className={`text-xs ml-1 ${distanceSavings > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                                                {distanceSavings > 0 ? `-${distanceSavings.toFixed(1)}km` : distanceSavings < 0 ? `+${Math.abs(distanceSavings).toFixed(1)}km` : '~same'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
                            <Map className="h-4 w-4" />
                            Total Stops
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">
                            {stopCount}
                        </div>
                    </div>
                </div>
            ) : (
                // Original single view when no optimization
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
                            <Clock className="h-4 w-4" />
                            Total Time
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {hours > 0 ? `${hours}h ` : ''}{minutes}m
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
                            <Map className="h-4 w-4" />
                            Total Stops
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {stopCount}
                        </div>
                    </div>

                    {totalDistance !== undefined && (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
                                <TrendingUp className="h-4 w-4" />
                                Distance
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {totalDistance.toFixed(1)} km
                            </div>
                        </div>
                    )}
                </div>
            )}

            {recommendedOrder && recommendedOrder.length > 0 && (
                <div className="mt-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-5 border border-blue-100 dark:border-blue-800/50 backdrop-blur-sm">
                    <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Recommended Stop Order (Traffic Optimized)
                    </h4>
                    <div className="space-y-3 relative">
                        {/* Vertical line connector */}
                        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-blue-200 dark:bg-blue-800/50"></div>

                        {startAddress && (
                            <div className="flex items-start gap-3 relative z-10">
                                <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-blue-500 flex items-center justify-center flex-shrink-0">
                                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                </div>
                                <div className="text-sm text-gray-700 dark:text-gray-300 font-medium pt-0.5">
                                    <span className="text-xs text-blue-600 dark:text-blue-400 font-bold block mb-0.5">START</span>
                                    {startAddress}
                                </div>
                            </div>
                        )}

                        {recommendedOrder.map((stop, index) => (
                            <div key={index} className="flex items-start gap-3 relative z-10">
                                <div className="h-6 w-6 rounded-full bg-white dark:bg-gray-800 border-2 border-blue-400 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 flex-shrink-0 shadow-sm">
                                    {index + 1}
                                </div>
                                <div className="text-sm text-gray-700 dark:text-gray-300 pt-0.5">
                                    {stop}
                                </div>
                            </div>
                        ))}

                        {destinationAddress && (
                            <div className="flex items-start gap-3 relative z-10">
                                <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-red-500 flex items-center justify-center flex-shrink-0">
                                    <Map className="h-3 w-3 text-red-500" />
                                </div>
                                <div className="text-sm text-gray-700 dark:text-gray-300 font-medium pt-0.5">
                                    <span className="text-xs text-red-500 font-bold block mb-0.5">DESTINATION</span>
                                    {destinationAddress}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
