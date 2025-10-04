import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "./components/ui/button";
import { InvoiceDetailsModal } from "./components/InvoiceDetailsModal";
import { StatementsSection } from "./components/StatementsSection";
import { InvoiceList } from "./components/InvoiceList";

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
  const deleteIncomingInvoice = useMutation(api.invoices.deleteIncomingInvoice);

  const [uploadingInvoices, setUploadingInvoices] = useState<UploadingInvoice[]>([]);
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



  if (!monthData) {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={goToPreviousMonth}
        >
          ← Previous
        </Button>
        <h1 className="text-base font-semibold text-primary tracking-tight">
          {formatMonthDisplay(currentMonth)}
        </h1>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={goToNextMonth}
        >
          Next →
        </Button>
      </div>

      <StatementsSection
        monthKey={currentMonth}
        statements={monthData.statements}
        generateUploadUrl={generateUploadUrl}
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
      />

      {/* Invoice Details Modal */}
      <InvoiceDetailsModal
        invoice={selectedInvoice}
        isOpen={isModalOpen}
        onClose={closeInvoiceModal}
        onDelete={handleDeleteInvoice}
      />
    </div>
  );
}
