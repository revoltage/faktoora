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
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Invoice Manager
              </h1>
              <p className="text-slate-600 text-sm">Streamline your invoicing workflow</p>
            </div>
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
    </>
  );
}
