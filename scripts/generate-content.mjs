import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";
import matter from "gray-matter";
import { renderMermaidSVG } from "beautiful-mermaid";
import hljs from "highlight.js";
import katex from "katex";
import MarkdownIt from "markdown-it";
import { loadSmoothDocsConfig } from "./config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const config = loadSmoothDocsConfig({ kitRoot: rootDir });

const site = process.argv[2] || config.siteKey;
if (site !== config.siteKey) {
  throw new Error(`Unknown docs site: ${site}`);
}

const oppositeSite = site;
const sourceDir = config.docsDir;
const generatedDir = path.join(rootDir, ".generated", site);
const publicDir = path.join(generatedDir, "public");

const siteTitle = config.siteName;
const AUTONUMBER_PREFIX = "__beautiful_mermaid_autonumber_";
const AUTONUMBER_PATTERN = /__beautiful_mermaid_autonumber_(\d+)__\s*/g;

await fs.mkdir(sourceDir, { recursive: true });
await fs.rm(generatedDir, { recursive: true, force: true });
await fs.mkdir(generatedDir, { recursive: true });
await fs.mkdir(publicDir, { recursive: true });

const markdownFiles = await fg("**/*.md", {
  cwd: sourceDir,
  dot: false,
  onlyFiles: true,
});

const assetFiles = await fg("**/*", {
  cwd: sourceDir,
  dot: false,
  onlyFiles: true,
  ignore: ["**/*.md"],
});
const assetDimensions = await collectAssetDimensions(assetFiles);

await Promise.all(
  assetFiles.map(async (relativePath) => {
    const from = path.join(sourceDir, relativePath);
    const to = path.join(publicDir, "docs-assets", relativePath);
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(from, to);
  }),
);

const pages = [];
for (const relativePath of markdownFiles.sort()) {
  const absolutePath = path.join(sourceDir, relativePath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const parsed = matter(raw);
  const route = toRoute(relativePath);
  const pageDir = path.posix.dirname(relativePath) === "." ? "" : path.posix.dirname(relativePath);
  const title = parsed.data.title || firstHeading(parsed.content) || titleFromPath(relativePath);
  const markdown = parsed.content.trim();
  const html = renderMarkdown(markdown, { pageDir });

  pages.push({
    title,
    url: route,
    sourcePath: `${site}/docs/${relativePath}`,
    absolutePath,
    markdown: raw,
    html,
    text: plainText(markdown),
    order: getOrder(relativePath, parsed.data),
    relativePath,
  });
}

if (pages.length === 0) {
  const markdown = `# ${siteTitle}\n\nNo pages yet.`;
  pages.push({
    title: siteTitle,
    url: "/",
    sourcePath: `${site}/docs/index.md`,
    absolutePath: path.join(sourceDir, "index.md"),
    markdown,
    html: renderMarkdown(markdown, { pageDir: "" }),
    text: plainText(markdown),
    order: 0,
    relativePath: "index.md",
  });
}

pages.sort(comparePages);

const docsData = {
  site,
  siteTitle,
  oppositeSite,
  devPorts: {
    [site]: 8100,
  },
  pages: pages.map(({ order, relativePath, ...page }) => page),
  nav: buildNav(pages),
};

const output = `import type { DocsData } from "../../src/types";\n\nexport const docsData: DocsData = ${JSON.stringify(
  docsData,
  null,
  2,
)};\n`;

await fs.writeFile(path.join(generatedDir, "docs-data.ts"), output);

async function collectAssetDimensions(relativePaths) {
  const dimensions = new Map();

  await Promise.all(
    relativePaths.map(async (relativePath) => {
      const normalizedPath = relativePath.replace(/\\/g, "/");
      if (!/\.(gif|jpe?g|png|webp)$/i.test(normalizedPath)) return;

      try {
        const buffer = await fs.readFile(path.join(sourceDir, relativePath));
        const imageSize = readImageSize(buffer);
        if (imageSize) dimensions.set(normalizedPath, imageSize);
      } catch (error) {
        console.warn(`Unable to read image dimensions for ${relativePath}: ${error.message}`);
      }
    }),
  );

  return dimensions;
}

function readImageSize(buffer) {
  return readPngSize(buffer) ?? readJpegSize(buffer) ?? readGifSize(buffer) ?? readWebpSize(buffer);
}

function readPngSize(buffer) {
  if (
    buffer.length < 24 ||
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47
  ) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readJpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;

    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > buffer.length) break;

    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;

    if (isJpegStartOfFrame(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += length;
  }

  return null;
}

function isJpegStartOfFrame(marker) {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    ![0xc4, 0xc8, 0xcc].includes(marker)
  );
}

