import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { Toaster } from "sonner";
import { Card, CardContent } from "./components/ui/card";

import { api } from "../convex/_generated/api";
import { InvoiceManager } from "./InvoiceManager";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-12 flex justify-between items-center border-b shadow-sm px-3">
        <h2 className="text-sm font-semibold text-primary tracking-tight">Invoice Manager</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 p-4">
        <Content />
      </main>
      <Toaster richColors toastOptions={{ classNames: { toast: "text-xs" } }} />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Authenticated>
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-3">
            <InvoiceManager />
          </CardContent>
        </Card>
      </Authenticated>
      <Unauthenticated>
        <div className="max-w-sm mx-auto">
          <div className="text-center mb-4">
            <h1 className="text-lg font-semibold text-primary mb-1 tracking-tight">Invoice Manager</h1>
            <p className="text-xs text-secondary">Sign in to get started</p>
          </div>
          <SignInForm />
        </div>
      </Unauthenticated>
    </>
  );
}
