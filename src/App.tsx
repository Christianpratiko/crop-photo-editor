import { useState, useRef, useEffect, useCallback } from 'react';
import Cropper, { ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import {
  UploadCloud,
  Download,
  Maximize,
  Minimize,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Image as ImageIcon,
  Settings,
  Crop,
  RefreshCcw,
  X,
  Hand
} from 'lucide-react';

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('image.jpeg');
  const cropperRef = useRef<ReactCropperElement>(null);

  // Settings
  const [aspectRatio, setAspectRatio] = useState<number>(NaN);
  const [dragMode, setDragMode] = useState<'crop' | 'move'>('crop');
  
  // Update drag mode directly on the cropper instance when it changes
  useEffect(() => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.setDragMode(dragMode);
    }
  }, [dragMode]);

  // Update aspect ratio directly on the cropper instance when it changes
  useEffect(() => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.setAspectRatio(aspectRatio);
    }
  }, [aspectRatio]);

  const [customRatio, setCustomRatio] = useState({ w: 1, h: 1 });
  const [quality, setQuality] = useState<number>(0.8);
  const [format, setFormat] = useState<string>('image/jpeg');

  // View States
  const [isFullscreen, setIsFullscreen] = useState(false);

  // History States
  // CropperJS data captures crop box, rotation, scale
  const [history, setHistory] = useState<Cropper.Data[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);

  // -- Fullscreen Handling --
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Keyboard shortcut for Fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleRedo();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [history, historyIndex]);

  // -- File Handling --
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    let files;
    if (e.target) {
      files = e.target.files;
    }
    if (files && files.length > 0) {
      const file = files[0];
      setFileName(file.name);
      
      // Suggest format based on input
      if (file.type === 'image/png') setFormat('image/png');
      else if (file.type === 'image/webp') setFormat('image/webp');
      else setFormat('image/jpeg');

      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as any);
        // Reset history
        setHistory([]);
        setHistoryIndex(-1);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = () => {
          setImage(reader.result as any);
          setHistory([]);
          setHistoryIndex(-1);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeImage = () => {
    setImage(null);
    setHistory([]);
    setHistoryIndex(-1);
  };

  // -- Cropper Actions --
  const saveHistoryState = useCallback(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    try {
      const data = cropper.getData();
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(data);
        setHistoryIndex(newHistory.length - 1);
        return newHistory;
      });
    } catch (e) {
      console.warn("Could not save cropper history state", e);
    }
  }, [historyIndex]);

  const onCropperReady = () => {
    // Save initial state
    const cropper = cropperRef.current?.cropper;
    if (cropper && history.length === 0) {
      saveHistoryState();
    }
  };

  const onCropEnd = () => {
    saveHistoryState();
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const cropper = cropperRef.current?.cropper;
      if (cropper) {
        isUndoRedoAction.current = true;
        const previousState = history[historyIndex - 1];
        cropper.setData(previousState);
        setHistoryIndex((prev) => prev - 1);
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const cropper = cropperRef.current?.cropper;
      if (cropper) {
        isUndoRedoAction.current = true;
        const nextState = history[historyIndex + 1];
        cropper.setData(nextState);
        setHistoryIndex((prev) => prev + 1);
      }
    }
  };

  const handleZoom = (ratio: number) => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.zoom(ratio);
      setTimeout(saveHistoryState, 100);
    }
  };

  const handleRotate = (degree: number) => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.rotate(degree);
      saveHistoryState();
    }
  };

  const handleFlipX = () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      const data = cropper.getData();
      cropper.scaleX(-data.scaleX || -1);
      saveHistoryState();
    }
  };

  const handleFlipY = () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      const data = cropper.getData();
      cropper.scaleY(-data.scaleY || -1);
      saveHistoryState();
    }
  };

  const handleReset = () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.reset();
      saveHistoryState();
    }
  };

  // -- Export --
  const getOutputFilename = () => {
    const nameWithoutExt = fileName.split('.').slice(0, -1).join('.') || 'cropped_image';
    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp'
    };
    return `${nameWithoutExt}_cropped${extMap[format]}`;
  };

  const handleExport = () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.getCroppedCanvas({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      }).toBlob(
        (blob) => {
          if (!blob) return;
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = getOutputFilename();
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);
        },
        format,
        quality
      );
    }
  };

  // Setup UI Ratios
  const PREDEFINED_RATIOS = [
    { label: 'Free', value: NaN },
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '16:9', value: 16 / 9 },
    { label: '3:4', value: 3 / 4 },
    { label: '9:16', value: 9 / 16 },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Header Bar */}
      <header className="flex-none flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shadow-sm z-10 w-full h-16">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Crop className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-900">
            Precision Crop
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          {image && (
            <>
              <div className="flex items-center space-x-1 border-r border-slate-200 pr-3 mr-3">
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="p-2 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo className="w-5 h-5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className="p-2 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={removeImage}
                className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors mr-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                title="Tutup & Hapus Gambar"
              >
                <X className="w-5 h-5" />
              </button>
            </>
          )}

          <button
            onClick={toggleFullscreen}
            className="flex items-center space-x-2 px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            title="Toggle Fullscreen (F11)"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            <span className="hidden sm:inline text-sm font-medium">Fullscreen</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Toolbar - Only when image exists */}
        {image && (
          <aside className="w-16 flex flex-col items-center py-4 bg-white border-r border-slate-200 space-y-4 overflow-y-auto z-10 flex-shrink-0">
            <ToolButton icon={<Crop />} onClick={() => setDragMode('crop')} tooltip="Crop Mode" isActive={dragMode === 'crop'} />
            <ToolButton icon={<Hand />} onClick={() => setDragMode('move')} tooltip="Move / Pan Mode" isActive={dragMode === 'move'} />
            <div className="w-8 h-px bg-slate-200 my-2" />
            <ToolButton icon={<ZoomIn />} onClick={() => handleZoom(0.1)} tooltip="Zoom In" />
            <ToolButton icon={<ZoomOut />} onClick={() => handleZoom(-0.1)} tooltip="Zoom Out" />
            <div className="w-8 h-px bg-slate-200 my-2" />
            <ToolButton icon={<RotateCcw />} onClick={() => handleRotate(-90)} tooltip="Rotate Left 90°" />
            <ToolButton icon={<RotateCw />} onClick={() => handleRotate(90)} tooltip="Rotate Right 90°" />
            <div className="w-8 h-px bg-slate-200 my-2" />
            <ToolButton icon={<FlipHorizontal />} onClick={handleFlipX} tooltip="Flip Horizontal" />
            <ToolButton icon={<FlipVertical />} onClick={handleFlipY} tooltip="Flip Vertical" />
            <div className="w-8 h-px bg-slate-200 my-2" />
            <ToolButton icon={<RefreshCcw />} onClick={handleReset} tooltip="Reset View" />
          </aside>
        )}

        {/* Center Canvas */}
        <section className="flex-1 relative bg-slate-100 flex flex-col overflow-hidden">
          {!image ? (
            <div
              className="flex-1 flex items-center justify-center p-8 min-h-0"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="max-w-md w-full bg-white rounded-2xl border-2 border-dashed border-slate-300 shadow-sm p-12 text-center transition-all hover:border-indigo-400 hover:bg-indigo-50/30">
                <div className="bg-indigo-100 text-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Unggah Gambar</h2>
                <p className="text-slate-500 mb-8 text-sm">
                  Tarik dan letakkan file gambar di sini,<br />atau klik tombol di bawah untuk memilih file.
                </p>
                <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg shadow-sm transition-colors focus-within:ring-4 focus-within:ring-indigo-500/30 inline-block">
                  Pilih dari Komputer
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={onFileChange}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="flex-1 w-full h-full p-6 relative flex flex-col overflow-hidden">
              <div className="relative flex-1 bg-pattern w-full h-full rounded-xl overflow-hidden shadow-inner border border-slate-300">
                <Cropper
                  ref={cropperRef}
                  src={image}
                  style={{ height: '100%', width: '100%' }}
                  zoomTo={0.5}
                  initialAspectRatio={NaN}
                  aspectRatio={aspectRatio}
                  preview=".img-preview"
                  viewMode={1}
                  minCropBoxHeight={10}
                  minCropBoxWidth={10}
                  background={false}
                  responsive={true}
                  autoCropArea={0.8}
                  checkOrientation={false} // https://github.com/fengyuanchen/cropperjs/issues/671
                  cropend={onCropEnd}
                  ready={onCropperReady}
                  guides={true}
                />
              </div>
            </div>
          )}
        </section>

        {/* Right Settings Panel - Only when image exists */}
        {image && (
          <aside className="w-80 flex-none bg-white border-l border-slate-200 overflow-y-auto flex flex-col h-full z-10 shadow-lg">
            <div className="p-5 border-b border-slate-200 flex-none sticky top-0 bg-white/95 backdrop-blur z-20">
              <h2 className="text-lg font-semibold flex items-center">
                <Settings className="w-5 h-5 mr-2 text-indigo-600" />
                Pengaturan Crop
              </h2>
            </div>
            
            <div className="flex-1 p-5 space-y-8">
              
              {/* Aspect Ratios block */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700 flex items-center">
                  <Crop className="w-4 h-4 mr-2" />
                  Rasio Bingkai (Aspect Ratio)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PREDEFINED_RATIOS.map((r) => (
                    <button
                      key={r.label}
                      onClick={() => setAspectRatio(r.value)}
                      className={`py-2 px-1 rounded-md text-sm font-medium border transition-all ${
                        Number.isNaN(aspectRatio) && Number.isNaN(r.value)
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                          : aspectRatio === r.value && !Number.isNaN(aspectRatio)
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                {/* Custom Ratio Editor */}
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Custom Rasio</span>
                    <button
                      onClick={() => setAspectRatio(customRatio.w / customRatio.h)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded"
                    >
                      Terapkan
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="number" 
                      min="1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="L"
                      value={customRatio.w}
                      onChange={(e) => setCustomRatio(prev => ({...prev, w: Number(e.target.value) || 1}))}
                    />
                    <span className="text-slate-400 font-bold">:</span>
                    <input 
                      type="number" 
                      min="1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="T"
                      value={customRatio.h}
                      onChange={(e) => setCustomRatio(prev => ({...prev, h: Number(e.target.value) || 1}))}
                    />
                  </div>
                </div>
              </div>

              {/* Export Settings */}
              <div className="space-y-4 pt-6 border-t border-slate-200">
                <label className="text-sm font-medium text-slate-700 flex items-center">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Kualitas & Format
                </label>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Kualitas Export</span>
                    <span className="font-semibold text-indigo-700">{Math.round(quality * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <p className="text-xs text-slate-500 mb-4">Pengaturan kualitas hanya berlaku untuk format JPG dan WebP.</p>
                </div>

                <div className="space-y-2">
                  <span className="text-sm text-slate-600">Format Gambar</span>
                  <select 
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="image/jpeg">JPEG (.jpg)</option>
                    <option value="image/png">PNG (.png) - Transparan/Lossless</option>
                    <option value="image/webp">WebP (.webp)</option>
                  </select>
                </div>

              </div>
              
            </div>

            {/* Action Bar at bottom */}
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex-none sticky bottom-0 z-20">
              <button
                onClick={handleExport}
                className="w-full flex items-center justify-center py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-transform active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <Download className="w-5 h-5 mr-2" />
                Download Hasil
              </button>
            </div>
            
          </aside>
        )}
      </main>

      {/* Global CSS for checkered bg */}
      <style>{`
        .bg-pattern {
          background-image: 
            linear-gradient(45deg, #e2e8f0 25%, transparent 25%), 
            linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #e2e8f0 75%), 
            linear-gradient(-45deg, transparent 75%, #e2e8f0 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
      `}</style>
    </div>
  );
}

function ToolButton({ icon, onClick, tooltip, isActive }: { icon: React.ReactNode, onClick: () => void, tooltip: string, isActive?: boolean }) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={`p-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-center shadow-sm border ${
          isActive 
            ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
            : 'bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border-slate-100 hover:border-indigo-100'
        }`}
        aria-label={tooltip}
      >
        <div className="w-5 h-5 [&>svg]:w-full [&>svg]:h-full">
          {icon}
        </div>
      </button>
      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
        {tooltip}
        <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-slate-800"></div>
      </div>
    </div>
  );
}
