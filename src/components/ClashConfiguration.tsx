'use client';

import { useState, useCallback } from 'react';

interface ClashSource {
    file: string;
    selector?: string;
    mode?: 'i' | 'e';
}

interface ClashSet {
    name: string;
    a: ClashSource[];
    b?: ClashSource[];
}

interface ClashConfigurationProps {
    files: File[];
    clashSets: ClashSet[];
    onClashSetsChange: (clashSets: ClashSet[]) => void;
}

export function ClashConfiguration({ files, clashSets, onClashSetsChange }: ClashConfigurationProps) {
    const [newSetName, setNewSetName] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

    const addClashSet = useCallback(() => {
        if (!newSetName.trim()) return;

        const newSet: ClashSet = {
            name: newSetName.trim(),
            a: Array.from(selectedFiles).map(filename => ({ file: filename })),
        };

        onClashSetsChange([...clashSets, newSet]);
        setNewSetName('');
        setSelectedFiles(new Set());
    }, [newSetName, selectedFiles, clashSets, onClashSetsChange]);

    const removeClashSet = useCallback((index: number) => {
        const newClashSets = clashSets.filter((_, i) => i !== index);
        onClashSetsChange(newClashSets);
    }, [clashSets, onClashSetsChange]);

    const handleFileSelection = useCallback((filename: string, checked: boolean) => {
        const newSelection = new Set(selectedFiles);
        if (checked) {
            newSelection.add(filename);
        } else {
            newSelection.delete(filename);
        }
        setSelectedFiles(newSelection);
    }, [selectedFiles]);

    const selectAllFiles = useCallback(() => {
        setSelectedFiles(new Set(files.map(f => f.name)));
    }, [files]);

    const clearSelection = useCallback(() => {
        setSelectedFiles(new Set());
    }, []);

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-4">
                <h2 className="text-lg font-medium text-gray-900">Clash Configuration</h2>
                <p className="text-sm text-gray-600">
                    Configure clash sets to detect collisions between IFC elements.
                </p>
            </div>

            {/* Add New Clash Set */}
            <div className="border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Create New Clash Set</h3>

                <div className="space-y-4">
                    {/* Clash Set Name */}
                    <div>
                        <label htmlFor="setName" className="block text-sm font-medium text-gray-700">
                            Clash Set Name
                        </label>
                        <input
                            type="text"
                            id="setName"
                            value={newSetName}
                            onChange={(e) => setNewSetName(e.target.value)}
                            placeholder="e.g., Structure vs MEP"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>

                    {/* File Selection */}
                    {files.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Select Files for Group A
                                </label>
                                <div className="space-x-2">
                                    <button
                                        onClick={selectAllFiles}
                                        className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        onClick={clearSelection}
                                        className="text-xs text-gray-600 hover:text-gray-800"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md">
                                {files.map((file) => (
                                    <div key={file.name} className="flex items-center p-2 hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            id={`file-${file.name}`}
                                            checked={selectedFiles.has(file.name)}
                                            onChange={(e) => handleFileSelection(file.name, e.target.checked)}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <label
                                            htmlFor={`file-${file.name}`}
                                            className="ml-2 block text-sm text-gray-900 truncate"
                                        >
                                            {file.name}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add Button */}
                    <button
                        onClick={addClashSet}
                        disabled={!newSetName.trim() || selectedFiles.size === 0}
                        className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${!newSetName.trim() || selectedFiles.size === 0
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                            }`}
                    >
                        Add Clash Set
                    </button>
                </div>
            </div>

            {/* Existing Clash Sets */}
            {clashSets.length > 0 && (
                <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                        Configured Clash Sets ({clashSets.length})
                    </h3>

                    <div className="space-y-3">
                        {clashSets.map((clashSet, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-medium text-gray-900">
                                        {clashSet.name}
                                    </h4>
                                    <button
                                        onClick={() => removeClashSet(index)}
                                        className="text-red-600 hover:text-red-800 p-1"
                                        title="Remove clash set"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="text-xs text-gray-600">
                                    <div>
                                        <strong>Group A:</strong> {clashSet.a.map(source => source.file).join(', ')}
                                    </div>
                                    {clashSet.b && clashSet.b.length > 0 && (
                                        <div>
                                            <strong>Group B:</strong> {clashSet.b.map(source => source.file).join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {clashSets.length === 0 && (
                <div className="text-center text-sm text-gray-500 py-8">
                    No clash sets configured yet
                </div>
            )}

            {/* Help Text */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">
                            How Clash Detection Works
                        </h3>
                        <div className="mt-2 text-sm text-blue-700">
                            <p>
                                Clash sets define which IFC files to compare. Group A elements will be checked for clashes
                                {clashSets.some(set => set.b) ? ' with Group B elements' : ' within themselves'}.
                                The system uses real IfcClash geometry processing for accurate results.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
