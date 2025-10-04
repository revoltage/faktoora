import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface UploadingInvoice {
  fileName: string;
  uploadId: string;
}

interface InvoiceListProps {
  monthKey: string;
  incomingInvoices: any[];
  uploadingInvoices: UploadingInvoice[];
  generateUploadUrl: any;
  addIncomingInvoice: any;
  deleteIncomingInvoice: any;
  onInvoiceClick: (invoice: any) => void;
  onUploadingStateChange: (invoices: UploadingInvoice[]) => void;
}

const InvoiceSkeleton = ({ fileName }: { fileName: string }) => (
  <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200 opacity-60">
    <div className="flex items-center gap-3 flex-1">
      <span className="text-blue-600 hover:underline font-medium">
        {fileName}
      </span>
      <div className="flex items-center gap-2 text-xs">
        <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded animate-pulse">
          🔄 Uploading...
        </span>
        <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded animate-pulse">
          🔄 Processing...
        </span>
      </div>
      <span className="text-xs text-gray-500 ml-auto">
        Just now
      </span>
    </div>
  </div>
);

export const InvoiceList = ({ 
  monthKey, 
  incomingInvoices, 
  uploadingInvoices, 
  generateUploadUrl, 
  addIncomingInvoice, 
  deleteIncomingInvoice, 
  onInvoiceClick,
  onUploadingStateChange
}: InvoiceListProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  const handleUploadInvoice = async (file: File) => {
    const uploadId = `upload-${Date.now()}-${Math.random()}`;
    const uploadingInvoice: UploadingInvoice = {
      fileName: file.name,
      uploadId,
    };

    // Add to uploading state immediately
    onUploadingStateChange([...uploadingInvoices, uploadingInvoice]);

    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();
      await addIncomingInvoice({
        monthKey,
        storageId,
        fileName: file.name,
      });
    } catch {
      toast.error("Failed to upload invoice");
    } finally {
      // Remove from uploading state
      onUploadingStateChange(uploadingInvoices.filter(inv => inv.uploadId !== uploadId));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type === "application/pdf") {
        void handleUploadInvoice(file);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const formatInvoiceDate = (dateStr: string | number) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  };

  return (
    <Card 
      className={`border border-gray-200 shadow-sm transition-colors ${
        isDragging ? "border-blue-500 bg-blue-50" : ""
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm font-semibold tracking-tight flex items-center justify-between">
          Incoming Invoices
          <Button
            size="sm"
            className="h-5 w-5 p-0 text-xs"
            onClick={() => invoiceInputRef.current?.click()}
          >
            +
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className={`p-3 pt-0 transition-opacity ${isDragging ? "opacity-50" : ""}`}>
        <input
          ref={invoiceInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            for (const file of files) {
              void handleUploadInvoice(file);
            }
            e.target.value = "";
          }}
        />
        {incomingInvoices.length === 0 && uploadingInvoices.length === 0 ? (
          <p className="text-xs text-muted-foreground">No invoices uploaded yet</p>
        ) : (
          <div className="space-y-1.5">
            {uploadingInvoices.map((uploadingInvoice) => (
              <InvoiceSkeleton key={uploadingInvoice.uploadId} fileName={uploadingInvoice.fileName} />
            ))}
            {incomingInvoices.map((invoice) => (
              <div
                key={invoice.storageId}
                className="group flex items-start justify-between p-2 rounded-md border bg-card cursor-pointer hover:bg-gray-50 transition-colors relative"
                onClick={() => onInvoiceClick(invoice)}
              >
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <div className="text-gray-400 mt-0.5">
                    📄
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Main row: Sender + Date */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-blue-600 font-medium truncate">
                        {invoice.analysis.sender.error ? (
                          <span className="text-red-600 cursor-pointer" onClick={() => console.error("🔍 Sender Analysis Error:", invoice.analysis.sender.error)}>
                            Sender Error
                          </span>
                        ) : invoice.analysis.sender.value ? (
                          invoice.analysis.sender.value
                        ) : invoice.analysis.sender.lastUpdated === null ? (
                          <span className="text-yellow-600">Analyzing sender...</span>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {invoice.analysis.date.error ? (
                          <span className="text-red-600 cursor-pointer" onClick={() => console.error("🔍 Date Analysis Error:", invoice.analysis.date.error)}>
                            Date Error
                          </span>
                        ) : invoice.analysis.date.value ? (
                          formatInvoiceDate(invoice.analysis.date.value)
                        ) : invoice.analysis.date.lastUpdated === null ? (
                          <span className="text-yellow-600">Analyzing date...</span>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </span>
                    </div>
                    {/* Tiny row: Filename + Uploaded at + Parse status */}
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                      <span className="truncate">{invoice.fileName}</span>
                      <span>•</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">{formatInvoiceDate(invoice.uploadedAt)}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>File uploaded at {new Date(invoice.uploadedAt).toLocaleString()}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <span>•</span>
                      <span>
                        {invoice.analysis.parsedText.error ? (
                          <span className="text-red-600 cursor-pointer" onClick={() => console.error("📝 Parsing Error:", invoice.analysis.parsedText.error)}>
                            Parse error
                          </span>
                        ) : invoice.analysis.parsedText.lastUpdated === null ? (
                          <span className="text-yellow-600">Parsing</span>
                        ) : (
                          <span className="text-green-600">Parsed</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-red-600 hover:text-red-700 ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteIncomingInvoice({
                      monthKey,
                      storageId: invoice.storageId,
                    });
                  }}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
