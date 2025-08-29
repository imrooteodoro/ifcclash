'use client';

import { useState } from 'react';

interface ClashResult {
    a: {
        file: string;
        id: number;
        guid: string;
        type: string;
        name: string;
    };
    b: {
        file: string;
        id: number;
        guid: string;
        type: string;
        name: string;
    };
    p1: [number, number, number];
    p2: [number, number, number];
    severity: 'High' | 'Medium' | 'Low';
    description: string;
}

interface ClashSetResult {
    name: string;
    results: ClashResult[];
}

interface ClashResultsProps {
    results: ClashSetResult[];
}

export function ClashResults({ results }: ClashResultsProps) {
    const [selectedClash, setSelectedClash] = useState<ClashResult | null>(null);
    const [filterSeverity, setFilterSeverity] = useState<'all' | 'High' | 'Medium' | 'Low'>('all');

    const totalClashes = results.reduce((sum, set) => sum + set.results.length, 0);
    const filteredResults = results.map(set => ({
        ...set,
        results: filterSeverity === 'all'
            ? set.results
            : set.results.filter(result => result.severity === filterSeverity)
    }));

    const filteredTotalClashes = filteredResults.reduce((sum, set) => sum + set.results.length, 0);

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'High': return 'bg-red-100 text-red-800';
            case 'Medium': return 'bg-yellow-100 text-yellow-800';
            case 'Low': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const formatPosition = (pos: [number, number, number]) => {
        return pos.map(coord => coord.toFixed(2)).join(', ');
    };

    if (results.length === 0) {
        return (
            <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Clash Results</h2>
                <div className="text-center text-gray-500 py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="mt-4 text-sm">No clash results yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                        Upload IFC files and configure clash sets to get started
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-2">Clash Results</h2>

                {/* Summary */}
                <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-gray-600">
                        Total clashes found: <span className="font-semibold text-gray-900">{totalClashes}</span>
                        {filterSeverity !== 'all' && (
                            <span> (showing {filteredTotalClashes} {filterSeverity.toLowerCase()})</span>
                        )}
                    </div>

                    {/* Severity Filter */}
                    <select
                        value={filterSeverity}
                        onChange={(e) => setFilterSeverity(e.target.value as 'all' | 'High' | 'Medium' | 'Low')}
                        className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">All Severities</option>
                        <option value="High">High Only</option>
                        <option value="Medium">Medium Only</option>
                        <option value="Low">Low Only</option>
                    </select>
                </div>

                {/* Results by Clash Set */}
                <div className="space-y-6">
                    {filteredResults.map((clashSet, setIndex) => (
                        <div key={setIndex} className="border border-gray-200 rounded-lg">
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                                <h3 className="text-sm font-medium text-gray-900">
                                    {clashSet.name}
                                </h3>
                                <p className="text-xs text-gray-600">
                                    {clashSet.results.length} clashes
                                </p>
                            </div>

                            {clashSet.results.length > 0 ? (
                                <div className="divide-y divide-gray-200">
                                    {clashSet.results.map((clash, clashIndex) => (
                                        <div
                                            key={clashIndex}
                                            className="p-4 hover:bg-gray-50 cursor-pointer"
                                            onClick={() => setSelectedClash(clash)}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center space-x-2 mb-2">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(clash.severity)}`}>
                                                            {clash.severity}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            {clash.description}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <p className="font-medium text-gray-900 truncate">
                                                                {clash.a.name}
                                                            </p>
                                                            <p className="text-gray-600 truncate">
                                                                {clash.a.type} • ID: {clash.a.id}
                                                            </p>
                                                            <p className="text-xs text-gray-500 truncate">
                                                                File: {clash.a.file}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900 truncate">
                                                                {clash.b.name}
                                                            </p>
                                                            <p className="text-gray-600 truncate">
                                                                {clash.b.type} • ID: {clash.b.id}
                                                            </p>
                                                            <p className="text-xs text-gray-500 truncate">
                                                                File: {clash.b.file}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-2 text-xs text-gray-500">
                                                        <div>Position A: ({formatPosition(clash.p1)})</div>
                                                        <div>Position B: ({formatPosition(clash.p2)})</div>
                                                    </div>
                                                </div>

                                                <div className="ml-4">
                                                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-500">
                                    <p className="text-sm">No clashes found for the selected severity</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Detailed Clash Modal */}
            {selectedClash && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-gray-900">Clash Details</h3>
                            <button
                                onClick={() => setSelectedClash(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor(selectedClash.severity)}`}>
                                    {selectedClash.severity} Severity
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Entity A */}
                                <div className="border border-gray-200 rounded-lg p-4">
                                    <h4 className="font-medium text-gray-900 mb-2">Entity A</h4>
                                    <dl className="space-y-2 text-sm">
                                        <div>
                                            <dt className="text-gray-600">Name:</dt>
                                            <dd className="font-medium">{selectedClash.a.name}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-600">Type:</dt>
                                            <dd>{selectedClash.a.type}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-600">ID:</dt>
                                            <dd>{selectedClash.a.id}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-600">GUID:</dt>
                                            <dd className="font-mono text-xs break-all">{selectedClash.a.guid}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-600">File:</dt>
                                            <dd className="truncate">{selectedClash.a.file}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-600">Position:</dt>
                                            <dd className="font-mono text-xs">({formatPosition(selectedClash.p1)})</dd>
                                        </div>
                                    </dl>
                                </div>

                                {/* Entity B */}
                                <div className="border border-gray-200 rounded-lg p-4">
                                    <h4 className="font-medium text-gray-900 mb-2">Entity B</h4>
                                    <dl className="space-y-2 text-sm">
                                        <div>
                                            <dt className="text-gray-600">Name:</dt>
                                            <dd className="font-medium">{selectedClash.b.name}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-600">Type:</dt>
                                            <dd>{selectedClash.b.type}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-600">ID:</dt>
                                            <dd>{selectedClash.b.id}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-600">GUID:</dt>
                                            <dd className="font-mono text-xs break-all">{selectedClash.b.guid}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-600">File:</dt>
                                            <dd className="truncate">{selectedClash.b.file}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-600">Position:</dt>
                                            <dd className="font-mono text-xs">({formatPosition(selectedClash.p2)})</dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="border-t border-gray-200 pt-4">
                                <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                                <p className="text-sm text-gray-600">{selectedClash.description}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
