import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";

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
  onClose: () => void;
}

const AI_MODELS = {
  claude: "Claude Sonnet 4.5",
  openai: "GPT-5 Mini",
  kimi: "Kimi K2",
  gptoss: "GPT-OSS 120B",
  llama3: "Llama 4 Maverick",
  gemini: "Gemini 2.5 Flash",
} as const;

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [vatId, setVatId] = useState("");
  const [accEmail, setAccEmail] = useState("");
  const [aiModel, setAiModel] = useState<keyof typeof AI_MODELS>("gemini");
  const [manualTransactions, setManualTransactions] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const userSettings = useQuery(api.userSettings.getUserSettings);
  const updateUserSettings = useMutation(api.userSettings.updateUserSettings);

  useEffect(() => {
    if (userSettings) {
      setVatId(userSettings.vatId || "");
      setAccEmail(userSettings.accEmail || "");
      setAiModel((userSettings.aiModel as keyof typeof AI_MODELS) || "gemini");
      setManualTransactions(userSettings.manualTransactions || "");
    }
  }, [userSettings]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await updateUserSettings({
        vatId: vatId.trim() || undefined,
        aiModel: aiModel,
        accEmail: accEmail.trim() || undefined,
        manualTransactions: manualTransactions.trim() || undefined,
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
    // Reset to original values
    if (userSettings) {
      setVatId(userSettings.vatId || "");
      setAccEmail(userSettings.accEmail || "");
      setAiModel((userSettings.aiModel as keyof typeof AI_MODELS) || "gemini");
      setManualTransactions(userSettings.manualTransactions || "");
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>⚙️ Settings</DialogTitle>
          <DialogDescription>
            Manage your account settings and preferences.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
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
            <Select value={aiModel} onValueChange={(value: keyof typeof AI_MODELS) => setAiModel(value)}>
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
            <Label htmlFor="manualTransactions" className="text-right pt-2">
              Manual Transactions
            </Label>
            <div className="col-span-3">
              <Textarea
                id="manualTransactions"
                value={manualTransactions}
                onChange={(e) => setManualTransactions(e.target.value)}
                placeholder="Name, Amount&#10;Name, Amount&#10;Name"
                className="min-h-[100px] text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                One per line: name, amount (optional)
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
