export default async function LoadingPage() {
  return (
    <div className="w-full animate-pulse">
      <div className="mb-10 h-6 w-2/5 rounded-full bg-gray-200 dark:bg-gray-300"></div>
      <div className="mb-8 h-4 w-4/5 rounded-full bg-gray-200 dark:bg-gray-300"></div>
      <div className="h-4 w-4/5 rounded-full bg-gray-200 dark:bg-gray-300"></div>
    </div>
  );
}
