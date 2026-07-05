import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface SettingsModalProps {
  isOpen: boolean;
  currentMonth: string;
  onClose: () => void;
}

type ManualTransactionFormRow = {
  localId: string;
  id?: Id<"manualTransactions">;
  monthKey: string;
  name: string;
  amount: string;
  currency: string;
  recurring: boolean;
};

const AI_MODELS = {
  claude: "Claude Sonnet 4.5",
  openai: "GPT-5 Mini",
  kimi: "Kimi K2",
  gptoss: "GPT-OSS 120B",
  llama3: "Llama 4 Maverick",
  gemini: "Gemini 3.5 Flash",
} as const;

function createManualTransactionRow(
  currentMonth: string,
  recurring = false,
): ManualTransactionFormRow {
  return {
    localId: crypto.randomUUID(),
    monthKey: recurring ? "" : currentMonth,
    name: "",
    amount: "",
    currency: "EUR",
    recurring,
  };
}

export function SettingsModal({
  isOpen,
  currentMonth,
  onClose,
}: SettingsModalProps) {
  const [vatId, setVatId] = useState("");
  const [accEmail, setAccEmail] = useState("");
  const [aiModel, setAiModel] = useState<keyof typeof AI_MODELS>("gemini");
  const [manualTransactions, setManualTransactions] = useState<
    ManualTransactionFormRow[]
  >([]);
  const [invoiceHelperLinks, setInvoiceHelperLinks] = useState("");
  const [currencyRates, setCurrencyRates] = useState("");
  const [currencyRateDate, setCurrencyRateDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const userSettings = useQuery(api.userSettings.getUserSettings);
  const savedManualTransactions = useQuery(
    api.manualTransactions.listManualTransactions,
  );
  const updateUserSettings = useMutation(api.userSettings.updateUserSettings);
  const replaceManualTransactions = useMutation(
    api.manualTransactions.replaceManualTransactions,
  );

  useEffect(() => {
    if (userSettings) {
      setVatId(userSettings.vatId || "");
      setAccEmail(userSettings.accEmail || "");
      setAiModel((userSettings.aiModel as keyof typeof AI_MODELS) || "gemini");
      setInvoiceHelperLinks(
        "invoiceHelperLinks" in userSettings &&
          typeof userSettings.invoiceHelperLinks === "string"
          ? userSettings.invoiceHelperLinks
          : "",
      );
      setCurrencyRates(
        "currencyRates" in userSettings &&
          typeof userSettings.currencyRates === "string"
          ? userSettings.currencyRates
          : "",
      );
      setCurrencyRateDate(
        "currencyRateDate" in userSettings &&
          typeof userSettings.currencyRateDate === "string"
          ? userSettings.currencyRateDate
          : "",
      );
    }
  }, [userSettings]);

  useEffect(() => {
    if (!savedManualTransactions) {
      return;
    }

    setManualTransactions(
      savedManualTransactions.map((transaction) => ({
        localId: transaction._id,
        id: transaction._id,
        monthKey: transaction.monthKey || currentMonth,
        name: transaction.name,
        amount: transaction.amount,
        currency: transaction.currency || "EUR",
        recurring: transaction.recurring,
      })),
    );
  }, [currentMonth, savedManualTransactions]);

  const addManualTransaction = (recurring: boolean) => {
    setManualTransactions((rows) => [
      ...rows,
      createManualTransactionRow(currentMonth, recurring),
    ]);
  };

  const updateManualTransaction = (
    localId: string,
    patch: Partial<ManualTransactionFormRow>,
  ) => {
    setManualTransactions((rows) =>
      rows.map((row) =>
        row.localId === localId
          ? {
              ...row,
              ...patch,
              monthKey:
                patch.recurring === true
                  ? ""
                  : (patch.monthKey ?? row.monthKey),
            }
          : row,
      ),
    );
  };

  const removeManualTransaction = (localId: string) => {
    setManualTransactions((rows) =>
      rows.filter((row) => row.localId !== localId),
    );
  };

  const resetManualTransactions = () => {
    setManualTransactions(
      (savedManualTransactions ?? []).map((transaction) => ({
        localId: transaction._id,
        id: transaction._id,
        monthKey: transaction.monthKey || currentMonth,
        name: transaction.name,
        amount: transaction.amount,
        currency: transaction.currency || "EUR",
        recurring: transaction.recurring,
      })),
    );
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await updateUserSettings({
        vatId: vatId.trim() || undefined,
        aiModel: aiModel,
        accEmail: accEmail.trim() || undefined,
        invoiceHelperLinks: invoiceHelperLinks.trim() || undefined,
        currencyRates: currencyRates.trim() || undefined,
        currencyRateDate: currencyRateDate.trim() || undefined,
      });
      await replaceManualTransactions({
        transactions: manualTransactions
          .filter((transaction) => transaction.name.trim())
          .map((transaction) => ({
            id: transaction.id,
            monthKey: transaction.recurring
              ? undefined
              : transaction.monthKey.trim() || currentMonth,
            name: transaction.name.trim(),
            amount: transaction.amount.trim(),
            currency: transaction.currency.trim() || undefined,
            recurring: transaction.recurring,
          })),
      });
      toast.success("⚙️ Settings saved successfully");
      onClose();
    } catch (error) {
      console.error("🔧 Settings save error:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (userSettings) {
      setVatId(userSettings.vatId || "");
      setAccEmail(userSettings.accEmail || "");
      setAiModel((userSettings.aiModel as keyof typeof AI_MODELS) || "gemini");
      setInvoiceHelperLinks(
        "invoiceHelperLinks" in userSettings &&
          typeof userSettings.invoiceHelperLinks === "string"
          ? userSettings.invoiceHelperLinks
          : "",
      );
      setCurrencyRates(
        "currencyRates" in userSettings &&
          typeof userSettings.currencyRates === "string"
          ? userSettings.currencyRates
          : "",
      );
      setCurrencyRateDate(
        "currencyRateDate" in userSettings &&
          typeof userSettings.currencyRateDate === "string"
          ? userSettings.currencyRateDate
          : "",
      );
    }
    resetManualTransactions();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>⚙️ Settings</DialogTitle>
          <DialogDescription>
            Manage your account settings and preferences.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-4 overflow-y-auto py-4 pr-1">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="vatId" className="text-right">
              VAT ID
            </Label>
            <Input
              id="vatId"
              value={vatId}
              onChange={(e) => setVatId(e.target.value)}
              className="col-span-3"
              placeholder="Enter your VAT ID"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="accEmail" className="text-right">
              Account Email
            </Label>
            <Input
              id="accEmail"
              value={accEmail}
              onChange={(e) => setAccEmail(e.target.value)}
              className="col-span-3"
              placeholder="Email for Gmail compose"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="aiModel" className="text-right">
              AI Model
            </Label>
            <Select
              value={aiModel}
              onValueChange={(value: keyof typeof AI_MODELS) =>
                setAiModel(value)
              }
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select AI model" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AI_MODELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="currencyRates" className="pt-2 text-right">
              Currency Rates
            </Label>
            <div className="col-span-3 space-y-2">
              <Textarea
                id="currencyRates"
                value={currencyRates}
                onChange={(e) => setCurrencyRates(e.target.value)}
                placeholder={"USD=1.18\\nBGN=1.9558"}
                className="min-h-[72px] text-xs font-mono"
              />
              <Input
                value={currencyRateDate}
                onChange={(e) => setCurrencyRateDate(e.target.value)}
                placeholder="Rate date, e.g. 2026-02-01"
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Units per 1 EUR. EUR is always fixed at 1.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="pt-2 text-right">Manual Transactions</Label>
            <div className="col-span-3 space-y-2">
              {manualTransactions.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  No manual transactions yet.
                </p>
              ) : (
                manualTransactions.map((transaction) => (
                  <div
                    key={transaction.localId}
                    className="grid grid-cols-12 items-center gap-2 rounded-md border p-2"
                  >
                    <Input
                      value={transaction.name}
                      onChange={(e) =>
                        updateManualTransaction(transaction.localId, {
                          name: e.target.value,
                        })
                      }
                      className="col-span-4 h-8 text-xs"
                      placeholder="Name"
                    />
                    <Input
                      value={transaction.amount}
                      onChange={(e) =>
                        updateManualTransaction(transaction.localId, {
                          amount: e.target.value,
                        })
                      }
                      className="col-span-2 h-8 text-xs"
                      placeholder="Amount"
                    />
                    <Input
                      value={transaction.currency}
                      onChange={(e) =>
                        updateManualTransaction(transaction.localId, {
                          currency: e.target.value,
                        })
                      }
                      className="col-span-2 h-8 text-xs uppercase"
                      placeholder="EUR"
                    />
                    <Input
                      value={
                        transaction.recurring
                          ? "Recurring"
                          : transaction.monthKey
                      }
                      onChange={(e) =>
                        updateManualTransaction(transaction.localId, {
                          monthKey: e.target.value,
                        })
                      }
                      className="col-span-2 h-8 text-xs"
                      disabled={transaction.recurring}
                      placeholder={currentMonth}
                    />
                    <Button
                      type="button"
                      variant={transaction.recurring ? "secondary" : "outline"}
                      size="sm"
                      className="col-span-1 h-8 px-2 text-[10px]"
                      onClick={() =>
                        updateManualTransaction(transaction.localId, {
                          recurring: !transaction.recurring,
                        })
                      }
                    >
                      {transaction.recurring ? "All" : "Month"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="col-span-1 h-8 px-2 text-[10px]"
                      onClick={() =>
                        removeManualTransaction(transaction.localId)
                      }
                    >
                      Delete
                    </Button>
                  </div>
                ))
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addManualTransaction(false)}
                >
                  Add for {currentMonth}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addManualTransaction(true)}
                >
                  Add recurring
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Rows keep stable IDs, so invoice bindings survive edits.
                Recurring rows appear in every month.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="invoiceHelperLinks" className="pt-2 text-right">
              Helper Links
            </Label>
            <div className="col-span-3">
              <Textarea
                id="invoiceHelperLinks"
                value={invoiceHelperLinks}
                onChange={(e) => setInvoiceHelperLinks(e.target.value)}
                placeholder="keyword, alias | link-template-with-{query}"
                className="min-h-[90px] text-xs font-mono"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                One rule per line. Put comma-separated keywords before | and
                link templates after it.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
