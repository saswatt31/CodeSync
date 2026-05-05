"use client";
import { useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { getSocket } from "../../lib/socket";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export function Editor({ language, code, onCodeChange, sessionId, editorRef, monacoRef }) {
  
  const handleEditorChange = (value, event) => {
    onCodeChange(value, event);
  };

  return (
    <div className="flex-1 overflow-hidden relative">
      <MonacoEditor
        height="100%"
        language={language}
        value={code}
        theme="vs-dark"
        onChange={handleEditorChange}
        onMount={(editor, monaco) => {
          if (editorRef) editorRef.current = editor;
          if (monacoRef) monacoRef.current = monaco;
          
          const socket = getSocket();
          socket.emit("sync_code", { sessionId });
        }}
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: "on",
          wordWrap: "on",
          padding: { top: 16, bottom: 16 },
          smoothScrolling: true,
          cursorBlinking: "smooth",
          renderWhitespace: "none",
          bracketPairColorization: { enabled: true },
          "semanticHighlighting.enabled": true,
        }}
      />
    </div>
  );
}
