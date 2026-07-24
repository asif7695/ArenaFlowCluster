"use client";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useDash } from "@/lib/store";
import NodeInspector from "@/components/views/NodeInspector";

// Deep-linkable node detail: /node/node-27, /node/node-3, etc. Syncs the URL
// param into the store's `selected` state, which the existing polling effect
// (fetches GET /nodes/<id>) is already keyed on.
export default function NodePage() {
  const params = useParams<{ id: string }>();
  const { setSelected } = useDash();

  useEffect(() => {
    if (params.id) setSelected(params.id);
  }, [params.id, setSelected]);

  return <NodeInspector />;
}
