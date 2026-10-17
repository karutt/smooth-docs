import { describe, expect, it } from "vitest";
import { makeMermaidSvgPortable } from "../themes/default/src/lib/mermaid-svg";

function svgFor(body: string) {
    return new DOMParser().parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`, "image/svg+xml",
    ).documentElement as unknown as SVGSVGElement;
}

const markers = `<defs>
    <marker id="arrow" markerWidth="8" markerHeight="5" refX="8" refY="2.5" orient="auto-start-reverse">
        <polygon points="0 0, 8 2.5, 0 5" fill="rgb(9, 105, 218)"/>
    </marker>
    <marker id="open" markerWidth="8" markerHeight="5" refX="8" refY="2.5" orient="auto">
        <polyline points="0 0, 8 2.5, 0 5" fill="none" stroke="rgb(9, 105, 218)"/>
    </marker>
</defs>`;

describe("portable Mermaid SVG", () => {
    it("exports the light participant cards and folded notes with legacy RGB fills", () => {
        const svg = svgFor(`<rect fill="color(srgb 0.973647 0.974118 0.974706)"/>
            <polygon fill="color(srgb 0.894588 0.896471 0.898824)"/>
            <circle fill="color(srgb 0.1 0.2 0.3 / 50%)"/>`);
        makeMermaidSvgPortable(svg);
        expect(svg.querySelector("rect")?.getAttribute("fill")).toBe("rgb(248, 248, 249)");
        expect(svg.querySelector("polygon")?.getAttribute("fill")).toBe("rgb(228, 229, 229)");
        expect(svg.querySelector("circle")?.getAttribute("fill")).toBe("rgba(26, 51, 77, 0.5)");
        expect(svg.outerHTML).not.toContain("color(srgb");
    });

    it("embeds forward and reverse arrowheads at the endpoint with stroke-width scaling", () => {
        const svg = svgFor(`${markers}
            <line x1="70" y1="100" x2="210" y2="100" stroke-width="1px" marker-end="url(#arrow)"/>
            <line x1="350" y1="150" x2="70" y2="150" stroke-width="2px" marker-end="url(#arrow)"/>`);
        makeMermaidSvgPortable(svg);
        const arrows = [...svg.querySelectorAll("[data-svg-arrowhead]")];
        expect(arrows).toHaveLength(2);
        expect(arrows[0].getAttribute("transform")).toBe("translate(210 100) rotate(0) scale(1) translate(-8 -2.5)");
        expect(arrows[1].getAttribute("transform")).toBe("translate(70 150) rotate(180) scale(2) translate(-8 -2.5)");
        expect(arrows.map((arrow) => arrow.querySelector("polygon")?.getAttribute("fill"))).toEqual([
            "rgb(9, 105, 218)", "rgb(9, 105, 218)",
        ]);
        expect(svg.querySelectorAll("marker, [marker-end]")).toHaveLength(0);
    });

    it("retains open arrowheads, start orientation, and self-message end direction", () => {
        const svg = svgFor(`${markers}
            <line x1="10" y1="20" x2="10" y2="80" stroke-width="1" marker-start="url(#arrow)"/>
            <polyline points="10,20 40,20 40,50 10,50" stroke-width="1" marker-end="url(#open)"/>`);
        makeMermaidSvgPortable(svg);
        const arrows = [...svg.querySelectorAll("[data-svg-arrowhead]")];
        expect(arrows[0].getAttribute("transform")).toBe("translate(10 20) rotate(270) scale(1) translate(-8 -2.5)");
        expect(arrows[1].getAttribute("transform")).toBe("translate(10 50) rotate(180) scale(1) translate(-8 -2.5)");
        expect(arrows[1].querySelector("polyline")?.getAttribute("fill")).toBe("none");
        expect(arrows[1].querySelector("polyline")?.getAttribute("stroke")).toBe("rgb(9, 105, 218)");
    });
});
