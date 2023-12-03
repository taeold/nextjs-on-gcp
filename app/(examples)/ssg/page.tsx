import { now } from "@/lib/utils";

export default async function SsgPage() {
  const resp = await fetch("https://httpbin.org/uuid");
  const { uuid } = await resp.json();
  return (
    <>
      <h2>A statically generated page! </h2>
      <p className="font-mono">Generated {now()}</p>
      <p className="font-mono">UUID: {uuid}</p>
    </>
  );
}
