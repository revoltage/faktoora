import { Copy, Mail, Download } from "lucide-react";
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
  // Create email draft content and subject
  const { emailContent, emailSubject } = createEmailContent(invoices, statements, monthKey);

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

  const handleDownloadAll = async () => {
    const filesToDownload = [
      ...statements.filter(s => s.url),
      ...invoices.filter(i => i.url)
    ];

    if (filesToDownload.length === 0) {
      toast.error("❌ No files available to download");
      return;
    }

    try {
      // Check for File System Access API support
      if (!('showDirectoryPicker' in window)) {
        toast.error("❌ Modern file access not supported in this browser");
        return;
      }

      // Parse month info from monthKey
      const [year, month] = monthKey.split("-");
      const folderName = `Outgoing Docs - ${year}-${month}`;

      toast.info(`📂 Choose a parent folder...`);

      // Request directory access
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });

      // Get or create the subfolder
      let subfolderHandle = await dirHandle.getDirectoryHandle(folderName, { create: true });

      toast.info(`📥 Downloading ${filesToDownload.length} files...`);
      
      // Download all files to the subfolder
      for (const file of filesToDownload) {
        try {
          const response = await fetch(file.url);
          const blob = await response.blob();
          
          // Create a file in the subfolder
          const fileHandle = await subfolderHandle.getFileHandle(file.fileName || "file.pdf", { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (error) {
          console.error(`Failed to download ${file.fileName}:`, error);
        }
      }
      
      toast.success(`✅ All files saved to "${folderName}"`);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast.info("💭 Download cancelled");
      } else {
        toast.error("❌ Failed to download all files");
        console.error("Download all error:", error);
      }
    }
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
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm font-semibold tracking-tight flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">Email Draft</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5"
            onClick={() => void handleDownloadAll()}
          >
            <Download className="h-3 w-3" />
            Download All
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">

        {/* Email Subject */}
        <div className="mb-1">
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
          <pre 
            className="whitespace-pre-wrap text-[10px] text-muted-foreground font-[Arial, sans-serif] font-normal cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors border border-gray-200"
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

// Utility function to create both email content and subject
function createEmailContent(
  invoices: any[],
  statements: any[],
  monthKey: string
) {
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

  // Create subject based on what's available
  let emailSubject = "";
  if (hasPdfStatements && hasInvoices) {
    emailSubject = `Извлечения от Револют и фактури за месец ${monthName} ${yearStr}`;
  } else if (hasPdfStatements) {
    emailSubject = `Извлечения от Револют за месец ${monthName} ${yearStr}`;
  } else {
    emailSubject = `Фактури за месец ${monthName} ${yearStr}`;
  }

  if (!hasInvoices && !hasPdfStatements) {
    const emailContent = `Здравей,\n\nЩе ти изпратя извлеченията от Револют и фактурите за месец ${monthName} по-късно днес`;
    return { emailContent, emailSubject };
  }

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

  return { emailContent, emailSubject };
}
