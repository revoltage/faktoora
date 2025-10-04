import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { TransactionList } from "./TransactionList";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Separator } from "./components/ui/separator";

interface UploadingInvoice {
  fileName: string;
  uploadId: string;
}

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

      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight">Incoming Invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-md p-4 mb-3 transition-colors ${
              isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"
            }`}
          >
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">Drag & drop invoice PDFs, or</p>
              <Button
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => invoiceInputRef.current?.click()}
              >
                Browse Files
              </Button>
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
            </div>
          </div>
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
                  className="flex items-center justify-between p-2 rounded-md border bg-card"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <a
                      href={invoice.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium truncate"
                    >
                      {invoice.fileName}
                    </a>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      {invoice.analysis.sender.error ? (
                        <Badge
                          variant="destructive"
                          className="cursor-pointer"
                          onClick={() => console.error("🔍 Sender Analysis Error:", invoice.analysis.sender.error)}
                        >
                          Sender Error
                        </Badge>
                      ) : invoice.analysis.sender.value ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          {invoice.analysis.sender.value}
                        </Badge>
                      ) : invoice.analysis.sender.lastUpdated === null ? (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Analyzing sender...</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-600 border-gray-300">N/A</Badge>
                      )}
                      {invoice.analysis.date.error ? (
                        <Badge
                          variant="destructive"
                          className="cursor-pointer"
                          onClick={() => console.error("🔍 Date Analysis Error:", invoice.analysis.date.error)}
                        >
                          Date Error
                        </Badge>
                      ) : invoice.analysis.date.value ? (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                          {invoice.analysis.date.value}
                        </Badge>
                      ) : invoice.analysis.date.lastUpdated === null ? (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Analyzing date...</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-600 border-gray-300">N/A</Badge>
                      )}
                      {invoice.analysis.parsedText.error && (
                        <Badge
                          variant="destructive"
                          className="cursor-pointer"
                          onClick={() => console.error("📝 Parsing Error:", invoice.analysis.parsedText.error)}
                        >
                          Parse Error
                        </Badge>
                      )}
                      {invoice.analysis.analysisBigError && (
                        <Badge
                          variant="destructive"
                          className="cursor-pointer"
                          onClick={() => console.error("🚨 Analysis Big Error:", invoice.analysis.analysisBigError)}
                        >
                          Analysis Error
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                      Uploaded: {new Date(invoice.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-red-600 hover:text-red-700 ml-2"
                    onClick={() => {
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
    </div>
  );
}
