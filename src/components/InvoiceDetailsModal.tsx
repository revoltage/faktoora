import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface InvoiceDetailsModalProps {
  invoice: any;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (storageId: any) => Promise<void>;
  onUpdateName: (storageId: any, name: string) => Promise<void>;
  monthKey: string;
}

export const InvoiceDetailsModal = ({
  invoice,
  isOpen,
  onClose,
  onDelete,
  onUpdateName,
  monthKey,
}: InvoiceDetailsModalProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(invoice?.name || "");

  if (!invoice) return null;

  const formatDate = (dateStr: string | number) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (analysis: any, field: string) => {
    const fieldData = analysis[field];
    if (fieldData.error) {
      return (
        <Badge variant="destructive" className="text-xs">
          Error
        </Badge>
      );
    }
    if (fieldData.lastUpdated === null) {
      return (
        <Badge variant="secondary" className="text-xs">
          Processing
        </Badge>
      );
    }
    if (fieldData.value) {
      return (
        <Badge variant="default" className="text-xs bg-green-600">
          Complete
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        N/A
      </Badge>
    );
  };

  const handleSaveName = async () => {
    try {
      await onUpdateName(invoice.storageId, editedName);
      setIsEditingName(false);
      toast.success("✅ Name updated successfully");
    } catch {
      toast.error("Failed to update name");
    }
  };

  const handleCancelEdit = () => {
    setEditedName(invoice.name || "");
    setIsEditingName(false);
  };

  const handleDownload = () => {
    if (!invoice.url) {
      toast.error("❌ File URL not available");
      return;
    }
    
    const link = document.createElement("a");
    link.href = invoice.url;
    link.download = invoice.fileName || "invoice.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("⬇️ Download started");
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
              <CardTitle className="text-sm font-medium">
                📁 File Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">
                    File Name:
                  </span>
                  <p className="mt-1 break-all">{invoice.fileName}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    Uploaded:
                  </span>
                  <p className="mt-1">{formatDate(invoice.uploadedAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Analysis Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                🔍 Analysis Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Classic Parsing</span>
                    {getStatusBadge(invoice.parsing, "parsedText")}
                  </div>
                  {invoice.parsing.parsedText.error && (
                    <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {invoice.parsing.parsedText.error}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">AI Text Parsing</span>
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

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Amount</span>
                    {getStatusBadge(invoice.analysis, "amount")}
                  </div>
                  {invoice.analysis.amount.error && (
                    <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {invoice.analysis.amount.error}
                    </p>
                  )}
                </div>
              </div>

              {invoice.analysis.analysisBigError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm font-medium text-red-800">
                    Analysis Error:
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {invoice.analysis.analysisBigError}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extracted Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                📋 Extracted Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Name:
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    {isEditingName ? (
                      <>
                        <Input
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="text-sm"
                          autoFocus
                        />
                        <Button size="sm" onClick={() => void handleSaveName()}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm">
                          {invoice.name || (
                            <span className="text-muted-foreground italic">
                              Not available
                            </span>
                          )}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsEditingName(true)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Sender:
                  </span>
                  <p className="mt-1 text-sm">
                    {invoice.analysis.sender.value || (
                      <span className="text-muted-foreground italic">
                        Not available
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Date:
                  </span>
                  <p className="mt-1 text-sm">
                    {invoice.analysis.date.value ? (
                      formatDate(invoice.analysis.date.value)
                    ) : (
                      <span className="text-muted-foreground italic">
                        Not available
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Amount:
                  </span>
                  <p className="mt-1 text-sm font-medium text-green-700">
                    {invoice.analysis.amount.value ? (
                      invoice.analysis.amount.value.replace("|", " ")
                    ) : (
                      <span className="text-muted-foreground italic">
                        Not available
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {invoice.parsing.parsedText.value && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Classic Parsed Text:
                  </span>
                  <div className="mt-2 p-3 bg-blue-50 rounded-md max-h-40 overflow-y-auto">
                    <p className="text-xs whitespace-pre-wrap">
                      {invoice.parsing.parsedText.value}
                    </p>
                  </div>
                </div>
              )}

              {invoice.analysis.parsedText.value && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    AI Parsed Text:
                  </span>
                  <div className="mt-2 p-3 bg-gray-50 rounded-md max-h-40 overflow-y-auto">
                    <p className="text-xs whitespace-pre-wrap">
                      {invoice.analysis.parsedText.value}
                    </p>
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
              variant="secondary"
              onClick={handleDownload}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download
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
