import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { TransactionList } from "../TransactionList";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";

interface StatementsSectionProps {
  monthKey: string;
  statements: any[];
  generateUploadUrl: any;
}

export const StatementsSection = ({
  monthKey,
  statements,
  generateUploadUrl,
}: StatementsSectionProps) => {
  const addStatement = useMutation(api.invoices.addStatement);
  const deleteStatement = useMutation(api.invoices.deleteStatement);
  const statementInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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
          monthKey,
          storageId,
          fileName: file.name,
          fileType,
          csvContent,
        });
        toast.success(`📊 Processed CSV: ${file.name}`);
      } else {
        await addStatement({
          monthKey,
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
        void handleUploadStatement(file, "pdf");
      } else if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        void handleUploadStatement(file, "csv");
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

  return (
    <Card
      className={`mb-3 border border-gray-200 shadow-sm transition-colors ${
        isDragging ? "border-blue-500 bg-blue-50" : ""
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm font-semibold tracking-tight flex items-center justify-between">
          Monthly Statements
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-5 px-2 text-[10px]"
              onClick={() => statementInputRef.current?.click()}
            >
              Upload PDF
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-5 px-2 text-[10px] bg-green-600 hover:bg-green-700"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".csv";
                input.multiple = true;
                input.onchange = (e) => {
                  const files = Array.from(
                    (e.target as HTMLInputElement).files || []
                  );
                  for (const file of files) {
                    void handleUploadStatement(file, "csv");
                  }
                };
                input.click();
              }}
            >
              Upload CSV(s)
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent
        className={`p-3 pt-0 transition-opacity ${isDragging ? "opacity-50" : ""}`}
      >
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
        {statements.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No statements uploaded yet
          </p>
        ) : (
          <div className="space-y-0">
            {statements.map((statement) => (
              <div
                key={statement.storageId}
                className="flex items-center justify-between py-0.5 border-t border-gray-100"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Badge className="uppercase text-[7px] bg-gray-200 text-gray-600 border-gray-200 px-1 py-0">
                    {statement.fileType}
                  </Badge>
                  <a
                    href={statement.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline truncate text-[9px]"
                  >
                    {statement.fileName}
                  </a>
                  <span className="text-[8px] text-muted-foreground whitespace-nowrap">
                    {new Date(statement.uploadedAt).toISOString().split("T")[0]}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[8px] text-red-600 hover:text-red-700"
                  onClick={() => {
                    void deleteStatement({
                      monthKey,
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

        {statements.length > 0 && (
          <div>
            <Separator className="mt-1 mb-2" />
            <TransactionList monthKey={monthKey} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
