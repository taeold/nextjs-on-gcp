"use client";

import { useRouter } from "next/navigation";

export default function RevalidateButton() {
  const router = useRouter();

  async function handleClick(e: any) {
    e.preventDefault();
    await fetch("/api/revalidate", { method: "POST" });
    location.reload();
  }

  return (
    <button
      type="button"
      className="me-2 inline-flex items-center rounded-lg bg-blue-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
      onClick={handleClick}
    >
      <svg
        className="me-2 h-8 w-8"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        width="24"
        fill="white"
      >
        <path d="M204-318q-22-38-33-78t-11-82q0-134 93-228t227-94h7l-64-64 56-56 160 160-160 160-56-56 64-64h-7q-100 0-170 70.5T240-478q0 26 6 51t18 49l-60 60ZM481-40 321-200l160-160 56 56-64 64h7q100 0 170-70.5T720-482q0-26-6-51t-18-49l60-60q22 38 33 78t11 82q0 134-93 228t-227 94h-7l64 64-56 56Z" />
      </svg>{" "}
      Regenerate Page
    </button>
  );
}
