export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logStartupStatus } = await import("@/lib/startup");
    logStartupStatus();
  }
}