function readGifSize(buffer) {
  const signature = buffer.subarray(0, 6).toString("ascii");
  if (buffer.length < 10 || (signature !== "GIF87a" && signature !== "GIF89a")) return null;

  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
}

function readWebpSize(buffer) {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return null;
  }

  const chunkType = buffer.subarray(12, 16).toString("ascii");

  if (chunkType === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (chunkType === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunkType === "VP8L" && buffer.length >= 25) {
    const value = buffer.readUInt32LE(21);
    return {
      width: (value & 0x3fff) + 1,
      height: ((value >> 14) & 0x3fff) + 1,
    };
  }

  return null;
}

function renderMarkdown(markdown, env) {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    highlight(code, lang) {
      return renderHighlightedCodeBlock(code, lang);
    },
  });

  md.renderer.rules.heading_open = (tokens, index, options, rendererEnv, self) => {
    const content = tokens[index + 1]?.content ?? "";
    const id = uniqueSlug(content, rendererEnv.slugCounts);
    tokens[index].attrSet("id", id);
    return self.renderToken(tokens, index, options);
  };

  md.renderer.rules.fence = (tokens, index, options, rendererEnv, self) => {
    const token = tokens[index];
    const lang = token.info.trim().split(/\s+/)[0];
    if (lang === "mermaid") {
      return `${renderMermaidBlock(token.content)}\n`;
    }
    return `${renderHighlightedCodeBlock(token.content, token.info)}\n`;
  };

  md.block.ruler.before("fence", "math_block", mathBlockRule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
  md.renderer.rules.math_block = (tokens, index) => `${renderMathBlock(tokens[index].content)}\n`;
  md.inline.ruler.after("escape", "math_inline", mathInlineRule);
  md.renderer.rules.math_inline = (tokens, index) => renderMathInline(tokens[index].content);

  const defaultImage =
    md.renderer.rules.image ||
    ((tokens, index, options, rendererEnv, self) =>
      self.renderToken(tokens, index, options));
  md.renderer.rules.image = (tokens, index, options, rendererEnv, self) => {
    const token = tokens[index];
    const sourceIndex = token.attrIndex("src");
    if (sourceIndex >= 0) {
      const source = token.attrs[sourceIndex][1];
      const localAssetPath = resolveLocalAssetPath(source, rendererEnv.pageDir);
      const dimensions = localAssetPath ? assetDimensions.get(localAssetPath) : null;

      if (dimensions && token.attrIndex("width") < 0 && token.attrIndex("height") < 0) {
        token.attrSet("width", String(dimensions.width));
        token.attrSet("height", String(dimensions.height));
      }

      if (token.attrIndex("decoding") < 0) token.attrSet("decoding", "async");
      if (token.attrIndex("draggable") < 0) token.attrSet("draggable", "false");

      token.attrs[sourceIndex][1] = rewriteAssetUrl(source, rendererEnv.pageDir);
    }
    return defaultImage(tokens, index, options, rendererEnv, self);
  };

  const defaultLink =
    md.renderer.rules.link_open ||
    ((tokens, index, options, rendererEnv, self) =>
      self.renderToken(tokens, index, options));
  md.renderer.rules.link_open = (tokens, index, options, rendererEnv, self) => {
    const token = tokens[index];
    const hrefIndex = token.attrIndex("href");
    if (hrefIndex >= 0) {
      token.attrs[hrefIndex][1] = rewriteMarkdownLink(
        token.attrs[hrefIndex][1],
        rendererEnv.pageDir,
      );
    }
    return defaultLink(tokens, index, options, rendererEnv, self);
  };

  md.renderer.rules.table_open = () =>
    '<div class="not-prose relative w-full overflow-auto my-6 text-foreground"><table class="w-full caption-bottom text-sm">\n';
  md.renderer.rules.table_close = () => "</table></div>\n";
  md.renderer.rules.thead_open = () => '<thead class="[&_tr]:border-b">\n';
  md.renderer.rules.tbody_open = () => '<tbody class="[&_tr:last-child]:border-0">\n';
  md.renderer.rules.tr_open = () =>
    '<tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">\n';
  md.renderer.rules.th_open = () =>
    '<th class="h-12 px-4 text-left align-middle font-medium text-foreground [&:has([role=checkbox])]:pr-0">';
  md.renderer.rules.td_open = () =>
    '<td class="p-4 align-middle text-foreground [&:has([role=checkbox])]:pr-0">';

  const withAccordions = expandAccordions(markdown, (innerMarkdown) =>
    md.render(innerMarkdown, { ...env, slugCounts: new Map() }),
  );

  return md.render(withAccordions, { ...env, slugCounts: new Map() });
}

