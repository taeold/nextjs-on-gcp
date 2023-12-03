import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  revalidatePath("/isr/demand");
  return new Response("Success!", { status: 200 });
}
