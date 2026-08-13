"use client";

import { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 20 * 1024 * 1024;

export function NotesUploadZone({ onUpload }: { onUpload: (file: File) => Promise<void> }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("We only support PDF, JPG, PNG, and WEBP files.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Your file is too large. Maximum size is 20MB.");
      return;
    }

    setUploading(true);
    try {
      await onUpload(file);
      toast.success("Uploaded! We're extracting content from it now.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!uploading) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!uploading) handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all ${
        uploading ? "cursor-wait border-[#CBD5E1] bg-[#F8FAFF]" : "cursor-pointer"
      } ${dragOver ? "border-[#1E3A8A] bg-[#DBEAFE]" : "border-[#CBD5E1] bg-[#F8FAFF] hover:border-[#3B5FBF]"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        disabled={uploading}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#1E3A8A] shadow-[var(--shadow-card)]">
        {uploading ? <Loader2 size={26} className="animate-spin" /> : <UploadCloud size={26} />}
      </div>
      <div>
        <p className="text-sm font-semibold text-[#0F172A]">
          {uploading ? "Uploading..." : "Drag & drop your notes here"}
        </p>
        <p className="mt-1 text-xs text-[#64748B]">PDF, JPG, PNG, or WEBP · up to 20MB · or click to browse</p>
      </div>
    </div>
  );
}
