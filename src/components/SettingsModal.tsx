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
  const [apiKeyLabel, setApiKeyLabel] = useState("");
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [isCreatingApiKey, setIsCreatingApiKey] = useState(false);
  const [revokingApiKeyId, setRevokingApiKeyId] = useState<string | null>(null);

  const userSettings = useQuery(api.userSettings.getUserSettings);
  const apiKeys = useQuery(api.apiKeys.listApiKeys);
  const updateUserSettings = useMutation(api.userSettings.updateUserSettings);
  const createApiKey = useMutation(api.apiKeys.createApiKey);
  const revokeApiKey = useMutation(api.apiKeys.revokeApiKey);

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

  const handleCreateApiKey = async () => {
    setIsCreatingApiKey(true);
    try {
      const result = await createApiKey({
        label: apiKeyLabel.trim() || undefined,
      });
      setNewApiKey(result.key);
      setApiKeyLabel("");
      toast.success(
        "API key created. Copy it now - it will not be shown again.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create API key";
      toast.error(message);
    } finally {
      setIsCreatingApiKey(false);
    }
  };

  const handleRevokeApiKey = async (apiKeyId: string) => {
    setRevokingApiKeyId(apiKeyId);
    try {
      await revokeApiKey({
        apiKeyId: apiKeyId as any,
      });
      toast.success("API key revoked");
    } catch {
      toast.error("Failed to revoke API key");
    } finally {
      setRevokingApiKeyId(null);
    }
  };

  const handleCopyApiKey = async () => {
    if (!newApiKey) {
      return;
    }

    try {
      await navigator.clipboard.writeText(newApiKey);
      toast.success("API key copied");
    } catch {
      toast.error("Failed to copy API key");
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) {
      return "Never";
    }
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px]">
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

          <div className="border-t pt-4 space-y-3">
            <div>
              <h3 className="text-sm font-medium">Headless API Keys</h3>
              <p className="text-[11px] text-muted-foreground">
                Use API keys for headless invoice and statement uploads.
              </p>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="apiKeyLabel" className="text-right">
                Key Label
              </Label>
              <div className="col-span-3 flex gap-2">
                <Input
                  id="apiKeyLabel"
                  value={apiKeyLabel}
                  onChange={(e) => setApiKeyLabel(e.target.value)}
                  placeholder="Server, Zapier, CI..."
                />
                <Button
                  type="button"
                  onClick={() => void handleCreateApiKey()}
                  disabled={isCreatingApiKey}
                >
                  {isCreatingApiKey ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>

            {newApiKey && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 space-y-2">
                <p className="text-xs font-medium text-amber-900">
                  Copy this key now. You will not be able to see it again.
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={newApiKey}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleCopyApiKey()}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(apiKeys || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No API keys yet.
                </p>
              ) : (
                (apiKeys || []).map((apiKey) => (
                  <div
                    key={apiKey._id}
                    className="border rounded-md p-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {apiKey.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {apiKey.keyPrefix}...
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Created: {formatDate(apiKey.createdAt)} | Last used:{" "}
                        {formatDate(apiKey.lastUsedAt)}
                      </p>
                    </div>
                    {apiKey.revokedAt ? (
                      <p className="text-[10px] text-muted-foreground">
                        Revoked
                      </p>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-7 text-[10px]"
                        disabled={revokingApiKeyId === apiKey._id}
                        onClick={() => void handleRevokeApiKey(apiKey._id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                ))
              )}
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
