export const metadata = {
  title: "Discord Admin MCP",
  description: "Private MCP bridge for Discord server administration.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          background: "#111214",
          color: "#f4f4f5",
        }}
      >
        {children}
      </body>
    </html>
  );
}
