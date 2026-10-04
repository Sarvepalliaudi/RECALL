import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RECALL — Personal AI Memory & Semantic Search",
  description: "Your devices remember files. RECALL remembers meaning.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RECALL",
  },
  authors: [{ name: "Audi Siva Bhanuvardhan Sarvepalli", url: "https://www.linkedin.com/in/audi-siva-bhanuvardhan-sarvepalli-4598a8289/" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#141923",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="bg-background text-foreground antialiased min-h-screen flex flex-col">
        {/* Anti-vibe Header: Dense, Functional, Direct */}
        <header className="border-b border-border bg-surface px-4 py-3 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-baseline gap-2 text-foreground font-mono font-bold tracking-tight text-lg">
              <span>RECALL</span>
              <span className="text-xs font-normal text-muted hidden sm:inline">v0.1.0</span>
            </a>
            <span className="text-xs text-muted border-l border-border pl-3 hidden md:inline">
              Your devices remember files. RECALL remembers meaning.
            </span>
          </div>

          <nav className="flex items-center gap-2 sm:gap-4 text-xs font-mono">
            <a href="/" className="px-2.5 py-1.5 rounded hover:bg-surface-raised text-foreground">
              Search
            </a>
            <a href="/devices" className="px-2.5 py-1.5 rounded hover:bg-surface-raised text-muted hover:text-foreground">
              Devices
            </a>
            <a href="/install" className="px-2.5 py-1.5 rounded hover:bg-surface-raised text-muted hover:text-foreground">
              Install PWA
            </a>
            <a href="/privacy" className="px-2.5 py-1.5 rounded hover:bg-surface-raised text-muted hover:text-foreground hidden lg:inline">
              Privacy
            </a>
            <a href="/security" className="px-2.5 py-1.5 rounded hover:bg-surface-raised text-muted hover:text-foreground hidden lg:inline">
              Security
            </a>
            <a href="/terms" className="px-2.5 py-1.5 rounded hover:bg-surface-raised text-muted hover:text-foreground hidden lg:inline">
              Terms
            </a>
          </nav>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col">{children}</main>

        {/* Footer with Attribution and Compliance */}
        <footer className="border-t border-border bg-surface py-4 px-4 sm:px-6 text-xs text-muted flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
          <div>
            Built by{" "}
            <a
              href="https://www.linkedin.com/in/audi-siva-bhanuvardhan-sarvepalli-4598a8289/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:underline"
            >
              Audi Siva Bhanuvardhan Sarvepalli
            </a>
          </div>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:underline">Privacy Policy</a>
            <a href="/security" className="hover:underline">Security</a>
            <a href="/terms" className="hover:underline">Terms</a>
            <a href="https://github.com/Sarvepalliaudi/RECALL.git" target="_blank" rel="noopener noreferrer" className="hover:underline">
              GitHub
            </a>
          </div>
        </footer>

        {/* PWA Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.warn('SW registration skipped:', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
