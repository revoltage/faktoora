import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  return (
    <Card className="w-full border bg-white rounded-xl">
      <CardHeader className="px-6 pt-6 pb-4">
        <CardTitle className="text-base font-medium text-center">
          {flow === "signIn" ? "Sign in" : "Create account"}
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground text-center">
          {flow === "signIn"
            ? "Use your email and password"
            : "Start by entering your email and password"}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-4">
        <Tabs
          value={flow}
          onValueChange={(v) => setFlow(v as typeof flow)}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 h-9 mb-4">
            <TabsTrigger value="signIn" className="text-xs">
              Sign in
            </TabsTrigger>
            <TabsTrigger value="signUp" className="text-xs">
              Sign up
            </TabsTrigger>
          </TabsList>

          <TabsContent value={flow} className="mt-0">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitting(true);
                const formData = new FormData(e.target as HTMLFormElement);
                formData.set("flow", flow);
                void signIn("password", formData).catch((error) => {
                  const message = error.message.includes("Invalid password")
                    ? "Invalid password. Please try again."
                    : flow === "signIn"
                      ? "Could not sign in, did you mean to sign up?"
                      : "Could not sign up, did you mean to sign in?";
                  toast.error(message);
                  setSubmitting(false);
                });
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password" className="text-xs">
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="h-9 text-sm"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-9 text-sm"
              >
                {submitting ? (
                  <span>Processing…</span>
                ) : flow === "signIn" ? (
                  "Sign in"
                ) : (
                  "Create account"
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-4">
          <Separator />
        </div>
      </CardContent>

      <CardFooter className="px-6 pb-6">
        <Button
          variant="outline"
          className="w-full h-9 text-sm"
          onClick={() => void signIn("anonymous")}
        >
          Continue as guest
        </Button>
      </CardFooter>
    </Card>
  );
}