function renderMermaidBlock(source) {
  const cleanSource = source.trim();

  try {
    const svg = enhanceAutonumberBadges(
      normalizeMermaidSvg(
        renderMermaidSVG(prepareMermaidSource(cleanSource), {
          bg: "hsl(var(--background))",
          fg: "hsl(var(--foreground))",
          line: "hsl(var(--border))",
          accent: "hsl(var(--foreground))",
          muted: "hsl(var(--foreground))",
          surface: "hsl(var(--card))",
          border: "hsl(var(--border))",
          transparent: true,
          padding: 32,
        }),
      ),
    );

    return `<div class="beautiful-mermaid beautiful-mermaid--rendered" data-mermaid-source="${escapeHtml(cleanSource)}">${svg}</div>`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Mermaid diagram render failed: ${message}`);
    return `<div class="beautiful-mermaid beautiful-mermaid--error"><p>Mermaid 図の描画に失敗しました。</p><pre><code>${escapeHtml(cleanSource)}</code></pre></div>`;
  }
}

function normalizeMermaidSvg(svg) {
  return svg
    .replace(/\s*@import url\('[^']+'\);\n?/g, "\n")
    .replace(
      /text \{ font-family: [^}]+ \}/,
      'text { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }',
    );
}

function prepareMermaidSource(source) {
  return applyAutonumber(normalizeFlowchartSubgraphs(source));
}

function normalizeFlowchartSubgraphs(source) {
  const lines = source.split("\n");
  const isFlowchart = lines.some((line) => /^(graph|flowchart)\s+/i.test(line.trim()));
  if (!isFlowchart) return source;

  let index = 0;
  return lines
    .map((line) => {
      const match = line.match(/^(\s*)subgraph\s+(.+?)\s*$/i);
      if (!match) return line;

      const [, indent, label] = match;
      if (label.includes("[")) return line;

      index += 1;
      return `${indent}subgraph smooth_subgraph_${index}["${escapeMermaidLabel(label)}"]`;
    })
    .join("\n");
}

function escapeMermaidLabel(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function applyAutonumber(source) {
  const lines = source.split("\n");
  const isSequenceDiagram = lines.some((line) => line.trim().toLowerCase() === "sequencediagram");
  if (!isSequenceDiagram) return source;

  let enabled = false;
  let counter = 1;
  let step = 1;
  const nextLines = [];

  for (const line of lines) {
    const autonumber = parseAutonumberDirective(line);
    if (autonumber) {
      enabled = true;
      counter = autonumber.start;
      step = autonumber.step;
      continue;
    }

    if (enabled && isSequenceMessageLine(line)) {
      nextLines.push(addAutonumberPrefix(line, counter));
      counter += step;
      continue;
    }

    nextLines.push(line);
  }

  return nextLines.join("\n");
}

function parseAutonumberDirective(line) {
  const match = line.trim().match(/^autonumber(?:\s+(\d+)(?:\s+(\d+))?)?$/i);
  if (!match) return null;

  return {
    start: match[1] ? Number(match[1]) : 1,
    step: match[2] ? Number(match[2]) : 1,
  };
}

function isSequenceMessageLine(line) {
  return /^(\S+?)\s*(--?>?>|--?[)x]|--?>>|--?>|->>|-->>|-\)|--\)|-x|--x|->|-->)\s*[+-]?(\S+?)\s*:\s*(.+)$/.test(
    line.trim(),
  );
}

function addAutonumberPrefix(line, number) {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return line;
  return `${line.slice(0, colonIndex + 1)} ${AUTONUMBER_PREFIX}${number}__ ${line
    .slice(colonIndex + 1)
    .trimStart()}`;
}

function enhanceAutonumberBadges(svg) {
  return svg.replace(/<g class="message"[\s\S]*?<\/g>/g, (message) => {
    const numberMatch = message.match(/__beautiful_mermaid_autonumber_(\d+)__\s*/);
    if (!numberMatch) return message;

    const number = numberMatch[1];
    const start = getArrowStartFromMessage(message);
    const cleanedMessage = message.replace(AUTONUMBER_PATTERN, "");
    if (!start) return cleanedMessage;

    const badgeSize = number.length >= 3 ? 19 : 15.5;
    const badgeRadius = badgeSize / 2;
    const badgeGap = 8;
    const badgeCx = start.direction >= 0 ? start.x - badgeRadius - badgeGap : start.x + badgeRadius + badgeGap;
    const badgeCy = start.y;
    const badgeSvg = [
      `<g class="beautiful-mermaid-autonumber" aria-label="message ${escapeAttr(number)}">`,
      `<circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeRadius}" fill="var(--beautiful-mermaid-autonumber-bg)" stroke="var(--beautiful-mermaid-autonumber-border)" stroke-width="1" />`,
      `<text x="${badgeCx}" y="${badgeCy}" font-size="${number.length >= 3 ? 8 : 9}" text-anchor="middle" font-weight="700" fill="var(--beautiful-mermaid-autonumber-text)" dy="3.15">${escapeHtml(number)}</text>`,
      `</g>`,
    ].join("");

    return cleanedMessage.replace(/(<text\b)/, `${badgeSvg}\n  $1`);
  });
}

