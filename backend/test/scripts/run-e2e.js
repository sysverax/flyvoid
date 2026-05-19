const readline = require("node:readline");
const { spawn } = require("node:child_process");

const DEFAULT_URL = "http://127.0.0.1:8080";

const looksLikeRegexPattern = (value) => /[|()[\]^$*+?]/.test(value);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeTargetPath = (value) => {
    const input = (value || "").trim().replace(/^['\"]|['\"]$/g, "");

    if (!input) {
        return input;
    }

    let normalized = input.replace(/\\/g, "/").replace(/^\.\//, "");

    // If caller passes backend-relative paths (test/...), rebase to Jest rootDir (test).
    if (/^test\//i.test(normalized)) {
        normalized = normalized.slice(5);
    }

    // If caller passes absolute paths, keep only the segment under /test/.
    const testSegmentIndex = normalized.toLowerCase().lastIndexOf("/test/");
    if (testSegmentIndex >= 0) {
        normalized = normalized.slice(testSegmentIndex + "/test/".length);
    }

    return normalized;
};

const resolveTestTargetPattern = (targetPath) => {
    const rawInput = (targetPath || "").trim().replace(/^['\"]|['\"]$/g, "");
    const normalized = normalizeTargetPath(targetPath);

    if (!normalized) {
        return "";
    }

    // Keep explicit regex-like patterns unchanged.
    if (looksLikeRegexPattern(rawInput) && !rawInput.includes("*") && !/[\\/]/.test(rawInput)) {
        return rawInput;
    }

    // If an explicit spec file is provided, match exactly that file.
    if (/\.e2e-spec\.ts$/i.test(normalized)) {
        return `${escapeRegex(normalized)}$`;
    }

    // Interpret wildcard/folder input as recursive folder matcher.
    let folder = normalized
        .replace(/\*+/g, "")
        .replace(/\/+$/, "");

    if (!folder) {
        return ".*\\.e2e-spec\\.ts$";
    }

    return `${escapeRegex(folder)}\/.*\\.e2e-spec\\.ts$`;
};

const askServerUrl = () =>
    new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question(`Enter backend server URL (${DEFAULT_URL}): `, (input) => {
            rl.close();
            const value = (input || "").trim();
            resolve(value || DEFAULT_URL);
        });
    });

const isValidHttpUrl = (value) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
};

const run = async () => {
    const targetPath = process.argv[2];
    const useRunningApp = process.env.E2E_USE_RUNNING_APP !== "false";
    const baseUrl = useRunningApp ? await askServerUrl() : DEFAULT_URL;

    if (useRunningApp && !isValidHttpUrl(baseUrl)) {
        console.error(`[FAILED] Invalid URL: ${baseUrl}`);
        process.exit(1);
    }

    const jestArgs = ["./node_modules/jest/bin/jest.js", "--runInBand"];

    if (targetPath) {
        jestArgs.push("--testPathPatterns", resolveTestTargetPattern(targetPath));
    }

    jestArgs.push("--config", "./test/jest-e2e.json");

    if (useRunningApp) {
        console.log(`[SUITE] Running E2E against ${baseUrl}`);
    } else {
        console.log("[SUITE] Running E2E in internal mode (in-process Nest app)");
    }

    const runner = spawn(process.execPath, jestArgs, {
        stdio: "inherit",
        shell: false,
        env: {
            ...process.env,
            E2E_USE_RUNNING_APP: useRunningApp ? "true" : "false",
            E2E_BASE_URL: baseUrl,
        },
    });

    runner.on("exit", (code, signal) => {
        if (signal) {
            process.kill(process.pid, signal);
            return;
        }

        process.exit(code ?? 1);
    });

    runner.on("error", (error) => {
        console.error(`[FAILED] Unable to start Jest: ${error.message}`);
        process.exit(1);
    });
};

void run();
