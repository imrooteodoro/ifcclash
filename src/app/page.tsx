'use client';

import { useState, useCallback, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ClashResults } from '@/components/ClashResults';
import { ClashConfiguration } from '@/components/ClashConfiguration';
import { ApiStatus } from '@/components/ApiStatus';

export interface ClashSource {
  file: string;
  selector?: string;
  mode?: 'i' | 'e';
}

export interface ClashSet {
  name: string;
  a: ClashSource[];
  b?: ClashSource[];
}

export interface ClashResult {
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

export interface ClashSetResult {
  name: string;
  results: ClashResult[];
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [clashSets, setClashSets] = useState<ClashSet[]>([]);
  const [results, setResults] = useState<ClashSetResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<{
    available: boolean;
    ifcclash_available: boolean;
    capabilities?: string[];
    fallback_mode?: boolean;
    message: string;
  } | null>(null);

  const checkApiStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/health');
      const status = await response.json();
      setApiStatus({
        available: response.ok,
        ifcclash_available: status.ifcclash_available || false,
        capabilities: status.capabilities || [],
        fallback_mode: status.fallback_mode || false,
        message: status.ifcclash_available
          ? 'API is ready for clash detection with full IfcOpenShell capabilities'
          : status.fallback_mode
            ? 'API is running in mock mode for UI testing'
            : 'API is running but IfcClash library is not available'
      });
    } catch {
      setApiStatus({
        available: false,
        ifcclash_available: false,
        capabilities: [],
        fallback_mode: false,
        message: 'API is not accessible - check if Flask server is running'
      });
    }
  }, []);

  // Check API status on component mount
  useEffect(() => {
    checkApiStatus();
  }, [checkApiStatus]);

  const handleFilesChange = useCallback((newFiles: File[]) => {
    setFiles(newFiles);
    // Reset results when files change
    setResults([]);
    setError(null);
  }, []);

  const handleClashSetsChange = useCallback((newClashSets: ClashSet[]) => {
    setClashSets(newClashSets);
    // Reset results when configuration changes
    setResults([]);
    setError(null);
  }, []);

  const runClashDetection = useCallback(async () => {
    if (files.length === 0) {
      setError('Please upload at least one IFC file');
      return;
    }

    if (clashSets.length === 0) {
      setError('Please configure at least one clash set');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();

      // Add files
      files.forEach((file) => {
        formData.append('files', file);
      });

      // Add clash configuration
      formData.append('clash_sets', JSON.stringify(clashSets));

      const response = await fetch('/api/clash-detection', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.results) {
        setResults(data.results);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (err) {
      console.error('Clash detection failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsProcessing(false);
    }
  }, [files, clashSets]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            IFC Clash Detection
          </h1>
          <p className="text-lg text-gray-600">
            Upload IFC files and detect clashes using real IfcClash technology
          </p>
        </div>

        {/* API Status */}
        <div className="mb-8">
          <ApiStatus status={apiStatus} onRefresh={checkApiStatus} />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  {error}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Configuration */}
          <div className="space-y-8">
            <FileUpload files={files} onFilesChange={handleFilesChange} />

            <ClashConfiguration
              files={files}
              clashSets={clashSets}
              onClashSetsChange={handleClashSetsChange}
            />

            {/* Run Clash Detection Button */}
            <div className="bg-white shadow rounded-lg p-6">
              <button
                onClick={runClashDetection}
                disabled={isProcessing || files.length === 0 || clashSets.length === 0}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${isProcessing || files.length === 0 || clashSets.length === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  }`}
              >
                {isProcessing ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing Clashes...
                  </div>
                ) : (
                  'Run Clash Detection'
                )}
              </button>
            </div>
          </div>

          {/* Right Column - Results */}
          <div>
            <ClashResults results={results} />
          </div>
        </div>
      </div>
    </div>
  );
}