function getArrowStartFromMessage(message) {
  const lineMatch = message.match(/<line\b[^>]*\bx1="([^"]+)"[^>]*\by1="([^"]+)"[^>]*\bx2="([^"]+)"/);
  if (lineMatch) {
    const x1 = Number(lineMatch[1]);
    const y1 = Number(lineMatch[2]);
    const x2 = Number(lineMatch[3]);
    return { x: x1, y: y1, direction: x2 >= x1 ? 1 : -1 };
  }

  const polylineMatch = message.match(/<polyline\b[^>]*\bpoints="([^"]+)"/);
  const points = polylineMatch?.[1]?.trim().split(/\s+/);
  if (points?.[0]) {
    const [x, y] = points[0].split(",").map(Number);
    const [nextX] = (points[1] || points[0]).split(",").map(Number);
    return { x, y, direction: nextX >= x ? 1 : -1 };
  }

  return null;
}

function expandAccordions(source, renderInner) {
  const lines = source.split(/\r?\n/);
  const out = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isFenceLine(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }

    if (inFence) {
      out.push(line);
      continue;
    }

    const accordion = parseAccordionStart(line);
    if (!accordion) {
      out.push(line);
      continue;
    }

    const parsed = readAccordion(lines, i + 1, accordion, renderInner);
    if (!parsed) {
      out.push(line);
      continue;
    }

    out.push("", renderAccordionMarker(parsed.data), "");
    i = parsed.endIndex;
  }

  return out.join("\n");
}

