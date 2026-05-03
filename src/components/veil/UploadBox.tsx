import { useCallback, useState } from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface UploadBoxProps {
  onFile: (file: File) => void;
  file?: File | null;
  onClear?: () => void;
  accept?: string;
  hint?: string;
}

export function UploadBox({ onFile, file, onClear, accept = ".csv", hint }: UploadBoxProps) {
  const [drag, setDrag] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }, [onFile]);

  if (file) {
    return (
      <div className="surface-card flex items-center gap-3 p-4">
        <div className="h-10 w-10 rounded-md bg-beige flex items-center justify-center text-walnut">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{file.name}</div>
          <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
        </div>
        {onClear && (
          <Button variant="ghost" size="icon" onClick={onClear} aria-label="Remove file">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={cn(
        "block cursor-pointer rounded-xl border-2 border-dashed bg-gradient-card transition-colors",
        "px-6 py-10 text-center",
        drag ? "border-walnut bg-beige/40" : "border-border hover:border-walnut/40",
      )}
    >
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <div className="mx-auto h-12 w-12 rounded-full bg-beige flex items-center justify-center text-walnut mb-3">
        <UploadCloud className="h-5 w-5" />
      </div>
      <div className="text-sm font-medium text-foreground">Drop CSV here or click to browse</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </label>
  );
}
