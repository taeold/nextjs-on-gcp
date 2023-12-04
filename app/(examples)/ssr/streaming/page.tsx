import React from "react";
import { now } from "@/lib/utils";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function Skeleton() {
  return <p className="animate-pulse bg-red-100 font-mono">Loading...</p>;
}

async function SlowComponent() {
  await sleep(3000);
  return <p className="font-mono">Streaming!</p>;
}

export default async function SsrPage() {
  const resp = await fetch("https://httpbin.org/uuid", {
    cache: "no-store",
  });
  const { uuid } = await resp.json();
  await sleep(1000);

  return (
    <>
      <h2>A server-streamed page (intentionally slow)! </h2>
      <p className="font-mono">Generated {now()}</p>
      <p className="font-mono">UUID: {uuid}</p>
      <React.Suspense fallback={<Skeleton />}>
        <SlowComponent />
      </React.Suspense>
    </>
  );
}
