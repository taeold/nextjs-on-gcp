import { now } from "@/lib/utils";

export default async function TimeRevlidatedPage() {
  const resp = await fetch("https://httpbin.org/uuid", {
    next: {
      revalidate: 10,
    },
  });
  const { uuid } = await resp.json();
  return (
    <>
      <h2>A cached page</h2>
      <p className="text-gray-500">(should be regenerated every 10 seconds)</p>
      <p className="font-mono">Generated {now()}</p>
      <p className="font-mono">UUID: {uuid}</p>
    </>
  );
}
