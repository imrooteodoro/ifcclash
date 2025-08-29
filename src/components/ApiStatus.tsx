'use client';

import { useState } from 'react';

interface ApiStatusProps {
    status: {
        available: boolean;
        ifcclash_available: boolean;
        capabilities?: string[];
        fallback_mode?: boolean;
        message: string;
    } | null;
    onRefresh: () => void;
}

export function ApiStatus({ status, onRefresh }: ApiStatusProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await onRefresh();
        setIsRefreshing(false);
    };

    if (!status) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                            Checking API Status...
                        </h3>
                        <div className="mt-2 text-sm text-yellow-700">
                            <button
                                onClick={handleRefresh}
                                className="text-yellow-800 underline hover:text-yellow-900"
                                disabled={isRefreshing}
                            >
                                {isRefreshing ? 'Refreshing...' : 'Check Status'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!status.available) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">
                            API Unavailable
                        </h3>
                        <div className="mt-2 text-sm text-red-700">
                            {status.message}
                            <button
                                onClick={handleRefresh}
                                className="ml-2 text-red-800 underline hover:text-red-900"
                                disabled={isRefreshing}
                            >
                                {isRefreshing ? 'Retrying...' : 'Retry'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`border rounded-md p-4 ${status.ifcclash_available ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex">
                <div className="flex-shrink-0">
                    {status.ifcclash_available ? (
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                    ) : (
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    )}
                </div>
                <div className="ml-3 flex-1">
                    <h3 className={`text-sm font-medium ${status.ifcclash_available ? 'text-green-800' : 'text-blue-800'}`}>
                        {status.ifcclash_available ? 'Full IFC Clash Detection' : 'Mock Mode - UI Testing'}
                    </h3>
                    <div className={`mt-2 text-sm ${status.ifcclash_available ? 'text-green-700' : 'text-blue-700'}`}>
                        {status.message}
                    </div>

                    {/* Capabilities */}
                    {status.capabilities && status.capabilities.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                            {status.capabilities.map((capability, index) => (
                                <span
                                    key={index}
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${status.ifcclash_available
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-blue-100 text-blue-800'
                                        }`}
                                >
                                    {capability.replace('_', ' ')}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.ifcclash_available
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                {status.ifcclash_available ? 'Production Ready' : 'Development Mode'}
                            </span>
                            {status.fallback_mode && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Mock Data
                                </span>
                            )}
                        </div>
                        <button
                            onClick={handleRefresh}
                            className={`text-xs underline hover:no-underline ${status.ifcclash_available ? 'text-green-800' : 'text-blue-800'
                                }`}
                            disabled={isRefreshing}
                        >
                            {isRefreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>

                    {!status.ifcclash_available && (
                        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                            <strong>Note:</strong> Running in mock mode for UI testing. Deploy to Vercel for real IFC clash detection with full IfcOpenShell capabilities.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
