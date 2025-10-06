import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Header } from "../components/Header";
import { InvoiceDetailsModal } from "../components/InvoiceDetailsModal";
import { InvoiceList } from "../components/InvoiceList";
import { StatementsSection } from "../components/StatementsSection";
import { EmailDraft } from "../components/EmailDraft";
import { Button } from "../components/ui/button";
import { useFeatureFlagsDebugSetter } from "../hooks/useFeatureFlags";

interface UploadingInvoice {
  fileName: string;
  uploadId: string;
}

export function InvoiceManagerPage() {
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        center={
          <div className="flex w-full max-w-xs sm:max-w-sm items-center justify-center gap-1 sm:gap-2 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] sm:px-3"
              onClick={goToPreviousMonth}
              aria-label="Go to previous month"
            >
              ← Prev
            </Button>
            <span className="block text-sm font-medium truncate text-center">
              {formatMonthDisplay(currentMonth)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] sm:px-3"
              onClick={goToNextMonth}
              aria-label="Go to next month"
            >
              Next →
            </Button>
          </div>
        }
      />

      <main className="flex-1 w-full px-2 pb-6 pt-4 sm:px-4 max-w-3xl mx-auto">
        <InvoiceManagerPageContent currentMonth={currentMonth} />
      </main>
    </div>
  );
}

export function InvoiceManagerPageContent({
  currentMonth,
}: {
  currentMonth: string;
}) {
  const monthData = useQuery(api.invoices.getMonthData, {
    monthKey: currentMonth,
  });
  const generateUploadUrl = useMutation(api.invoices.generateUploadUrl);
  const addIncomingInvoice = useMutation(api.invoices.addIncomingInvoice);
  const deleteIncomingInvoice = useMutation(api.invoices.deleteIncomingInvoice);
  const updateInvoiceName = useMutation(api.invoices.updateInvoiceName);
  const deleteAllStatements = useMutation(api.invoices.deleteAllStatements);
  const deleteAllInvoices = useMutation(api.invoices.deleteAllInvoices);

  // Feature flags
  useFeatureFlagsDebugSetter();

  const [uploadingInvoices, setUploadingInvoices] = useState<
    UploadingInvoice[]
  >([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openInvoiceModal = (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsModalOpen(true);
  };

  const closeInvoiceModal = () => {
    setIsModalOpen(false);
    setSelectedInvoice(null);
  };

  const handleDeleteInvoice = async (storageId: any) => {
    try {
      await deleteIncomingInvoice({
        monthKey: currentMonth,
        storageId,
      });
      closeInvoiceModal();
      toast.success("🗑️ Invoice deleted successfully");
    } catch {
      toast.error("Failed to delete invoice");
    }
  };

  const handleUpdateInvoiceName = async (storageId: any, name: string) => {
    try {
      await updateInvoiceName({
        monthKey: currentMonth,
        storageId,
        name,
      });
    } catch {
      toast.error("Failed to update invoice name");
      throw new Error("Failed to update invoice name");
    }
  };


  if (!monthData) {
    return (
      <div className="flex justify-center items-center mt-16">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 sm:space-y-4">
      <EmailDraft
        invoices={monthData.incomingInvoices}
        statements={monthData.statements}
        monthKey={currentMonth}
        uploadingInvoices={uploadingInvoices}
        />

        <StatementsSection
          monthKey={currentMonth}
          statements={monthData.statements}
          generateUploadUrl={generateUploadUrl}
          deleteAllStatements={deleteAllStatements}
        />

      <InvoiceList
        monthKey={currentMonth}
        incomingInvoices={monthData.incomingInvoices}
        uploadingInvoices={uploadingInvoices}
        generateUploadUrl={generateUploadUrl}
        addIncomingInvoice={addIncomingInvoice}
        deleteIncomingInvoice={deleteIncomingInvoice}
        onInvoiceClick={openInvoiceModal}
        onUploadingStateChange={setUploadingInvoices}
        deleteAllInvoices={deleteAllInvoices}
      />
      {/* Invoice Details Modal */}
      <InvoiceDetailsModal
        invoice={selectedInvoice}
        isOpen={isModalOpen}
        onClose={closeInvoiceModal}
        onDelete={handleDeleteInvoice}
        onUpdateName={handleUpdateInvoiceName}
        monthKey={currentMonth}
      />
    </div>
  );
}
