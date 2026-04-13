import { useState, useEffect } from "react";
import { ImageIcon, Trash2, RefreshCw, Download, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaFile {
  filename: string;
  url: string;
  size: number;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function MediaLibrary() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/media/library`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFiles(); }, []);

  const handleDelete = async (filename: string) => {
    if (!confirm("Delete this image? This cannot be undone.")) return;
    setDeleting(filename);
    try {
      await fetch(`${baseUrl}/api/media/${filename}`, { method: "DELETE" });
      setFiles((f) => f.filter((file) => file.filename !== filename));
      if (selected === filename) setSelected(null);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Media Library</h1>
          <p className="text-sm text-muted-foreground mt-1">All generated visuals and uploaded assets in one place.</p>
        </div>
        <button
          onClick={fetchFiles}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <ImageIcon className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">No media yet</h3>
          <p className="text-sm text-muted-foreground">
            Generate images for your campaign posts and they'll appear here.
          </p>
        </div>
      ) : (
        <div className="flex gap-6">
          <div className={cn("grid gap-3 flex-1", selected ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5")}>
            {files.map((file) => (
              <div
                key={file.filename}
                onClick={() => setSelected(selected === file.filename ? null : file.filename)}
                className={cn(
                  "relative group aspect-square rounded-xl overflow-hidden border cursor-pointer transition-all",
                  selected === file.filename
                    ? "ring-2 ring-primary border-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                <img
                  src={file.url}
                  alt={file.filename}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-end p-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(file.filename); }}
                    disabled={deleting === file.filename}
                    className="p-1.5 rounded-lg bg-red-500/90 text-white hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {selected && (() => {
            const file = files.find((f) => f.filename === selected);
            if (!file) return null;
            return (
              <div className="w-72 flex-shrink-0 space-y-4">
                <div className="rounded-xl overflow-hidden border border-border">
                  <img src={file.url} alt={file.filename} className="w-full object-contain max-h-64" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size</span>
                    <span className="text-foreground font-medium">{formatSize(file.size)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-foreground font-medium">{new Date(file.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a
                    href={file.url}
                    download
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                  <button
                    onClick={() => handleDelete(file.filename)}
                    disabled={deleting === file.filename}
                    className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {files.length > 0 && (
        <p className="text-xs text-muted-foreground">{files.length} image{files.length !== 1 ? "s" : ""} total</p>
      )}
    </div>
  );
}
