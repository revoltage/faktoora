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

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [vatId, setVatId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const userSettings = useQuery(api.userSettings.getUserSettings);
  const updateUserSettings = useMutation(api.userSettings.updateUserSettings);

  useEffect(() => {
    if (userSettings) {
      setVatId(userSettings.vatId || "");
    }
  }, [userSettings]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await updateUserSettings({
        vatId: vatId.trim() || undefined,
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
