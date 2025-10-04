import { SignInForm } from "@/components/SignInForm";

export function AuthenticationPage() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-4">
          <h1 className="text-sm font-medium text-foreground">Facktoora</h1>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}
