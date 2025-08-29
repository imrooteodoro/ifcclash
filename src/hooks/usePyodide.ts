// src/hooks/usePyodide.ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPyodideWorker } from "@/lib/pyodide-worker";

export function usePyodide() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ step: string; progress: number } | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const workerRef = useRef<Worker | null>(null);

  const init = useCallback(async () => {
    if (workerRef.current) return;
    const w = await createPyodideWorker();
    workerRef.current = w;
    w.onmessage = (e: MessageEvent) => {
      const { type, data } = e.data || {};
      if (type === "init") setReady(true);
      else if (type === "progress") setProgress(data);
      else if (type === "error") setError(data?.message || "Worker error");
      else if (type === "debug") setDebugInfo(prev => prev + data?.message + "\n");
    };
    w.postMessage({ type: "init" });
  }, []);

  const uploadIfc = useCallback(async (file: File, label?: string) => {
    if (!workerRef.current || !ready) throw new Error("Pyodide not ready");
    const buf = await file.arrayBuffer();
    return new Promise((resolve, reject) => {
      const w = workerRef.current!;
      const handler = (e: MessageEvent) => {
        const { type, data } = e.data || {};
        if (type === "complete" && data?.process) {
          w.removeEventListener("message", handler as any);
          resolve(data.process);
        } else if (type === "error") {
          w.removeEventListener("message", handler as any);
          reject(new Error(data?.message || "Upload failed"));
        }
      };
      w.addEventListener("message", handler as any);
      w.postMessage({ type: "process", data: { fileBuffer: buf, fileName: file.name, label } });
    });
  }, [ready]);

  const runClash = useCallback(async (job: any) => {
    if (!workerRef.current || !ready) throw new Error("Pyodide not ready");
    return new Promise<any>((resolve, reject) => {
      const w = workerRef.current!;
      const handler = (e: MessageEvent) => {
        const { type, data } = e.data || {};
        if (type === "complete" && data?.clash) {
          w.removeEventListener("message", handler as any);
          resolve(data.clash);
        } else if (type === "error") {
          w.removeEventListener("message", handler as any);
          reject(new Error(data?.message || "Clash failed"));
        }
      };
      w.addEventListener("message", handler as any);
      w.postMessage({ type: "run_clash", data: { job } });
    });
  }, [ready]);

  const exportBCF = useCallback(async (request: any) => {
    if (!workerRef.current || !ready) throw new Error("Pyodide not ready");
    return new Promise<Blob>((resolve, reject) => {
      const w = workerRef.current!;
      const handler = (e: MessageEvent) => {
        const { type, data } = e.data || {};
        if (type === "complete" && data?.bcf) {
          w.removeEventListener("message", handler as any);
          const blob = new Blob([data.bcf], { type: "application/octet-stream" });
          resolve(blob);
        } else if (type === "error") {
          w.removeEventListener("message", handler as any);
          reject(new Error(data?.message || "BCF export failed"));
        }
      };
      w.addEventListener("message", handler as any);
      w.postMessage({ type: "export_bcf", data: { request } });
    });
  }, [ready]);

  const extractEntities = useCallback(async (fileLabel: string) => {
    if (!workerRef.current || !ready) throw new Error("Pyodide not ready");
    return new Promise<any>((resolve, reject) => {
      const w = workerRef.current!;
      const handler = (e: MessageEvent) => {
        const { type, data } = e.data || {};
        if (type === "complete" && data?.entities) {
          w.removeEventListener("message", handler as any);
          resolve(data);
        } else if (type === "error") {
          w.removeEventListener("message", handler as any);
          reject(new Error(data?.message || "Entity extraction failed"));
        }
      };
      w.addEventListener("message", handler as any);
      w.postMessage({ type: "extract_entities", data: { fileLabel } });
    });
  }, [ready]);

  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  return { ready, error, progress, debugInfo, init, uploadIfc, runClash, exportBCF, extractEntities };
}
