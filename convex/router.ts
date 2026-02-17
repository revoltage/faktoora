import { httpRouter } from "convex/server";
import {
  createUploadUrl,
  registerInvoice,
  registerStatement,
} from "./headlessApi";

const http = httpRouter();

http.route({
  path: "/api/v1/upload-url",
  method: "POST",
  handler: createUploadUrl,
});

http.route({
  path: "/api/v1/invoices",
  method: "POST",
  handler: registerInvoice,
});

http.route({
  path: "/api/v1/statements",
  method: "POST",
  handler: registerStatement,
});

export default http;