function readAccordion(lines, startIndex, accordion, renderInner) {
  const items = [];
  let currentItem = null;
  let inFence = false;

  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    if (isFenceLine(line)) {
      inFence = !inFence;
      if (currentItem) currentItem.body.push(line);
      continue;
    }

    if (!inFence) {
      const nextItem = parseAccordionItemStart(line);
      if (nextItem) {
        if (currentItem) items.push(renderAccordionItem(currentItem, renderInner));
        currentItem = nextItem;
        continue;
      }

      if (line.trim() === "::") {
        if (currentItem) {
          items.push(renderAccordionItem(currentItem, renderInner));
          currentItem = null;
          continue;
        }

        return {
          data: {
            multiple: accordion.multiple,
            items,
          },
          endIndex: i,
        };
      }
    }

    if (currentItem) {
      currentItem.body.push(line);
      continue;
    }

    if (line.trim() !== "") return null;
  }

  return null;
}

function parseAccordionStart(line) {
  const match = line.match(/^::accordion(?:\{([^}]*)\})?\s*$/);
  if (!match) return null;

  const options = parseBraceOptions(match[1]);
  return {
    multiple: options.has("multiple"),
  };
}

function parseAccordionItemStart(line) {
  const match = line.match(/^::item\[(.+?)\](?:\{([^}]*)\})?\s*$/);
  if (!match) return null;

  const options = parseBraceOptions(match[2]);
  return {
    title: match[1].trim(),
    open: options.has("open"),
    body: [],
  };
}

