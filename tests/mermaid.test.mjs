import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { renderMermaidSVG } from "beautiful-mermaid";
import { JSDOM } from "jsdom";
import { loadSmoothDocsConfig } from "../scripts/config.mjs";

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);
const parkingSequence = `sequenceDiagram
    actor User as 利用者
    participant Cam as カメラ
    participant LINE
    participant Shop as 店舗
    participant Parking as 駐車料金
    rect
        Note over User,Cam: 1. 入庫
        User->>Cam: 車が入庫
    end
    rect
        Note over Cam,LINE: 2. ナンバー読取
        Cam->>LINE: ナンバーを読み取る
    end
    rect
        Note over LINE,User: 3. 店舗・割引案内
        LINE-->>User: 店舗一覧・割引案内
    end
    rect
        Note over User,Shop: 4. 店舗利用
        User->>Shop: 買い物・食事
        Shop-->>User: レシートを受け取る
    end
    rect
        Note over User,Parking: 5. レシート送信・割引
        User->>LINE: レシートを送信
        LINE->>Parking: 割引を適用
        Parking-->>User: 割引後の駐車料金
    end`;

function documentFor(source) {
  return new JSDOM(renderMermaidSVG(source), { contentType: "image/svg+xml" }).window.document;
}

function polygonBounds(element) {
  const points = element.getAttribute("points").split(/\s+/).map((point) => point.split(",").map(Number));
  return {
    x: Math.min(...points.map(([x]) => x)),
    y: Math.min(...points.map(([, y]) => y)),
    right: Math.max(...points.map(([x]) => x)),
    bottom: Math.max(...points.map(([, y]) => y)),
  };
}

function rectBounds(element) {
  const x = Number(element.getAttribute("x"));
  const y = Number(element.getAttribute("y"));
  return { x, y, right: x + Number(element.getAttribute("width")), bottom: y + Number(element.getAttribute("height")) };
}

function assertContains(outer, inner) {
  assert.ok(outer.x < inner.x && outer.right > inner.right, "frame contains the full note width");
  assert.ok(outer.y < inner.y && outer.bottom > inner.bottom, "frame contains the full note height");
}

test("all five phase notes render inside their own rect without overlapping adjacent frames", () => {
  const doc = documentFor(parkingSequence);
  const notes = [...doc.querySelectorAll("g.note")];
  const frames = [...doc.querySelectorAll("g.block > rect:first-child")].map(rectBounds);
  assert.deepEqual(notes.map((note) => note.querySelector("text").textContent.trim()), [
    "1. 入庫", "2. ナンバー読取", "3. 店舗・割引案内", "4. 店舗利用", "5. レシート送信・割引",
  ]);
  assert.equal(frames.length, 5);
  const firstMessageIndices = [0, 1, 2, 3, 5];
  const messages = [...doc.querySelectorAll("g.message")];
  notes.forEach((note, index) => {
    const box = polygonBounds(note.querySelector("polygon"));
    assertContains(frames[index], box);
    const messageLabelY = Number(messages[firstMessageIndices[index]].querySelector("text").getAttribute("y"));
    assert.ok(box.bottom < messageLabelY, "phase heading precedes its first message with clearance");
    if (index > 0) assert.ok(frames[index - 1].bottom < frames[index].y, "adjacent phase frames do not overlap");
  });
  const actorLabel = doc.querySelector('g.actor[data-type="actor"] text');
  assert.ok(Number(actorLabel.getAttribute("y")) + 14 < frames[0].y, "first phase clears the actor label");
});

