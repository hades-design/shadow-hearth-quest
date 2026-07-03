import { createFileRoute } from "@tanstack/react-router";
import EldenGame from "@/components/EldenGame";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen py-6 px-4">
      <EldenGame />
    </main>
  );
}
