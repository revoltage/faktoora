import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useFeatureFlagsDebugSetter() {
  const allFeatureFlags = useQuery(api.featureFlags.getAllFeatureFlags);

  return {
    allFeatureFlags,
  };
}
