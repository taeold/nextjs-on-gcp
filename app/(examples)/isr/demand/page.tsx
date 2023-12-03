import { now } from "@/lib/utils";
import RevalidateButton from "./revalidateButton";

export default async function DemandRevlidatedPage() {
  const resp = await fetch("https://httpbin.org/uuid", {
    next: {
      revalidate: 100000,
      tags: ["uuid"],
    },
  });
  const { uuid } = await resp.json();
  return (
    <>
      <h2>A cached page</h2>
      <RevalidateButton />
      <p className="font-mono">Generated {now()}</p>
      <p className="font-mono">UUID: {uuid}</p>
    </>
  );
}
