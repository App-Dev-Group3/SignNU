import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

type AnnotationType = 'text' | 'signature';

export interface PdfAnnotation {
  id: string;
  type: AnnotationType;
  page: number;
  text: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  signatureData?: string;
  ownerId?: string;
}

interface PdfEditorProps {
  file: File;
  annotations: PdfAnnotation[];
  onChange: (annotations: PdfAnnotation[]) => void;
  onClose: () => void;
  isSaving: boolean;
  currentUserId?: string;
  currentUserSignatureURL?: string | null;
}

export function PdfEditor({ file, annotations, onChange, onClose, isSaving, currentUserId, currentUserSignatureURL }: PdfEditorProps) {
  const pageRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<any>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [mode, setMode] = useState<AnnotationType>('text');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageCount, setPageCount] = useState(0);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isSignatureDrawing, setIsSignatureDrawing] = useState(false);

  const renderPage = async (pdf: any, pageNumber: number, canvas: HTMLCanvasElement) => {
    const page = await pdf.getPage(pageNumber);
    const unscaledViewport = page.getViewport({ scale: 1 });
    canvas.style.width = '100%';

    const displayWidth = canvas.getBoundingClientRect().width || unscaledViewport.width;
    const scale = displayWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });
    const context = canvas.getContext('2d');
    if (!context) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.height = `${viewport.height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    await page.render({ canvasContext: context, viewport }).promise;
  };

  const renderAllPages = async () => {
    const pdf = pdfRef.current;
    if (!pdf) return;

    setLoading(true);
    setRenderError(null);
    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const canvas = pageRefs.current[pageNumber - 1];
        if (canvas) {
          await renderPage(pdf, pageNumber, canvas);
        }
      }
    } catch (error: any) {
      setRenderError(error?.message || 'Unable to render PDF pages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadPdf = async () => {
      setRenderError(null);
      setLoading(true);
      try {
        const data = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
      } catch (error: any) {
        setRenderError(error?.message || 'Unable to render PDF');
        setPageCount(0);
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [file]);

  useEffect(() => {
    if (pageCount > 0) {
      renderAllPages();
    }
  }, [pageCount]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const pageNumber = Number((event.currentTarget as HTMLDivElement).dataset.page || '1');
    const bounds = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
    const xPct = (event.clientX - bounds.left) / bounds.width;
    const yPct = (event.clientY - bounds.top) / bounds.height;

    const base: PdfAnnotation = {
      id: `anno-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: mode,
      page: pageNumber,
      text: mode === 'text' ? 'Enter text' : 'SIGN HERE',
      xPct: Math.min(Math.max(xPct, 0), 1),
      yPct: Math.min(Math.max(yPct, 0), 1),
      widthPct: mode === 'text' ? 0.2 : 0.25,
      heightPct: mode === 'text' ? 0.06 : 0.1,
      ownerId: currentUserId,
    };

    onChange([...annotations, base]);
    setSelectedId(base.id);
  };

  const updateAnnotation = (id: string, updates: Partial<PdfAnnotation>) => {
    onChange(annotations.map((annotation) => annotation.id === id ? { ...annotation, ...updates } : annotation));
  };

  const isDraggableAnnotation = (annotation: PdfAnnotation) => {
    const canDragType = annotation.type === 'text' || annotation.type === 'signature';
    if (!canDragType) {
      return false;
    }
    if (currentUserId) {
      return annotation.ownerId ? annotation.ownerId === currentUserId : false;
    }
    return true;
  };

  const removeAnnotation = (id: string) => {
    onChange(annotations.filter((annotation) => annotation.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  };

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{
    annotationId: string;
    pageNumber: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedId) || null;

  useEffect(() => {
    if (selectedAnnotation?.type === 'signature') {
      loadSignatureToCanvas(selectedAnnotation.signatureData);
    }
  }, [selectedAnnotation?.id, selectedAnnotation?.signatureData]);

  async function loadSignatureToCanvas(dataUrl: string | undefined) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!dataUrl) return;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
  };

  const saveSignatureFromCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !selectedAnnotation) return;
    const signatureData = canvas.toDataURL('image/png');
    updateAnnotation(selectedAnnotation.id, { signatureData });
  };

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (selectedAnnotation?.type === 'signature') {
      updateAnnotation(selectedAnnotation.id, { signatureData: undefined });
    }
  };

  const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

  const handleAnnotationPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    annotation: PdfAnnotation,
  ) => {
    e.stopPropagation();
    setSelectedId(annotation.id);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    dragStartRef.current = {
      annotationId: annotation.id,
      pageNumber: annotation.page,
      startX: e.clientX,
      startY: e.clientY,
      origX: annotation.xPct,
      origY: annotation.yPct,
    };
    setDraggingId(annotation.id);
  };

  useEffect(() => {
    if (!draggingId) return;

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragStartRef.current;
      if (!drag || !containerRef.current) return;

      const pageContainer = containerRef.current.querySelector(
        `[data-page="${drag.pageNumber}"]`,
      ) as HTMLDivElement | null;
      if (!pageContainer) return;

      const rect = pageContainer.getBoundingClientRect();
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      const newXPct = clamp((drag.origX * rect.width + deltaX) / rect.width);
      const newYPct = clamp((drag.origY * rect.height + deltaY) / rect.height);

      updateAnnotation(drag.annotationId, { xPct: newXPct, yPct: newYPct });
    };

    const onPointerUp = () => {
      setDraggingId(null);
      dragStartRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [draggingId]);

  const startSignatureDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsSignatureDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSignatureDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopSignatureDrawing = () => {
    setIsSignatureDrawing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={mode === 'text' ? 'secondary' : 'outline'} onClick={() => setMode('text')}>
          Add Text
        </Button>
        <Button type="button" variant={mode === 'signature' ? 'secondary' : 'outline'} onClick={() => setMode('signature')}>
          Add Signature Placeholder
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="max-h-[65vh] overflow-y-auto rounded border border-gray-200 bg-white" ref={containerRef}>
        {Array.from({ length: pageCount }, (_, index) => {
          const pageNumber = index + 1;
          const annotationsForPage = annotations.filter((annotation) => annotation.page === pageNumber);

          return (
            <div key={pageNumber} className="mb-6">
              <div className="mb-2 flex items-center justify-between gap-3 px-2 text-sm text-gray-600">
                <span>Page {pageNumber}</span>
                <span>{annotationsForPage.length} annotation{annotationsForPage.length === 1 ? '' : 's'}</span>
              </div>
              <div
                className="relative overflow-hidden"
                data-page={pageNumber}
                onClick={handleCanvasClick}
              >
                <canvas
                  ref={(el) => {
                    pageRefs.current[index] = el;
                  }}
                  className="block w-full"
                />
                {annotationsForPage.map((annotation) => {
                  const left = `${annotation.xPct * 100}%`;
                  const top = `${annotation.yPct * 100}%`;
                  const width = `${annotation.widthPct * 100}%`;
                  const height = `${annotation.heightPct * 100}%`;
                  const draggable = isDraggableAnnotation(annotation);
                  return (
                    <div
                      key={annotation.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(annotation.id);
                      }}
                      onPointerDown={(e) => draggable && handleAnnotationPointerDown(e, annotation)}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        if (dragStartRef.current?.annotationId === annotation.id) {
                          setDraggingId(null);
                          dragStartRef.current = null;
                        }
                      }}
                      onDragStart={(e) => e.preventDefault()}
                      style={{ left, top, width, height, touchAction: 'none' }}
                      className={`absolute border ${selectedId === annotation.id ? 'border-blue-500 bg-blue-50/50' : 'border-yellow-500 bg-yellow-50/50'} p-1 text-xs text-gray-900 ${draggable ? 'cursor-move' : 'cursor-not-allowed opacity-70'}`}
                    >
                      {annotation.type === 'signature' && annotation.signatureData ? (
                        <img
                          src={annotation.signatureData}
                          alt="Signature preview"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="truncate">
                          {annotation.text || (annotation.type === 'signature' ? 'SIGN HERE' : 'Text')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {selectedId && (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {selectedAnnotation?.type === 'signature' ? 'Signature Placeholder' : 'Text'}
            </label>
            <div className="space-y-3">
              <input
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                value={selectedAnnotation?.text || ''}
                onChange={(e) => updateAnnotation(selectedId, { text: e.target.value })}
                placeholder={selectedAnnotation?.type === 'signature' ? 'Enter placeholder label or role' : 'Enter text'}
              />
              {selectedAnnotation?.type === 'signature' ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Button type="button" variant="outline" onClick={() => updateAnnotation(selectedAnnotation.id, { signatureData: undefined })}>
                      Draw Signature
                    </Button>
                    {currentUserSignatureURL ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => updateAnnotation(selectedAnnotation.id, { signatureData: currentUserSignatureURL })}
                      >
                        Use Uploaded Signature
                      </Button>
                    ) : null}
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <canvas
                      ref={signatureCanvasRef}
                      width={320}
                      height={120}
                      onMouseDown={startSignatureDrawing}
                      onMouseMove={drawSignature}
                      onMouseUp={stopSignatureDrawing}
                      onMouseLeave={stopSignatureDrawing}
                      className="block w-full bg-white cursor-crosshair"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button type="button" variant="outline" onClick={clearSignatureCanvas}>
                      Clear Signature
                    </Button>
                    <Button type="button" onClick={saveSignatureFromCanvas}>
                      Save Signature
                    </Button>
                  </div>
                  {selectedAnnotation.signatureData && (
                    <img
                      src={selectedAnnotation.signatureData}
                      alt="Signature preview"
                      className="w-full max-w-xs rounded border"
                    />
                  )}
                </>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Actions</label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => removeAnnotation(selectedId!)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {renderError && <p className="text-sm text-red-600">{renderError}</p>}
    </div>
  );
}