function parseBraceOptions(value) {
  return new Set(
    (value || "")
      .split(/[,\s]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function renderAccordionItem(item, renderInner) {
  return {
    title: item.title,
    open: item.open,
    html: renderInner(item.body.join("\n").trim()),
  };
}

function renderAccordionMarker(data) {
  return `<div data-docs-accordion="${encodeBase64Json(data)}"></div>`;
}

function encodeBase64Json(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function isFenceLine(line) {
  return /^ {0,3}(```|~~~)/.test(line);
}

function isMathFenceLine(line) {
  return /^ {0,3}\$\$\s*$/.test(line);
}

function mathBlockRule(state, startLine, endLine, silent) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const opener = state.src.slice(start, max);
  if (!isMathFenceLine(opener)) return false;
  if (silent) return true;

  let nextLine = startLine + 1;
  let contentEndLine = endLine;
  let hasClosingFence = false;

  for (; nextLine < endLine; nextLine += 1) {
    const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
    const lineMax = state.eMarks[nextLine];
    const line = state.src.slice(lineStart, lineMax);
    if (isMathFenceLine(line)) {
      contentEndLine = nextLine;
      hasClosingFence = true;
      nextLine += 1;
      break;
    }
  }

  const token = state.push("math_block", "math", 0);
  token.block = true;
  token.content = state.getLines(startLine + 1, contentEndLine, state.blkIndent, true);
  token.map = [startLine, hasClosingFence ? nextLine : contentEndLine];
  state.line = hasClosingFence ? nextLine : endLine;
  return true;
}

function isValidMathInlineDelim(state, pos) {
  const max = state.posMax;
  const prevChar = pos > 0 ? state.src.charCodeAt(pos - 1) : -1;
  const nextChar = pos + 1 <= max ? state.src.charCodeAt(pos + 1) : -1;

  let canOpen = true;
  let canClose = true;

  // A closing "$" must not sit right after whitespace or right before a digit
  // (so plain currency like "$5" and "5 $" is left untouched).
  if (prevChar === 0x20 || prevChar === 0x09 || (nextChar >= 0x30 && nextChar <= 0x39)) {
    canClose = false;
  }
  if (nextChar === 0x20 || nextChar === 0x09) {
    canOpen = false;
  }

  return { canOpen, canClose };
}

function mathInlineRule(state, silent) {
  if (state.src[state.pos] !== "$") return false;

  const open = isValidMathInlineDelim(state, state.pos);
  if (!open.canOpen) {
    if (!silent) state.pending += "$";
    state.pos += 1;
    return true;
  }

  // Skip properly escaped "$" until an unescaped closing delimiter is found.
  const start = state.pos + 1;
  let match = start;
  while ((match = state.src.indexOf("$", match)) !== -1) {
    let pos = match - 1;
    while (state.src[pos] === "\\") pos -= 1;
    if ((match - pos) % 2 === 1) break;
    match += 1;
  }

  if (match === -1) {
    if (!silent) state.pending += "$";
    state.pos = start;
    return true;
  }

  if (match - start === 0) {
    if (!silent) state.pending += "$$";
    state.pos = start + 1;
    return true;
  }

  const close = isValidMathInlineDelim(state, match);
  if (!close.canClose) {
    if (!silent) state.pending += "$";
    state.pos = start;
    return true;
  }

  if (!silent) {
    const token = state.push("math_inline", "math", 0);
    token.markup = "$";
    token.content = state.src.slice(start, match);
  }

  state.pos = match + 1;
  return true;
}

function normalizeHighlightLanguage(value) {
  const raw = value?.trim().split(/\s+/)[0]?.toLowerCase();
  if (!raw) return null;

  const aliases = {
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rb: "ruby",
    sh: "bash",
    shell: "bash",
    ts: "typescript",
    tsx: "typescript",
    yml: "yaml",
    md: "markdown",
  };
  const language = aliases[raw] || raw;
  return hljs.getLanguage(language) ? language : null;
}

function getCodeBlockLabel(value) {
  return value?.trim().split(/\s+/)[0]?.toLowerCase() || "text";
}

function renderHighlightedCodeBlock(code, lang) {
  const language = normalizeHighlightLanguage(lang);
  if (!language) {
    return renderCodeBlock({
      code: escapeHtml(code),
      language: getCodeBlockLabel(lang),
    });
  }

  const highlighted = hljs.highlight(code, {
    language,
    ignoreIllegals: true,
  }).value;
  return renderCodeBlock({
    code: highlighted,
    language,
  });
}

function renderCodeBlock({ code, language }) {
  const safeLanguage = escapeAttr(language || "text") || "text";
  const languageClass = `language-${safeLanguage}`;

  return [
    `<figure class="docs-code-block" data-language="${safeLanguage}">`,
    `<figcaption class="docs-code-block-header">`,
    `<span class="docs-code-block-label">${escapeHtml(safeLanguage)}</span>`,
    `<button type="button" class="docs-code-copy" aria-label="Copy code">Copy</button>`,
    `</figcaption>`,
    `<pre class="hljs ${languageClass}"><code class="${languageClass}">${code}</code></pre>`,
    `</figure>`,
  ].join("");
}

function renderMathBlock(source) {
  const cleanSource = source.trim();
  const safeSource = escapeAttr(cleanSource);

  if (!cleanSource) {
    return `<figure class="docs-math-block" data-math-source="${safeSource}"><div class="docs-math-placeholder">Empty equation</div></figure>`;
  }

  const html = katex.renderToString(normalizeKatexCompatibleSource(cleanSource), {
    displayMode: true,
    output: "html",
    strict: false,
    throwOnError: false,
  });
  return `<figure class="docs-math-block" data-math-source="${safeSource}">${html}</figure>`;
}

function renderMathInline(source) {
  const cleanSource = source.trim();
  const safeSource = escapeAttr(cleanSource);

  if (!cleanSource) {
    return `<span class="docs-math-inline" data-math-source="${safeSource}"></span>`;
  }

  const html = katex.renderToString(normalizeKatexCompatibleSource(cleanSource), {
    displayMode: false,
    output: "html",
    strict: false,
    throwOnError: false,
  });
  return `<span class="docs-math-inline" data-math-source="${safeSource}">${html}</span>`;
}

function normalizeKatexCompatibleSource(source) {
  return source
    .replace(/\\begin\{eqnarray\*?\}/g, "\\begin{aligned}")
    .replace(/\\end\{eqnarray\*?\}/g, "\\end{aligned}");
}

function buildNav(pageList) {
  const root = [];
  const byKey = new Map();

  for (const page of pageList) {
    const segments = page.relativePath.split("/");
    const isIndex = segments[segments.length - 1] === "index.md";
    const dirs = isIndex ? segments.slice(0, -1) : segments.slice(0, -1);
    let current = root;
    let key = "";

    for (const dir of dirs) {
      key = key ? `${key}/${dir}` : dir;
      if (!byKey.has(key)) {
        const node = {
          title: titleFromSegment(dir),
          url: toRoute(`${key}/index.md`),
          order: orderFromSegment(dir),
          children: [],
        };
        byKey.set(key, node);
        current.push(node);
      }
      const node = byKey.get(key);
      current = node.children;
    }

    if (isIndex && dirs.length > 0) {
      const node = byKey.get(dirs.join("/"));
      node.title = page.title;
      node.url = page.url;
      node.order = page.order;
    } else {
      current.push({
        title: page.title,
        url: page.url,
        order: page.order,
        children: [],
      });
    }
  }

  sortNav(root);
  return root;
}

function sortNav(items) {
  items.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ja"));
  items.forEach((item) => sortNav(item.children));
}

function comparePages(a, b) {
  const aSegments = a.relativePath.split("/");
  const bSegments = b.relativePath.split("/");
  const min = Math.min(aSegments.length, bSegments.length);
  for (let i = 0; i < min; i += 1) {
    const orderDiff = orderFromSegment(aSegments[i]) - orderFromSegment(bSegments[i]);
    if (orderDiff !== 0) return orderDiff;
    const textDiff = aSegments[i].localeCompare(bSegments[i], "ja");
    if (textDiff !== 0) return textDiff;
  }
  return aSegments.length - bSegments.length;
}

function getOrder(relativePath, data) {
  if (typeof data.nav_order === "number") return data.nav_order;
  if (relativePath === "index.md") return 0;
  if (relativePath.endsWith("/index.md")) {
    return orderFromSegment(relativePath.split("/").at(-2) || relativePath);
  }
  return orderFromSegment(relativePath.split("/").pop() || relativePath);
}

function orderFromSegment(segment) {
  const match = segment.match(/^(\d+)/);
  return match ? Number(match[1]) : 9999;
}

function toRoute(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  if (normalized === "index.md") return "/";
  if (normalized.endsWith("/index.md")) {
    return `/${normalized.slice(0, -"index.md".length)}`;
  }
  return `/${normalized.replace(/\.md$/, "")}/`;
}

function titleFromPath(relativePath) {
  const filename = relativePath.split("/").pop() || relativePath;
  return titleFromSegment(filename.replace(/\.md$/, ""));
}

function titleFromSegment(segment) {
  return segment
    .replace(/\.md$/, "")
    .replace(/^\d+[_-]/, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function firstHeading(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

function plainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^::accordion(?:\{[^}]*\})?\s*$/gm, " ")
    .replace(/^::item\[(.+?)\](?:\{[^}]*\})?\s*$/gm, "$1")
    .replace(/^::\s*$/gm, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rewriteAssetUrl(value, pageDir) {
  if (!value || isExternal(value) || value.startsWith("/") || value.startsWith("#")) {
    return value;
  }
  const [pathname, suffix = ""] = splitUrl(value);
  const target = normalizeLocalAssetPath(pathname, pageDir);
  if (!target) return value;
  return `/docs-assets/${site}/${target}${suffix}`;
}

function resolveLocalAssetPath(value, pageDir) {
  if (!value || isExternal(value) || value.startsWith("/") || value.startsWith("#")) {
    return null;
  }

  const [pathname] = splitUrl(value);
  return normalizeLocalAssetPath(pathname, pageDir);
}

function normalizeLocalAssetPath(pathname, pageDir) {
  if (!pathname) return null;

  let decodedPathname = pathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    decodedPathname = pathname;
  }

  const target = path.posix.normalize(path.posix.join(pageDir, decodedPathname));
  if (target === ".." || target.startsWith("../")) return null;

  return target;
}

function rewriteMarkdownLink(value, pageDir) {
  if (!value || isExternal(value) || value.startsWith("/") || value.startsWith("#")) {
    return value;
  }
  const [pathname, suffix = ""] = splitUrl(value);
  if (!pathname.endsWith(".md")) return value;
  const target = path.posix.normalize(path.posix.join(pageDir, pathname));
  return `${toRoute(target)}${suffix}`;
}

function splitUrl(value) {
  const match = value.match(/^([^?#]*)([?#].*)?$/);
  return [match?.[1] ?? value, match?.[2] ?? ""];
}

function isExternal(value) {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//");
}

function uniqueSlug(value, used) {
  const base = slugify(value) || "section";
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}
