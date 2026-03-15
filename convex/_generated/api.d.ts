/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as featureFlags from "../featureFlags.js";
import type * as http from "../http.js";
import type * as invoiceAnalysis from "../invoiceAnalysis.js";
import type * as invoiceParsing from "../invoiceParsing.js";
import type * as invoiceParsingMutations from "../invoiceParsingMutations.js";
import type * as invoices from "../invoices.js";
import type * as lib_pdfParser from "../lib/pdfParser.js";
import type * as refundMatching from "../refundMatching.js";
import type * as router from "../router.js";
import type * as seed from "../seed.js";
import type * as userSettings from "../userSettings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  featureFlags: typeof featureFlags;
  http: typeof http;
  invoiceAnalysis: typeof invoiceAnalysis;
  invoiceParsing: typeof invoiceParsing;
  invoiceParsingMutations: typeof invoiceParsingMutations;
  invoices: typeof invoices;
  "lib/pdfParser": typeof lib_pdfParser;
  refundMatching: typeof refundMatching;
  router: typeof router;
  seed: typeof seed;
  userSettings: typeof userSettings;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