test("leading notes and note-only diagrams retain source order and multiline height", () => {
  const doc = documentFor(`sequenceDiagram
    participant A
    participant B
    Note left of A: Before first message
    Note over A,B: Line one<br/>Line two
    Note right of B: Last note`);
  const notes = [...doc.querySelectorAll("g.note")];
  assert.equal(notes.length, 3);
  assert.deepEqual(notes.map((note) => note.getAttribute("data-position")), ["left", "over", "right"]);
  const bounds = notes.map((note) => polygonBounds(note.querySelector("polygon")));
  assert.ok(bounds[0].bottom < bounds[1].y && bounds[1].bottom < bounds[2].y);
  assert.ok(bounds[1].bottom - bounds[1].y > bounds[0].bottom - bounds[0].y);
  assert.doesNotMatch(doc.documentElement.outerHTML, /(?:NaN|Infinity)/);
});

test("over notes fill the participant columns in either order and retain room for long text", () => {
  const doc = documentFor(`sequenceDiagram
    participant A as First
    participant B as A much wider participant
    participant C as Last
    Note over A,C: Span
    Note over C,A: Reverse
    Note over B: One column
    Note right of B: x
    Note over A,C: ${"Long note text ".repeat(12)}`);
  const actors = [...doc.querySelectorAll("g.actor > rect")].map(rectBounds);
  const notes = [...doc.querySelectorAll("g.note > polygon:first-child")].map(polygonBounds);
  for (const note of notes.slice(0, 2)) {
    assert.ok(Math.abs(note.x - actors[0].x) < 0.000001, "note starts at the first participant column");
    assert.ok(Math.abs(note.right - actors[2].right) < 0.000001, "note ends at the last participant column");
  }
  assert.ok(Math.abs(notes[2].x - actors[1].x) < 0.000001);
  assert.ok(Math.abs(notes[2].right - actors[1].right) < 0.000001);
  assert.ok(notes[3].x > actors[1].right, "right-of note remains beside its participant");
  assert.ok(notes[3].right - notes[3].x < actors[1].right - actors[1].x,
    "right-of note retains its compact text width");
  assert.ok(notes[4].x < actors[0].x && notes[4].right > actors[2].right,
    "long text can expand beyond the minimum column span");
});

test("notes inside empty blocks and trailing notes remain in the correct frame", () => {
  const doc = documentFor(`sequenceDiagram
    participant A
    participant B
    rect
        Note over A,B: Notes only
    end
    rect
        A->>B: Message
        Note right of B: Inside second block
    end
    Note over A: Outside all blocks`);
  const notes = [...doc.querySelectorAll("g.note")].map((note) => polygonBounds(note.querySelector("polygon")));
  const frames = [...doc.querySelectorAll("g.block > rect:first-child")].map(rectBounds);
  assertContains(frames[0], notes[0]);
  assertContains(frames[1], notes[1]);
  assert.ok(frames[0].bottom < frames[1].y);
  assert.ok(frames[1].bottom < notes[2].y, "outside note follows the last block");
});

test("notes after self messages clear the complete loop and the following message", () => {
  const doc = documentFor(`sequenceDiagram
    A->>A: Self message
    Note right of A: After the loop
    A->>B: Next message`);
  const loop = doc.querySelector("g.message polyline");
  const note = polygonBounds(doc.querySelector("g.note polygon"));
  assert.ok(polygonBounds(loop).bottom < note.y);
  const nextLabel = doc.querySelectorAll("g.message text")[1];
  assert.ok(note.bottom < Number(nextLabel.getAttribute("y")));
});

