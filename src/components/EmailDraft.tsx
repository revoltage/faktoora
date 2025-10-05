import { Copy, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "./ui/separator";

interface EmailDraftProps {
  invoices: any[];
  statements: any[];
  monthKey: string;
  uploadingInvoices?: { fileName: string; uploadId: string }[];
}

export const EmailDraft = ({
  invoices,
  statements,
  monthKey,
  uploadingInvoices = [],
}: EmailDraftProps) => {
  // Check if there are PDF statements or invoices
  const hasPdfStatements = statements.some((stmt) => stmt.fileType === "pdf");
  const hasInvoices = invoices.length > 0;

  // Only render if there are PDF statements or invoices
  if (!hasPdfStatements && !hasInvoices) {
    return null;
  }

  // Create email draft content
  const emailContent = createEmailDraft(invoices, statements, monthKey);
  const emailSubject = createEmailSubject(invoices, statements, monthKey);

  if (!emailContent) {
    return null;
  }

  const handleCopyToClipboard = () => {
    navigator.clipboard
      .writeText(emailContent)
      .then(() => {
        toast.success("📋 Email draft copied to clipboard");
      })
      .catch(() => {
        toast.error("Failed to copy email draft");
      });
  };

  const handleCopySubject = () => {
    navigator.clipboard
      .writeText(emailSubject)
      .then(() => {
        toast.success("📋 Email subject copied to clipboard");
      })
      .catch(() => {
        toast.error("Failed to copy email subject");
      });
  };

  const renderUploadingInvoices = () => {
    // renders • ${uploadingInvoice.fileName} (uploading...)\n for each uploading invoice
    return uploadingInvoices.map((uploadingInvoice) => (
      <div
        key={uploadingInvoice.uploadId}
        className="text-muted-foreground italic animate-pulse"
      >
        • — Uploading {uploadingInvoice.fileName} —
      </div>
    ));
  };

  return (
    <Card className="mb-3 border border-gray-200 shadow-sm">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm font-semibold tracking-tight flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Draft
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-2 text-[10px] gap-1"
            onClick={handleCopyToClipboard}
          >
            <Copy className="!h-2 !w-2" />
            Copy
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <Separator className="mb-2" />

        {/* Email Subject */}
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-700 mb-1">Subject:</div>
          <div 
            className="text-[10px] text-muted-foreground font-[Arial, sans-serif] font-normal cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors border border-gray-200"
            onClick={handleCopySubject}
            title="Click to copy email subject"
          >
            {emailSubject}
          </div>
        </div>

        {/* Email Body */}
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">Body:</div>
          <pre 
            className="whitespace-pre-wrap text-[10px] text-muted-foreground font-[Arial, sans-serif] font-normal cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors"
            onClick={handleCopyToClipboard}
            title="Click to copy email draft"
          >
            {emailContent}
            {renderUploadingInvoices()}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
};

// Import the utility function
function createEmailDraft(
  invoices: any[],
  statements: any[],
  monthKey: string
) {
  if (invoices.length === 0 && statements.length === 0) {
    return null;
  }

  // Parse month from monthKey (format: "YYYY-MM")
  const [year, month] = monthKey.split("-");

  // Use Bulgarian locale for month name
  const monthNames = [
    "януари",
    "февруари",
    "март",
    "април",
    "май",
    "юни",
    "юли",
    "август",
    "септември",
    "октомври",
    "ноември",
    "декември",
  ];

  const monthName = monthNames[parseInt(month) - 1];
  const yearStr = year;

  // Check for PDF statements specifically
  const hasPdfStatements = statements.some((stmt) => stmt.fileType === "pdf");
  const hasInvoices = invoices.length > 0;

  // Build the email content
  let emailContent = "Здравей,\n\n";

  if (hasPdfStatements && hasInvoices) {
    emailContent += `Изпращам ти извлеченията от Revolut и фактурите за месец ${monthName} ${yearStr}:\n\n`;
  } else if (hasPdfStatements) {
    emailContent += `Изпращам ти извлеченията от Revolut за месец ${monthName} ${yearStr}:\n\n`;
  } else {
    emailContent += `Изпращам ти фактурите за месец ${monthName} ${yearStr}:\n\n`;
  }

  // Add invoices list
  if (hasInvoices) {
    // Sort invoices by uploadedAt (oldest first)
    const sortedInvoices = [...invoices].sort((a, b) => 
      new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
    );
    
    sortedInvoices.forEach((invoice) => {
      // Priority: invoice name -> sender -> filename
      const displayName =
        invoice.name || invoice.analysis?.sender?.value || invoice.fileName;
      emailContent += `• ${displayName}\n`;
    });
  }

  return emailContent;
}

// Function to create email subject
function createEmailSubject(
  invoices: any[],
  statements: any[],
  monthKey: string
) {
  if (invoices.length === 0 && statements.length === 0) {
    return "";
  }

  // Parse month from monthKey (format: "YYYY-MM")
  const [year, month] = monthKey.split("-");

  // Use Bulgarian locale for month name
  const monthNames = [
    "януари",
    "февруари", 
    "март",
    "април",
    "май",
    "юни",
    "юли",
    "август",
    "септември",
    "октомври",
    "ноември",
    "декември",
  ];

  const monthName = monthNames[parseInt(month) - 1];
  const yearStr = year;

  // Check for PDF statements and invoices
  const hasPdfStatements = statements.some((stmt) => stmt.fileType === "pdf");
  const hasInvoices = invoices.length > 0;

  // Build the subject based on what's available
  if (hasPdfStatements && hasInvoices) {
    return `Извлечения от Револют и фактури за месец ${monthName} ${yearStr}`;
  } else if (hasPdfStatements) {
    return `Извлечения от Револют за месец ${monthName} ${yearStr}`;
  } else {
    return `Фактури за месец ${monthName} ${yearStr}`;
  }
}
