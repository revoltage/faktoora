import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { Toaster } from "sonner";

import { api } from "../convex/_generated/api";
import { AuthenticationPage } from "./pages/AuthenticationPage";
import { InvoiceManagerPage } from "./pages/InvoiceManagerPage";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Content />
      <Toaster richColors toastOptions={{ classNames: { toast: "text-xs" } }} />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-200 border-t-indigo-600"></div>
      </div>
    );
  }

  return (
    <>
      <Authenticated>
        <InvoiceManagerPage />
      </Authenticated>
      <Unauthenticated>
        <AuthenticationPage />
      </Unauthenticated>
    </>
  );
}
