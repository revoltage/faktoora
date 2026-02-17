import { useState } from "react";
import { toast } from "sonner";
import { Download, ExternalLink, Edit } from "lucide-react";

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
  onDelete: (invoice: any) => Promise<void>;
  onUpdateName: (invoice: any, name: string) => Promise<void>;
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

  const getStatusBadge = (section: any, field: string) => {
    const fieldData = section?.[field];
    if (!fieldData) {
      return (
        <Badge variant="outline" className="text-xs">
          N/A
        </Badge>
      );
    }
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

  const formatAmount = (value: unknown) => {
    if (!value) return null;
    const s = String(value).replace("|", " ").trim();
    return s;
  };

  const Field = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div>
      <span className="text-sm font-medium text-muted-foreground">
        {label}:
      </span>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );

  const handleSaveName = async () => {
    try {
      await onUpdateName(invoice, editedName);
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

  const handleDownload = async () => {
    if (!invoice.url) {
      toast.error("❌ File URL not available");
      return;
    }

    try {
      const response = await fetch(invoice.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = invoice.fileName || "invoice.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(blobUrl);
      toast.success("⬇️ Download started");
    } catch (error) {
      toast.error("❌ Failed to download file");
      console.error("Download error:", error);
    }
  };

  const handleView = () => {
    if (!invoice.url) {
      toast.error("❌ File URL not available");
      return;
    }

    window.open(invoice.url, "_blank");
  };

  const handleEditInSejda = () => {
    if (!invoice.url) {
      toast.error("❌ File URL not available");
      return;
    }

    const filesParam = JSON.stringify([{ downloadUrl: invoice.url }]);
    const encodedParam = encodeURIComponent(filesParam);
    const sejdaUrl = `https://www.sejda.com/pdf-editor?files=${encodedParam}`;

    window.open(sejdaUrl, "_blank");
    toast.success("📝 Opening in Sejda editor");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[82vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>📄</span>
            <span className="font-semibold">Invoice Details</span>
            <Badge variant="outline" className="text-xs">
              {invoice.fileName}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  📁 File Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="File Name">
                    <p className="break-all">{invoice.fileName}</p>
                  </Field>
                  <Field label="Uploaded">
                    <p>{formatDate(invoice.uploadedAt)}</p>
                  </Field>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  🔍 Analysis Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {
                      label: "Classic Parsing",
                      section: invoice.parsing,
                      field: "parsedText",
                    },
                    {
                      label: "AI Text Parsing",
                      section: invoice.analysis,
                      field: "parsedText",
                    },
                    {
                      label: "Sender",
                      section: invoice.analysis,
                      field: "sender",
                    },
                    { label: "Date", section: invoice.analysis, field: "date" },
                    {
                      label: "Amount",
                      section: invoice.analysis,
                      field: "amount",
                    },
                  ].map((item) => (
                    <div key={item.label} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {item.label}
                        </span>
                        {getStatusBadge(item.section, item.field)}
                      </div>
                      {item.section?.[item.field]?.error && (
                        <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          {item.section[item.field].error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {invoice.analysis?.analysisBigError && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
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
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                📋 Extracted Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Name:
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
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

                <Field label="Sender">
                  {invoice.analysis?.sender?.value || (
                    <span className="text-muted-foreground italic">
                      Not available
                    </span>
                  )}
                </Field>

                <Field label="Date">
                  {invoice.analysis?.date?.value ? (
                    formatDate(invoice.analysis.date.value)
                  ) : (
                    <span className="text-muted-foreground italic">
                      Not available
                    </span>
                  )}
                </Field>

                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Amount:
                  </span>
                  <p className="mt-1 text-sm font-medium text-green-700">
                    {formatAmount(invoice.analysis?.amount?.value) || (
                      <span className="text-muted-foreground italic">
                        Not available
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {invoice.parsing?.parsedText?.value && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Classic Parsed Text
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-blue-50 rounded-md max-h-56 overflow-y-auto">
                    <p className="text-xs whitespace-pre-wrap">
                      {invoice.parsing.parsedText.value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {invoice.analysis?.parsedText?.value && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    AI Parsed Text
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-gray-50 rounded-md max-h-56 overflow-y-auto">
                    <p className="text-xs whitespace-pre-wrap">
                      {invoice.analysis.parsedText.value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button variant="default" onClick={handleView} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              View
            </Button>
            <Button
              variant="default"
              onClick={handleEditInSejda}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="default"
              onClick={() => void handleDownload()}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void onDelete(invoice);
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
