import { internalMutation } from "./_generated/server";

// Convex-recommended seeding approach
export const seedFeatureFlags = internalMutation(async (ctx) => {
  console.log("🌱 Seeding feature flags...");
  
  // Check if already seeded to avoid duplicates
  const existingFlags = await ctx.db.query("featureFlags").collect();
  if (existingFlags.length > 0) {
    console.log("⏭️ Feature flags already seeded, skipping");
    return;
  }

  // Seed default feature flags
  await ctx.db.insert("featureFlags", {
    flagName: "invoiceAnalysis",
    enabled: false, // Start with OFF as requested
    description: "Enable AI-powered invoice analysis",
    updatedAt: Date.now(),
  });

  await ctx.db.insert("featureFlags", {
    flagName: "invoiceParsing", 
    enabled: false, // Start with OFF as requested
    description: "Enable invoice parsing functionality",
    updatedAt: Date.now(),
  });

  console.log("✅ Feature flags seeded successfully");
});
