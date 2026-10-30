import { createFileRoute } from "@tanstack/react-router";

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
  return (
    <iframe
      src="/raizes.html"
      title="Raízes"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
}
