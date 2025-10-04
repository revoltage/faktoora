import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Copy, Mail } from "lucide-react";
import { toast } from "sonner";

interface EmailDraftProps {
  invoices: any[];
  statements: any[];
  monthKey: string;
}

export const EmailDraft = ({ invoices, statements, monthKey }: EmailDraftProps) => {
  // Check if there are PDF statements or invoices
  const hasPdfStatements = statements.some(stmt => stmt.fileType === 'pdf');
  const hasInvoices = invoices.length > 0;

  // Only render if there are PDF statements or invoices
  if (!hasPdfStatements && !hasInvoices) {
    return null;
  }

  // Create email draft content
  const emailContent = createEmailDraft(invoices, statements, monthKey);

  if (!emailContent) {
    return null;
  }

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(emailContent)
      .then(() => {
        toast.success("📋 Email draft copied to clipboard");
      })
      .catch(() => {
        toast.error("Failed to copy email draft");
      });
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
            variant="outline"
            size="sm"
            className="h-5 px-2 text-[10px] shadow-none"
            onClick={handleCopyToClipboard}
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <pre className="whitespace-pre-wrap text-xs text-muted-foreground bg-gray-50 p-3 rounded border font-mono">
          {emailContent}
        </pre>
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
  const [year, month] = monthKey.split('-');
  
  // Use Bulgarian locale for month name
  const monthNames = [
    'януари', 'февруари', 'март', 'април', 'май', 'юни',
    'юли', 'август', 'септември', 'октомври', 'ноември', 'декември'
  ];
  
  const monthName = monthNames[parseInt(month) - 1];
  const yearStr = year;

  // Check for PDF statements specifically
  const hasPdfStatements = statements.some(stmt => stmt.fileType === 'pdf');
  const hasInvoices = invoices.length > 0;

  // Build the email content
  let emailContent = 'Здравей,\n\n';
  
  if (hasPdfStatements && hasInvoices) {
    emailContent += `Изпращам ти извлеченията от Revolut и фактурите за месец ${monthName} ${yearStr}:\n\n`;
  } else if (hasPdfStatements) {
    emailContent += `Изпращам ти извлеченията от Revolut за месец ${monthName} ${yearStr}:\n\n`;
  } else {
    emailContent += `Изпращам ти фактурите за месец ${monthName} ${yearStr}:\n\n`;
  }

  // Add invoices list
  if (hasInvoices) {
    invoices.forEach(invoice => {
      // Priority: invoice name -> sender -> filename
      const displayName = invoice.name || 
                         invoice.analysis?.sender?.value || 
                         invoice.fileName;
      emailContent += `• ${displayName}\n`;
    });
    emailContent += '\n';
  }


  return emailContent;
}
