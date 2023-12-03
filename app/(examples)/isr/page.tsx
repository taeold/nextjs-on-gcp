import { now } from "@/lib/utils";

export default function RevlidateRoutePage() {
  return (
    <>
      <h2>ISR Demo</h2>
      <ul>
        <li>
          <a href="/isr/time">Time-based revalidation</a>
        </li>
        <li>
          <a href="/isr/demand">On-demand revalidation</a>
        </li>
      </ul>
    </>
  );
}
