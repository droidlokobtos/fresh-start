import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Raízes | Árvore Genealógica" },
      { name: "description", content: "Cadastre familiares, relacionamentos e histórias da sua árvore genealógica." },
      { property: "og:title", content: "Raízes | Árvore Genealógica" },
      { property: "og:description", content: "Cadastre familiares, relacionamentos e histórias da sua árvore genealógica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const frame = useRef<HTMLIFrameElement>(null);
  const sendConfiguration = () => {
    frame.current?.contentWindow?.postMessage({ type: "raizes-cloud-config", config: { url: import.meta.env.VITE_SUPABASE_URL, key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }, window.location.origin);
  };
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === "raizes-cloud-ready") sendConfiguration();
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  return (
    <iframe
      ref={frame}
      onLoad={sendConfiguration}
      src="/raizes.html"
      title="Raízes"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
}
