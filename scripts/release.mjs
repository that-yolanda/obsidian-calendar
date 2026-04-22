import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

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

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const versions = JSON.parse(readFileSync("versions.json", "utf8"));

if (packageJson.version !== version) {
	console.error(
		`package.json version mismatch: expected ${version}, got ${packageJson.version}`,
	);
	process.exit(1);
}

if (manifest.version !== version) {
	console.error(
		`manifest.json version mismatch: expected ${version}, got ${manifest.version}`,
	);
	process.exit(1);
}

if (!(version in versions)) {
	console.error(`versions.json is missing version ${version}`);
	process.exit(1);
}

if (versions[version] !== manifest.minAppVersion) {
	console.error(
		`versions.json minAppVersion mismatch: expected ${manifest.minAppVersion}, got ${versions[version]}`,
	);
	process.exit(1);
}

if (packageJson.name !== manifest.id) {
	console.error(
		`package name and manifest id mismatch: ${packageJson.name} !== ${manifest.id}`,
	);
	process.exit(1);
}

const releaseTitle = `chore(release): publish ${version}`;
const existingTag = runAndCapture("git", ["tag", "--list", version]);
if (!dryRun && existingTag) {
	console.error(`Git tag ${version} already exists`);
	process.exit(1);
}

run("pnpm", ["lint"]);
run("pnpm", ["build"]);
run("git", [
	"add",
	"package.json",
	"manifest.json",
	"versions.json",
]);
run("git", ["commit", "-m", releaseTitle]);
run("git", ["tag", version]);
run("git", ["push", "origin", "HEAD"]);
run("git", ["push", "origin", version]);
