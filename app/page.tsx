export default function Page() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "72px 24px",
        lineHeight: 1.55,
      }}
    >
      <div
        style={{
          border: "1px solid #2f3136",
          borderRadius: 18,
          padding: 28,
          background: "#18191c",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "5px 10px",
            borderRadius: 999,
            background: "#24262b",
            color: "#c7c9cf",
            fontSize: 13,
          }}
        >
          MCP online
        </div>
        <h1 style={{ marginBottom: 8 }}>Discord Admin MCP</h1>
        <p style={{ color: "#b7b9c0", marginTop: 0 }}>
          Private, OAuth-protected bridge between ChatGPT and a Discord bot.
        </p>
        <p style={{ color: "#8f9299" }}>
          MCP endpoint: <code>/mcp</code>
        </p>
      </div>
    </main>
  );
}
