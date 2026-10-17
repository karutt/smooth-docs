type Point = { x: number; y: number };

// SVG importers often accept legacy RGB paint but not CSS Color 4's color(srgb).
function legacyPaint(value: string) {
    const match = value.match(/^color\(srgb\s+(.+)\)$/);
    if (!match) return value;
    const [channels, alpha] = match[1].split(/\s*\/\s*/);
    const rgb = channels.trim().split(/\s+/).map((channel) => {
        const fraction = channel.endsWith("%") ? parseFloat(channel) / 100 : Number(channel);
        return Math.round(Math.max(0, Math.min(1, fraction)) * 255);
    });
    if (rgb.length !== 3 || rgb.some((channel) => !Number.isFinite(channel))) {
        throw new Error(`Could not export SVG color: ${value}`);
    }
    const opacity = alpha?.endsWith("%") ? parseFloat(alpha) / 100 : Number(alpha ?? 1);
    return opacity === 1
        ? `rgb(${rgb.join(", ")})`
        : `rgba(${rgb.join(", ")}, ${opacity})`;
}

function markerDirection(element: Element, end: boolean) {
    let point: Point;
    let adjacent: Point;
    if (element.localName === "line") {
        const first = { x: Number(element.getAttribute("x1")), y: Number(element.getAttribute("y1")) };
        const last = { x: Number(element.getAttribute("x2")), y: Number(element.getAttribute("y2")) };
        point = end ? last : first;
        adjacent = end ? first : last;
    } else if (element.localName === "polyline" || element.localName === "polygon") {
        const numbers = (element.getAttribute("points") ?? "").match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
        const points: Point[] = [];
        for (let index = 0; index + 1 < numbers.length; index += 2) {
            points.push({ x: numbers[index], y: numbers[index + 1] });
        }
        if (element.localName === "polygon" && points.length) points.push(points[0]);
        if (points.length < 2) throw new Error("Could not find the SVG arrow direction.");
        point = end ? points[points.length - 1] : points[0];
        adjacent = end ? points[points.length - 2] : points[1];
    } else {
        const geometry = element as SVGGeometryElement;
        const length = geometry.getTotalLength();
        const step = Math.min(0.1, length / 2);
        point = geometry.getPointAtLength(end ? length : 0);
        adjacent = geometry.getPointAtLength(end ? length - step : step);
    }
    const dx = end ? point.x - adjacent.x : adjacent.x - point.x;
    const dy = end ? point.y - adjacent.y : adjacent.y - point.y;
    return { point, angle: Math.atan2(dy, dx) * 180 / Math.PI };
}

export function makeMermaidSvgPortable(svg: SVGElement, sourceSvg: SVGElement = svg) {
    const markers = new Map([...svg.querySelectorAll("marker")].map((marker) => [marker.id, marker]));
    const targets = [...svg.querySelectorAll("[marker-start], [marker-end]")];
    const sources = [...sourceSvg.querySelectorAll("[marker-start], [marker-end]")];

    // Materialize arrowheads: design tools can import the polygons/paths even
    // when they do not implement SVG's marker references.
    targets.forEach((target, index) => {
        for (const position of ["start", "end"] as const) {
            const property = `marker-${position}`;
            const reference = target.getAttribute(property)?.match(/url\(["']?#([^"')]+)["']?\)/);
            if (!reference) continue;
            const marker = markers.get(reference[1]);
            if (!marker) throw new Error("The SVG arrowhead definition was not found.");
            const { point, angle } = markerDirection(sources[index], position === "end");
            const orient = marker.getAttribute("orient") ?? "0";
            const rotation = orient.startsWith("auto")
                ? angle + (position === "start" && orient === "auto-start-reverse" ? 180 : 0)
                : parseFloat(orient);
            const scale = marker.getAttribute("markerUnits") === "userSpaceOnUse"
                ? 1 : parseFloat(target.getAttribute("stroke-width") ?? "1");
            const refX = Number(marker.getAttribute("refX") ?? 0);
            const refY = Number(marker.getAttribute("refY") ?? 0);
            const arrow = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
            arrow.setAttribute("data-svg-arrowhead", position);
            arrow.setAttribute("opacity", target.getAttribute("opacity") ?? "1");
            arrow.setAttribute("transform", [
                target.getAttribute("transform") ?? "",
                `translate(${point.x} ${point.y}) rotate(${rotation}) scale(${scale}) translate(${-refX} ${-refY})`,
            ].filter(Boolean).join(" "));
            for (const child of marker.children) arrow.append(child.cloneNode(true));
            target.after(arrow);
            target.removeAttribute(property);
            (target as SVGElement).style.removeProperty(property);
        }
    });
    svg.querySelectorAll("marker").forEach((marker) => marker.remove());

    for (const element of [svg, ...svg.querySelectorAll("*")]) {
        for (const property of ["fill", "stroke", "color", "stop-color", "flood-color"]) {
            const value = element.getAttribute(property);
            if (value) element.setAttribute(property, legacyPaint(value));
        }
    }
}
