import { getStation } from "@station/api";

const [, , command, mode, fixture, packId] = process.argv;

async function main(): Promise<void> {
  if (command !== "replay") {
    process.stderr.write("usage: station replay --mode recorded <fixture.jsonl> [packId]\n");
    process.exit(1);
  }
  if (mode !== "--mode" && mode !== "recorded") {
    process.stderr.write("only --mode recorded is wired. live is nightly.\n");
    process.exit(1);
  }
  const path = fixture === "recorded" ? packId : fixture;
  const pack = fixture === "recorded" ? process.argv[5] : packId;
  const station = getStation({ seed: false });
  const rows = await station.replay.replayCompare(path ?? "fixtures/sales-week.jsonl", pack ?? "sales");
  process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
}

await main();