test("Markdown generation supplies both GitHub palettes and retains the five notes and eight autonumber badges", async (t) => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), "smooth-docs-mermaid-"));
  await mkdir(path.join(projectDir, "docs"));
  await writeFile(path.join(projectDir, "smooth-docs.yml"), "site_key: test\nsite_name: Mermaid Test\n");
  const numberedSequence = parkingSequence.replace("sequenceDiagram", "sequenceDiagram\n    autonumber");
  const unframedSequence = numberedSequence.replace(/^    (?:rect|end)\n/gm, "");
  await writeFile(path.join(projectDir, "docs/index.md"),
    "```mermaid\n" + numberedSequence + "\n```\n\n```mermaid\n" + unframedSequence + "\n```\n");
  const config = loadSmoothDocsConfig({ kitRoot, projectDir });
  t.after(async () => {
    await rm(projectDir, { recursive: true, force: true });
    await rm(path.dirname(config.generatedSiteDir), { recursive: true, force: true });
  });
  await execFileAsync(process.execPath, ["scripts/generate-content.mjs"], {
    cwd: kitRoot, env: { ...process.env, SMOOTH_DOCS_PROJECT_DIR: projectDir },
  });
  const generated = await readFile(path.join(config.generatedSiteDir, "docs-data.ts"), "utf8");
  // Generated data is JSON embedded in a TypeScript export, so decode its
  // escapes before parsing the emitted HTML/SVG.
  const match = generated.match(/export const docsData[^=]*= ([\s\S]*);\n$/);
  assert.ok(match, "generated module contains docs data");
  const data = JSON.parse(match[1]);
  const page = data.pages.find((page) => page.kind === "page");
  const doc = new JSDOM(page.html).window.document;
  const wrapper = doc.querySelector(".beautiful-mermaid--rendered");
  const svg = wrapper.querySelector("svg");
  assert.equal(wrapper.dataset.mermaidTheme, "github");
  assert.equal(svg.dataset.mermaidTheme, "github");
  assert.equal(svg.style.getPropertyValue("--bg"), "var(--docs-mermaid-bg)");
  assert.equal(svg.style.getPropertyValue("--accent"), "var(--docs-mermaid-accent)");
  assert.equal(svg.style.getPropertyValue("--border"), "var(--docs-mermaid-line)");
  assert.equal(svg.style.getPropertyValue("--muted"), "var(--docs-mermaid-fg)");
  assert.match(svg.style.getPropertyValue("--surface"), /^color-mix\(/);
  assert.equal(wrapper.style.backgroundColor, "var(--docs-mermaid-bg)");
  for (const element of [wrapper, svg]) {
    assert.equal(element.style.getPropertyValue("--docs-mermaid-light-bg"), "#ffffff");
    assert.equal(element.style.getPropertyValue("--docs-mermaid-light-fg"), "#1f2328");
    assert.equal(element.style.getPropertyValue("--docs-mermaid-light-accent"), "#0969da");
    assert.equal(element.style.getPropertyValue("--docs-mermaid-dark-bg"), "#0d1117");
    assert.equal(element.style.getPropertyValue("--docs-mermaid-dark-fg"), "#e6edf3");
    assert.equal(element.style.getPropertyValue("--docs-mermaid-dark-accent"), "#4493f8");
  }
  assert.equal(svg.querySelectorAll("g.note").length, 5);
  assert.equal(svg.querySelectorAll(".beautiful-mermaid-autonumber").length, 8);

  // Without rect frames, phase notes must clear both the preceding number
  // badge and the label of the next message.
  const unframedSvg = doc.querySelectorAll(".beautiful-mermaid--rendered > svg")[1];
  const notes = [...unframedSvg.querySelectorAll("g.note")];
  const messages = [...unframedSvg.querySelectorAll("g.message")];
  const firstMessageIndices = [0, 1, 2, 3, 5];
  notes.forEach((note, index) => {
    const box = polygonBounds(note.querySelector("polygon"));
    const nextLabel = messages[firstMessageIndices[index]].querySelector(":scope > text");
    assert.ok(Number(nextLabel.getAttribute("y")) - box.bottom >= 24,
      "phase note leaves room above the next message label");
    if (index === 0) return;
    const badge = messages[firstMessageIndices[index] - 1].querySelector(".beautiful-mermaid-autonumber circle");
    const badgeBottom = Number(badge.getAttribute("cy")) + Number(badge.getAttribute("r"));
    assert.ok(box.y - badgeBottom >= 16,
      "phase note leaves room below the preceding number badge");
  });
});
