'use client';

import { useCallback, useRef } from 'react';

interface FileUploadProps {
    files: File[];
    onFilesChange: (files: File[]) => void;
}

export function FileUpload({ files, onFilesChange }: FileUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(event.target.files || []);
        const ifcFiles = selectedFiles.filter(file =>
            file.name.toLowerCase().endsWith('.ifc')
        );

        if (ifcFiles.length !== selectedFiles.length) {
            const nonIfcFiles = selectedFiles.filter(file =>
                !file.name.toLowerCase().endsWith('.ifc')
            );
            console.warn('Some files were ignored (only .ifc files are supported):',
                nonIfcFiles.map(f => f.name));
        }

        onFilesChange(ifcFiles);
    }, [onFilesChange]);

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const droppedFiles = Array.from(event.dataTransfer.files);
        const ifcFiles = droppedFiles.filter(file =>
            file.name.toLowerCase().endsWith('.ifc')
        );

        if (ifcFiles.length > 0) {
            onFilesChange([...files, ...ifcFiles]);
        }
    }, [files, onFilesChange]);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    }, []);

    const removeFile = useCallback((indexToRemove: number) => {
        const newFiles = files.filter((_, index) => index !== indexToRemove);
        onFilesChange(newFiles);
    }, [files, onFilesChange]);

    const clearAllFiles = useCallback(() => {
        onFilesChange([]);
    }, [onFilesChange]);

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-4">
                <h2 className="text-lg font-medium text-gray-900">IFC Files</h2>
                <p className="text-sm text-gray-600">
                    Upload IFC files for clash detection. Only .ifc files are supported.
                </p>
            </div>

            {/* Upload Area */}
            <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
            >
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="mt-4">
                    <p className="text-sm text-gray-600">
                        Click to upload or drag and drop IFC files
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        Only .ifc files are supported
                    </p>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".ifc"
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-900">
                            Uploaded Files ({files.length})
                        </h3>
                        <button
                            onClick={clearAllFiles}
                            className="text-sm text-red-600 hover:text-red-800"
                        >
                            Clear All
                        </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {files.map((file, index) => (
                            <div
                                key={`${file.name}-${index}`}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                            >
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                    <svg className="h-8 w-8 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                    </svg>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {formatFileSize(file.size)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeFile(index)}
                                    className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Remove file"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {files.length === 0 && (
                <div className="mt-4 text-center text-sm text-gray-500">
                    No IFC files uploaded yet
                </div>
            )}
        </div>
    );
}
