import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";

export function useFeatureFlagsDebugSetter() {
  const allFeatureFlags = useQuery(api.featureFlags.getAllFeatureFlags);
  const setFeatureFlag = useMutation(api.featureFlags.setFeatureFlag);

  useEffect(() => {
    if (allFeatureFlags && setFeatureFlag) {
      const flagMethods: Record<string, (enabled: boolean) => Promise<void>> = {};
      
      for (const flag of allFeatureFlags) {
        flagMethods[flag.flagName] = async (enabled: boolean) => {
          try {
            await setFeatureFlag({
              flagName: flag.flagName,
              enabled,
              description: flag.description,
            });
            console.log(`🎛️ Feature flag '${flag.flagName}' set to ${enabled}`);
            toast.success(`Feature flag '${flag.flagName}' set to ${enabled}`);
          } catch (error) {
            console.error(`❌ Failed to set feature flag '${flag.flagName}':`, error);
            toast.error(`Failed to set feature flag '${flag.flagName}'`);
          }
        };
      }
      
      // Expose to window object
      (window as any).__setFeatureFlag = flagMethods;
      
      // Also expose a helper to list all flags
      (window as any).__getFeatureFlags = () => {
        console.log("🎛️ Available feature flags:");
        allFeatureFlags.forEach(flag => {
          console.log(`  ${flag.flagName}: ${flag.enabled}${flag.description ? ` (${flag.description})` : ''}`);
        });
        return allFeatureFlags;
      };
      
      console.log("🎛️ Feature flag controls available:");
      console.log("  window.__setFeatureFlag.invoiceAnalysis(true/false)");
      console.log("  window.__getFeatureFlags()");
    }
  }, [allFeatureFlags, setFeatureFlag]);

  return {
    allFeatureFlags,
    setFeatureFlag,
  };
}
