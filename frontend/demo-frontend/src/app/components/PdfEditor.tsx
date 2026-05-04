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
  approverStepId?: string;
  fontSizePx?: number;
}

export interface PdfEditorApprovalStep {
  id?: string;
  role: string;
  userId: string;
  userName: string;
}

interface PdfEditorProps {
  file: File;
  annotations: PdfAnnotation[];
  onChange: (annotations: PdfAnnotation[]) => void;
  onClose: () => void;
  isSaving: boolean;
  currentUserId?: string;
  currentUserSignatureURL?: string | null;
  approvalSteps: PdfEditorApprovalStep[];
}

export function PdfEditor({ file, annotations, onChange, onClose, isSaving, currentUserId, currentUserSignatureURL, approvalSteps }: PdfEditorProps) {
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
  const [isEditingText, setIsEditingText] = useState(false);
  const [justFinishedEditing, setJustFinishedEditing] = useState(false);
  const [justFinishedSignature, setJustFinishedSignature] = useState(false);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const resizeStartRef = useRef<{
    annotationId: string;
    startX: number;
    startY: number;
    origWidthPct: number;
    origHeightPct: number;
  } | null>(null);

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
    if (isEditingText) return;

    if (justFinishedEditing) {
      setJustFinishedEditing(false);
      return;
    }
    if (justFinishedSignature) {
      setJustFinishedSignature(false);
      return;
    }

    const pageNumber = Number((event.currentTarget as HTMLDivElement).dataset.page || '1');
    const bounds = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
    const xPct = (event.clientX - bounds.left) / bounds.width;
    const yPct = (event.clientY - bounds.top) / bounds.height;

    const base: PdfAnnotation = {
      id: `anno-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: mode,
      page: pageNumber,
      text: '',
      xPct: Math.min(Math.max(xPct, 0), 1),
      yPct: Math.min(Math.max(yPct, 0), 1),
      widthPct: mode === 'text' ? 0.2 : 0.25,
      heightPct: mode === 'text' ? 0.06 : 0.1,
      ownerId: currentUserId,
      fontSizePx: mode === 'text' ? 14 : undefined,
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

  const getApproverStepLabel = (step: PdfEditorApprovalStep | undefined) => {
    if (!step) return '';
    return step.userName ? `${step.role} — ${step.userName}` : step.role;
  };

  const updateAnnotationApprover = (annotationId: string, approverStepId: string) => {
    const step = approvalSteps.find((item) => item.id === approverStepId);
    const newText = step ? getApproverStepLabel(step) : '';
    updateAnnotation(annotationId, { approverStepId: approverStepId || undefined, text: newText });
    setJustFinishedSignature(true);
  };

  const setupSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
  };

  useEffect(() => {
    setupSignatureCanvas();
    if (selectedAnnotation?.type === 'signature') {
      loadSignatureToCanvas(selectedAnnotation.signatureData);
    }
  }, [selectedAnnotation?.id, selectedAnnotation?.signatureData]);

  async function loadSignatureToCanvas(dataUrl: string | undefined) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!dataUrl) return;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = dataUrl;
  };

  const saveSignatureFromCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !selectedAnnotation) return;
    const signatureData = canvas.toDataURL('image/png');
    updateAnnotation(selectedAnnotation.id, { signatureData });
    setJustFinishedSignature(true);
  };

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (selectedAnnotation?.type === 'signature') {
      updateAnnotation(selectedAnnotation.id, { signatureData: undefined });
      setJustFinishedSignature(true);
    }
  };

  const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

  const handleAnnotationPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    annotation: PdfAnnotation,
  ) => {
    e.stopPropagation();
    setSelectedId(annotation.id);

    const isTextEditableTarget = annotation.type === 'text' && (e.target as HTMLElement).closest?.('[data-editable-text="true"]');

    if (isTextEditableTarget) {
      return;
    } 

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
  if (!draggingId && !resizingId) return;

  const onPointerMove = (event: PointerEvent) => {
    if (draggingId) {
      const drag = dragStartRef.current;
      
      if (!drag || !containerRef.current) return;
      
      const pageContainer = containerRef.current.querySelector(`[data-page="${drag.pageNumber}"]`) as HTMLDivElement | null;

      if (!pageContainer) return;

      const rect = pageContainer.getBoundingClientRect();
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      const newXPct = clamp((drag.origX * rect.width + deltaX) / rect.width);
      const newYPct = clamp((drag.origY * rect.height + deltaY) / rect.height);

      updateAnnotation(drag.annotationId, { xPct: newXPct, yPct: newYPct });
    } else if (resizingId) {
        const resize = resizeStartRef.current;

        if (!resize) return;

        const deltaX = event.clientX - resize.startX;
        const deltaY = event.clientY - resize.startY;
        const pageContainer = containerRef.current?.querySelector(`[data-page="${annotations.find(a => a.id === resizingId)?.page}"]`) as HTMLDivElement | null;

        if (!pageContainer) return;

        const rect = pageContainer.getBoundingClientRect();
        const deltaWidthPct = deltaX / rect.width;
        const deltaHeightPct = deltaY / rect.height;
        const newWidthPct = clampSize(resize.origWidthPct + deltaWidthPct, 0.05, 0.9);
        const newHeightPct = clampSize(resize.origHeightPct + deltaHeightPct, 0.05, 0.9);
        
        const newHeightPx = newHeightPct * rect.height;
        const newFontSizePx = Math.max(8, Math.min(48, newHeightPx * 0.25));
        
        updateAnnotation(resizingId, { 
          widthPct: newWidthPct, 
          heightPct: newHeightPct,
          fontSizePx: newFontSizePx
        });
    }
  };

  const onPointerUp = () => {
    setDraggingId(null);
    dragStartRef.current = null;

    setResizingId(null);
    resizeStartRef.current = null;
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  return () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  }, [draggingId, resizingId]);

  const startSignatureDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setJustFinishedSignature(false);

    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    e.preventDefault();
    setupSignatureCanvas();
    setIsSignatureDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);

    if (canvas.setPointerCapture) {
      canvas.setPointerCapture(e.pointerId);
    }
  };

  const drawSignature = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isSignatureDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopSignatureDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsSignatureDrawing(false);
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    if (canvas.releasePointerCapture) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // ignore if pointer capture is already released
      }
    }
    setJustFinishedSignature(true);
  };

  const handleResizePointerDown = (e: React.PointerEvent, annotation: PdfAnnotation) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    resizeStartRef.current = {
      annotationId: annotation.id,
      startX: e.clientX,
      startY: e.clientY,
      origWidthPct: annotation.widthPct,
      origHeightPct: annotation.heightPct,
    };

    setResizingId(annotation.id);
  };

  const clampSize = (value: number, min: number = 0.05, max: number = 0.8) => Math.min(Math.max(value, min), max);

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
                    style={{ left, top, width, height, touchAction: 'none' }}
                    className={`absolute border-2 ${selectedId === annotation.id ? 'border-blue-500 bg-blue-50/50' : 'border-yellow-500 bg-yellow-50/50'} p-1 text-xs text-gray-900`}
                  >

                  {draggable && (
                    <div
                      className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center text-[10px] leading-none shadow-sm"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        handleAnnotationPointerDown(e, annotation);
                      }}
                      title="Drag to move"
                    >
                      ⠿
                    </div>
                  )}

                  {selectedId === annotation.id && draggable && (
                    <div
                      className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-3 h-3 bg-gray-400 rounded-sm cursor-nw-resize"
                      onPointerDown={(e) => handleResizePointerDown(e, annotation)}
                      title="Resize"
                    />
                  )}

                  {annotation.type === 'signature' && annotation.signatureData ? (
                    <img
                      src={annotation.signatureData}
                      alt="Signature preview"
                      className="h-full w-full object-contain"
                    />
                    ) : annotation.type === 'text' ? (
                      <div
                        contentEditable={draggable}
                        suppressContentEditableWarning
                        data-editable-text="true"

                        style={{ 
                          fontSize: `${annotation.fontSizePx || 14}px` 
                        }}
                        onFocus={(e) => { 
                          const el = e.currentTarget as HTMLElement;
                          // ensure the editable element is seeded with the current annotation text
                          // without making the element controlled by React while editing
                          // (prevents caret/ordering issues)
                          try {
                            if (el && el.innerText !== annotation.text) el.innerText = annotation.text || '';
                          } catch {}
                          setIsEditingText(true);
                          setJustFinishedEditing(false);
                        }}
                        onInput={(e) => {
                          const newText = e.currentTarget.innerText;

                          if (newText !== annotation.text) {
                            updateAnnotation(annotation.id, { text: newText });
                          }
                        }}
                        onBlur={(e) => {
                          setIsEditingText(false);
                          setJustFinishedEditing(true);
                          const newText = e.currentTarget.innerText;

                          if (newText !== annotation.text) {
                            updateAnnotation(annotation.id, { text: newText });
                          }
                        }}

                        onKeyDown={(e) => {
                          e.stopPropagation(); 
                          
                          if (e.key === 'Enter') { 
                            e.preventDefault(); 
                            e.currentTarget.blur(); 
                          }
                        }}

                        className="w-full h-full outline-none break-words whitespace-pre-wrap"
                      >
                        {(selectedId === annotation.id && isEditingText) ? null : annotation.text}
                    </div>
                      ) : (
                        <div className="truncate">{annotation.text || ''}</div>
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
        {selectedAnnotation?.type === 'text' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Current Text</label>
            <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
              {selectedAnnotation.text} 
            </div>
            <label className="block text-sm font-medium text-gray-700">Double‑click the floating text box on the PDF to edit</label>
          </div>
      )}

      {selectedAnnotation?.type === 'signature' && (
        <div>
          <div className="space-y-3">
            {selectedAnnotation?.type === 'signature' ? (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Assign approver</label>
                    <select
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                      value={selectedAnnotation.approverStepId ?? ''}
                      onChange={(e) => updateAnnotationApprover(selectedAnnotation.id, e.target.value)}
                    >
                    <option value="">Unassigned</option>

                    {approvalSteps.map((step) => (
                      <option key={step.id} value={step.id}>
                        {getApproverStepLabel(step)}
                      </option>
                    ))}
                    </select>
                  </div>

                  {selectedAnnotation.approverStepId && (
                    <p className="text-sm text-slate-600">
                      Assigned approver: <span className="font-medium">{getApproverStepLabel(approvalSteps.find((step) => step.id === selectedAnnotation.approverStepId))}</span>
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Button type="button" variant="outline" 
                    onClick={() => {
                      updateAnnotation(selectedAnnotation.id, { signatureData: undefined });
                      setJustFinishedSignature(false);
                    }}
                  >
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
                    onPointerDown={startSignatureDrawing}
                    onPointerMove={drawSignature}
                    onPointerUp={stopSignatureDrawing}
                    onPointerLeave={stopSignatureDrawing}
                    onPointerCancel={stopSignatureDrawing}
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
              </>
            ) : null}
          </div>
        </div>

      )}
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
