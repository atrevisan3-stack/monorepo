const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const services = [];
let requestShutdown;
const shutdownRequested = new Promise((resolve) => {
  requestShutdown = resolve;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    console.log("\nStopping the simulation...");
    requestShutdown();
  });
}

function startService(name, entryPoint, port, extraEnv = {}) {
  const child = spawn(process.execPath, [path.join(root, entryPoint)], {
    cwd: root,
    env: { ...process.env, PORT: String(port), ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.closeResult = new Promise((resolve) => {
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  services.push(child);
  return child;
}

async function waitForHealthy(child, name, port) {
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`${name} exited before becoming healthy`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`, {
        signal: AbortSignal.timeout(1000)
      });
      if (response.ok) {
        console.log(`${name} is healthy on port ${port}.`);
        return;
      }
    } catch (error) {
      if (error.name !== "AbortError" && error.name !== "TimeoutError" && error.cause?.code !== "ECONNREFUSED") {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`${name} did not become healthy on port ${port}`);
}

async function assertHealthy(name, port) {
  const response = await fetch(`http://127.0.0.1:${port}/healthz`, {
    signal: AbortSignal.timeout(1000)
  });
  if (!response.ok) {
    throw new Error(`${name} healthcheck failed: HTTP ${response.status}`);
  }
}

async function stopService(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return child.closeResult;
  }

  child.kill("SIGTERM");
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(null), 5000);
  });
  const result = await Promise.race([child.closeResult, timeout]);
  clearTimeout(timeoutId);
  if (result === null) {
    child.kill("SIGKILL");
    return child.closeResult;
  }

  return result;
}

async function main() {
  const autoStopDelay = process.env.SIMULATION_AUTO_STOP_MS
    ? Number(process.env.SIMULATION_AUTO_STOP_MS)
    : null;
  if (autoStopDelay !== null && (!Number.isFinite(autoStopDelay) || autoStopDelay < 0)) {
    throw new Error("SIMULATION_AUTO_STOP_MS must be a non-negative number");
  }

  const tier2 = startService("Tier 2", "apps/tier-2-notifications/server.js", 3002);
  const tier1 = startService("Tier 1", "apps/tier-1-api/server.js", 3001, {
    SIMULATE_CRASH_AFTER_MS: "5000"
  });

  await Promise.all([
    waitForHealthy(tier1, "Tier 1", 3001),
    waitForHealthy(tier2, "Tier 2", 3002)
  ]);
  console.log("Waiting for the simulated fatal error in Tier 1...");

  const tier1Exit = await tier1.closeResult;
  if (tier1Exit.code !== 1) {
    throw new Error(`Expected Tier 1 to exit with code 1, received ${JSON.stringify(tier1Exit)}`);
  }

  await assertHealthy("Tier 2 after Tier 1 failure", 3002);

  console.log("Tier 1 failed. Tier 2 is still healthy and remains running.");
  if (autoStopDelay === null) {
    console.log("Press Ctrl+C to stop Tier 2 and finish the simulation.");
    await shutdownRequested;
  } else {
    console.log(`Verifying Tier 2 remains healthy for ${autoStopDelay} ms...`);
    await new Promise((resolve) => setTimeout(resolve, autoStopDelay));
    await assertHealthy("Tier 2 after verification period", 3002);
    console.log("Tier 2 remained healthy after the Tier 1 failure.");
  }

  const tier2Exit = await stopService(tier2);
  if (tier2Exit.code !== 0 && tier2Exit.signal !== "SIGTERM") {
    throw new Error(`Expected Tier 2 to stop cleanly, received ${JSON.stringify(tier2Exit)}`);
  }
  console.log("Simulation complete: Tier 2 was stopped after verification.");
}

main()
  .catch((error) => {
    console.error(`Simulation failed: ${error.message}`);
    process.exitCode = 1;
  }).finally(async () => {
    if (process.exitCode !== 0) {
      await Promise.all(services.map(stopService));
    }
  });
