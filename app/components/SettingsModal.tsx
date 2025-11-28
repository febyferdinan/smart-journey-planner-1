import React from 'react';
import { X, Globe, Map as MapIcon, Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from './ThemeProvider';

type TimezoneMode = 'origin' | 'destination';
type Provider = 'google' | 'mapbox' | 'osm';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    timezoneMode: TimezoneMode;
    setTimezoneMode: (mode: TimezoneMode) => void;
    provider: Provider;
    setProvider: (provider: Provider) => void;
    googleMapsApiKey: string;
    setGoogleMapsApiKey: (key: string) => void;
}

export default function SettingsModal({
    isOpen,
    onClose,
    timezoneMode,
    setTimezoneMode,
    provider,
    setProvider,
    googleMapsApiKey,
    setGoogleMapsApiKey,
}: SettingsModalProps) {
    const { theme, setTheme } = useTheme();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Theme Setting */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            <Sun className="h-4 w-4" />
                            Theme
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => setTheme('light')}
                                className={`flex flex-col items-center justify-center p-3 rounded-md border-2 transition ${theme === 'light'
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                    }`}
                            >
                                <Sun className="h-5 w-5 mb-1" />
                                <span className="text-xs font-medium">Light</span>
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`flex flex-col items-center justify-center p-3 rounded-md border-2 transition ${theme === 'dark'
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                    }`}
                            >
                                <Moon className="h-5 w-5 mb-1" />
                                <span className="text-xs font-medium">Dark</span>
                            </button>
                            <button
                                onClick={() => setTheme('system')}
                                className={`flex flex-col items-center justify-center p-3 rounded-md border-2 transition ${theme === 'system'
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                    }`}
                            >
                                <Monitor className="h-5 w-5 mb-1" />
                                <span className="text-xs font-medium">System</span>
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Choose your preferred color scheme.
                        </p>
                    </div>

                    {/* Timezone Setting */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            <Globe className="h-4 w-4" />
                            Time Display Mode
                        </label>
                        <select
                            value={timezoneMode}
                            onChange={(e) => setTimezoneMode(e.target.value as TimezoneMode)}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-3 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="destination">Destination Time</option>
                            <option value="origin">Origin Time</option>
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Choose whether to display times in the origin's or destination's timezone.
                        </p>
                    </div>

                    {/* Map Provider Setting */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            <MapIcon className="h-4 w-4" />
                            Map & Routing Provider
                        </label>
                        <select
                            value={provider}
                            onChange={(e) => setProvider(e.target.value as Provider)}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-3 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="google">Google Maps (Recommended)</option>
                            <option value="osm">OpenStreetMap (Free)</option>
                            <option value="mapbox">Mapbox</option>
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Select the service used for maps, geocoding, and routing.
                        </p>
                    </div>

                    {/* Google Maps API Key Setting */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            <MapIcon className="h-4 w-4" />
                            Google Maps API Key
                        </label>
                        <input
                            type="password"
                            value={googleMapsApiKey}
                            onChange={(e) => setGoogleMapsApiKey(e.target.value)}
                            placeholder="Enter your Google Maps API key (optional)"
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-3 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            If empty, the API key from .env.local will be used.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 dark:bg-gray-900 p-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
