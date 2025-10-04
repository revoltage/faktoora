import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { TransactionList } from "./TransactionList";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Separator } from "./components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./components/ui/dialog";

interface UploadingInvoice {
  fileName: string;
  uploadId: string;
}

interface InvoiceDetailsModalProps {
  invoice: any;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (storageId: any) => Promise<void>;
}

const InvoiceDetailsModal = ({ invoice, isOpen, onClose, onDelete }: InvoiceDetailsModalProps) => {
  if (!invoice) return null;

  const formatDate = (dateStr: string | number) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "long", 
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getStatusBadge = (analysis: any, field: string) => {
    const fieldData = analysis[field];
    if (fieldData.error) {
      return <Badge variant="destructive" className="text-xs">Error</Badge>;
    }
    if (fieldData.lastUpdated === null) {
      return <Badge variant="secondary" className="text-xs">Processing</Badge>;
    }
    if (fieldData.value) {
      return <Badge variant="default" className="text-xs bg-green-600">Complete</Badge>;
    }
    return <Badge variant="outline" className="text-xs">N/A</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📄 Invoice Details
            <Badge variant="outline" className="text-xs">
              {invoice.fileName}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* File Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">📁 File Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">File Name:</span>
                  <p className="mt-1 break-all">{invoice.fileName}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Uploaded:</span>
                  <p className="mt-1">{formatDate(invoice.uploadedAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Analysis Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">🔍 Analysis Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Text Parsing</span>
                    {getStatusBadge(invoice.analysis, "parsedText")}
                  </div>
                  {invoice.analysis.parsedText.error && (
                    <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {invoice.analysis.parsedText.error}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Sender</span>
                    {getStatusBadge(invoice.analysis, "sender")}
                  </div>
                  {invoice.analysis.sender.error && (
                    <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {invoice.analysis.sender.error}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Date</span>
                    {getStatusBadge(invoice.analysis, "date")}
                  </div>
                  {invoice.analysis.date.error && (
                    <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {invoice.analysis.date.error}
                    </p>
                  )}
                </div>
              </div>
              
              {invoice.analysis.analysisBigError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm font-medium text-red-800">Analysis Error:</p>
                  <p className="text-xs text-red-600 mt-1">{invoice.analysis.analysisBigError}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extracted Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">📋 Extracted Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Sender:</span>
                  <p className="mt-1 text-sm">
                    {invoice.analysis.sender.value || (
                      <span className="text-muted-foreground italic">Not available</span>
                    )}
                  </p>
                </div>
                
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Date:</span>
                  <p className="mt-1 text-sm">
                    {invoice.analysis.date.value ? formatDate(invoice.analysis.date.value) : (
                      <span className="text-muted-foreground italic">Not available</span>
                    )}
                  </p>
                </div>
              </div>
              
              {invoice.analysis.parsedText.value && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Parsed Text:</span>
                  <div className="mt-2 p-3 bg-gray-50 rounded-md max-h-40 overflow-y-auto">
                    <p className="text-xs whitespace-pre-wrap">{invoice.analysis.parsedText.value}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                void onDelete(invoice.storageId);
              }}
            >
              Delete Invoice
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export function InvoiceManager() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const path = window.location.pathname;
    if (path === "/") {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    return path.substring(1);
  });

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === "/") {
        const now = new Date();
        setCurrentMonth(
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
        );
      } else {
        setCurrentMonth(path.substring(1));
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateToMonth = (monthKey: string) => {
    window.history.pushState({}, "", `/${monthKey}`);
    setCurrentMonth(monthKey);
  };

  const monthData = useQuery(api.invoices.getMonthData, { monthKey: currentMonth });
  const generateUploadUrl = useMutation(api.invoices.generateUploadUrl);
  const addIncomingInvoice = useMutation(api.invoices.addIncomingInvoice);
  const addStatement = useMutation(api.invoices.addStatement);
  const deleteIncomingInvoice = useMutation(api.invoices.deleteIncomingInvoice);
  const deleteStatement = useMutation(api.invoices.deleteStatement);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadingInvoices, setUploadingInvoices] = useState<UploadingInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const statementInputRef = useRef<HTMLInputElement>(null);

  const handleUploadInvoice = async (file: File) => {
    const uploadId = `upload-${Date.now()}-${Math.random()}`;
    const uploadingInvoice: UploadingInvoice = {
      fileName: file.name,
      uploadId,
    };

    // Add to uploading state immediately
    setUploadingInvoices(prev => [...prev, uploadingInvoice]);

    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();
      await addIncomingInvoice({
        monthKey: currentMonth,
        storageId,
        fileName: file.name,
      });
    } catch {
      toast.error("Failed to upload invoice");
    } finally {
      // Remove from uploading state
      setUploadingInvoices(prev => prev.filter(inv => inv.uploadId !== uploadId));
    }
  };

  const handleUploadStatement = async (file: File, fileType: "pdf" | "csv") => {
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();
      
      // If it's a CSV file, read the content and process it
      if (fileType === "csv") {
        const csvContent = await file.text();
        await addStatement({
          monthKey: currentMonth,
          storageId,
          fileName: file.name,
          fileType,
          csvContent,
        });
        toast.success(`📊 Processed CSV: ${file.name}`);
      } else {
        await addStatement({
          monthKey: currentMonth,
          storageId,
          fileName: file.name,
          fileType,
        });
      }
    } catch {
      toast.error("Failed to upload statement");
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

  const openInvoiceModal = (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsModalOpen(true);
  };

  const closeInvoiceModal = () => {
    setIsModalOpen(false);
    setSelectedInvoice(null);
  };

  const handleDeleteInvoice = async (storageId: any) => {
    try {
      await deleteIncomingInvoice({
        monthKey: currentMonth,
        storageId,
      });
      closeInvoiceModal();
      toast.success("🗑️ Invoice deleted successfully");
    } catch {
      toast.error("Failed to delete invoice");
    }
  };

  const goToPreviousMonth = () => {
    const [year, month] = currentMonth.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() - 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    navigateToMonth(newMonth);
  };

  const goToNextMonth = () => {
    const [year, month] = currentMonth.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    navigateToMonth(newMonth);
  };

  const formatMonthDisplay = (monthKey: string) => {
    const [year, month] = monthKey.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  };

  const formatInvoiceDate = (dateStr: string | number) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  };

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

  if (!monthData) {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={goToPreviousMonth}
        >
          ← Previous
        </Button>
        <h1 className="text-base font-semibold text-primary tracking-tight">
          {formatMonthDisplay(currentMonth)}
        </h1>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={goToNextMonth}
        >
          Next →
        </Button>
      </div>

      <Card className="mb-3 border border-gray-200 shadow-sm">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight">Monthly Statements</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="flex gap-2 mb-3">
            <Button
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => statementInputRef.current?.click()}
            >
              Upload PDF
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-7 px-2 text-[11px] bg-green-600 hover:bg-green-700"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".csv";
                input.multiple = true;
                input.onchange = (e) => {
                  const files = Array.from((e.target as HTMLInputElement).files || []);
                  for (const file of files) {
                    void handleUploadStatement(file, "csv");
                  }
                };
                input.click();
              }}
            >
              Upload CSV(s)
            </Button>
            <input
              ref={statementInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleUploadStatement(file, "pdf");
                }
                e.target.value = "";
              }}
            />
          </div>
          {monthData.statements.length === 0 ? (
            <p className="text-xs text-muted-foreground">No statements uploaded yet</p>
          ) : (
            <div className="space-y-1.5">
              {monthData.statements.map((statement) => (
                <div
                  key={statement.storageId}
                  className="flex items-center justify-between p-2 rounded-md border bg-card"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className="uppercase bg-blue-600 text-white border-blue-600">
                      {statement.fileType}
                    </Badge>
                    <a
                      href={statement.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate"
                    >
                      {statement.fileName}
                    </a>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(statement.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-red-600 hover:text-red-700"
                    onClick={() => {
                      void deleteStatement({
                        monthKey: currentMonth,
                        storageId: statement.storageId,
                      });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator className="my-3" />

          <div>
            <TransactionList monthKey={currentMonth} />
          </div>
        </CardContent>
      </Card>

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
          {monthData.incomingInvoices.length === 0 && uploadingInvoices.length === 0 ? (
            <p className="text-xs text-muted-foreground">No invoices uploaded yet</p>
          ) : (
            <div className="space-y-1.5">
              {uploadingInvoices.map((uploadingInvoice) => (
                <InvoiceSkeleton key={uploadingInvoice.uploadId} fileName={uploadingInvoice.fileName} />
              ))}
              {monthData.incomingInvoices.map((invoice) => (
                <div
                  key={invoice.storageId}
                  className="group flex items-start justify-between p-2 rounded-md border bg-card cursor-pointer hover:bg-gray-50 transition-colors relative"
                  onClick={() => openInvoiceModal(invoice)}
                >
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="text-gray-400 mt-0.5">
                      📄
                    </div>
                    <div className="text-xs text-muted-foreground absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to view details
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
                        monthKey: currentMonth,
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

      {/* Invoice Details Modal */}
      <InvoiceDetailsModal
        invoice={selectedInvoice}
        isOpen={isModalOpen}
        onClose={closeInvoiceModal}
        onDelete={handleDeleteInvoice}
      />
    </div>
  );
}
