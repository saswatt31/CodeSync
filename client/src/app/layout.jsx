import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import ErrorBoundary from "../components/ErrorBoundary";

export const metadata = {
  title: "CodeSync — Real-time Collaborative Code Interviews",
  description: "A professional platform for live technical interviews with AI-powered code review.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-background">
        <AuthProvider>
          <ErrorBoundary>
          {/* Subtle grid background */}
          <div className="fixed inset-0 -z-10 pointer-events-none">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)
                `,
                backgroundSize: "40px 40px",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
          </div>
          {children}
          </ErrorBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}
