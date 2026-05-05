"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login as loginApi } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";
// M-3: Import from shared module, not from peer register/page (breaks cross-route coupling)
import { AuthLayout, Field, ErrorBanner, SubmitBtn } from "../../../components/auth/AuthComponents";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await loginApi(form);
      login(data.user, data.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your CodeSync account"
      link={{ href: "/auth/register", label: "No account?", cta: "Create one" }}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <Field
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
        />
        <Field
          label="Password"
          type="password"
          placeholder="Your password"
          value={form.password}
          onChange={(v) => setForm({ ...form, password: v })}
        />
        <SubmitBtn loading={loading} label="Sign in" />
      </form>
    </AuthLayout>
  );
}
