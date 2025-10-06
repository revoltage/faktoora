import { useQuery } from "convex/react";
import { CheckIcon, XIcon, Loader2, CircleAlertIcon } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkVatIdInText } from "@/lib/vatIdChecker";

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
  onUploadingStateChange: Dispatch<SetStateAction<UploadingInvoice[]>>;
  deleteAllInvoices?: any;
}

const InvoiceSkeleton = ({ fileName }: { fileName: string }) => (
  <div className="flex items-center justify-between pt-0.5 pb-1 border-t border-gray-100 hover:bg-gray-50 transition-colors opacity-60">
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <span className="text-base flex-shrink-0">📄</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs font-medium text-blue-600 truncate">
              {fileName}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-yellow-600">Uploading...</span>
          </div>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
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
  onUploadingStateChange,
  deleteAllInvoices,
}: InvoiceListProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const userSettings = useQuery(api.userSettings.getUserSettings);

  const formatMonthDisplay = (monthKey: string) => {
    const [year, month] = monthKey.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  };

  const handleDeleteAllInvoices = async () => {
    if (!deleteAllInvoices) return;
    try {
      await deleteAllInvoices({ monthKey });
      toast.success("🗑️ All invoices deleted successfully");
    } catch {
      toast.error("Failed to delete all invoices");
    }
  };

  const handleUploadInvoice = async (file: File) => {
    const uploadId = `upload-${Date.now()}-${Math.random()}`;
    const uploadingInvoice: UploadingInvoice = {
      fileName: file.name,
      uploadId,
    };

    // Add to uploading state immediately
    onUploadingStateChange((prev) => [...prev, uploadingInvoice]);

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
      onUploadingStateChange((prev) =>
        prev.filter((inv) => inv.uploadId !== uploadId)
      );
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
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      // year: "2-digit",
    });
  };

  const renderVatIdStatus = (invoice: any) => {
    // Check if VAT ID is configured in settings
    if (!userSettings?.vatId) {
      return (
        <span className="text-[9px] text-gray-500 bg-gray-100 px-2 py-0 rounded border">
          No VAT ID set
        </span>
      );
    }

    // Use classic parsing first, fallback to AI analysis
    const parsedText = invoice.parsing.parsedText.value || invoice.analysis.parsedText.value;
    
    if (!parsedText) {
      return <span className="text-[9px] text-gray-400">No parsed text</span>;
    }

    const vatCheck = checkVatIdInText(parsedText, userSettings.vatId);

    if (vatCheck.found) {
      return (
        <span className="text-[9px] text-green-600 font-base">
          <CheckIcon className="inline-block  w-3 h-3 pb-1" /> VAT OK
        </span>
      );
    }

    return (
      <span className="text-[9px] text-white bg-red-500 px-2 py-0 rounded font-bold border border-red-600">
        VAT MISSING
      </span>
    );
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
          <div className="flex gap-2">
            {deleteAllInvoices && incomingInvoices.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-5 px-2 text-[10px] shadow-none"
                  >
                    Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>🗑️ Delete All Invoices</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete all invoice files for{" "}
                      {formatMonthDisplay(monthKey)}? This action cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void handleDeleteAllInvoices()}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-5 px-2 text-[10px] shadow-none"
              onClick={() => invoiceInputRef.current?.click()}
            >
              + Upload Invoice(s)
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent
        className={`p-3 pt-0 transition-opacity ${isDragging ? "opacity-50" : ""}`}
      >
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
          <p className="text-xs text-muted-foreground">
            No invoices uploaded yet
          </p>
        ) : (
          <div className="space-y-0">
            {uploadingInvoices.map((uploadingInvoice) => (
              <InvoiceSkeleton
                key={uploadingInvoice.uploadId}
                fileName={uploadingInvoice.fileName}
              />
            ))}
            {incomingInvoices.map((invoice) => (
              <div
                key={invoice.storageId}
                className="flex items-center justify-between pt-0.5 pb-1 border-t border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => onInvoiceClick(invoice)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-base flex-shrink-0">📄</span>
                  <div className="flex-1 min-w-0">
                    {/* Main row: Sender + Date on left, Amount on right */}
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-medium text-blue-600 truncate">
                          {invoice.name ?? invoice.fileName}
                        </span>

                        <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                          {invoice.analysis.date.error ? (
                            <span
                              className="text-red-600 cursor-pointer"
                              onClick={() =>
                                console.error(
                                  "🔍 Date Analysis Error:",
                                  invoice.analysis.date.error
                                )
                              }
                            >
                              <CircleAlertIcon className="inline-block w-2.5 h-2.5 text-red-600" />
                            </span>
                          ) : invoice.analysis.date.value ? (
                            formatInvoiceDate(invoice.analysis.date.value)
                          ) : invoice.analysis.date.lastUpdated === null ? (
                            <span className="text-yellow-600 animate-pulse">
                              Analyzing date...
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </span>

                        <span className="text-[9px]">
                          {invoice.analysis.sender.error ? (
                            <span
                              className="text-red-600 cursor-pointer"
                              onClick={() =>
                                console.error(
                                  "🔍 Sender Analysis Error:",
                                  invoice.analysis.sender.error
                                )
                              }
                            >
                              <CircleAlertIcon className="inline-block w-2.5 h-2.5 text-red-600" />
                            </span>
                          ) : invoice.analysis.sender.value ? (
                            <>
                              {/* <CheckIcon className="inline-block w-3 h-3 text-green-600" /> */}
                            </>
                          ) : // invoice.analysis.sender.value
                          invoice.analysis.sender.lastUpdated === null ? (
                            <span className="text-yellow-600 animate-pulse">
                              Analyzing sender...
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-green-700 whitespace-nowrap ml-2">
                        {invoice.analysis.amount.error ? (
                          <span
                            className="text-red-600 cursor-pointer"
                            onClick={() =>
                              console.error(
                                "💰 Amount Analysis Error:",
                                invoice.analysis.amount.error
                              )
                            }
                          >
                            ERROR
                          </span>
                        ) : invoice.analysis.amount.value ? (
                          invoice.analysis.amount.value.replace("|", " ")
                        ) : invoice.analysis.amount.lastUpdated === null ? (
                          <span className="text-yellow-600 animate-pulse">
                            Analyzing amount...
                          </span>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </span>
                    </div>

                    {/* Tiny row: Filename + Uploaded at + Parse status on left, VAT Status on right */}
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="truncate">{invoice.fileName}</span>
                        <span>•</span>
                        <span>{formatInvoiceDate(invoice.uploadedAt)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {/* Classic Parsing Status */}
                          <span>
                            {invoice.parsing.parsedText.error ? (
                              <span
                                className="text-red-600 cursor-pointer"
                                onClick={() =>
                                  console.error(
                                    "📝 Classic Parsing Error:",
                                    invoice.parsing.parsedText.error
                                  )
                                }
                                title={`Classic Error: ${invoice.parsing.parsedText.error}`}
                              >
                                C✗
                              </span>
                            ) : invoice.parsing.parsedText.lastUpdated === null ? (
                              <span className="text-yellow-600 animate-pulse" title="Classic parsing...">
                                C⏳
                              </span>
                            ) : invoice.parsing.parsedText.value ? (
                              <span className="text-blue-600" title="Classic parsing complete">
                                C✓
                              </span>
                            ) : (
                              <span className="text-gray-400" title="Classic parsing not started">
                                C-
                              </span>
                            )}
                          </span>

                          {/* AI Parsing Status */}
                          <span>
                            {invoice.analysis.parsedText.error ? (
                              <span
                                className="text-red-600 cursor-pointer"
                                onClick={() =>
                                  console.error(
                                    "📝 AI Parsing Error:",
                                    invoice.analysis.parsedText.error
                                  )
                                }
                                title={`AI Error: ${invoice.analysis.parsedText.error}`}
                              >
                                A✗
                              </span>
                            ) : invoice.analysis.parsedText.lastUpdated === null ? (
                              <span className="text-yellow-600 animate-pulse" title="AI parsing...">
                                A⏳
                              </span>
                            ) : invoice.analysis.parsedText.value ? (
                              <span className="text-green-600" title="AI parsing complete">
                                A✓
                              </span>
                            ) : (
                              <span className="text-gray-400" title="AI parsing not started">
                                A-
                              </span>
                            )}
                          </span>
                        </span>
                      </div>
                      <div className="ml-2">{renderVatIdStatus(invoice)}</div>
                    </div>

                    {/* Paid Items Row */}
                    {invoice.analysis.paidItems.value && Array.isArray(invoice.analysis.paidItems.value) && invoice.analysis.paidItems.value.length > 0 && (
                      <div className="text-[8px] text-gray-500 mt-0.5">
                        <span className="font-medium">Items: </span>
                        {invoice.analysis.paidItems.value.slice(0, 3).map((item, index) => (
                          <span key={index}>
                            {item.description} ({item.amount})
                            {index < Math.min(invoice.analysis.paidItems.value.length, 3) - 1 && ", "}
                          </span>
                        ))}
                        {invoice.analysis.paidItems.value.length > 3 && (
                          <span> +{invoice.analysis.paidItems.value.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!h-4 !w-4 p-0 mr-1 text-gray-400 hover:text-gray-600 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteIncomingInvoice({
                        monthKey,
                        storageId: invoice.storageId,
                      });
                    }}
                  >
                    <XIcon className="!h-2.5 !w-2.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
