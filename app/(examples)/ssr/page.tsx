import { now } from "@/lib/utils";

export default async function SsrPage() {
  const resp = await fetch("https://httpbin.org/uuid", {
    cache: "no-store",
  });
  const { uuid } = await resp.json();

  return (
    <>
      <h2>A server generated page! </h2>
      <p className="font-mono">Generated {now()}</p>
      <p className="font-mono">UUID: {uuid}</p>
    </>
  );
}
