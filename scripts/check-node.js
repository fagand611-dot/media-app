// Fail fast, with a clear message, when Node is too old for node:sqlite.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`\nTastemate needs Node.js 22.13 or newer. You have ${process.version}.`);
  console.error('Install the current LTS from https://nodejs.org, then run the command again.\n');
  process.exit(1);
}
