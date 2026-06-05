import { listDNAFactors, isValidDNAFactor, projectDNA } from "../dna/dna-projector.js";
import { renderDNAPlot2D } from "../ui/render-plot2d.js";

export default {
  name: "/plot2d",

  match: (input) =>
    input.startsWith("/plot2d"),

  execute: async ({
    input,
    engine,
  }) => {

    const [
      ,
      rawX = "CRE",
      rawY = "COL",
    ] = input.split(/\s+/);

    const axisX =
      rawX.toUpperCase();

    const axisY =
      rawY.toUpperCase();

    if (
      !isValidDNAFactor(axisX) ||
      !isValidDNAFactor(axisY)
    ) {

      console.log("");
      console.log(
        "Available DNA Factors:"
      );

      console.log(
        listDNAFactors().join(", ")
      );

      console.log("");

      return;
    }

    const points = [];

    for (const [id, cell] of engine.cells) {

      const profile =
        await cell.getEvolutionInfo();

      const projected =
        projectDNA(
          profile.dna,
          axisX,
          axisY
        );

      points.push({
        id,
        ...projected,
      });
    }

    renderDNAPlot2D(
      points,
      axisX,
      axisY
    );
  },
};
