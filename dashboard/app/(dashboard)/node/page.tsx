import { redirect } from "next/navigation";

// /node with no id -> a sensible default (the planted-failure node, D4).
export default function NodeIndexPage() {
  redirect("/node/node-27");
}
