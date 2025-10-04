import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { Toaster } from "sonner";

import { api } from "../convex/_generated/api";
import { InvoiceManager } from "./InvoiceManager";
import { SignInForm } from "./SignInForm";

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
        <InvoiceManager />
      </Authenticated>
      <Unauthenticated>
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="w-full max-w-sm">
            <div className="text-center mb-4">
              <h1 className="text-sm font-medium text-foreground">Invoice Manager</h1>
            </div>
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
    </>
  );
}
