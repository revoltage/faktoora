import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "./components/ui/button";
import { Header } from "./components/Header";
import { InvoiceDetailsModal } from "./components/InvoiceDetailsModal";
import { StatementsSection } from "./components/StatementsSection";
import { InvoiceList } from "./components/InvoiceList";
import { SignOutButton } from "./SignOutButton";

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

  const monthData = useQuery(api.invoices.getMonthData, {
    monthKey: currentMonth,
  });
  const generateUploadUrl = useMutation(api.invoices.generateUploadUrl);
  const addIncomingInvoice = useMutation(api.invoices.addIncomingInvoice);
  const deleteIncomingInvoice = useMutation(api.invoices.deleteIncomingInvoice);
  const updateInvoiceName = useMutation(api.invoices.updateInvoiceName);

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
    <div className="">
      <Header
        left={
          <h2 className="text-sm font-semibold text-primary tracking-tight">
            Invoice Manager
          </h2>
        }
        center={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={goToPreviousMonth}
            >
              ← Prev
            </Button>
            <span className="text-sm font-medium text-primary">
              {formatMonthDisplay(currentMonth)}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={goToNextMonth}
            >
              Next →
            </Button>
          </div>
        }
        right={<SignOutButton />}
      />

      <main className="flex-1 p-4 max-w-3xl mx-auto">
        <div className="mt-4">
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
        </div>

        {/* Invoice Details Modal */}
        <InvoiceDetailsModal
          invoice={selectedInvoice}
          isOpen={isModalOpen}
          onClose={closeInvoiceModal}
          onDelete={handleDeleteInvoice}
          onUpdateName={handleUpdateInvoiceName}
          monthKey={currentMonth}
        />
      </main>
    </div>
  );
}
