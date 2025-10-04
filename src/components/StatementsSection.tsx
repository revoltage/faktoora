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

export const StatementsSection = ({ monthKey, statements, generateUploadUrl }: StatementsSectionProps) => {
  const addStatement = useMutation(api.invoices.addStatement);
  const deleteStatement = useMutation(api.invoices.deleteStatement);
  const statementInputRef = useRef<HTMLInputElement>(null);

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

  return (
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
        {statements.length === 0 ? (
          <p className="text-xs text-muted-foreground">No statements uploaded yet</p>
        ) : (
          <div className="space-y-1.5">
            {statements.map((statement) => (
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

        <Separator className="my-3" />

        <div>
          <TransactionList monthKey={monthKey} />
        </div>
      </CardContent>
    </Card>
  );
};
