import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

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
      toast.success("Invoice uploaded - analyzing...");
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
      await addStatement({
        monthKey: currentMonth,
        storageId,
        fileName: file.name,
        fileType,
      });
      toast.success("Statement uploaded");
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={goToPreviousMonth}
          className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          ← Previous
        </button>
        <h1 className="text-3xl font-bold text-primary">
          {formatMonthDisplay(currentMonth)}
        </h1>
        <button
          onClick={goToNextMonth}
          className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          Next →
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Monthly Statements</h2>
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => statementInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Upload Statement PDF
          </button>
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".csv";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  void handleUploadStatement(file, "csv");
                }
              };
              input.click();
            }}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Upload Statement CSV
          </button>
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
          <p className="text-gray-500 text-sm">No statements uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {monthData.statements.map((statement) => (
              <div
                key={statement.storageId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold px-2 py-1 bg-gray-200 rounded uppercase">
                    {statement.fileType}
                  </span>
                  <a
                    href={statement.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {statement.fileName}
                  </a>
                  <span className="text-xs text-gray-500">
                    {new Date(statement.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => {
                    void deleteStatement({
                      monthKey: currentMonth,
                      storageId: statement.storageId,
                    });
                  }}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Incoming Invoices</h2>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 mb-4 transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-gray-50"
          }`}
        >
          <div className="text-center">
            <p className="text-gray-600 mb-2">
              Drag & drop invoice PDFs here, or
            </p>
            <button
              onClick={() => invoiceInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Browse Files
            </button>
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
          <p className="text-gray-500 text-sm">No invoices uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {/* Show uploading skeletons first */}
            {uploadingInvoices.map((uploadingInvoice) => (
              <InvoiceSkeleton key={uploadingInvoice.uploadId} fileName={uploadingInvoice.fileName} />
            ))}
            {/* Show uploaded invoices */}
            {monthData.incomingInvoices.map((invoice) => (
              <div
                key={invoice.storageId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200"
              >
                <div className="flex items-center gap-3 flex-1">
                  <a
                    href={invoice.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {invoice.fileName}
                  </a>
                  <div className="flex items-center gap-2 text-xs">
                    {invoice.analysis.sender.error ? (
                      <span 
                        className="px-2 py-1 bg-red-100 text-red-800 rounded cursor-pointer hover:bg-red-200 transition-colors"
                        onClick={() => console.error("🔍 Sender Analysis Error:", invoice.analysis.sender.error)}
                        title="Click to see error details in console"
                      >
                        Sender Error
                      </span>
                    ) : invoice.analysis.sender.value ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                        {invoice.analysis.sender.value}
                      </span>
                    ) : invoice.analysis.sender.lastUpdated === null ? (
                      <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded animate-pulse">
                        Analyzing sender...
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded">
                        N/A
                      </span>
                    )}
                    {invoice.analysis.date.error ? (
                      <span 
                        className="px-2 py-1 bg-red-100 text-red-800 rounded cursor-pointer hover:bg-red-200 transition-colors"
                        onClick={() => console.error("🔍 Date Analysis Error:", invoice.analysis.date.error)}
                        title="Click to see error details in console"
                      >
                        Date Error
                      </span>
                    ) : invoice.analysis.date.value ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {invoice.analysis.date.value}
                      </span>
                    ) : invoice.analysis.date.lastUpdated === null ? (
                      <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded animate-pulse">
                        Analyzing date...
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded">
                        N/A
                      </span>
                    )}
                    {invoice.analysis.parsedText.error && (
                      <span 
                        className="px-2 py-1 bg-red-100 text-red-800 rounded cursor-pointer hover:bg-red-200 transition-colors"
                        onClick={() => console.error("📝 Parsing Error:", invoice.analysis.parsedText.error)}
                        title="Click to see error details in console"
                      >
                        Parse Error
                      </span>
                    )}
                    {invoice.analysis.analysisBigError && (
                      <span 
                        className="px-2 py-1 bg-red-100 text-red-800 rounded cursor-pointer hover:bg-red-200 transition-colors"
                        onClick={() => console.error("🚨 Analysis Big Error:", invoice.analysis.analysisBigError)}
                        title="Click to see error details in console"
                      >
                        Analysis Error
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 ml-auto">
                    Uploaded: {new Date(invoice.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => {
                    void deleteIncomingInvoice({
                      monthKey: currentMonth,
                      storageId: invoice.storageId,
                    });
                  }}
                  className="text-red-600 hover:text-red-800 text-sm ml-4"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
