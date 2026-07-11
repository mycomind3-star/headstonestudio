import { useRef, useState } from "react";

type ConversionStyle = "engraving" | "sketch" | "stipple" | "memorial";

interface ConversionResult {
  outputUrl: string;
  style: ConversionStyle;
  predictionId: string;
}

const STYLE_LABELS: Record<ConversionStyle, { label: string; desc: string }> = {
  engraving: { label: "Engraving", desc: "Stark lines, high contrast — classic laser look" },
  sketch:    { label: "Pencil Sketch", desc: "Fine crosshatching, hand-drawn feel" },
  stipple:   { label: "Stipple", desc: "Dot-based shading, great for portraits" },
  memorial:  { label: "Memorial", desc: "Woodcut style, detailed etching" },
};

// Replace with your actual deployed function URL
const FUNCTION_URL = "https://api.base44.com/api/apps/6a51b5a4689127183ab8c59c/functions/convertToEngravable";

export function PhotoConverter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [style, setStyle] = useState<ConversionStyle>("engraving");
  const [status, setStatus] = useState<"idle" | "uploading" | "converting" | "done" | "error">("idle");
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload an image file (JPG, PNG, etc.)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    uploadImage(file);
  }

  async function uploadImage(file: File) {
    setStatus("uploading");
    setErrorMsg(null);
    setResult(null);
    try {
      // Upload to a public URL via Base44 file storage
      const formData = new FormData();
      formData.append("file", file);
      // Use a data URL as the source — pass it directly to the function
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setUploadedUrl(dataUrl);
        setStatus("idle");
      };
      reader.readAsDataURL(file);
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function runConversion() {
    if (!uploadedUrl) return;
    setStatus("converting");
    setErrorMsg(null);
    setResult(null);
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: uploadedUrl, style }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.details || data.error || "Conversion failed");
      }
      setResult(data);
      setStatus("done");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDownload() {
    if (!result?.outputUrl) return;
    const a = document.createElement("a");
    a.href = result.outputUrl;
    a.download = `engravable-${style}-${Date.now()}.png`;
    a.click();
  }

  return (
    <div className="photo-converter">
      <div className="panel-block">
        <p className="panel-kicker">AI Photo Converter</p>
        <p className="converter-lede">
          Upload a photo of a person or pet — AI converts it to a laser-engraving-ready image.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`drop-zone${dragOver ? " drop-zone--active" : ""}${preview ? " drop-zone--has-image" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {preview ? (
          <img src={preview} alt="Uploaded photo" className="drop-zone__preview" />
        ) : (
          <div className="drop-zone__placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span>Drop a photo here or click to browse</span>
            <span className="drop-zone__hint">JPG, PNG, WEBP supported</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {/* Style selector */}
      <div className="panel-block">
        <span className="field-label">Engraving Style</span>
        <div className="style-grid">
          {(Object.entries(STYLE_LABELS) as [ConversionStyle, { label: string; desc: string }][]).map(([key, { label, desc }]) => (
            <button
              key={key}
              className={`style-btn${style === key ? " style-btn--active" : ""}`}
              onClick={() => setStyle(key)}
            >
              <span className="style-btn__label">{label}</span>
              <span className="style-btn__desc">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Convert button */}
      <button
        className="convert-btn"
        disabled={!uploadedUrl || status === "converting" || status === "uploading"}
        onClick={runConversion}
      >
        {status === "converting" ? (
          <>
            <span className="spinner" />
            Converting… this takes ~30s
          </>
        ) : status === "uploading" ? (
          "Uploading…"
        ) : (
          "Convert to Engravable"
        )}
      </button>

      {/* Error */}
      {errorMsg && (
        <div className="status-pill status-error" style={{ width: "100%", borderRadius: "0.5rem", padding: "0.6rem 1rem" }}>
          {errorMsg}
        </div>
      )}

      {/* Result */}
      {result && status === "done" && (
        <div className="converter-result">
          <div className="panel-block">
            <p className="panel-kicker" style={{ color: "#324629" }}>✓ Ready for LightBurn</p>
          </div>
          <img src={result.outputUrl} alt="Engravable result" className="result-image" />
          <div className="result-actions">
            <button className="convert-btn" onClick={handleDownload}>
              Download PNG
            </button>
            <button
              className="btn-secondary"
              onClick={() => { setPreview(null); setUploadedUrl(null); setResult(null); setStatus("idle"); }}
            >
              Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
