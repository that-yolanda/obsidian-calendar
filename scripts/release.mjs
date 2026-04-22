import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const version = args.find((arg) => arg !== "--dry-run");

if (!version) {
	console.error("Usage: pnpm release <version> [--dry-run]");
	process.exit(1);
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
	console.error(`Invalid version: ${version}`);
	process.exit(1);
}

const run = (command, commandArgs, options = {}) => {
	const printable = [command, ...commandArgs].join(" ");
	console.log(`> ${printable}`);

	if (dryRun) {
		return "";
	}

	return execFileSync(command, commandArgs, {
		stdio: "inherit",
		...options,
	});
};

const runAndCapture = (command, commandArgs) => {
	if (dryRun) {
		console.log(`> ${[command, ...commandArgs].join(" ")}`);
		return "";
	}

	return execFileSync(command, commandArgs, { encoding: "utf8" }).trim();
};

const gitStatus = runAndCapture("git", ["status", "--porcelain"]);
if (!dryRun && gitStatus) {
	console.error(
		"Working tree is not clean. Commit or stash changes before running pnpm release.",
	);
	process.exit(1);
}

// Read current files
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const versions = JSON.parse(readFileSync("versions.json", "utf8"));

// Bump version in all three files
packageJson.version = version;
manifest.version = version;
versions[version] = manifest.minAppVersion;

if (!dryRun) {
	writeFileSync("package.json", `${JSON.stringify(packageJson, null, "\t")}\n`);
	writeFileSync("manifest.json", `${JSON.stringify(manifest, null, "\t")}\n`);
	writeFileSync("versions.json", `${JSON.stringify(versions, null, "\t")}\n`);
	console.log(`Version bumped to ${version} in package.json, manifest.json, versions.json`);
} else {
	console.log(`[dry-run] Would bump version to ${version}`);
}

const releaseTitle = `chore(release): publish ${version}`;
const existingTag = runAndCapture("git", ["tag", "--list", version]);
if (!dryRun && existingTag) {
	console.error(`Git tag ${version} already exists`);
	process.exit(1);
}

run("pnpm", ["lint"]);
run("pnpm", ["build"]);
run("git", ["add", "package.json", "manifest.json", "versions.json"]);
const stagedChanges = runAndCapture("git", ["diff", "--cached", "--name-only"]);
if (stagedChanges) {
	run("git", ["commit", "-m", releaseTitle]);
} else {
	console.log("> skip git commit (no staged changes)");
}
run("git", ["tag", version]);
run("git", ["push", "origin", "HEAD"]);
run("git", ["push", "origin", version]);
